# Flight Recording Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Execution remains in this session, consistent with the preference for the assistant to do the work itself.

**Goal:** Save clean short FPV flight videos with drone sound and provider attribution.

**Architecture:** `SimSession` owns a `FlightRecorder` across flight locations. A world adapter composes Cesium frames and credits onto a fixed-size canvas; a `DroneAudio` branch supplies the existing sound. Zustand holds display state, and app-level controls expose capture and finished clips without storing media resources in React or the store.

**Tech Stack:** Existing TypeScript, CesiumJS, React, Zustand, Vitest/jsdom; browser Canvas, MediaRecorder, MediaStream, and Web Audio APIs. No new dependencies.

**Spec:** [Flight recording design](../specs/2026-10-04-flight-recording-design.md).

## Execution record — 2026-10-04

Tasks 1–6 are implemented locally. The task briefs below retain the original
planned scope; the following record distinguishes actual checks from coverage
limits.

- V1: Full suite: 297 tests in 34 files pass; production build passes. A fresh
  review reproduced and fixed attribution-fit publication, current-frame credit
  timing, and disposal during pending flight startup, with regression tests.
- V2: Chrome/Playwright: initial load, location autocomplete, Fly Here, HUD,
  minimap, keyboard throttle ramp (0%, 5%, 37%), and ESC pause/resume work.
  A connected radio takes precedence over keyboard input; the keyboard check
  simulated a disconnected radio. The final browser pass had no page errors or
  unexpected console errors.
- V3: A downloaded 1280 × 720 MP4 plays with non-silent drone audio, provider
  logos and complete credits, without application overlays. The recorder's
  video track reports a 60 fps target. Pause held the timer unchanged; resume
  continued capture. Resize preserved output dimensions. A second clip after
  discard and leaving a location with a retained download both work.
- V4: Forced supported WebM fallback plays decoded video frames with audio;
  muted capture decodes to silence. Owned audio/video tracks are ended after
  finalization. Native MP4 encoding of a synthetic scene stopped at the byte
  threshold and finalized a playable 295,341,551-byte clip. That stress check
  requested 100 Mbps to reach the threshold quickly; production requests
  8 Mbps. The final chunk can exceed the 256 MiB threshold. Native WebM
  finalized at the duration limit using an accelerated injected clock; a full
  five-minute wall-clock soak was not performed.
- V5: In the same warmed Chrome view, RenderDiagnostics reported 60 FPS and
  16.7 ms/frame with capture off and on. This is one local observation, not a
  hardware guarantee. Capture track cleanup was observed; sustained heap
  retention across many recordings remains unmeasured.
- V6: A visibility event in Chrome pauses an active recorded flight and
  returning visibility does not resume it. Headless Chrome kept both tabs
  visible, so an actual background-tab transition remains unverified.
  Download retry, startup cancellation, overlapping stop, and encoder errors
  are covered by unit tests; real browser encoder-error recovery and browsers
  other than Chrome remain unverified.

General provider video-use permission remains unresolved. No publishing or
provider authorization is implied by these local checks. Local media, logs and
scanner fixtures remain outside the repository.
## Global constraints

- G1: Exclude HUD, minimap, menus, crash flash, and recording controls; preserve current provider branding and full data attribution.
- G2: Fixed output dimensions fit within 1920 × 1080, preserve initial viewport aspect, use even dimensions, and never upscale. Resize by letterboxing. Target at most 60 fps.
- G3: Prefer supported MP4 with audio, then WebM; use the actual recorder MIME type for Blob and extension. Request 8 Mbps video and 128 kbps audio, with one-second chunk delivery.
- G4: Stop at 300 recorded seconds or 256 MiB encoded chunks. Pauses do not advance elapsed recording time. The byte limit is a chunk threshold, not a guaranteed peak-memory ceiling.
- G5: One completed clip survives location changes; download permits retry and does not discard it. Replacement/discard releases media resources. Reload loses unsaved footage.
- G6: No new product dependencies, Cesium/core imports in UI, media objects in Zustand, or recording work in the 500 Hz physics loop. Follow existing test patterns.
- G7: Public provider credit APIs and standard DOM access only; no private Cesium fields or selectors coupled to internal CSS class names.
- G8: Verify browser behavior on `http://localhost:5173`, existing tests, and build. Do not push, publish, or send external messages without explicit approval.
- G9: Before each significant local commit, inspect complete staged diff/list/metadata, verify the public noreply identity, run a redacted secret scan, and verify scanner detection with a synthetic secret outside the repository.
- G10: Local development can proceed; release of general flight recording requires confirmation that the applicable provider agreement permits it. Approval of this plan does not establish provider permission.

