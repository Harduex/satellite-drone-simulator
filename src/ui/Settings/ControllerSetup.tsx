import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../../store';
import { RADIO_PRESETS, matchPreset } from '../../core/input/RadioPresets';
import type { AxisMapping, AxisChannelConfig } from '../../core/input/AxisMapper';
import { DEFAULT_DEADZONE } from '../../core/input/AxisMapper';
import { AxisMapper } from '../../core/input/AxisMapper';
import { colors, fonts, gradients } from '../theme';
import { Slider, SettingsPanelHeader } from './shared';

/** Map axes for VISUAL display — reads correct axis per channel but does NOT
 *  apply inversion. Inversion is only needed for flight controller sign convention.
 *  For the preview, stick-right should always move dot-right. */
function mapForDisplay(mapping: AxisMapping, rawAxes: number[]) {
  const readRaw = (ch: AxisChannelConfig) => {
    const raw = (rawAxes[ch.axis] ?? 0) - (ch.centerOffset ?? 0);
    return raw; // no inversion — raw physical direction
  };
  const throttleRaw = readRaw(mapping.throttle);
  return {
    throttle: Math.max(0, Math.min(1, (throttleRaw + 1) / 2)),
    yaw: readRaw(mapping.yaw),
    pitch: readRaw(mapping.pitch),
    roll: readRaw(mapping.roll),
  };
}

interface Props {
  onClose: () => void;
}

// ── Wizard Steps ──────────────────────────────────────────
type WizardStep =
  | 'detect'
  | 'center'
  | 'map-throttle'
  | 'map-yaw'
  | 'map-pitch'
  | 'map-roll'
  | 'verify'
  | 'deadzones';

const CHANNEL_STEPS: WizardStep[] = ['map-throttle', 'map-yaw', 'map-pitch', 'map-roll'];
type Channel = 'throttle' | 'yaw' | 'pitch' | 'roll';

const CHANNEL_INSTRUCTIONS: Record<Channel, string> = {
  throttle: 'Move THROTTLE stick fully UP',
  yaw: 'Move YAW stick fully RIGHT',
  pitch: 'Move PITCH stick fully FORWARD',
  roll: 'Move ROLL stick fully RIGHT',
};

function getStageNumber(step: WizardStep): number {
  if (step === 'detect') return 1;
  if (step === 'center') return 2;
  if (step.startsWith('map-')) return 3;
  if (step === 'verify') return 4;
  return 5;
}

const STAGE_LABELS = ['Detect', 'Center', 'Map', 'Verify', 'Config'];

