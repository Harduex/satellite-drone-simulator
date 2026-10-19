import * as Cesium from "cesium";
import { DronePhysics } from "../core/physics/DronePhysics";
import { BlackboxLogger, type BlackboxReport } from "../core/physics/BlackboxLogger";
import { WindModel } from "../core/physics/WindModel";
import { resolveWindConfig } from "../core/physics/WindConfig";
import { FlightController } from "../core/flight-controller/FlightController";
import { GamepadManager } from "../core/input/GamepadManager";
import { KeyboardInput } from "../core/input/KeyboardInput";
import { FPVCamera, DEFAULT_CAMERA_CONFIG } from "../camera/FPVCamera";
import { DroneRenderer } from "../world/DroneRenderer";
import { CrashDetector } from "./CrashDetector";
import { TelemetryPublisher } from "./TelemetryPublisher";
import { FlightNavigation } from "./FlightNavigation";
import type { DroneAudio } from "./DroneAudio";
import { TerrainSampler } from "../world/TerrainSampler";
import { ContactSampler } from '../world/ContactSampler';
import { SurfaceContact } from '../core/physics/SurfaceContact';
import { isRecoveryShortcut } from './recoveryShortcut';
import { useStore } from "../store";
import type {
  DroneState,
  PhysicsConfig,
  RatesConfig,
  StickInputs,
  Vector3,
} from "../core/physics/types";
import { vec3, quatFromEuler } from "../core/physics/types";
import { createDefaultDroneState } from "../core/physics/types";

const MAX_PHYSICS_SUBSTEPS = 50;
// Preserve real-time flight down to 10 FPS, but discard long stall time.
const MAX_WALL_DT = MAX_PHYSICS_SUBSTEPS / 500;
const MAX_RECOVERY_DISTANCE = 20;