## Review focus

- R1: Stop or location exit during asynchronous frame/logo setup cannot leave a recorder attached to the next flight. Pin with a deferred-start test in Task 3 and exit-order test in Task 4.
- R2: Long or changing tile attribution remains complete and readable without private Cesium fields. Pin wrapping and credit-refresh tests in Task 2, then inspect real footage in Task 6.
- R3: Browser support checks can succeed while recorder construction/start fails. Pin rollback and retry tests in Task 3.
- R4: Pause, hide-tab, resize, and exit can overlap. Pin duplicate-finalization and paused-stop tests in Task 4, then exercise overlaps in Task 6.
- R5: Discarding or replacing a clip must revoke the old URL without disconnecting speaker audio. Pin resource-ownership tests in Tasks 1 and 3, then test a second clip in Task 6.

## File map

| Files | Responsibility |
| --- | --- |
| `src/store/recordingSlice.ts`, `src/store/index.ts` | Serializable recorder snapshot and store composition. |
| `src/game/DroneAudio.ts` | Temporary recording audio branch, independently disposable. |
| `src/world/RecordingFrameSource.ts` | Fixed canvas size, scene-frame composition, attribution assets, and render cleanup. |
| `src/game/FlightRecorder.ts` | Browser capability negotiation, capture lifecycle, chunk limits, finished Blob/download ownership. |
| `src/game/SimSession.ts` | Connect recording to flight phase, pause/resume, reset, location departure, and disposal. |
| `src/ui/RecordingControls/RecordingControls.tsx`, `.module.css` | Record/Stop, timer, finished clip actions, and error messages. |
| `src/ui/App.tsx`, `src/ui/SimView/PauseMenu.tsx`, `src/ui/ServiceProvider.tsx` | Persistent control placement, R/visibility handlers, exit/disposal integration. |
| Tests beside owning modules under existing `__tests__/` directories | Meaningful lifecycle, frame, audio, store, session, and shortcut coverage. |
| `README.md`, design and plan documents | Explain controls, limits, supported formats, and verified implementation status. |

## Task 1: Recording state and audio branch

**Files:** Create `src/store/recordingSlice.ts` and `src/store/__tests__/recordingSlice.test.ts`; modify `src/store/index.ts`, `src/game/DroneAudio.ts`, and `src/game/__tests__/DroneAudio.test.ts`.

**Interfaces:** Export `RecordingStatus = 'idle' | 'recording' | 'paused' | 'finalizing' | 'ready' | 'error'`, `RecordingErrorCode` with the spec's seven codes, and `RecordingSnapshot` with `status`, `elapsedSeconds`, `encodedBytes`, `filename: string | null`, `error: { code: RecordingErrorCode; message: string } | null`, and `stopReason: 'user' | 'duration' | 'size' | 'session_exit' | 'encoding_error' | null`. `RecordingSlice` exposes `recording: RecordingSnapshot` and `setRecording(snapshot: RecordingSnapshot): void`; compose `createRecordingSlice` into `AppStore`. Export `RecordingAudioSource { stream: MediaStream; dispose(): void }` from `DroneAudio.ts`; add `DroneAudio.createRecordingSource(): RecordingAudioSource`.

- Write failing tests using the existing fake audio-context helper: recording master connects to both speaker and recording destination; disposing the branch twice disconnects only its destination; source tracks stop once; muted volume reaches the recording branch; missing audio context raises a recoverable startup error. Store tests assert serializable defaults and immutable snapshot replacement without altering session phase.
- Run `npm run test -- src/game/__tests__/DroneAudio.test.ts src/store/__tests__/recordingSlice.test.ts`; verify the new behaviors fail before implementation.
- Implement snapshot types/defaults and the master-output branch using `createMediaStreamDestination()`. Keep existing playback behavior; branch disposal owns its destination and tracks, never the speaker destination or context.
- Run the targeted tests and `npm run build`; require passes. Review and locally commit `feat: add recording state and drone audio capture` after G9.

## Task 2: Fixed-size scene frames and attribution

**Files:** Create `src/world/RecordingFrameSource.ts` and `src/world/__tests__/RecordingFrameSource.test.ts`. Modify `src/world/TileLoader.ts` only if full tile credits are not already displayed through the public API.

**Interfaces:** Export `RecordingFrameSource { canvas: HTMLCanvasElement; dispose(): void }`, `getRecordingDimensions(width: number, height: number): { width: number; height: number }`, and `createRecordingFrameSource(viewer: Cesium.Viewer): Promise<RecordingFrameSource>`. The adapter reads `viewer.canvas` and the documented `viewer.cesiumWidget.creditContainer`; it owns the recording canvas, attribution asset cache, and postRender listener.