// ── Main Component ────────────────────────────────────────
export function ControllerSetup({ onClose }: Props) {
  const [step, setStep] = useState<WizardStep>('detect');
  const [gamepad, setGamepad] = useState<Gamepad | null>(null);
  const [liveAxes, setLiveAxes] = useState<number[]>([]);
  const [centerOffsets, setCenterOffsets] = useState<number[]>([]);
  const [centerCalibrated, setCenterCalibrated] = useState(false);
  // Load saved mapping from localStorage on mount — this ensures the preview
  // uses the user's actual calibrated mapping, not just the auto-detected preset
  const [mapping, setMapping] = useState<Partial<AxisMapping>>(() => {
    const saved = AxisMapper.loadFromStorage();
    return saved ?? {};
  });
  const [detectionPhase, setDetectionPhase] = useState<'waiting' | 'detected'>('waiting');
  const [selectedPreset, setSelectedPreset] = useState<string>('Generic');
  const rates = useStore((s) => s.rates);
  const setRates = useStore((s) => s.setRates);
  const pollRef = useRef<number | null>(null);
  const detectionCountRef = useRef<{ axis: number; count: number } | null>(null);

  const DETECTION_FRAMES = 10;
  const DETECTION_THRESHOLD = 0.5;

  // ── Gamepad polling at rAF rate ──
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

  // ── Auto-select matching preset when gamepad first connects ──
  useEffect(() => {
    if (gamepad && step === 'detect') {
      const preset = matchPreset(gamepad.id);
      if (preset) setSelectedPreset(preset);
    }
  }, [gamepad, step]);

  // ── Axis detection for mapping steps ──
  useEffect(() => {
    if (!step.startsWith('map-') || detectionPhase !== 'waiting') return;
    const channel = step.replace('map-', '') as Channel;

    // Axes already assigned to other channels
    const usedAxes = new Set<number>();
    for (const [ch, config] of Object.entries(mapping)) {
      if (ch !== channel && config) usedAxes.add((config as AxisChannelConfig).axis);
    }

    let maxDelta = 0;
    let maxIndex = -1;
    for (let i = 0; i < liveAxes.length; i++) {
      if (usedAxes.has(i)) continue;
      const center = centerOffsets[i] ?? 0;
      const delta = Math.abs(liveAxes[i]! - center);
      if (delta > DETECTION_THRESHOLD && delta > maxDelta) {
        maxDelta = delta;
        maxIndex = i;
      }
    }

    if (maxIndex >= 0) {
      const ref = detectionCountRef.current;
      if (ref && ref.axis === maxIndex) {
        ref.count++;
        if (ref.count >= DETECTION_FRAMES) {
          const center = centerOffsets[maxIndex] ?? 0;
          const delta = liveAxes[maxIndex]! - center;
          // If delta is negative when moving in the "positive" direction, invert
          const inverted = delta < 0;
          setMapping(prev => ({
            ...prev,
            [channel]: {
              axis: maxIndex,
              inverted,
              deadzone: DEFAULT_DEADZONE,
              centerOffset: center,
            },
          }));
          setDetectionPhase('detected');
          detectionCountRef.current = null;
        }
      } else {
        detectionCountRef.current = { axis: maxIndex, count: 1 };
      }
    } else {
      detectionCountRef.current = null;
    }
  }, [liveAxes, step, detectionPhase, centerOffsets, mapping]);

  // ── Compute stick inputs for crosshair preview (display-oriented) ──
  // Uses raw axis values WITHOUT inversion — inversion is for flight controller
  // sign convention, not for visual display where stick-right should = dot-right
  const mappedInputs = useMemo(() => {
    const m = mapping;
    if (!m.throttle || !m.yaw || !m.pitch || !m.roll) return null;
    return mapForDisplay(m as AxisMapping, liveAxes);
  }, [mapping, liveAxes]);

  // ── Handlers ──
  const handleUsePreset = () => {
    const preset = RADIO_PRESETS[selectedPreset];
    if (preset) {
      setMapping({ ...preset });
      setCenterOffsets(new Array(liveAxes.length).fill(0));
      setCenterCalibrated(false);
      setStep('verify');
    }
  };

  const handleCalibrateCenter = () => {
    setCenterOffsets(Array.from(liveAxes));
    setCenterCalibrated(true);
  };

  const handleNextChannel = () => {
    const idx = CHANNEL_STEPS.indexOf(step);
    if (idx < CHANNEL_STEPS.length - 1) {
      setStep(CHANNEL_STEPS[idx + 1]!);
    } else {
      setStep('verify');
    }
    setDetectionPhase('waiting');
    detectionCountRef.current = null;
  };

  const handleRedoChannel = () => {
    const channel = step.replace('map-', '') as Channel;
    setMapping(prev => {
      const next = { ...prev };
      delete next[channel];
      return next;
    });
    setDetectionPhase('waiting');
    detectionCountRef.current = null;
  };

  const handleStartOver = () => {
    setMapping({});
    setCenterOffsets([]);
    setCenterCalibrated(false);
    setDetectionPhase('waiting');
    detectionCountRef.current = null;
    setStep('center');
  };

  const handleDeadzoneChange = (channel: Channel, value: number) => {
    setMapping(prev => ({
      ...prev,
      [channel]: { ...prev[channel]!, deadzone: value },
    }));
  };

  const handleSave = () => {
    if (mapping.throttle && mapping.yaw && mapping.pitch && mapping.roll) {
      const fullMapping = mapping as AxisMapping;
      AxisMapper.saveToStorage(fullMapping);
      useStore.getState().setAxisMapping(fullMapping);
    }
    onClose();
  };

  const currentStage = getStageNumber(step);
  const currentChannel = step.startsWith('map-') ? step.replace('map-', '') as Channel : null;

  return (
    <div>
      {/* Header */}
      <SettingsPanelHeader title="Controller Setup" onClose={onClose} />

      {/* Gamepad status */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: gamepad ? colors.primary : colors.error,
        }} />
        <span style={{ color: colors.on_surface, fontSize: '0.85rem', fontFamily: fonts.body }}>
          {gamepad ? gamepad.id : 'No controller detected — plug in via USB'}
        </span>
      </div>

      {/* Progress indicator */}
      <StepIndicator currentStage={currentStage} />

      {/* ── Step 1: Detect ── */}
      {step === 'detect' && (
        <StepPanel>
          <StepTitle>Connect Controller</StepTitle>
          {gamepad ? (
            <>
              <p style={hintStyle}>
                Select a preset for quick setup, or run manual calibration for precise mapping.
              </p>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: colors.on_surface, fontSize: '0.85rem', marginRight: 8, fontFamily: fonts.body }}>Preset:</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  style={selectStyle}
                >
                  {Object.keys(RADIO_PRESETS).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={handleUsePreset} style={accentButtonStyle}>
                  Use Preset & Verify
                </button>
                <button onClick={() => setStep('center')} style={secondaryButtonStyle}>
                  Manual Calibration
                </button>
              </div>
            </>
          ) : (
            <p style={hintStyle}>Waiting for controller connection...</p>
          )}
        </StepPanel>
      )}

      {/* ── Step 2: Center Calibration ── */}
      {step === 'center' && (
        <StepPanel>
          <StepTitle>Center Calibration</StepTitle>
          <p style={hintStyle}>
            Release all sticks (hands off). Click the button to record center position.
          </p>
          {/* Raw axis bars */}
          {gamepad && <AxisBars axes={liveAxes} centerOffsets={centerOffsets} />}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
            <button onClick={handleCalibrateCenter} style={accentButtonStyle}>
              {centerCalibrated ? 'Re-Calibrate Center' : 'Calibrate Center'}
            </button>
            {centerCalibrated && (
              <button onClick={() => { setStep('map-throttle'); setDetectionPhase('waiting'); }} style={accentButtonStyle}>
                Next
              </button>
            )}
          </div>
          {centerCalibrated && (
            <p style={{ ...hintStyle, color: colors.primary, marginTop: '8px' }}>
              Center recorded for {centerOffsets.length} axes
            </p>
          )}
        </StepPanel>
      )}

      {/* ── Steps 3a-3d: Axis Mapping ── */}
      {currentChannel && (
        <StepPanel>
          <StepTitle>Map Axes</StepTitle>
          <ChannelSubIndicator current={currentChannel} mapping={mapping} />
          {detectionPhase === 'waiting' ? (
            <>
              <p style={{ color: colors.primary, fontSize: '1.1rem', textAlign: 'center', margin: '12px 0', fontFamily: fonts.display }}>
                {CHANNEL_INSTRUCTIONS[currentChannel]}
              </p>
              <p style={hintStyle}>Hold the stick in that position...</p>
              {gamepad && <AxisBars axes={liveAxes} centerOffsets={centerOffsets} />}
            </>
          ) : (
            <>
              <div style={{
                textAlign: 'center', padding: '12px',
                background: 'rgba(255, 182, 147, 0.1)', borderRadius: 0, margin: '8px 0',
              }}>
                <span style={{ color: colors.primary, fontSize: '1rem', fontFamily: fonts.body }}>
                  {currentChannel.toUpperCase()}: Axis {(mapping[currentChannel] as AxisChannelConfig).axis}
                  {(mapping[currentChannel] as AxisChannelConfig).inverted ? ' (Inverted)' : ' (Normal)'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={handleNextChannel} style={accentButtonStyle}>Next</button>
                <button onClick={handleRedoChannel} style={secondaryButtonStyle}>Redo</button>
              </div>
            </>
          )}
        </StepPanel>
      )}

      {/* ── Step 4: Verify ── */}
      {step === 'verify' && (
        <StepPanel>
          <StepTitle>Verify Mapping</StepTitle>
          <p style={hintStyle}>Move all sticks to verify correct response.</p>
          {mappedInputs && (
            <DualStickCrosshair
              leftX={mappedInputs.yaw}
              leftY={mappedInputs.throttle}
              rightX={mappedInputs.roll}
              rightY={mappedInputs.pitch}
              size={150}
            />
          )}
          <MappingSummary mapping={mapping} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
            <button onClick={() => setStep('deadzones')} style={accentButtonStyle}>Looks Good</button>
            <button onClick={handleStartOver} style={secondaryButtonStyle}>Start Over</button>
          </div>
        </StepPanel>
      )}

      {/* ── Step 5: Deadzones & Rates ── */}
      {step === 'deadzones' && (
        <StepPanel>
          <StepTitle>Deadzones & Rates</StepTitle>
          {mappedInputs && (
            <DualStickCrosshair
              leftX={mappedInputs.yaw}
              leftY={mappedInputs.throttle}
              rightX={mappedInputs.roll}
              rightY={mappedInputs.pitch}
              size={120}
            />
          )}
          {/* Deadzone sliders */}
          <SectionLabel>Deadzones</SectionLabel>
          {(['throttle', 'yaw', 'pitch', 'roll'] as Channel[]).map(ch => (
            <Slider
              key={ch}
              label={ch.charAt(0).toUpperCase() + ch.slice(1)}
              value={(mapping[ch] as AxisChannelConfig)?.deadzone ?? DEFAULT_DEADZONE}
              min={0}
              max={0.30}
              step={0.01}
              labelWidth={80}
              onChange={(v) => handleDeadzoneChange(ch, v)}
            />
          ))}
          {/* Rate sliders */}
          <SectionLabel>Rates</SectionLabel>
          <Slider label="Roll Rate" value={rates.rollRate} min={100} max={900} step={10} unit="deg/s" labelWidth={80} onChange={(v) => setRates({ rollRate: v })} />
          <Slider label="Pitch Rate" value={rates.pitchRate} min={100} max={900} step={10} unit="deg/s" labelWidth={80} onChange={(v) => setRates({ pitchRate: v })} />
          <Slider label="Yaw Rate" value={rates.yawRate} min={100} max={900} step={10} unit="deg/s" labelWidth={80} onChange={(v) => setRates({ yawRate: v })} />
          <Slider label="Expo" value={rates.expo} min={0} max={1} step={0.05} labelWidth={80} onChange={(v) => setRates({ expo: v })} />
          <button onClick={handleSave} style={{ ...accentButtonStyle, width: '100%', marginTop: '12px' }}>
            Save & Close
          </button>
        </StepPanel>
      )}

      {/* Dual-stick crosshair shown on detect/center/map steps as raw preview */}
      {(step === 'detect' || step === 'center' || step.startsWith('map-')) && gamepad && (
        <div style={{ marginTop: '12px' }}>
          <RawStickPreview axes={liveAxes} mapping={mapping} selectedPreset={selectedPreset} />
        </div>
      )}
    </div>
  );
}

