# Flight interface redesign

**Date:** 2026-10-20
**Scope:** Home, pause, settings and shared interaction states for simulator pilots.
**Status:** Flight deck implemented locally; shared settings, bottom launch dock and real 3D aircraft preview verified.

## Design

Keep the satellite map central. Use the Flight deck instrument-panel aesthetic:
neutral dark surfaces, warm orange primary actions, fine borders and clear
typographic hierarchy. Retain existing font assets initially to avoid adding font
requests. Layout and interaction quality take priority over decorative effects.

The home screen has a compact identity header and a bottom-centered launch dock,
bounded to 760px rather than stretched across the viewport. Search and quiet
Random location / My location actions form the upper row. A fine divider separates
the selected place and coordinates on the lower left from Fly Here on the lower
right. The dock stacks on narrow screens. Dimensions, spacing and framing follow
the shared [Flight deck design system](../../../DESIGN.md). Settings has its own clearly
labelled entry. Search, map clicks, saved defaults, loading, random eligibility
checks and launch errors retain their existing behavior. Provider attribution and
map controls remain visible. The shared Google map remains mounted during flight.

Use the neutral Graphite palette with the shared orange accent. Surfaces and
text have no green cast; exact palette values live in the design system tokens.

Pause uses two columns on wide screens: flight actions beside a lightweight
interactive quadcopter preview. Resume is primary. Restart from home follows;
Change Location and Random Location form a destination group. Save Current As
Default and Copy Location form a smaller location-tools group. Settings and
Developer tools remain separate entries. Narrow screens stack content and give
actions priority over the decorative preview.

## Settings contract

One settings shell serves home and pause. Controller retains the calibration
wizard and saved mappings. Flight contains audio, traffic, pedestrians, daylight,
stick display, camera FOV/tilt, wind and God mode. Advanced contains mass, drag,
motor response and spawn altitude. Developer tools exposes the existing diagnostics
toggle; telemetry export is available during a flight. Cache-only practice retains
its existing diagnostics implementation and session restrictions. Reset behavior
remains explicit and preserves its existing scope.

Settings use a labelled modal, contained keyboard focus, visible focus states and
focus restoration. Escape closes settings first; a subsequent Escape resumes the
paused flight. Opening settings never modifies preferences. Existing store actions
and session callbacks retain responsibility for changes.

## Preview contract

The repository has no detailed drone mesh. Render an original geometric X-frame
quadcopter matching the representative 5-inch configuration, with four motors,
propellers, battery and front camera. Reuse MOTOR_LAYOUT for motor placement.
Use local SVG/CSS geometry and perspective transforms; introduce no rendering
dependency, asset service or additional WebGL context. Pointer movement tilts and
turns the preview within bounded angles; pointer exit returns to its resting pose.
Any idle motion stops for reduced-motion preferences. Touch and keyboard users
receive the static preview without losing access to actions. Preview failure must
not affect Resume or settings.

## Interaction and layout contract

All interactive controls have hover, focus-visible, active and disabled states.
Long place names, controller identifiers, errors and values wrap or truncate within
their containers. Meaningful truncated labels retain accessible full names.
Important instructions and errors wrap rather than disappear. Flex/grid children
can shrink; buttons retain usable hit areas. Menus scroll within short viewports,
and primary actions remain reachable. Audit the HUD and recording/diagnostics
surfaces for the same overflow defects without changing their responsibilities.

Use functional headings (selected destination, Paused, Settings). Omit promotional
captions, brand taglines and repeated section labels. Keep location coordinates,
action labels, useful instructions, errors and provider/model attribution visible.

## Verification

Exercise search/autocomplete, map selection, random selection/loading/failure,
launch, pause/resume, restart, location actions and settings navigation. Verify
controller mappings survive opening/closing settings, advanced controls are hidden
by default, and telemetry/diagnostics remain reachable. Test modal Escape/focus
behavior and preview pointer/reduced-motion behavior. Check desktop and narrow
layouts, long labels, hover/focus states, console errors, keyboard throttle ramping
and live HUD. Run affected automated tests and the production build. Provider or
connected-controller blockers are reported explicitly.

## Boundaries

Physics, controller mapping logic, map services, tile loading and provider access
remain outside this redesign. Reuse existing store preferences and callbacks.
The preview represents the simulated configuration; it does not add an in-world
drone model or a drone-selection system.
