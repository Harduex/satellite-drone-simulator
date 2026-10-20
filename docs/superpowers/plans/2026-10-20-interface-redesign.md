# Flight deck implementation plan

**Goal:** Implement the approved D1 Flight deck, P1 Graphite, Afterburn launch arrangement and real model preview.
**Spec:** [Interface design](../specs/2026-10-20-interface-redesign.md).
**Execution:** Native implementation on `codex/flight-deck-ui`; preserve existing map, session and controller state.

## Tasks and verification

- [x] Shared settings: one accessible modal for both entry points; Flight, Controller, Advanced and Developer categories. Add regression tests for advanced disclosure, Escape staying paused, focus containment/restoration, unchanged mappings and existing callbacks. Reuse store actions; preserve reset scope.
- [x] Home and pause: Graphite tokens, bottom launch dock, grouped pause actions, complete interaction states, responsive wrapping. Preserve the mounted map and existing search/random/error guards. Run picker/pause/recording tests.
- [x] Real preview: source and attribute a redistributable FPV GLB, bundle it locally, render via existing Cesium in a dedicated world renderer. UI owns mount/pointer lifecycle only. Load on pause, respect reduced motion, dispose render resources on close; failure leaves menu usable. Test disposal/failure and verify loaded geometry and mouse response in browser.
- [x] Final checks: affected tests, full suite, production build; live search, launch, HUD, pause/settings/resume, keyboard ramping and console checks. Inspect long labels and narrow layout. Review the whole diff, scan staged content with a self-tested secret scanner, and commit locally.

## Constraints

No new external service, rendering framework or physics changes. A real 3D model replaces the prototype drawing. Graphite removes green surfaces; all screens share Flight deck styling. Developer telemetry stays reachable. The implementation is approved; ordinary design details are settled in this session without additional approval gates.
