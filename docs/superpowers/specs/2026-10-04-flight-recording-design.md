# Flight video recording

**Date:** 2026-10-04
**Scope:** Local video recording of short FPV flights, without flight overlays.
**Status:** Implemented locally; general provider video-use permission remains a release condition.

## Implementation notes

`FlightRecorder` owns encoded data and object URLs; Zustand receives serializable
snapshots only. `RecordingControls` owns the app-level R and visibility listeners.
`SimSession` finalizes capture before disposing source audio and cancels pending
flight startup on exit or application disposal.

`RecordingFrameSource` defers composition to a microtask after Cesium's
`postRender`, because Cesium updates its public credit container later in the
same render call. Frames and complete credits are composed on a staging canvas
before publishing to the captured canvas. Attribution loading or fit failures
prevent publication and end capture with a recoverable error. Logo loads time
out after ten seconds.

## TL;DR

Record the rendered flight and synthesized drone sound into a local video using browser media APIs. A Record/Stop button and R shortcut control capture; a timer remains visible in the app but absent from the video. Capture excludes the HUD, minimap, menus, crash flash, and recording controls; provider attribution remains visible in the exported footage. Output preserves the starting viewport aspect ratio, fits within 1920 × 1080 without upscaling, and targets at most 60 frames per second. Prefer supported MP4 with audio, otherwise supported WebM; actual frame rate depends on rendering and encoding performance. Pause recording with the flight and offer a download when stopped, at five minutes of recorded flight, or when leaving the location. Keep one finished clip in memory until downloaded and explicitly discarded or replaced; use a 256 MiB encoded-data limit in addition to the duration limit. All capture and encoding stay in the browser, using only application video and sound. Release requires confirmation that the applicable map-content agreement permits general flight videos; the documented promotional-video allowance alone does not establish this permission. Long recordings, replay data, video editing, uploads, and microphone capture are outside this design.

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│ UI / STORE                                              │
│ RecordingControls + ready clip actions [React] (NEW)    │
│ recordingSlice: status, timer, error [Zustand] (NEW)    │
│ SimView / PauseMenu / app shell [React] reused          │
└────────────────────────────┬────────────────────────────┘
                             │ sends recording actions to
                             │ [TS]
                             ▼
┌─────────────────────────────────────────────────────────┐
│ GAME                                                    │
│ FlightRecorder: encoding + one clip [TS] (NEW)          │
│ SimSession: recording lifecycle methods [TS] (NEW)      │
│ DroneAudio: stream destination branch [Web Audio] (NEW) │
│ Existing flight lifecycle and audio output reused       │
└────────────────────────────┬────────────────────────────┘
                             │ captures frames from
                             │ [Canvas]
                             ▼