- Write failing tests with fake canvas/context and `Cesium.Event`: 3840 × 2160 becomes 1920 × 1080; 1280 × 720 remains unchanged; 3440 × 1440 becomes 1920 × 802; invalid or sub-two-pixel dimensions reject. Assert fixed output size after resize, centered letterboxing, no more than 60 composed frames per second, complete wrapped credits, attribution refresh, and listener removal on disposal. Include failed logo loading and disposal during pending setup.
- Run `npm run test -- src/world/__tests__/RecordingFrameSource.test.ts`; require failure of new cases.
- Implement drawing after Cesium rendering, throttled to 60 fps. Use standard DOM traversal of the public credit container to collect provider text and image sources; do not depend on Cesium class names or internal credits collections. Preserve supplied logos, cache asset loads, and wrap all attribution without ellipsis. If tile credits live only in the popup, use the documented tileset `showCreditsOnScreen` setting so the public container exposes full credits. Any unreadable or unloadable required attribution prevents capture instead of silently omitting it. Keep attribution within readable bounds of the exported canvas.
- Run targeted tests and build; require passes. Review and locally commit `feat: compose clean flight frames with attribution` after G9.

## Task 3: Recorder lifecycle and finished-clip ownership

**Files:** Create `src/game/FlightRecorder.ts` and `src/game/__tests__/FlightRecorder.test.ts`.

**Interfaces:** `FlightRecorder` accepts `createFrameSource: () => Promise<RecordingFrameSource>`, `createAudioSource: () => RecordingAudioSource`, and `publish: (snapshot: RecordingSnapshot) => void`. Expose `start(): Promise<void>`, `pause(): void`, `resume(): void`, `stop(reason?: RecordingSnapshot['stopReason']): Promise<void>`, `download(): void`, `discard(): void`, and `dispose(): Promise<void>`. Inject a narrow browser runtime for `MediaRecorder`, time, and object-URL/download operations in unit tests; production defaults use native APIs. Reuse the source interfaces from Tasks 1–2.

- Write failing tests with fake recorder events/tracks and Vitest fake timers: MP4/WebM negotiation; supported-check success followed by constructor/start failure; asynchronous startup cancelled by stop; final data arriving before stop completion; duplicate start/stop; pause-adjusted elapsed time; stop at exactly 300 seconds or 256 MiB; empty clip; partial clip on encoder error; ending tracks; download retry; discard/replacement; object URL revocation; resource cleanup exactly once. Exercise one full fake-event lifecycle rather than mirroring private fields.
- Run `npm run test -- src/game/__tests__/FlightRecorder.test.ts`; require failures before implementation.
- Implement a serialized lifecycle with a generation guard for pending setup and one shared finalization Promise. Capture the composed canvas stream at 60 fps, combine it with source audio, and record at the G3 targets. Count only active time with a monotonic clock; check duration independently of render-frame delivery and bytes on each chunk. Preserve nonempty encoded data after a recoverable encoder failure; show the warning with a ready clip. Do not claim a partial clip is playable until browser verification. Keep finished Blob/object URL outside Zustand; filename extension follows the recorder's actual MIME type. Reject a pending clip on start, and make discard/disposal idempotent.
- Run targeted tests and build; require passes. Review and locally commit `feat: record and download bounded flight clips` after G9.

## Task 4: Integrate flight lifecycle

**Files:** Modify `src/game/SimSession.ts`, `src/ui/ServiceProvider.tsx`, and `src/ui/SimView/PauseMenu.tsx`; create `src/game/__tests__/SimSession.recording.test.ts`.

**Interfaces:** Add `SimSession.startRecording(): Promise<void>`, `stopRecording(): Promise<void>`, `downloadRecording(): void`, `discardRecording(): void`, and `dispose(): Promise<void>`. Keep the recorder alive across locations; `endSession(): Promise<void>` and `changeLocationFromPause(): Promise<void>` await finalization. Consumers handle these Promises without unhandled rejections. Continue using synchronous `pause(): void`, `resume(): void`, and `reset(): void`.

- Write failing session tests with mocked existing world/audio/loop dependencies: start only while FLYING; paused recording stops; pause precedes audio suspension; resume restores audio before capture; reset retains the clip and recording; repeated exit joins one finalization; exit during pending start cancels setup; finalization precedes audio disposal/container hiding; error cleanup still leaves the session; completed clip survives a location change; application disposal discards it.
- Run `npm run test -- src/game/__tests__/SimSession.recording.test.ts`; require the new cases to fail.
- Construct the recorder once per session owner with factories that resolve the current viewer/audio. Route snapshots to `setRecording`. Serialize recording starts and exits; block a new session while source teardown is pending. Update Promise signatures at all call sites, including pause-menu callbacks. Add application-owner cleanup only for owned recording resources and existing session teardown; verify against React development remount behavior rather than adding unrelated provider refactoring.
- Run targeted session/audio/recorder tests and build; require passes. Review and locally commit `feat: synchronize recording with flight lifecycle` after G9.

