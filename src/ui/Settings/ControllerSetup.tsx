import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../../store';
import { RADIO_PRESETS, matchPreset } from '../../core/input/RadioPresets';
import type { AxisMapping, AxisChannelConfig } from '../../core/input/AxisMapper';
import { DEFAULT_DEADZONE } from '../../core/input/AxisMapper';
import { AxisMapper } from '../../core/input/AxisMapper';
import { colors } from '../theme';
import { Slider, SettingsPanelHeader } from './shared';
import css from './ControllerSetup.module.css';

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
      <div className={css.gamepadStatus}>
        <div
          className={css.statusDot}
          style={{ background: gamepad ? colors.primary : colors.error }}
        />
        <span className={css.statusLabel}>
          {gamepad ? gamepad.id : 'No controller detected — plug in via USB'}
        </span>
      </div>

      {/* Progress indicator */}
      <StepIndicator currentStage={currentStage} />

      {/* ── Step 1: Detect ── */}
      {step === 'detect' && (
        <div className={css.stepPanel}>
          <h3 className={css.stepTitle}>Connect Controller</h3>
          {gamepad ? (
            <>
              <p className={css.hint}>
                Select a preset for quick setup, or run manual calibration for precise mapping.
              </p>
              <div className={css.presetRow}>
                <label className={css.presetLabel}>Preset:</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className={css.selectInput}
                >
                  {Object.keys(RADIO_PRESETS).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className={css.buttonRow}>
                <button onClick={handleUsePreset} className={css.accentButton}>
                  Use Preset & Verify
                </button>
                <button onClick={() => setStep('center')} className={css.secondaryButton}>
                  Manual Calibration
                </button>
              </div>
            </>
          ) : (
            <p className={css.hint}>Waiting for controller connection...</p>
          )}
        </div>
      )}

      {/* ── Step 2: Center Calibration ── */}
      {step === 'center' && (
        <div className={css.stepPanel}>
          <h3 className={css.stepTitle}>Center Calibration</h3>
          <p className={css.hint}>
            Release all sticks (hands off). Click the button to record center position.
          </p>
          {/* Raw axis bars */}
          {gamepad && <AxisBars axes={liveAxes} centerOffsets={centerOffsets} />}
          <div className={css.buttonRowMt}>
            <button onClick={handleCalibrateCenter} className={css.accentButton}>
              {centerCalibrated ? 'Re-Calibrate Center' : 'Calibrate Center'}
            </button>
            {centerCalibrated && (
              <button onClick={() => { setStep('map-throttle'); setDetectionPhase('waiting'); }} className={css.accentButton}>
                Next
              </button>
            )}
          </div>
          {centerCalibrated && (
            <p className={css.hintPrimary}>
              Center recorded for {centerOffsets.length} axes
            </p>
          )}
        </div>
      )}

      {/* ── Steps 3a-3d: Axis Mapping ── */}
      {currentChannel && (
        <div className={css.stepPanel}>
          <h3 className={css.stepTitle}>Map Axes</h3>
          <ChannelSubIndicator current={currentChannel} mapping={mapping} />
          {detectionPhase === 'waiting' ? (
            <>
              <p className={css.channelInstruction}>
                {CHANNEL_INSTRUCTIONS[currentChannel]}
              </p>
              <p className={css.hint}>Hold the stick in that position...</p>
              {gamepad && <AxisBars axes={liveAxes} centerOffsets={centerOffsets} />}
            </>
          ) : (
            <>
              <div className={css.detectionResult}>
                <span className={css.detectionResultText}>
                  {currentChannel.toUpperCase()}: Axis {(mapping[currentChannel] as AxisChannelConfig).axis}
                  {(mapping[currentChannel] as AxisChannelConfig).inverted ? ' (Inverted)' : ' (Normal)'}
                </span>
              </div>
              <div className={css.buttonRow}>
                <button onClick={handleNextChannel} className={css.accentButton}>Next</button>
                <button onClick={handleRedoChannel} className={css.secondaryButton}>Redo</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 4: Verify ── */}
      {step === 'verify' && (
        <div className={css.stepPanel}>
          <h3 className={css.stepTitle}>Verify Mapping</h3>
          <p className={css.hint}>Move all sticks to verify correct response.</p>
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
          <div className={css.buttonRowMt}>
            <button onClick={() => setStep('deadzones')} className={css.accentButton}>Looks Good</button>
            <button onClick={handleStartOver} className={css.secondaryButton}>Start Over</button>
          </div>
        </div>
      )}

      {/* ── Step 5: Deadzones & Rates ── */}
      {step === 'deadzones' && (
        <div className={css.stepPanel}>
          <h3 className={css.stepTitle}>Deadzones & Rates</h3>
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
          <h4 className={css.sectionLabel}>Deadzones</h4>
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
          <h4 className={css.sectionLabel}>Rates</h4>
          <Slider label="Roll Rate" value={rates.rollRate} min={100} max={900} step={10} unit="deg/s" labelWidth={80} onChange={(v) => setRates({ rollRate: v })} />
          <Slider label="Pitch Rate" value={rates.pitchRate} min={100} max={900} step={10} unit="deg/s" labelWidth={80} onChange={(v) => setRates({ pitchRate: v })} />
          <Slider label="Yaw Rate" value={rates.yawRate} min={100} max={900} step={10} unit="deg/s" labelWidth={80} onChange={(v) => setRates({ yawRate: v })} />
          <Slider label="Expo" value={rates.expo} min={0} max={1} step={0.05} labelWidth={80} onChange={(v) => setRates({ expo: v })} />
          <button onClick={handleSave} className={css.saveButton}>
            Save & Close
          </button>
        </div>
      )}

      {/* Dual-stick crosshair shown on detect/center/map steps as raw preview */}
      {(step === 'detect' || step === 'center' || step.startsWith('map-')) && gamepad && (
        <div className={css.rawPreviewMargin}>
          <RawStickPreview axes={liveAxes} mapping={mapping} selectedPreset={selectedPreset} />
        </div>
      )}
    </div>
  );
}

// ── Step Progress Indicator ───────────────────────────────
function StepIndicator({ currentStage }: { currentStage: number }) {
  return (
    <div className={css.stepIndicatorRow}>
      {STAGE_LABELS.map((label, i) => {
        const stageNum = i + 1;
        const isActive = stageNum === currentStage;
        const isCompleted = stageNum < currentStage;
        return (
          <div key={label} className={css.stepItem}>
            <div className={css.stepColumn}>
              <div
                className={css.stepCircle}
                style={{
                  background: isActive ? colors.primary : 'transparent',
                  color: isActive ? colors.on_primary : isCompleted ? colors.primary : colors.surface_container_highest,
                  border: `2px solid ${isActive ? colors.primary : isCompleted ? colors.primary : colors.surface_container_highest}`,
                }}
              >
                {isCompleted ? '\u2713' : stageNum}
              </div>
              <span
                className={css.stepLabel}
                style={{
                  color: isActive ? colors.primary : isCompleted ? colors.primary : colors.surface_container_highest,
                }}
              >
                {label}
              </span>
            </div>
            {i < STAGE_LABELS.length - 1 && (
              <div
                className={css.stepConnector}
                style={{
                  background: stageNum < currentStage ? colors.primary : colors.surface_container_highest,
                }}
              />
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
    <div className={css.channelSubRow}>
      {channels.map((ch, i) => {
        const isCurrent = ch === current;
        const isDone = !!mapping[ch];
        return (
          <span
            key={ch}
            className={css.channelTag}
            style={{
              background: isCurrent ? colors.primary : isDone ? 'rgba(255, 182, 147, 0.15)' : colors.surface_container_high,
              color: isCurrent ? colors.on_primary : isDone ? colors.primary : colors.on_surface,
              fontWeight: isCurrent ? 700 : 400,
            }}
          >
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
    <div className={css.dualStickRow}>
      <div className={css.stickColumn}>
        <StickBox x={leftX} y={leftY} yIsThrottle={true} xLabel="YAW" yLabel="THR" size={size} />
        <div className={css.stickColumnLabel}>Left Stick</div>
      </div>
      <div className={css.stickColumn}>
        <StickBox x={rightX} y={rightY} yIsThrottle={false} xLabel="ROLL" yLabel="PITCH" size={size} />
        <div className={css.stickColumnLabel}>Right Stick</div>
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
    <div className={css.stickBoxWrapper} style={{ width: size + 20, height: size + 20 }}>
      {/* Background */}
      <div className={css.stickBoxBg} style={{ width: size, height: size }} />
      {/* Horizontal center line */}
      <div className={css.stickBoxHLine} style={{ top: 10 + centerY, width: size }} />
      {/* Vertical center line */}
      <div className={css.stickBoxVLine} style={{ left: 20 + size / 2, height: size }} />
      {/* Dot — uses transform for GPU-composited positioning */}
      <div
        className={css.stickBoxDot}
        style={{ transform: `translate(${20 + dotX - 6}px, ${10 + dotY - 6}px)` }}
      />
      {/* X label (below box) */}
      <span className={css.stickBoxXLabel} style={{ left: 20 + size / 2 }}>
        {xLabel}
      </span>
      {/* Y label (left of box, rotated) */}
      <span className={css.stickBoxYLabel} style={{ top: 10 + size / 2 }}>
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
    <div className={css.axisBarsRow}>
      {axes.map((val, i) => {
        const center = centerOffsets[i] ?? 0;
        const adjusted = val - center;
        return (
          <div key={i} className={css.axisBarCol}>
            <div className={css.axisBarTrack}>
              <div
                className={css.axisBarFill}
                style={{
                  height: `${Math.abs(adjusted) * 50}%`,
                  transform: adjusted < 0 ? 'scaleY(-1) translateY(100%)' : undefined,
                }}
              />
              {/* Center marker if calibrated */}
              {center !== 0 && <div className={css.axisBarCenter} />}
            </div>
            <span className={css.axisBarLabel}>{i}</span>
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
    <div className={css.mappingSummary}>
      {channels.map(ch => {
        const config = mapping[ch] as AxisChannelConfig | undefined;
        return (
          <div key={ch}>
            <span className={css.mappingChannelLabel}>{ch.toUpperCase()}</span>: Axis {config?.axis ?? '?'}
            {config?.inverted ? ' (Inv)' : ''}
          </div>
        );
      })}
    </div>
  );
}
