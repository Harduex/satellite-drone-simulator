# Saved places implementation plan

> Execute inline with the existing implementation workflow. Track completed tasks and verification below.

**Goal:** Bookmark places and launch directly from favorites or recent successful flights.
**Architecture:** Reuse the existing Zustand slice structure, native dialog patterns and SimSession lifecycle. Add bounded local persistence and one shared Places dialog.
**Tech stack:** Existing TypeScript, React, Zustand and Vitest; no new dependencies.
**Spec:** [Approved design](../specs/2026-10-24-saved-places-design.md).

## Constraints

Work on master. Keep Cesium operations in session/world ownership. Preserve existing default location, settings, search and manual launch behavior.
Store at most 50 favorites and 20 recent places. Names have an 80-character limit; coordinates are validated and deduplicated to six decimals.
Commit verified significant work locally after public-safety checks. Do not push.

## Tasks and current state

- [x] T1: Add PlacesPersistence.ts and placesSlice.ts, integrate store/index.ts. Test valid reload, malformed/versioned storage, coordinate validation, caps, duplicate launches, rename/remove/clear and denied storage. Run the new store tests red then green.
- [x] T2: Record history only at SimSession successful-load completion; add session-owned current-position bookmarking access and saved-place launch with failed-switch cleanup. Extend existing SimSession random-location fixture tests for success, retry candidate, failure, cancellation and duplicate requests.
- [x] T3: Add PlacesDialog.tsx/CSS and tests; wire picker and pause. Cover immediate launch, inline add/rename, list removal, persistence warning, loading/retry, return-to-picker, focus restoration and Escape isolation. Keep existing design tokens and mobile sizing.
- [x] T4: Run affected tests, full suite and build; perform foreground browser checks on localhost:5173, including search, saved-place reload/launch, keyboard ramp, pause, responsive layout and console errors. Review full diff; fix material findings, reconcile docs and commit.

## Review focus and verification contract

| ID | Priority | Input / condition | Expected evidence |
| --- | --- | --- | --- |
| V1 | High | Malformed/version-mismatched storage and invalid coordinates | Store tests preserve valid entries and reject invalid content without a crash |
| V2 | High | Full lists and rounded duplicate coordinates | No silent favorite eviction; recent order bounded and deduplicated |
| V3 | High | Denied storage reads/writes | Session edits work and persistence failure is visible |
| V4 | Critical | Failed/cancelled/ignored or random-retried launch | Only actual completed launch enters Recent; failed replacement offers recovery |
| V5 | High | Escape/Tab during pause dialog | Dialog closes before flight resumes; focus remains usable |
| V6 | High | Launch click repeated during loading | One flight request; entry shows loading and errors allow retry |
| V7 | Medium | Long names, empty lists and mobile viewport | Names readable; scrolling and controls remain available |
| V8 | High | Reload, selection, current-position bookmark | Lists survive reload; selection launches directly; bookmark captures current coordinates |

Automated gates: `npm run test -- src/store/__tests__/placesSlice.test.ts src/ui/Places/__tests__/PlacesDialog.test.tsx src/game/__tests__/SimSession.randomLocation.test.ts`; `npm run test`; `npm run build`.
Browser gate: required repository protocol plus V7/V8 through a supported browser API. Record observed blockers explicitly.

## Execution record

Implementation complete locally. Store, session and dialog tests were added before their production behavior; initial runs demonstrated missing functionality.
The affected store/session/dialog run passed 35 tests. The full regression suite passed 679 tests across 83 files; `npm run build` passed.

Browser checks on localhost:5173 verified autocomplete selection, custom favorite naming, persistence of favorites and Recent after reload, immediate launch and paused-flight replacement.
Current-position bookmarking, rename, Escape isolation and 320px and 390px mobile layouts were exercised. Keyboard throttle responded to short inputs; flight reached 43 m horizontal travel and 28.6 m AGL with heading changes.
Final browser console inspection found no JavaScript errors. Failure, cancellation, duplicate starts, corrupt/denied storage, capacities and list removal have automated coverage.
The picker shortcut row wraps at narrow widths; a 320px check confirmed equal client and scroll widths after the adjustment.
An independent review found no remaining material issues. Existing safe-surface spawn adjustment remains in effect.

No new runtime dependencies or agent infrastructure were added. Transient session artifacts remain untracked.