export class GameLoop {
  private running = false;
  private physicsAccumulator = 0;
  private readonly PHYSICS_DT = 1 / 500;
  private lastTimestamp = 0;
  private lastMotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };
  private stickInputs: StickInputs = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };

  private droneState: DroneState;
  private droneStateBuffer: DroneState;
  private physics: DronePhysics;
  private readonly blackboxLogger = new BlackboxLogger();
  private readonly windModel = new WindModel();
  private readonly windVelocity: Vector3 = { x: 0, y: 0, z: 0 };
  private flightController: FlightController;
  private gamepadManager: GamepadManager;
  private keyboardInput: KeyboardInput;
  private fpvCamera: FPVCamera;
  private droneRenderer: DroneRenderer;
  private crashDetector: CrashDetector;
  private telemetryPublisher: TelemetryPublisher;
  private navigation: FlightNavigation;
  private enuFrame: Cesium.Matrix4;
  private viewer: Cesium.Viewer;
  private terrainSampler: TerrainSampler;
  private preUpdateListener: Cesium.Event.RemoveCallback | null = null;
  private sceneExclusions: object[];
  private resetListener: (() => void) | null = null;

  private spawnAltitude: number;
  private spawnPosition: Vector3;
  private lastSafePosition: Vector3;
  private readonly contactSampler: ContactSampler;
  private readonly surfaceContact: SurfaceContact;
  private contactRadius: number;
  private supported = false;
  private hasImpactAnchor = false;
  private readonly impactAnchor = { x: 0, y: 0, z: 0 };
  private readonly recoveryPosition = { x: 0, y: 0, z: 0 };
  private readonly handleRecoveryKey = (event: KeyboardEvent) => {
    if (!this.running || !isRecoveryShortcut(event)) return;
    event.preventDefault();
    this.recover();
  };
  private audio?: DroneAudio;

  constructor(params: {
    viewer: Cesium.Viewer;
    enuFrame: Cesium.Matrix4;
    physicsConfig: PhysicsConfig;
    ratesConfig: RatesConfig;
    terrainSampler: TerrainSampler;
    initialPosition?: Vector3;
    sceneExclusions?: object[];
    audio?: DroneAudio;
  }) {
    this.viewer = params.viewer;
    this.enuFrame = params.enuFrame;
    this.spawnAltitude = params.physicsConfig.spawnAltitude;
    this.spawnPosition = params.initialPosition ?? vec3(0, 0, this.spawnAltitude);
    this.lastSafePosition = { ...this.spawnPosition };
    this.terrainSampler = params.terrainSampler;
    this.sceneExclusions = params.sceneExclusions ?? [];
    this.audio = params.audio;

    this.physics = new DronePhysics(params.physicsConfig);
    this.surfaceContact = new SurfaceContact(params.physicsConfig);
    this.contactSampler = new ContactSampler(params.terrainSampler);
    this.contactRadius = params.physicsConfig.armLength + (params.physicsConfig.rotorDiameter ?? 0.13) / 2;
    this.windModel.setConfig(resolveWindConfig(params.physicsConfig));
    this.flightController = new FlightController(
      params.ratesConfig,
    );
    this.gamepadManager = new GamepadManager();
    this.keyboardInput = new KeyboardInput();

    // Apply FOV and camera tilt from settings store
    const { fov: storeFov, cameraTilt: storeCameraTilt } = useStore.getState();
    this.fpvCamera = new FPVCamera({
      ...DEFAULT_CAMERA_CONFIG,
      fov: storeFov,
      tiltDegrees: storeCameraTilt,
    });

    this.droneRenderer = new DroneRenderer();
    this.crashDetector = new CrashDetector();
    this.telemetryPublisher = new TelemetryPublisher();
    this.telemetryPublisher.setOnPublish((data) => {
      useStore.getState().updateTelemetry(data);
    });

    this.droneState = createDefaultDroneState(this.spawnPosition);
    this.droneStateBuffer = createDefaultDroneState(this.spawnPosition);
    useStore.getState().resetTelemetry();
    this.navigation = new FlightNavigation(this.enuFrame, this.spawnPosition);
    this.publishNavigation(performance.now());
  }

  /** Register a callback for crash events */
  onCrash(callback: () => void): void {
    this.crashDetector.setOnCrash(callback);
  }

  onReset(callback: () => void): void { this.resetListener = callback; }

  setSceneExclusions(objects: readonly object[]): void {
    this.sceneExclusions = [...objects];
    const drone = this.droneRenderer.getEntity();
    this.terrainSampler.setExclusions(drone ? [...objects, drone] : [...objects]);
  }

  /** Push current store settings into all live subsystems (call on resume) */
  applyStoreSettings(): void {
    const store = useStore.getState();
    this.physics.updateConfig(store.physicsConfig);
    this.surfaceContact.updateConfig(store.physicsConfig);
    this.contactRadius = store.physicsConfig.armLength + (store.physicsConfig.rotorDiameter ?? 0.13) / 2;
    this.windModel.setConfig(resolveWindConfig(store.physicsConfig));
    this.flightController.updateRates(store.rates);
    this.fpvCamera.setFov(store.fov);
    this.fpvCamera.setTiltDegrees(store.cameraTilt);
  }

  start(): void {
    this.audio?.play();
    this.running = true;
    this.lastTimestamp = performance.now();
    this.physicsAccumulator = 0;

    // Initialize subsystems
    this.fpvCamera.init(this.viewer);
    this.droneRenderer.init(this.viewer);

    // Exclude the drone entity (and other scene objects like clouds) from
    // terrain height sampling so sampleHeight() doesn't read the drone's
    // own depth-buffer pixel as "ground height."
    const exclusions: object[] = [...this.sceneExclusions];
    const droneEntity = this.droneRenderer.getEntity();
    if (droneEntity) {
      exclusions.push(droneEntity);
    }
    this.terrainSampler.setExclusions(exclusions);

    this.gamepadManager.startPolling();
    this.keyboardInput.start();
    window.addEventListener('keydown', this.handleRecoveryKey);

    // Run physics + camera sync in preUpdate so the camera position is current
    // before Cesium's tile traversal — photoreal 3D refinement tracks movement
    // reliably, and we avoid a redundant second sync in a preRender listener.
    this.preUpdateListener = this.viewer.scene.preUpdate.addEventListener(
      () => {
        this.tick(performance.now());
      },
    );
  }

  stop(): void {
    this.audio?.pause();
    this.running = false;
    if (this.preUpdateListener) {
      this.preUpdateListener();
      this.preUpdateListener = null;
    }
    this.gamepadManager.stopPolling();
    this.keyboardInput.stop();
    window.removeEventListener('keydown', this.handleRecoveryKey);
    useStore.getState().updateLiveSticks({ throttle: 0, yaw: 0, roll: 0, pitch: 0 });
    this.droneRenderer.destroy();
  }

  reset(): void {
    this.resetAtPosition(this.spawnPosition);
    this.resetListener?.();
  }

  private resetAtPosition(position: Vector3): void {
    this.droneState = createDefaultDroneState(position);
    Object.assign(this.lastSafePosition, position);
    this.physics.reset();
    this.blackboxLogger.reset();
    this.windModel.reset();
    this.windModel.updateInto(0, this.windVelocity);
    this.flightController.reset();
    this.telemetryPublisher.reset();
    this.crashDetector.reset();
    this.contactSampler.reset();
    this.supported = false;
    this.hasImpactAnchor = false;
    this.keyboardInput.reset();
    this.lastMotorCommands.m1 = 0; this.lastMotorCommands.m2 = 0;
    this.lastMotorCommands.m3 = 0; this.lastMotorCommands.m4 = 0;
    this.physicsAccumulator = 0;
    useStore.getState().resetTelemetry();
    this.navigation.reset();
    this.publishNavigation(performance.now());
  }

  recover(): boolean {
    const { position, quaternion: q } = this.droneState;
    const anchor = this.hasImpactAnchor ? this.impactAnchor : position;
    const dx = anchor.x - this.lastSafePosition.x;
    const dy = anchor.y - this.lastSafePosition.y;
    const nearby = dx * dx + dy * dy <= MAX_RECOVERY_DISTANCE * MAX_RECOVERY_DISTANCE;
    const candidate = nearby ? this.lastSafePosition : anchor;
    const destination = this.recoveryPosition;
    if (!this.contactSampler.findClearPosition(candidate, this.contactRadius, destination)
      && !this.contactSampler.findClearPosition(anchor, this.contactRadius, destination)
      && !this.contactSampler.findClearPosition(this.spawnPosition, this.contactRadius, destination)) {
      useStore.getState().setRecoveryUnavailable(true);
      return false;
    }
    const yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
    this.resetAtPosition(destination);
    this.droneState.quaternion = quatFromEuler(0, 0, yaw);
    this.resetListener?.();
    return true;
  }

  private tick(timestamp: number): void {
    if (!this.running) return;

    // Compute wall clock delta
    let wallDt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Clamp to prevent spiral of death
    if (wallDt > MAX_WALL_DT) wallDt = MAX_WALL_DT;
    if (wallDt <= 0) return;

    // 2. Sample terrain height at drone position (once per render frame)
    const planes = this.contactSampler.prepare(this.droneState, this.contactRadius, wallDt, timestamp / 1000);
    const groundHeight = this.contactSampler.groundHeight ?? this.terrainSampler.getGroundHeight();
    if (this.contactSampler.groundHeight !== null && !this.contactSampler.overlap
      && this.droneState.position.z - groundHeight >= 2 && !this.crashDetector.disabled) {
      Object.assign(this.lastSafePosition, this.droneState.position);
    }
    const godMode = useStore.getState().godMode;
    const recoveryUnavailable = useStore.getState().recoveryUnavailable;

    // 3. Flight controller + physics substeps at fixed 500Hz
    this.physicsAccumulator += wallDt;
    let steps = 0;
    while (
      this.physicsAccumulator >= this.PHYSICS_DT && steps < MAX_PHYSICS_SUBSTEPS
    ) {
      this.stickInputs = this.gamepadManager.read() ?? this.keyboardInput.read(this.PHYSICS_DT);
      if (this.crashDetector.disabled || recoveryUnavailable || (this.supported && this.stickInputs.throttle < 0.02)) {
        this.lastMotorCommands.m1 = 0; this.lastMotorCommands.m2 = 0;
        this.lastMotorCommands.m3 = 0; this.lastMotorCommands.m4 = 0;
        this.flightController.reset();
      } else this.flightController.updateInto(
        this.stickInputs,
        this.droneState,
        this.PHYSICS_DT,
        this.lastMotorCommands,
      );
      this.windModel.updateInto(this.PHYSICS_DT, this.windVelocity);
      this.physics.stepInto(
        this.droneState,
        this.lastMotorCommands,
        this.PHYSICS_DT,
        groundHeight,
        this.droneStateBuffer,
        this.windVelocity,
        false,
      );
      const contact = this.surfaceContact.resolve(this.droneState, this.droneStateBuffer, planes, this.PHYSICS_DT);
      this.supported = contact.supported;
      const disabled = this.crashDetector.check(contact, this.droneStateBuffer, godMode, this.PHYSICS_DT);
      if (disabled && !this.hasImpactAnchor) {
        Object.assign(this.impactAnchor, this.droneState.position);
        this.hasImpactAnchor = true;
      }
      // Swap references (zero allocation ping-pong)
      const tmp = this.droneState;
      this.droneState = this.droneStateBuffer;
      this.droneStateBuffer = tmp;
      this.blackboxLogger.recordStep(
        this.PHYSICS_DT,
        this.stickInputs,
        this.droneState,
        this.lastMotorCommands,
        this.physics.getMotorModel().state.rpm,
        groundHeight,
      );
      this.physicsAccumulator -= this.PHYSICS_DT;
      steps++;
    }

    useStore.getState().setFlightCondition(this.crashDetector.disabled ? 'disabled'
      : this.contactSampler.overlap ? 'geometry' : this.crashDetector.hasImpactFeedback ? 'impact'
      : this.supported ? 'landed' : 'flying');
    const audioSettings = useStore.getState();
    this.audio?.update(this.physics.getMotorModel().state.rpm, audioSettings.audioVolume, audioSettings.physicsConfig.maxThrottleRpm,
      Math.hypot(this.droneState.velocity.x - this.windVelocity.x,
        this.droneState.velocity.y - this.windVelocity.y, this.droneState.velocity.z - this.windVelocity.z));
    if (useStore.getState().showStickOverlay) {
      useStore.getState().updateLiveSticks(this.stickInputs);
    }

    // 4. Sync camera to physics state
    this.fpvCamera.sync(this.droneState, this.enuFrame);

    // 5. Update drone renderer position (reuse ECEF from camera sync)
    this.droneRenderer.update(this.fpvCamera.getLastEcefPosition());
    this.publishNavigation(timestamp);

    // 6. Publish telemetry (throttled to ~10Hz)
    this.telemetryPublisher.maybePublish(
      this.droneState,
      this.stickInputs.throttle,
      groundHeight,
      this.windVelocity,
    );

  }

  getDroneState(): DroneState {
    return this.droneState;
  }

  exportTelemetryReport(): BlackboxReport {
    const store = useStore.getState();
    return this.blackboxLogger.exportReport(store.physicsConfig, store.rates);
  }

  private publishNavigation(timestamp: number): void {
    const snapshot = this.navigation.update(this.droneState, timestamp);
    if (snapshot) useStore.getState().updateNavigation(snapshot);
  }

  getEnuFrame(): Cesium.Matrix4 {
    return this.enuFrame;
  }

  isPaused(): boolean {
    return !this.running;
  }
}
