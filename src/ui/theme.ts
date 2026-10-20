// ── Design Token System ─────────────────────────────────────
// Centralizes all DESIGN.md values. Every UI component imports from here.
// See DESIGN.md for the "Kinetic HUD" creative specification.

// ── Colors ──────────────────────────────────────────────────
export const colors = {
  // Surfaces (depth via tonal layering, not shadows)
  surface: '#121213',
  surface_container_lowest: '#0d0d10',
  surface_container_low: '#1c1c1f',
  surface_container: '#222226',
  surface_container_high: '#2b2b30',
  surface_container_highest: '#35353d',
  surface_bright: '#404048',

  // Accent
  primary: '#ffbd70',
  primary_container: '#ffab55',
  on_primary: '#121213',
  secondary: '#bdf4ff',
  secondary_container: '#1a3a42',

  // Text
  on_surface: '#f0eeeb',
  on_surface_variant: '#c8c6cc',
  on_surface_muted: '#a6a5ac',

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
  cta: 'linear-gradient(135deg, #ffbd70, #ffc98c)',
} as const;

