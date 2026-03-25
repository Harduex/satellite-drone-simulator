import { colors, fonts, fontSizes } from '../theme';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
      <span style={{
        color: colors.on_surface, fontSize: fontSizes.body_sm, width: labelWidth,
        opacity: 0.7, fontFamily: fonts.body,
      }}>
        {label}
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: colors.primary }}
      />
      <span style={{
        color: colors.on_surface, fontSize: '0.75rem', width: '60px',
        textAlign: 'right', fontFamily: fonts.body,
      }}>
        {displayValue} {unit}
      </span>
    </div>
  );
}

// ── Shared Panel Header ──────────────────────────────────
export function SettingsPanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <h2 style={{ margin: 0, color: colors.on_surface, fontWeight: 400, fontFamily: fonts.display }}>{title}</h2>
      <button onClick={onClose} style={closeButtonStyle}>X</button>
    </div>
  );
}

// ── Shared Button Styles ─────────────────────────────────
export const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid ' + colors.outline_variant_strong,
  color: colors.on_surface,
  borderRadius: 0,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: fontSizes.body_md,
  fontFamily: fonts.body,
};
