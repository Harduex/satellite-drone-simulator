# Sports traffic implementation plan

> Execute inline using the executing-plans workflow. Work directly on master under repository rules.

**Goal:** Three original retro sports-car silhouettes randomly mixed into ordinary traffic, with vivid yellow, red and blue body paint.

**Architecture:** Extend the existing traffic model manifest and Blender generator. Keep normal traffic paint and all driving behavior unchanged; select sports paint in the existing body shader.

**Tech stack:** Blender 5.0+, Python, TypeScript, Cesium, Vitest.

**Scope:** [LW1-SPORT](../../ROADMAP.md). Original stylized wedge, berlinetta and winged coupe inspired by retro Italian sports cars; no manufacturer geometry or branding. Preserve current actor caps, lifecycle, lighting and rendering budgets. No game-mode scoring or special driving behavior.

## Execution

- [x] Extend fleet coverage to all eight models and verify sports paint through the renderer's actual shader uniforms; run first and observe failure.
- [x] Extend the existing generator with three distinct sports shapes and shared export validation. Generate only the new assets; retain the existing five files.
- [x] Add model dimensions and paint category to the manifest; reuse random model selection and body-only shader. Verify fleet tests, renderer tests and build.
- [ ] Inspect the exported shapes and colors. Verify search/launch, flight movement/turn, pause, visible traffic and browser errors on localhost:5173. Shapes/colors and flight controls checked; nearby street appearance of each sports variant remains unverified.
- [x] Update attribution, documentation index and roadmap status to reflect verified results and any observed limitations. Review the diff, scan staged content with a synthetic-secret self-test, then commit locally.

## Coverage decisions

The main risks are missing fleet variants, incorrect model-to-length mapping, muted sports colors, paint leaking onto glass/tires, malformed exports and lifecycle/flight regressions. Tests exercise fleet membership and real shader uniforms; export checks cover bounds, materials and degenerate triangles. Browser inspection covers appearance and runtime behavior. Existing renderer tests retain coverage of failed loads, late loads, pause, disposal and environment exposure. Authentication and persistence changes are outside this local asset/configuration change.

- **TC1 (high):** Populate the existing 300-car fixture; all eight models appear with matching manifest lengths.
- **TC2 (high):** Load each sports model with each color index; shader body paint is vivid yellow/red/blue. Standard cars retain existing colors.
- **TC3 (high):** Generate and independently parse all three GLBs; each matches declared bounds and has valid triangles, four or fewer materials, ground contact origin and neutral body vertex colors.
- **TC4 (high):** Inspect all three silhouettes in a rendered preview, including body paint versus windows/wheels.
- **TC5 (high):** Perform the repository browser flight protocol and inspect nearby moving cars. Report unavailable provider/browser checks explicitly.

## Review focus

Keep model lengths unique because the existing simulation recovers model identity from length. Confirm all six existing random color indices map evenly onto the three sports colors. Preserve original asset bytes, daylight exposure and bounded loading/disposal behavior.
