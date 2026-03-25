import { useStore } from '../../store';
import { DEFAULT_DRONE_CONFIG } from '../../core/physics/types';
import { colors, fontSizes, spacing } from '../theme';
import { Slider, SettingsPanelHeader } from './shared';

interface Props {
  onClose: () => void;
}

export function PhysicsSettings({ onClose }: Props) {
  const config = useStore((s) => s.physicsConfig);
  const setConfig = useStore((s) => s.setPhysicsConfig);
  const fov = useStore((s) => s.fov);
  const setFov = useStore((s) => s.setFov);
  const cameraTilt = useStore((s) => s.cameraTilt);
  const setCameraTilt = useStore((s) => s.setCameraTilt);

  const handleReset = () => {
    setConfig(DEFAULT_DRONE_CONFIG);
  };

  return (
    <div>
      <SettingsPanelHeader title="Physics Settings" onClose={onClose} />

      <Slider
        label="Mass" value={config.mass}
        min={0.2} max={1.5} step={0.01} unit="kg"
        onChange={(v) => setConfig({ mass: v })}
      />
      <Slider
        label="Drag Coeff." value={config.dragCoefficient}
        min={0.1} max={1.0} step={0.01}
        onChange={(v) => setConfig({ dragCoefficient: v })}
      />
      <Slider
        label="Motor Lag" value={config.motorTimeConstant * 1000}
        min={10} max={100} step={1} unit="ms"
        onChange={(v) => setConfig({ motorTimeConstant: v / 1000 })}
      />
      <Slider
        label="Spawn Alt." value={config.spawnAltitude}
        min={2} max={50} step={1} unit="m"
        onChange={(v) => setConfig({ spawnAltitude: v })}
      />
      <Slider
        label="FOV" value={fov}
        min={60} max={140} step={1} unit="deg"
        onChange={(v) => setFov(v)}
      />
      <Slider
        label="Cam. Tilt" value={cameraTilt}
        min={0} max={45} step={1} unit="deg"
        onChange={(v) => setCameraTilt(v)}
      />

      <button onClick={handleReset} style={{
        marginTop: spacing.md,
        padding: '8px 20px',
        fontSize: fontSizes.body_sm,
        border: '1px solid ' + colors.outline_variant,
        borderRadius: 0,
        cursor: 'pointer',
        background: colors.surface_container_highest,
        color: colors.on_surface,
        width: '100%',
      }}>
        Reset to Defaults
      </button>
    </div>
  );
}
