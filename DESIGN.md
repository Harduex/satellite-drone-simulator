# Flight deck design system

The map and flight view are the focus. UI uses neutral graphite surfaces, warm
orange primary actions, restrained borders and concise functional labels. Avoid
promotional captions, decorative numbering and repeated headings.

## Sources of truth

- `src/ui/theme.css`: colors, typography, spacing, control geometry and global
  interaction states. Use CSS custom properties in component styles.
- `src/ui/theme.ts`: matching colors and gradients for JavaScript consumers.
  Dimensions and framing belong in CSS, not in a second JavaScript token table.
- `src/ui/controls.module.css`: primary, secondary and quiet buttons, compact
  labels and the shared brand. Reuse these classes before defining controls.
- [Interface design](docs/superpowers/specs/2026-10-20-interface-redesign.md):
  picker, pause and settings behavior and responsive layout contracts.

## Palette and typography

| Role | Token / value | Use |
| --- | --- | --- |
| Base surface | `--color-surface` / `#121213` | Header, settings sidebar, recessed inputs |
| Panel surface | `--color-surface-container-low` / `#1c1c1f` | Floating picker and settings content |
| Hover surface | `--color-surface-container-high` / `#2b2b30` | Hover and active navigation |
| Primary | `--color-primary` / `#ffbd70` | Main action and selected-location accent |
| Text | `--color-on-surface` / `#f0eeeb` | Titles and action labels |
| Secondary text | `--color-on-surface-variant` / `#c8c6cc` | Secondary controls and descriptions |
| Muted text | `--color-on-surface-muted` / `#a6a5ac` | Coordinates, supporting instructions |
| Fine frame | `--color-outline-variant` / 20% neutral | Panel/input borders and section dividers |
| Focus | `--color-secondary` / `#bdf4ff` | Keyboard focus outline |

Use existing Space Grotesk display and Inter body assets. Reuse `--fs-*` size
tokens where applicable. A selected destination is a 16px medium-weight title;
coordinates are 11px supporting text with tabular numerals. Longer content wraps
or truncates within its container; truncated place names retain a full title.

## Dimensions and framing

| Role | Token | Dimension |
| --- | --- | --- |
| Standard control | `--control-height` | 44px minimum |
| Search / prominent action | `--control-height-prominent` | 48px minimum |
| Compact nested action / close control | `--control-height-compact` | 36px minimum |
| Icon / text gap | `--control-gap` | 12px |
| Control corners | `--radius-control` | 2px |
| Panel corners | `--radius-panel` | 0px |
| Floating panel shadow | `--shadow-panel` | Diffuse shadow against detailed map imagery |

Spacing scale: `--space-xs` 4px, `--space-sm` 8px, `--space-md` 16px,
`--space-lg` 24px, `--space-xl` 32px. Use 24px panel padding on desktop,
16px on mobile, and 16px between related groups. Content-specific widths and
responsive breakpoints stay local to the component.

Panels have a 1px fine frame and square corners. Inputs use the same fine frame
with 2px corners and a recessed surface. Buttons use 2px corners. Keep the orange
primary action solid; secondary controls use a fine outline, while quiet actions
have no frame. Thin outline icons share a consistent stroke and retain text
labels. Do not use different corner treatments for controls within one panel.

## Picker composition

The bottom-centered panel is 760px wide at most, with viewport margins and no
stretch across wide monitors. Search is the primary entry point on the upper
row, followed by quiet Random location and My location actions. One fine divider
separates discovery from the selected destination and coordinates on the lower
left, with Fly Here on the lower right. This aligns the destination with the
action it will perform.

On smaller screens, discovery shortcuts move below search. On mobile, Fly Here
spans the panel width beneath the location. Panel height is bounded and scrollable
in short viewports. Keep map attribution visible; preserve search/autocomplete,
map selection, launch errors and existing loading/disabled states.

## Interaction and accessibility

All controls retain visible keyboard focus, hover, pressed and disabled states.
Use semantic buttons, labelled inputs and decorative SVG icons hidden from
assistive technology. Loading actions communicate progress in their labels;
errors remain readable and use `role="alert"`. Respect reduced-motion preferences.
Settings contains keyboard focus and restores it on close. Escape closes
settings before resuming a paused flight.
