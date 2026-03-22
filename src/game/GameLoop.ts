import * as Cesium from "cesium";
import { DronePhysics } from "../core/physics/DronePhysics";
import { FlightController } from "../core/flight-controller/FlightController";
import { GamepadManager } from "../core/input/GamepadManager";
import { KeyboardInput } from "../core/input/KeyboardInput";
import { FPVCamera } from "../camera/FPVCamera";
import { DroneRenderer } from "../world/DroneRenderer";
import { TerrainSampler } from "../world/TerrainSampler";
import { BatteryModel } from "./BatteryModel";
import { enuToEcef } from "../world/CoordUtils";
import { useStore } from "../store";
import { triggerCrashFlash } from "../ui/SimView/CrashFlash";
import type {
  DroneState,
  PhysicsConfig,
  RatesConfig,
  StickInputs,
} from "../core/physics/types";
import { createDefaultDroneState, v3Magnitude } from "../core/physics/types";

const MAX_PHYSICS_SUBSTEPS = 10;
const MAX_WALL_DT = 0.05; // 50ms cap
const TELEMETRY_UPDATE_INTERVAL = 6; // frames (~10Hz at 60fps)

export class GameLoop {
  private running = false;
  private physicsAccumulator = 0;
  private readonly PHYSICS_DT = 1 / 500;
  private lastTimestamp = 0;
  private frameCount = 0;

  private droneState: DroneState;
  private physics: DronePhysics;
  private flightController: FlightController;
  private gamepadManager: GamepadManager;
  private keyboardInput: KeyboardInput;
  private fpvCamera: FPVCamera;
  private droneRenderer: DroneRenderer;
  private terrainSampler: TerrainSampler;
  private batteryModel: BatteryModel;
  private enuFrame: Cesium.Matrix4;
  private viewer: Cesium.Viewer;
  private preRenderListener: Cesium.Event.RemoveCallback | null = null;

  private spawnAltitude: number;
  private terrainHeight: number;

  constructor(params: {
    viewer: Cesium.Viewer;
    enuFrame: Cesium.Matrix4;
    physicsConfig: PhysicsConfig;
    ratesConfig: RatesConfig;
    terrainSampler: TerrainSampler;
    terrainHeight: number;
  }) {
    this.viewer = params.viewer;
    this.enuFrame = params.enuFrame;
    this.terrainHeight = params.terrainHeight;
    this.spawnAltitude = params.physicsConfig.spawnAltitude;

    this.physics = new DronePhysics(params.physicsConfig);
    this.flightController = new FlightController(
      params.physicsConfig,
      params.ratesConfig,
    );
    this.gamepadManager = new GamepadManager();
    this.keyboardInput = new KeyboardInput();
    this.fpvCamera = new FPVCamera();
    this.droneRenderer = new DroneRenderer();
    this.terrainSampler = params.terrainSampler;
    this.batteryModel = new BatteryModel();

    this.droneState = createDefaultDroneState(this.spawnAltitude);
  }

  start(): void {
    this.running = true;
    this.lastTimestamp = performance.now();
    this.physicsAccumulator = 0;
    this.frameCount = 0;

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

    // 2. Flight controller: sticks → motor commands
    const motorCommands = this.flightController.update(
      stickInputs,
      this.droneState,
      this.PHYSICS_DT,
    );

    // 3. Physics substeps (fixed 500Hz)
    this.physicsAccumulator += wallDt;
    let steps = 0;
    while (
      this.physicsAccumulator >= this.PHYSICS_DT && steps < MAX_PHYSICS_SUBSTEPS
    ) {
      this.droneState = this.physics.step(
        this.droneState,
        motorCommands,
        this.PHYSICS_DT,
      );
      this.physicsAccumulator -= this.PHYSICS_DT;
      steps++;
    }
    // Drop remaining time if we hit the cap (prevents spiral of death)
    if (steps >= MAX_PHYSICS_SUBSTEPS) {
      this.physicsAccumulator = 0;
    }

    // 4. Sync camera to physics state
    this.fpvCamera.sync(this.droneState, this.enuFrame);

    // 5. Update drone renderer position
    const ecefPosition = enuToEcef(this.droneState.position, this.enuFrame);
    this.droneRenderer.update(ecefPosition);

    // 6. Battery drain
    const batteryState = this.batteryModel.drain(motorCommands, wallDt);

    // 7. Terrain collision check (on telemetry update cycle to avoid spam)
    this.frameCount++;
    if (this.frameCount % TELEMETRY_UPDATE_INTERVAL === 0) {
      const agl = this.terrainSampler.getAGL(
        this.droneState.position.z,
        this.terrainHeight,
      );
      const speed = v3Magnitude(this.droneState.velocity);

      useStore.getState().updateTelemetry({
        positionX: this.droneState.position.x,
        positionY: this.droneState.position.y,
        positionZ: this.droneState.position.z,
        speed,
        altitudeAGL: agl,
        batteryPercent: batteryState.percentRemaining,
        batteryVoltage: batteryState.voltage,
        throttle: stickInputs.throttle,
      });

      // Crash check: AGL < 0.5m triggers reset
      if (agl < 0.5 && this.droneState.position.z < this.spawnAltitude * 0.5) {
        triggerCrashFlash();
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
