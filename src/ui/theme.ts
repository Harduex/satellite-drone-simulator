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