┌─────────────────────────────────────────────────────────┐
│ WORLD / BROWSER                                         │
│ Recording frame + attribution adapter [Canvas 2D] (NEW) │
│ Cesium postRender and public credits reused             │
│ MediaRecorder / captureStream [Web APIs] reused         │
└─────────────────────────────────────────────────────────┘
```

The existing 500 Hz physics loop remains outside video capture.

The recorder belongs in `game/`, alongside `DroneAudio` and `RenderDiagnostics`. `world/` supplies rendered frames and visible provider credits; `ui/` interacts through `SimSession` and Zustand without importing Cesium or core physics. No product dependencies are added.

## The contract

| ID | Surface | Behavior |
| --- | --- | --- |
| C1 | `SimSession.startRecording()` | Starts only during `FLYING`, with a supported video/audio format, valid rendered frame dimensions, and no pending unsaved clip. Repeated starts during capture have no effect. |
| C2 | `SimSession.stopRecording()` | Finalizes once; repeated stops during finalization have no effect. Resolves after the last encoded chunk and resource cleanup. |
| C3 | `SimSession.downloadRecording()` | Downloads the completed Blob through a user action. Uses `flight-YYYYMMDD-HHMMSS.mp4` or `.webm`, matching the recorder's actual MIME type. Download keeps the clip available for retry. |
| C4 | `SimSession.discardRecording()` | Releases a finished clip and its object URL. Starting another recording requires explicit discard/replacement of the existing clip. |
| C5 | New `recordingSlice` | State: `idle`, `recording`, `paused`, `finalizing`, `ready`, or `error`; recorded elapsed seconds, encoded bytes, filename, and a user-facing error. Blob, tracks, audio nodes, and object URLs stay outside Zustand. |
| C6 | New `RecordingControls` | Record/Stop, REC indicator, timer, and Download/Discard for a completed clip. Ready controls remain available after a location change. Controls are keyboard-accessible. |
| C7 | R shortcut | Toggles start/stop during flight; stops an active paused recording from the pause menu. Ignore key repeats, modified shortcuts, and editable targets. Does not start a new recording while paused. |
| C8 | Limits | Finalize at 300 recorded seconds or 256 MiB encoded chunks, whichever occurs first. Byte limit is checked per chunk; a final chunk may exceed the threshold. The duration timer excludes pauses. |
| C9 | Dimensions | Fix output size at start; fit inside 1920 × 1080, preserve aspect ratio, use even pixel dimensions, and do not upscale. Letterbox subsequent viewport aspect changes rather than distort or restart. |
| C10 | Audio | Capture the existing master output at the selected flight volume. Muted flight produces silent audio. Audio capture failure prevents starting an audio/video recording and shows a recoverable error. |

Stable errors: `unsupported`, `not_flying`, `clip_pending`, `capture_failed`, `audio_unavailable`, `encoding_failed`, and `empty_clip`. Errors contain safe user-facing descriptions, not raw browser exception details.

Browser capability checks and runtime recorder errors remain authoritative; a positive `isTypeSupported()` response does not guarantee successful recording. No microphone, camera, desktop capture, server endpoint, or external authorization is involved.

## Resolution / flow

1. A user gesture starts capture through `SimSession`. Validate phase, clip ownership, dimensions, and browser support before allocating resources; this prevents duplicate recorders and accidental loss of an unsaved clip.
2. Attach a recording destination to `DroneAudio`'s existing master output. Preserve speaker playback and disconnect only the recording branch on cleanup.
3. Render a separate recording canvas from Cesium frames after rendering, scaled to the fixed output dimensions. Add the current provider logo and full visible data attribution using documented Cesium credit surfaces. Never capture DOM flight overlays or read private Cesium fields. Capture is bounded by the render rate and 60 fps; idle recording allocates no per-frame work.
4. Combine recording-canvas video and application audio into one stream. Select a supported audio/video MIME type, preferring MP4 then WebM. Ask `MediaRecorder` for approximately 8 Mbps video, 128 kbps audio, and chunks every second; bitrate requests are targets, not guaranteed limits.
5. Update recording status and elapsed time outside the physics hot path. ESC pauses the recorder before suspending drone audio; resume the sound context and flight together with capture. Paused menu time does not enter the clip. Hiding the tab pauses an active flight through the existing session controls; returning leaves it paused for explicit resume.
6. Stop at a user request, duration/byte limit, or location departure. Finish encoding before closing captured audio resources or hiding/destroying the source. Session exit awaits finalization; errors still permit leaving the session.
7. Retain at most one completed clip in a recording owner that survives location changes. Offer Download and Discard outside the flight-only view as needed. Stop owned tracks, remove render/visibility listeners, and disconnect recording audio nodes after finalization. Discard/replacement/disposal releases the Blob and object URL. Reloading or closing the page loses an unsaved clip.

## Key decisions

| ID | Decision | Why |
| --- | --- | --- |
| D1 | Browser recording with a composed canvas | Captures clean footage and current attribution at a fixed size without a screen-sharing picker or a video encoding dependency. A canvas copy adds GPU/CPU work only while recording. |
| D2 | Five-minute clips, one completed clip, 256 MiB stop threshold | At the requested 8.128 Mbps total bitrate, five minutes is approximately 305 MB. The byte guard may finish earlier, around four minutes at that rate, and bounds retained encoded chunks despite bitrate variation. Blob assembly can require additional memory. |
| D3 | Target 1080p/60, preserve viewport aspect | Caps encoder workload and avoids forcing camera/FOV changes. It does not promise 60 fps on a machine rendering fewer frames. |
| D4 | Match filename to actual browser format | A WebM Blob renamed `.mp4` is not an MP4 video. Capability negotiation avoids conversion overhead and misleading downloads. |
| D5 | Pause with the simulation | Removes frozen menu intervals while retaining one continuous clip. |
| D6 | Retain a clip after session exit | Changing location does not silently discard footage. Explicit replacement avoids accumulating several large Blobs. |

## Rejected alternatives

| Option | Why rejected |
| --- | --- |
| Browser tab/screen capture | Includes UI overlays and needs a screen-sharing selection; system audio availability varies. |
| Capture only the raw Cesium canvas | Omits attribution displayed in separate HTML and does not ensure fixed 1080p bounds. |
| Custom WebCodecs/muxer or FFmpeg conversion | Adds codec, muxing, and memory complexity for a short-clip feature already served by browser recording. |
| Save physics state and render later | Requires a replay subsystem and repeats tile/render work; it does not deliver a video recorded during the flight. |

## Failure modes

| When | Where | Result |
| --- | --- | --- |
| Browser lacks capture or a supported audio/video format | Start validation | Disable Record with an explanation; flight remains usable. |
| Capture, attribution assets, or audio setup fails | Start transaction | Clean up allocated resources; show a recoverable error and allow retry. |
| Rapid start/stop, shortcut repeat, or stop during exit | Recorder lifecycle | Serialize transitions; one recorder and one finalization result. |
| Encoder errors or track ends unexpectedly | Recorder events | Stop and clean up; retain a nonempty partial clip with a warning, otherwise report `empty_clip`. |
| Limit reached | Chunk handler / elapsed clock | Finalize once and offer the completed clip with the limit reason. |
| Window resizes | Frame composition | Preserve output dimensions and letterbox as necessary. |
| Tab becomes hidden | Visibility handler | Pause the flight and capture; explicit resume on return. |
| User changes location while recording | Session exit | Await finalization before source teardown; retain download controls after exit. |
| User reloads or closes the page | Browser lifecycle | Unsaved in-memory recording is lost; no promise of unload-time finalization. |
| Download is cancelled or blocked | Download action | Keep the clip ready for another user-triggered download. |

Recording failures release owned resources and preserve flight usability; any finalized nonempty clip survives until discarded, replaced, or page disposal.

## Analogous feature & parity

`DroneAudio` is the closest media lifecycle analog: `SimSession` owns it, `GameLoop` drives play/pause/update, `settingsSlice` owns audio volume, `FlightSettings` exposes volume, and `DroneAudio.test.ts` covers node cleanup. There is no existing video export feature.

| Surface | In scope? | Reason |
| --- | --- | --- |
| `SimSession` lifecycle | Yes | Own recorder start/stop/pause/resume and finalize before audio disposal. |
| `DroneAudio` and its tests | Yes | Expose a recording branch while preserving playback and cleanup. |
| `GameLoop` physics/audio update | No | Reuse existing sound output; recording does not enter the 500 Hz loop. |
| `settingsSlice` / `FlightSettings` | No | Reuse current flight volume; first version has fixed quality targets. |
| `SimView`, `PauseMenu`, app-level ready controls | Yes | Provide accessible capture and download actions across session transitions. |

## Verification

- V1: Unit tests cover duplicate calls, final chunk handling, format fallback, pause accounting, limits, failed startup, encoder failures, disposal, and clip replacement. Audio tests verify speaker output remains connected after recording cleanup.
- V2: Build and existing tests pass. Browser checks on `http://localhost:5173` cover load, location autocomplete/Fly Here, flight HUD, smooth keyboard telemetry, ESC pause/resume, and console errors.
- V3: Record a short real flight, download it, and play it locally. Verify changing scenery, audible motor changes, correct dimensions/MIME/extension, readable provider attribution, and absence of every flight overlay.
- V4: Test recording while resizing, pausing, hiding the tab, changing location, reaching both limits, downloading again, discarding, and recording a second clip. Test MP4 and WebM when the browser supports them; report unsupported branches accurately.
- V5: Compare recording on/off in the same warmed flight view using existing render diagnostics. Report frame-rate impact and recorded playback quality; verify flight input remains responsive and no recording work runs in the physics step.

## Provider requirements and sources

Preserve all supplied branding and data attribution. Cesium's [Google-content terms](https://cesium.com/legal/terms-for-google/) incorporate the [Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies). Those policies explicitly describe promotional videos of at most 30 seconds with additional conditions. They do not explicitly grant general five-minute end-user flight recording. Confirm applicable rights with the provider or an agreement that covers this use before releasing general flight recording; retaining attribution alone does not settle video-use permission.

Technical contracts follow [canvas capture](https://w3c.github.io/mediacapture-fromelement/), [MediaStream Recording](https://www.w3.org/TR/mediastream-recording/), and [Web Audio media stream destinations](https://www.w3.org/TR/webaudio/#MediaStreamAudioDestinationNode). Actual browser integration remains subject to runtime verification.

## Out of scope

- O1: Whole-flight/long-session recording, persistent libraries, replay data, and automatic recording.
- O2: HUD inclusion, alternate cameras, video editing, quality settings, transcoding, uploads, and sharing integrations.
- O3: Microphone/system audio, browser screen capture, changes to physics, or a new map provider.
