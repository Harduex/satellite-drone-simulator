// ── Design Token System ─────────────────────────────────────
// Centralizes all DESIGN.md values. Every UI component imports from here.
// See DESIGN.md for the "Kinetic HUD" creative specification.

// ── Colors ──────────────────────────────────────────────────
export const colors = {
  // Surfaces (depth via tonal layering, not shadows)
  surface: '#131314',
  surface_container_lowest: '#0e0e0f',
  surface_container_low: '#1c1b1c',
  surface_container: '#201f21',
  surface_container_high: '#2a292b',
  surface_container_highest: '#353436',
  surface_bright: '#3d3c3e',

  // Accent
  primary: '#ffb693',
  primary_container: '#ff6b00',
  on_primary: '#131314',
  secondary: '#bdf4ff',
  secondary_container: '#1a3a42',

  // Text
  on_surface: '#e8e6e3',
  on_surface_variant: '#c4c1bd',
  on_surface_muted: '#8a8884',

  // Semantic
  error: '#ff4444',
  warning: '#ffaa00',

  // Borders (ghost borders only — no opaque borders)
  outline_variant: 'rgba(228, 225, 220, 0.20)',
  outline_variant_strong: 'rgba(228, 225, 220, 0.40)',

  // Special
  crash_flash: 'rgba(255, 0, 0, 0.4)',
} as const;

// ── Gradients ───────────────────────────────────────────────
export const gradients = {
  cta: 'linear-gradient(135deg, #ffb693, #ff6b00)',
} as const;

// ── Typography ──────────────────────────────────────────────
export const fonts = {
  display: "'Space Grotesk', sans-serif",
  body: "'Inter', sans-serif",
} as const;

export const fontSizes = {
  display_lg: '2rem',
  display_md: '1.4rem',
  display_sm: '1rem',
  body_md: '0.9rem',
  body_sm: '0.85rem',
  label_sm: '0.6875rem',
  label_xs: '0.6rem',
} as const;

// ── Spacing ─────────────────────────────────────────────────
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
} as const;

// ── Elevation ───────────────────────────────────────────────
export const elevation = {
  none: 'none',
  ambient: '0 20px 50px rgba(0, 0, 0, 0.5)',
} as const;

// ── Radius ──────────────────────────────────────────────────
export const radius = {
  none: '0px',
} as const;

// ── Glass effect (floating panels) ──────────────────────────
export const glass = {
  background: 'rgba(32, 31, 33, 0.60)',
  backdropFilter: 'blur(20px)',
} as const;

// ── HUD-specific tokens ─────────────────────────────────────
export const hud = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontFeatureSettings: "'tnum'",
  textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
  labelStyle: {
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontFamily: "'Space Grotesk', sans-serif",
  },
} as const;
