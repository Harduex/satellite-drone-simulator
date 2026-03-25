import css from './shared.module.css';

// ── Shared Slider ────────────────────────────────────────
export function Slider({ label, value, min, max, step = 1, unit = '', labelWidth = 90, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  labelWidth?: number;
  onChange: (v: number) => void;
}) {
  const displayValue = step < 1
    ? value.toFixed(step < 0.1 ? 2 : 1)
    : String(value);

  return (
    <div className={css.sliderRow}>
      <span className={css.sliderLabel} style={{ width: labelWidth }}>
        {label}
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={css.sliderInput}
      />
      <span className={css.sliderValue}>
        {displayValue} {unit}
      </span>
    </div>
  );
}

// ── Shared Panel Header ──────────────────────────────────
export function SettingsPanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className={css.panelHeader}>
      <h2 className={css.panelTitle}>{title}</h2>
      <button onClick={onClose} className={css.closeButton}>X</button>
    </div>
  );
}
