import { useStore, DEFAULT_FOV, DEFAULT_CAMERA_TILT } from '../../store';
import { DEFAULT_DRONE_CONFIG } from '../../core/physics/types';
import { Slider, SettingsPanelHeader } from './shared';
import css from './PhysicsSettings.module.css';

interface Props {
  onClose: () => void;
  section?: "flight" | "aircraft";
}

export function PhysicsSettings({ onClose, section = "aircraft" }: Props) {
  const config = useStore((s) => s.physicsConfig);
  const setConfig = useStore((s) => s.setPhysicsConfig);
  const fov = useStore((s) => s.fov);
  const setFov = useStore((s) => s.setFov);
  const cameraTilt = useStore((s) => s.cameraTilt);
  const setCameraTilt = useStore((s) => s.setCameraTilt);
  const godMode = useStore((s) => s.godMode);
  const setGodMode = useStore((s) => s.setGodMode);

  const setWindPreset = useStore(s => s.setWindPreset);
  const setRealTime = useStore(s => s.setRealTimeOfDay);
  const setTraffic = useStore(s => s.setRoadTrafficEnabled);
  const setPedestrians = useStore(s => s.setPedestriansEnabled);

  const handleReset = () => {
    setRealTime(false);
    setTraffic(true);
    setPedestrians(true);
    setConfig(DEFAULT_DRONE_CONFIG);
    setFov(DEFAULT_FOV);
    setCameraTilt(DEFAULT_CAMERA_TILT);
    setGodMode(false);
  };

  return (
    <div>
      {section === "aircraft" && <SettingsPanelHeader title="Aircraft tuning" onClose={onClose} />}

      {section === "flight" && <>

      <div className={css.windPresets} role="group" aria-label="Wind presets">
        {(['calm', 'light', 'breezy'] as const).map(preset => (
          <button key={preset} onClick={() => setWindPreset(preset)}>{preset === 'calm' ? 'Calm' : preset === 'light' ? 'Light' : 'Breezy'}</button>
        ))}
      </div>
      <Slider label="Wind speed" value={config.windSpeed ?? 1.5} min={0} max={8} step={0.1} unit="m/s" onChange={v => setConfig({ windSpeed: v })} />
      <Slider label="Wind from" value={config.windDirection ?? 233} min={0} max={360} step={1} unit="deg" onChange={v => setConfig({ windDirection: v })} />
      <Slider label="Gust strength" value={config.windGustStrength ?? 0.35} min={0} max={2} step={0.05} unit="m/s" onChange={v => setConfig({ windGustStrength: v })} />

      <label className={css.godMode}>
        <span className={css.godModeCopy}>
          <span>God mode</span>
          <span id="god-mode-description" className={css.godModeHint}>
            Solid contacts without damage. Press Space to recover nearby.
          </span>
        </span>
        <input
          className={css.godModeInput}
          type="checkbox"
          role="switch"
          aria-label="God mode"
          aria-describedby="god-mode-description"
          checked={godMode}
          onChange={(e) => setGodMode(e.target.checked)}
        />
        <span className={css.godModeTrack} aria-hidden="true" />
      </label>

      <Slider label="Horizontal FOV" value={fov} min={60} max={140} step={1} unit="deg" onChange={setFov} />
      <Slider label="Cam. Tilt" value={cameraTilt} min={0} max={45} step={1} unit="deg" onChange={setCameraTilt} />
      </>}
      {section === "aircraft" && <>
      <Slider label="Mass" value={config.mass} min={0.2} max={1.5} step={0.01} unit="kg" onChange={(v) => setConfig({ mass: v })} />
      <Slider label="Drag Coeff." value={config.dragCoefficient} min={0.1} max={1.0} step={0.01} onChange={(v) => setConfig({ dragCoefficient: v })} />
      <Slider label="Motor Lag" value={config.motorTimeConstant * 1000} min={10} max={100} step={1} unit="ms" onChange={(v) => setConfig({ motorTimeConstant: v / 1000 })} />
      <Slider label="Spawn Alt." value={config.spawnAltitude} min={2} max={50} step={1} unit="m" onChange={(v) => setConfig({ spawnAltitude: v })} />


      <button onClick={handleReset} className={css.resetButton}>
        Reset aircraft and flight defaults
      </button>
      <p className={css.resetHint}>Resets aircraft, camera, God mode, daylight, traffic and pedestrians. Controller mappings are preserved.</p>
      </>}
    </div>
  );
}