## Task 5: Controls, keyboard shortcut, and visibility

**Files:** Create `src/ui/RecordingControls/RecordingControls.tsx`, `src/ui/RecordingControls/RecordingControls.module.css`, and `src/ui/RecordingControls/__tests__/RecordingControls.test.tsx`; modify `src/ui/App.tsx` and `src/ui/SimView/PauseMenu.tsx`.

**Interfaces:** `RecordingControls({ session }: { session: SimSession })` reads `recording` and `phase` from Zustand and calls only the session facade. Mount once in the app shell so finished clips remain available in PICKER. Extend the existing app keyboard handler for unmodified `KeyR`; register a visibility handler that pauses only an active recorded flight and never auto-resumes.

- Write failing jsdom tests with React's existing runtime APIs (`createRoot`/`act`), no added test-library dependency: record during flight, stop while paused, finalizing disabled state, formatted timer, ready Download/Discard, recoverable error text, and no recording-start action in PICKER/PAUSED. Dispatch keyboard/visibility events to verify editable elements, key repeat, modifiers, and hidden-tab explicit resume behavior.
- Run `npm run test -- src/ui/RecordingControls/__tests__/RecordingControls.test.tsx`; verify failures of the new behavior.
- Implement accessible buttons, focus styles, REC indicator, elapsed display, limit reason, and Download/Discard actions using existing theme variables. Keep controls reachable above the pause overlay without intercepting flight input outside the buttons; hide active capture controls outside the relevant phases. Ignore R in inputs, textareas, selects, or contenteditable elements. Do not add confirmation dialogs; explicit discard/replacement actions express intent.
- Run targeted UI/session tests and build; require passes. Review and locally commit `feat: add flight recording controls and shortcut` after G9.

## Task 6: Real recording verification and documentation

**Files:** Update `README.md`, `docs/README.md`, the recording design, and this plan to reflect actual behavior and completed checks. Keep downloaded videos, screenshots, logs, and scanner fixtures outside tracked files.

- Run `npm run test` and `npm run build`; require all tests/build to pass. Use the configured development server on `http://localhost:5173` and available Chrome DevTools/Playwright capabilities, following the repository browser self-test. Report unavailable browser tooling or credentials precisely; do not ask the user to run checks the agent can run.
- Verify initial load, autocomplete/Fly Here, visible HUD and minimap when enabled, smooth keyboard telemetry, ESC pause/resume, and no fatal or unexpected console errors.
- Record, download, and play a short flight video. Check scene movement, drone audio changes/mute, readable current attribution/logos, actual MIME/extension, dimensions, and absence of HUD/minimap/menus/crash flash/recording controls. Check audio/video continuity around pause/resume. If the provider-use question prevents a real Google-content capture, use an existing permissible test scene only if one is available; otherwise mark real capture unverified instead of inventing a map subsystem.
- Repeat with resize, hidden tab, session exit during capture, second clip after discard, retry download, and overlapping lifecycle actions. Exercise five-minute and byte limits in a real browser; fake timers alone do not establish encoder behavior. Verify supported MP4/WebM branches and document browser-specific gaps.
- Compare recording on/off in the same warmed view through `RenderDiagnostics`; report rendered FPS, playback quality, input responsiveness, and memory/cleanup observations. No hard FPS guarantee is introduced.
- Review the complete branch against the spec with the applicable code-review/verification skills. Resolve verified findings and rerun affected checks. Reconcile documentation with the implementation; preserve unresolved provider-release permission as a release condition, not a claim of approval.
- Inspect complete staged diff/list/metadata and run the G9 safety checks; locally commit verified documentation/fixes. Leave a clean working tree and report local commits, validation, and material limitations. Do not publish.

## Plan self-review

All C1–C10 contracts map to Tasks 1–5; V1–V5 map to targeted tests and Task 6. R1–R5 each have a named owning task and test. Shared types come from `recordingSlice`, audio/frame sources from their owning modules, and UI depends only on the session facade and store. Provider video-use permission remains a release condition separate from implementation correctness.

## Execution handoff

Recommended method: execute the six tasks directly in this session. The lifecycle interfaces are tightly related and the existing session owner already connects them; retaining one implementation context avoids repeated handoffs. Review and approval of this written plan precedes implementation. No delegation is required for routine tasks.
