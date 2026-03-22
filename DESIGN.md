# Design System Documentation: The Kinetic HUD

## 1. Overview & Creative North Star
**Creative North Star: The Kinetic HUD**
This design system is engineered for high-velocity decision-making and surgical precision. It moves away from the "friendly" rounded corners of the modern web, instead embracing the cold, calculated aesthetic of a drone pilot’s command center.

The system breaks the "template" look through intentional asymmetry—utilizing wide gutters and offset data blocks—and a typography scale that favors dramatic contrast between massive display headers and microscopic, high-density labels. We are not building a website; we are building a tactical overlay. The UI should feel like a projection on a glass cockpit: weightless, luminous, and absolute.

---

## 2. Colors
The palette is rooted in deep obsidian tones with high-luminance accents designed to draw the eye to critical telemetry data.

* **Primary (`#ffb693` / Safety Orange):** Reserved for active flight states, critical warnings, and primary action triggers.
* **Secondary (`#bdf4ff` / Electric Cyan):** Used for steady-state data, navigation, and secondary telemetry.
* **Neutral Surface (`#131314`):** The "void." A deep charcoal that provides the canvas for light-emitting elements.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for defining sections. Structural boundaries must be defined solely through background color shifts. Use `surface_container_low` against `surface` to denote a sidebar, or `surface_container_high` to define a workspace.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, semi-transparent glass panes.
* **Base:** `surface` (#131314)
* **Level 1 Container:** `surface_container_low` (#1c1b1c)
* **Active Overlays:** `surface_container_highest` (#353436)
Each nested layer should move "closer" to the pilot by increasing in tonal value, creating depth through luminance rather than drop shadows.

### The "Glass & Gradient" Rule
To achieve a high-end "cockpit" feel, main CTAs and hero elements should utilize a subtle linear gradient from `primary` (#ffb693) to `primary_container` (#ff6b00) at a 135-degree angle. For floating panels, use `surface_variant` with a 60% opacity and a 20px backdrop-blur to simulate frosted glass.

---

## 3. Typography
The typographic system utilizes a "High-Tech Editorial" approach, pairing the geometric aggression of **Space Grotesk** with the neutral, surgical legibility of **Inter**.

* **Display & Headlines (Space Grotesk):** Used for mission titles, status headers, and large-scale data points. The character of the font—sharp and wide—reinforces the "Drone Pilot" aesthetic.
* **Body & Titles (Inter):** Used for technical descriptions and navigational labels. Inter provides the high-performance legibility required for dense information environments.
* **Labels (Space Grotesk):** Set in `label-sm` (0.6875rem), these should often be uppercase with a 0.05em letter-spacing to mimic technical serial numbers and telemetry tags.

---

## 4. Elevation & Depth
In this design system, depth is a function of light and layering, not physics and shadows.

* **The Layering Principle:** Avoid shadows. Instead, place a `surface_container_lowest` (#0e0e0f) card on a `surface_container_low` (#1c1b1c) background to create a "recessed" look. Alternatively, use a `surface_bright` layer to indicate an elevated "pop-up" state.
* **Ambient Shadows:** If a floating effect is required (e.g., a modal), use an ultra-diffused shadow: `box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5)`. Never use harsh, dark-grey drop shadows.
* **The "Ghost Border":** For elements that require containment (like input fields), use the `outline_variant` token at 20% opacity. This creates a "barely-there" tactical frame that suggests a boundary without cluttering the visual field.
* **Sharp Corners:** The `roundedness` scale is set to `0px` globally. Every element—from buttons to cards—must feature hard, 90-degree corners to maintain the "Machined" look.

---

## 5. Components

### Buttons
* **Primary:** Solid `primary` color, `on_primary` text. Sharp corners. No shadow.
* **Secondary:** Ghost border (`outline_variant` at 40%) with `secondary` text.
* **States:** On hover, primary buttons should "glow" using a subtle outer box-shadow of the same color at 30% opacity.

### Input Fields
* **Style:** No background fill. Only a bottom border (Ghost Border style) or a full thin `outline_variant` frame at 20% opacity.
* **Typography:** All input text should use `body-md` (Inter) for maximum clarity.

### Cards & Lists
* **Rule:** Forbid the use of divider lines.
* **Execution:** Separate list items using `spacing.2` (0.4rem) of vertical white space or by alternating background tones between `surface_container_low` and `surface_container`.

### Tactical Overlays (Chips)
* **Design:** Small, rectangular blocks using `tertiary_container`. These should look like data tags on a radar screen.

### Navigation Highlighting
* Instead of a traditional underline or background change, use a 2px vertical "Active Bar" in `primary` orange to the left of the active menu item.

---

## 6. Do's and Don'ts

### Do:
* **Use Asymmetry:** Place data labels in the far corners of containers to maximize the feeling of a wide-angle HUD.
* **Embrace Monochromaticity:** Use 90% charcoal and black, saving the `primary` orange only for things that require immediate pilot intervention.
* **Prioritize Density:** High-performance users prefer seeing more data at once. Use the smaller end of the spacing scale (`0.5` to `2.5`) for internal component padding.

### Don't:
* **No Rounded Corners:** Never use `border-radius`. It breaks the tactical precision of the system.
* **No Generic Icons:** Use ultra-thin (1pt) stroke icons. Avoid "filled" or "chunky" iconography which feels like a consumer app.
* **No Soft Gradients:** Avoid "sunset" or "rainbow" gradients. If using gradients, keep them within the same tonal family (e.g., `secondary` to `secondary_container`).
* **No 100% Opaque Borders:** High-contrast borders create visual "noise." Stick to Tonal Layering or Ghost Borders.