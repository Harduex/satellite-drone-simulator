import * as Cesium from "cesium";
import { DronePhysics } from "../core/physics/DronePhysics";
import { FlightController } from "../core/flight-controller/FlightController";
import { GamepadManager } from "../core/input/GamepadManager";
import { KeyboardInput } from "../core/input/KeyboardInput";
import { FPVCamera, DEFAULT_CAMERA_CONFIG } from "../camera/FPVCamera";
import { DroneRenderer } from "../world/DroneRenderer";
import { BatteryModel } from "./BatteryModel";
import { CrashDetector } from "./CrashDetector";
import { TelemetryPublisher } from "./TelemetryPublisher";
import { enuToEcef } from "../world/CoordUtils";
import { useStore } from "../store";
import type {
  DroneState,
  PhysicsConfig,
  RatesConfig,
  StickInputs,
} from "../core/physics/types";
import { createDefaultDroneState } from "../core/physics/types";

const MAX_PHYSICS_SUBSTEPS = 10;
const MAX_WALL_DT = 0.05; // 50ms cap

export class GameLoop {
  private running = false;
  private physicsAccumulator = 0;
  private readonly PHYSICS_DT = 1 / 500;
  private lastTimestamp = 0;
  private lastMotorCommands = { m1: 0, m2: 0, m3: 0, m4: 0 };

  private droneState: DroneState;
  private physics: DronePhysics;
  private flightController: FlightController;
  private gamepadManager: GamepadManager;
  private keyboardInput: KeyboardInput;
  private fpvCamera: FPVCamera;
  private droneRenderer: DroneRenderer;
  private batteryModel: BatteryModel;
  private crashDetector: CrashDetector;
  private telemetryPublisher: TelemetryPublisher;
  private enuFrame: Cesium.Matrix4;
  private viewer: Cesium.Viewer;
  private preRenderListener: Cesium.Event.RemoveCallback | null = null;

  private spawnAltitude: number;

  constructor(params: {
    viewer: Cesium.Viewer;
    enuFrame: Cesium.Matrix4;
    physicsConfig: PhysicsConfig;
    ratesConfig: RatesConfig;
  }) {
    this.viewer = params.viewer;
    this.enuFrame = params.enuFrame;
    this.spawnAltitude = params.physicsConfig.spawnAltitude;

    this.physics = new DronePhysics(params.physicsConfig);
    this.flightController = new FlightController(
      params.physicsConfig,
      params.ratesConfig,
    );
    this.gamepadManager = new GamepadManager();
    this.keyboardInput = new KeyboardInput();

    // Apply FOV from settings store
    const storeFov = useStore.getState().fov;
    this.fpvCamera = new FPVCamera({
      ...DEFAULT_CAMERA_CONFIG,
      fov: storeFov,
    });

    this.droneRenderer = new DroneRenderer();
    this.batteryModel = new BatteryModel();
    this.crashDetector = new CrashDetector(this.spawnAltitude);
    this.telemetryPublisher = new TelemetryPublisher();

    this.droneState = createDefaultDroneState(this.spawnAltitude);
  }

  /** Register a callback for crash events */
  onCrash(callback: () => void): void {
    this.crashDetector.setOnCrash(callback);
  }

  start(): void {
    this.running = true;
    this.lastTimestamp = performance.now();
    this.physicsAccumulator = 0;

    // Initialize subsystems
    this.fpvCamera.init(this.viewer);
    this.droneRenderer.init(this.viewer);
    this.gamepadManager.startPolling();
    this.keyboardInput.start();

    // Hook into Cesium's preRender event for synchronized updates
    this.preRenderListener = this.viewer.scene.preRender.addEventListener(
      () => {
        this.tick(performance.now());
      },
    );
  }

  stop(): void {
    this.running = false;
    if (this.preRenderListener) {
      this.preRenderListener();
      this.preRenderListener = null;
    }
    this.gamepadManager.stopPolling();
    this.keyboardInput.stop();
    this.droneRenderer.destroy();
  }

  reset(): void {
    this.droneState = createDefaultDroneState(this.spawnAltitude);
    this.physics.reset();
    this.flightController.reset();
    this.batteryModel.reset();
    this.telemetryPublisher.reset();
    this.physicsAccumulator = 0;
    useStore.getState().resetTelemetry();
  }

  private tick(timestamp: number): void {
    if (!this.running) return;

    // Compute wall clock delta
    let wallDt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Clamp to prevent spiral of death
    if (wallDt > MAX_WALL_DT) wallDt = MAX_WALL_DT;
    if (wallDt <= 0) return;

    // 1. Read input (gamepad takes priority over keyboard)
    let stickInputs: StickInputs | null = this.gamepadManager.read();
    if (!stickInputs) {
      stickInputs = this.keyboardInput.read(wallDt);
    }

    // 2. Flight controller + physics substeps at fixed 500Hz
    this.physicsAccumulator += wallDt;
    let steps = 0;
    while (
      this.physicsAccumulator >= this.PHYSICS_DT && steps < MAX_PHYSICS_SUBSTEPS
    ) {
      this.lastMotorCommands = this.flightController.update(
        stickInputs,
        this.droneState,
        this.PHYSICS_DT,
      );
      this.droneState = this.physics.step(
        this.droneState,
        this.lastMotorCommands,
        this.PHYSICS_DT,
      );
      this.physicsAccumulator -= this.PHYSICS_DT;
      steps++;
    }
    if (steps >= MAX_PHYSICS_SUBSTEPS) {
      this.physicsAccumulator = 0;
    }

    // 3. Sync camera to physics state
    this.fpvCamera.sync(this.droneState, this.enuFrame);

    // 4. Update drone renderer position
    const ecefPosition = enuToEcef(this.droneState.position, this.enuFrame);
    this.droneRenderer.update(ecefPosition);

    // 5. Battery drain
    const batteryState = this.batteryModel.drain(this.lastMotorCommands, wallDt);

    // 6. Publish telemetry (throttled to ~10Hz)
    const published = this.telemetryPublisher.maybePublish(
      this.droneState,
      batteryState,
      stickInputs.throttle,
    );

    // 7. Crash detection (only on telemetry frames to avoid spam)
    if (published) {
      const crashed = this.crashDetector.check(this.droneState);
      if (crashed) {
        this.reset();
      }
    }
  }

  getDroneState(): DroneState {
    return this.droneState;
  }

  isPaused(): boolean {
    return !this.running;
  }
}
