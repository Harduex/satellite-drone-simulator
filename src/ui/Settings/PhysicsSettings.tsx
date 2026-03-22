import { useStore } from '../../store';
import { DEFAULT_DRONE_CONFIG } from '../../core/physics/types';

interface Props {
  onClose: () => void;
}

export function PhysicsSettings({ onClose }: Props) {
  const config = useStore((s) => s.physicsConfig);
  const setConfig = useStore((s) => s.setPhysicsConfig);

  const handleReset = () => {
    setConfig(DEFAULT_DRONE_CONFIG);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#e0e0e0', fontWeight: 400 }}>Physics Settings</h2>
        <button onClick={onClose} style={closeButtonStyle}>X</button>
      </div>

      <Slider
        label="Mass"
        value={config.mass}
        min={0.2}
        max={1.5}
        step={0.01}
        unit="kg"
        onChange={(v) => setConfig({ mass: v })}
      />
      <Slider
        label="Drag Coeff."
        value={config.dragCoefficient}
        min={0.1}
        max={1.0}
        step={0.01}
        onChange={(v) => setConfig({ dragCoefficient: v })}
      />
      <Slider
        label="Motor Lag"
        value={config.motorTimeConstant * 1000}
        min={10}
        max={100}
        step={1}
        unit="ms"
        onChange={(v) => setConfig({ motorTimeConstant: v / 1000 })}
      />
      <Slider
        label="Spawn Alt."
        value={config.spawnAltitude}
        min={2}
        max={50}
        step={1}
        unit="m"
        onChange={(v) => setConfig({ spawnAltitude: v })}
      />

      <button onClick={handleReset} style={{
        marginTop: '1rem',
        padding: '8px 20px',
        fontSize: '0.85rem',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '6px',
        cursor: 'pointer',
        background: 'transparent',
        color: '#e0e0e0',
        width: '100%',
      }}>
        Reset to Defaults
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit = '', onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{ color: '#e0e0e0', fontSize: '0.8rem', width: '90px', opacity: 0.7 }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#00ff88' }}
      />
      <span style={{ color: '#e0e0e0', fontSize: '0.75rem', width: '60px', textAlign: 'right' }}>
        {step < 1 ? value.toFixed(step < 0.1 ? 2 : 1) : value} {unit}
      </span>
    </div>
  );
}

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.2)',
  color: '#e0e0e0',
  borderRadius: '4px',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: '0.9rem',
};