// ── Step Progress Indicator ───────────────────────────────
function StepIndicator({ currentStage }: { currentStage: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: '1rem' }}>
      {STAGE_LABELS.map((label, i) => {
        const stageNum = i + 1;
        const isActive = stageNum === currentStage;
        const isCompleted = stageNum < currentStage;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 50 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600,
                fontFamily: fonts.display,
                background: isActive ? colors.primary : isCompleted ? 'transparent' : 'transparent',
                color: isActive ? colors.on_primary : isCompleted ? colors.primary : colors.surface_container_highest,
                border: `2px solid ${isActive ? colors.primary : isCompleted ? colors.primary : colors.surface_container_highest}`,
              }}>
                {isCompleted ? '\u2713' : stageNum}
              </div>
              <span style={{
                fontSize: '0.6rem', marginTop: 2, fontFamily: fonts.display,
                color: isActive ? colors.primary : isCompleted ? colors.primary : colors.surface_container_highest,
              }}>
                {label}
              </span>
            </div>
            {i < STAGE_LABELS.length - 1 && (
              <div style={{
                width: 24, height: 2, marginBottom: 14,
                background: stageNum < currentStage ? colors.primary : colors.surface_container_highest,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Channel Sub-Indicator (for mapping step) ──────────────
function ChannelSubIndicator({ current, mapping }: { current: Channel; mapping: Partial<AxisMapping> }) {
  const channels: Channel[] = ['throttle', 'yaw', 'pitch', 'roll'];
  const labels = ['THR', 'YAW', 'PIT', 'ROL'];
  return (
    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '8px' }}>
      {channels.map((ch, i) => {
        const isCurrent = ch === current;
        const isDone = !!mapping[ch];
        return (
          <span key={ch} style={{
            fontSize: '0.75rem', padding: '2px 8px', borderRadius: 0,
            fontFamily: fonts.display,
            background: isCurrent ? colors.primary : isDone ? 'rgba(255, 182, 147, 0.15)' : colors.surface_container_high,
            color: isCurrent ? colors.on_primary : isDone ? colors.primary : colors.on_surface,
            fontWeight: isCurrent ? 700 : 400,
          }}>
            {labels[i]}
          </span>
        );
      })}
    </div>
  );
}

// ── Dual-Stick Crosshair ──────────────────────────────────
function DualStickCrosshair({ leftX, leftY, rightX, rightY, size = 140 }: {
  leftX: number; leftY: number; rightX: number; rightY: number; size?: number;
}) {
  return (
    <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', padding: '8px 0' }}>
      <div style={{ textAlign: 'center' }}>
        <StickBox x={leftX} y={leftY} yIsThrottle={true} xLabel="YAW" yLabel="THR" size={size} />
        <div style={{ color: colors.on_surface, fontSize: '0.65rem', opacity: 0.4, marginTop: 2, fontFamily: fonts.body }}>Left Stick</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StickBox x={rightX} y={rightY} yIsThrottle={false} xLabel="ROLL" yLabel="PITCH" size={size} />
        <div style={{ color: colors.on_surface, fontSize: '0.65rem', opacity: 0.4, marginTop: 2, fontFamily: fonts.body }}>Right Stick</div>
      </div>
    </div>
  );
}

// ── Single Stick Box ──────────────────────────────────────
function StickBox({ x, y, yIsThrottle, xLabel, yLabel, size }: {
  x: number; y: number; yIsThrottle: boolean; xLabel: string; yLabel: string; size: number;
}) {
  // x: [-1,1], y: [0,1] for throttle or [-1,1] for pitch
  const dotX = ((x + 1) / 2) * size;
  const dotY = yIsThrottle ? (1 - y) * size : ((1 - y) / 2) * size;
  const centerY = yIsThrottle ? size : size / 2;

  return (
    <div style={{ position: 'relative', width: size + 20, height: size + 20, margin: '0 auto' }}>
      {/* Background */}
      <div style={{
        position: 'absolute', top: 10, left: 20, width: size, height: size,
        background: colors.surface, border: '1px solid ' + colors.outline_variant, borderRadius: 0,
      }} />
      {/* Horizontal center line */}
      <div style={{
        position: 'absolute', top: 10 + centerY, left: 20, width: size,
        height: 1, background: colors.surface_container_highest,
      }} />
      {/* Vertical center line */}
      <div style={{
        position: 'absolute', left: 20 + size / 2, top: 10, height: size,
        width: 1, background: colors.surface_container_highest,
      }} />
      {/* Dot — uses transform for GPU-composited positioning */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0,
        width: 12, height: 12, borderRadius: '50%',
        background: colors.primary,
        boxShadow: '0 0 8px rgba(255, 182, 147, 0.5)',
        transform: `translate(${20 + dotX - 6}px, ${10 + dotY - 6}px)`,
        willChange: 'transform',
      }} />
      {/* X label (below box) */}
      <span style={{
        position: 'absolute', bottom: -2, left: 20 + size / 2, transform: 'translateX(-50%)',
        color: colors.on_surface, fontSize: '0.6rem', opacity: 0.5, fontFamily: fonts.display,
      }}>
        {xLabel}
      </span>
      {/* Y label (left of box, rotated) */}
      <span style={{
        position: 'absolute', top: 10 + size / 2, left: 4, transform: 'translateY(-50%) rotate(-90deg)',
        color: colors.on_surface, fontSize: '0.6rem', opacity: 0.5, fontFamily: fonts.display,
        transformOrigin: 'center',
      }}>
        {yLabel}
      </span>
    </div>
  );
}

// ── Raw Stick Preview (before mapping is complete) ────────
function RawStickPreview({ axes, mapping, selectedPreset }: {
  axes: number[]; mapping: Partial<AxisMapping>; selectedPreset: string;
}) {
  // If we have a full mapping, use display-oriented mapping (no inversion)
  if (mapping.throttle && mapping.yaw && mapping.pitch && mapping.roll) {
    const mapped = mapForDisplay(mapping as AxisMapping, axes);
    return (
      <DualStickCrosshair
        leftX={mapped.yaw} leftY={mapped.throttle}
        rightX={mapped.roll} rightY={mapped.pitch}
        size={100}
      />
    );
  }

  // Use the selected preset's axis assignments for the raw preview
  const preset = RADIO_PRESETS[selectedPreset] ?? RADIO_PRESETS['Generic']!;
  const mapped = mapForDisplay(preset, axes);
  return (
    <DualStickCrosshair
      leftX={mapped.yaw} leftY={mapped.throttle}
      rightX={mapped.roll} rightY={mapped.pitch}
      size={100}
    />
  );
}

// ── Axis Bars Visualizer ──────────────────────────────────
function AxisBars({ axes, centerOffsets }: { axes: number[]; centerOffsets: number[] }) {
  return (
    <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
      {axes.map((val, i) => {
        const center = centerOffsets[i] ?? 0;
        const adjusted = val - center;
        return (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 50, background: colors.surface, borderRadius: 0,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', bottom: '50%', left: 0, right: 0,
                height: `${Math.abs(adjusted) * 50}%`,
                background: colors.primary,
                transform: adjusted < 0 ? 'scaleY(-1) translateY(100%)' : undefined,
                transformOrigin: 'bottom', borderRadius: 0,
              }} />
              {/* Center marker if calibrated */}
              {center !== 0 && (
                <div style={{
                  position: 'absolute', bottom: '50%', left: 0, right: 0,
                  height: 1, background: '#ff884488',
                }} />
              )}
            </div>
            <span style={{ color: colors.on_surface, fontSize: '0.6rem', opacity: 0.5, fontFamily: fonts.body }}>{i}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Mapping Summary ───────────────────────────────────────
function MappingSummary({ mapping }: { mapping: Partial<AxisMapping> }) {
  const channels: Channel[] = ['throttle', 'yaw', 'pitch', 'roll'];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px',
      fontSize: '0.75rem', color: colors.on_surface, opacity: 0.7,
      marginTop: '8px', padding: '8px', background: colors.surface, borderRadius: 0,
      fontFamily: fonts.body,
    }}>
      {channels.map(ch => {
        const config = mapping[ch] as AxisChannelConfig | undefined;
        return (
          <div key={ch}>
            <span style={{ fontWeight: 600 }}>{ch.toUpperCase()}</span>: Axis {config?.axis ?? '?'}
            {config?.inverted ? ' (Inv)' : ''}
          </div>
        );
      })}
    </div>
  );
}

// ── Reusable Sub-Components ───────────────────────────────
function StepPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: colors.surface, borderRadius: 0, padding: '1rem', marginBottom: '0.5rem',
    }}>
      {children}
    </div>
  );
}

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ color: colors.on_surface, fontWeight: 500, fontSize: '0.95rem', margin: '0 0 8px', textAlign: 'center', fontFamily: fonts.display }}>
      {children}
    </h3>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{ color: colors.on_surface, fontWeight: 400, fontSize: '0.85rem', margin: '12px 0 6px', opacity: 0.7, fontFamily: fonts.display }}>
      {children}
    </h4>
  );
}

// ── Styles ────────────────────────────────────────────────
const hintStyle: React.CSSProperties = {
  color: colors.on_surface, opacity: 0.5, fontSize: '0.85rem', textAlign: 'center', margin: '4px 0 12px',
  fontFamily: fonts.body,
};

const accentButtonStyle: React.CSSProperties = {
  padding: '8px 20px', fontSize: '0.9rem', border: 'none', borderRadius: 0,
  cursor: 'pointer', background: gradients.cta, color: colors.on_primary, fontWeight: 600,
  fontFamily: fonts.display,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 20px', fontSize: '0.9rem', border: 'none', borderRadius: 0,
  cursor: 'pointer', background: colors.surface_container_highest, color: colors.on_surface,
  fontFamily: fonts.body,
};

const selectStyle: React.CSSProperties = {
  background: colors.surface, color: colors.on_surface, border: '1px solid ' + colors.outline_variant,
  borderRadius: 0, padding: '6px 12px', fontSize: '0.85rem',
  fontFamily: fonts.body,
};
