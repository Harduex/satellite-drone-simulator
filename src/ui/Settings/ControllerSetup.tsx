import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { RADIO_PRESETS, matchPreset } from '../../core/input/RadioPresets';
import type { AxisMapping } from '../../core/input/AxisMapper';
import { AxisMapper } from '../../core/input/AxisMapper';

interface Props {
  onClose: () => void;
}

type WizardStep = 'detect' | 'throttle' | 'yaw' | 'pitch' | 'roll' | 'done';
const STEPS: WizardStep[] = ['detect', 'throttle', 'yaw', 'pitch', 'roll', 'done'];
const STEP_LABELS: Record<WizardStep, string> = {
  detect: 'Detecting Controller',
  throttle: 'Move THROTTLE stick fully up',
  yaw: 'Move YAW stick fully right',
  pitch: 'Move PITCH stick fully forward',
  roll: 'Move ROLL stick fully right',
  done: 'Mapping Complete',
};

export function ControllerSetup({ onClose }: Props) {
  const [step, setStep] = useState<WizardStep>('detect');
  const [gamepad, setGamepad] = useState<Gamepad | null>(null);
  const [mapping, setMapping] = useState<Partial<AxisMapping>>({});
  const [liveAxes, setLiveAxes] = useState<number[]>([]);
  const rates = useStore((s) => s.rates);
  const setRates = useStore((s) => s.setRates);
  const pollRef = useRef<number | null>(null);

  // Poll gamepad axes at 60Hz
  useEffect(() => {
    const poll = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (gp && gp.axes.length >= 4) {
          setGamepad(gp);
          setLiveAxes(Array.from(gp.axes));
          break;
        }
      }
      pollRef.current = requestAnimationFrame(poll);
    };
    pollRef.current = requestAnimationFrame(poll);
    return () => {
      if (pollRef.current !== null) cancelAnimationFrame(pollRef.current);
    };
  }, []);

  // Auto-detect preset when gamepad connects
  useEffect(() => {
    if (gamepad && step === 'detect') {
      const preset = matchPreset(gamepad.id);
      if (preset) {
        const presetMapping = RADIO_PRESETS[preset];
        if (presetMapping) {
          setMapping(presetMapping);
          setStep('done');
        }
      }
    }
  }, [gamepad, step]);

  // Detect which axis moved for wizard
  useEffect(() => {
    if (step === 'detect' || step === 'done') return;
    const threshold = 0.8;
    for (let i = 0; i < liveAxes.length; i++) {
      const val = liveAxes[i];
      if (val !== undefined && Math.abs(val) > threshold) {
        const inverted = val < 0;
        const axisConfig = { axis: i, inverted };
        const newMapping = { ...mapping };
        if (step === 'throttle') newMapping.throttle = axisConfig;
        else if (step === 'yaw') newMapping.yaw = axisConfig;
        else if (step === 'pitch') newMapping.pitch = axisConfig;
        else if (step === 'roll') newMapping.roll = axisConfig;
        setMapping(newMapping);
        // Advance to next step
        const idx = STEPS.indexOf(step);
        setStep(STEPS[idx + 1] ?? 'done');
        break;
      }
    }
  }, [liveAxes, step, mapping]);

  const handleSave = () => {
    if (mapping.throttle && mapping.yaw && mapping.pitch && mapping.roll) {
      const fullMapping = mapping as AxisMapping;
      AxisMapper.saveToStorage(fullMapping);
      useStore.getState().setAxisMapping(fullMapping);
    }
    onClose();
  };

  const handleSkipToManual = () => {
    setStep('throttle');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#e0e0e0', fontWeight: 400 }}>Controller Setup</h2>
        <button onClick={onClose} style={closeButtonStyle}>X</button>
      </div>

      {/* Gamepad status */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: gamepad ? '#00ff88' : '#ff4444',
        }} />
        <span style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
          {gamepad ? gamepad.id : 'No controller detected'}
        </span>
      </div>

      {/* Axis visualizer */}
      {gamepad && (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '4px' }}>
          {liveAxes.map((val, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 60,
                background: '#1a1a2e',
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: '50%',
                  left: 0,
                  right: 0,
                  height: `${Math.abs(val) * 50}%`,
                  background: '#00ff88',
                  transform: val < 0 ? 'scaleY(-1) translateY(100%)' : undefined,
                  transformOrigin: 'bottom',
                  borderRadius: 2,
                }} />
              </div>
              <span style={{ color: '#e0e0e0', fontSize: '0.65rem', opacity: 0.6 }}>
                {i}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Wizard step */}
      <div style={{
        background: '#1a1a2e',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        textAlign: 'center',
        color: '#e0e0e0',
      }}>
        <p style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
          {STEP_LABELS[step]}
        </p>
        {step === 'detect' && !gamepad && (
          <p style={{ opacity: 0.5, fontSize: '0.85rem', margin: 0 }}>
            Plug in your radio controller via USB
          </p>
        )}
        {step === 'detect' && gamepad && (
          <button onClick={handleSkipToManual} style={smallButtonStyle}>
            Manual Mapping
          </button>
        )}
      </div>

      {/* Rates config (always visible) */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ color: '#e0e0e0', fontWeight: 400, fontSize: '0.9rem', margin: '0 0 0.5rem' }}>
          Rates
        </h3>
        <RateSlider
          label="Roll Rate"
          value={rates.rollRate}
          min={100}
          max={900}
          unit="deg/s"
          onChange={(v) => setRates({ rollRate: v })}
        />
        <RateSlider
          label="Pitch Rate"
          value={rates.pitchRate}
          min={100}
          max={900}
          unit="deg/s"
          onChange={(v) => setRates({ pitchRate: v })}
        />
        <RateSlider
          label="Yaw Rate"
          value={rates.yawRate}
          min={100}
          max={900}
          unit="deg/s"
          onChange={(v) => setRates({ yawRate: v })}
        />
        <RateSlider
          label="Expo"
          value={rates.expo}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => setRates({ expo: v })}
        />
      </div>

      {/* Save button */}
      {step === 'done' && (
        <button onClick={handleSave} style={{
          ...smallButtonStyle,
          width: '100%',
          background: '#00ff88',
          color: '#1a1a2e',
          fontWeight: 600,
        }}>
          Save & Close
        </button>
      )}
    </div>
  );
}

function RateSlider({ label, value, min, max, step = 10, unit = '', onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <span style={{ color: '#e0e0e0', fontSize: '0.8rem', width: '80px', opacity: 0.7 }}>
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
        {step < 1 ? value.toFixed(2) : value} {unit}
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

const smallButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  fontSize: '0.9rem',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  background: '#3a3a4e',
  color: '#e0e0e0',
};
