# Saved places and recent flights

**Date:** 2026-10-24 (as-built: 2026-10-24)
**Scope:** UI-FAVORITES: bookmark places and return directly to favorites or recent flight locations.
**Status:** Authoritative. Implemented locally in `src/store/placesSlice.ts`, `src/ui/Places/PlacesDialog.tsx` and `src/game/SimSession.ts`.

## Design

A Places menu is available from the location picker and pause menu.
Favorites and Recent are separate lists within that menu.
Selecting a place starts loading its flight immediately through `SimSession.startSession()`.
The existing Fly Here action remains available for map and search selections.
Locations stay in this browser through Zustand and local storage, following existing settings persistence.

| ID | Behavior | Reason |
| --- | --- | --- |
| S1 | Launch immediately when a favorite or recent place is selected | Direct return to a known place without an additional Fly Here step |
| S2 | Save the selected map location from the picker; save the drone's current horizontal position from pause | Reuse picker selection and `getCurrentLocationForPicker()`. Saving from pause must not silently bookmark the original launch point |
| S3 | Allow custom favorite names, renaming and removal | Map clicks and current-position bookmarks otherwise have coordinate-only labels. Trim names and limit them to 80 characters |
| S4 | Keep the latest 20 distinct successful launch locations, newest first | Record the actual accepted spawn location, including random starts. Failed, ignored or cancelled launches do not enter Recent |
| S5 | Keep up to 50 favorites; refuse additions at the limit with a clear message | Do not evict an existing favorite silently. Bounded local storage without silent eviction |
| S6 | Match places using latitude/longitude rounded to six decimal places | Repeated launches move one Recent entry to the front. Bookmarking an existing favorite does not create a duplicate |
| S7 | Allow removing individual Recent entries and clearing Recent; keep favorites independent | Removing history does not remove a bookmark. Add a favorite directly from a Recent entry |
| S8 | Keep default-location behavior and existing settings reset semantics | Favorites do not replace Save Current As Default or change spawn altitude |

The Places menu uses a native dialog, following `SettingsDialog` focus and Escape behavior.
Closing from pause returns to the paused flight; Escape closes Places before any flight-resume shortcut.
Use existing graphite panels, button classes, spacing and mobile viewport constraints from [the design system](../../../DESIGN.md).
The lists scroll inside the dialog. Place names and coordinates remain readable with long names and empty lists.
Save and rename use labeled inline inputs. Validation errors appear beside the affected control.

## Approach

Extend the existing client-side store and session ownership. Add a dedicated places slice and persistence adapter beside their existing siblings.
Reuse `SavedLocation`, `SettingsPersistence.isFiniteLatLng()` and the current session launch flow.
Reuse one Places dialog from the picker and pause menu, with session actions passed through their existing owners.
UI components do not access Cesium or calculate the current drone position.

| Approach | Decision / tradeoff |
| --- | --- |
| Immediate launch through existing session lifecycle | Selected. Fast return to a known place; switching away from a paused flight replaces that flight |
| Select a map marker, then press Fly Here | Not selected. Adds another step when returning to a saved place |
| Account-backed cloud storage | Outside scope. Local persistence already serves the browser simulator without a backend or sign-in |

## Persistence and failure behavior

Persist one versioned document: `fpvsim_places`, containing `version: 1`, `favorites` and `recent` arrays.
Each entry stores only `lat`, `lng` and `name`. Favorites and Recent have independent names and ordering.
Recent uses launch order rather than timestamps. Selecting a saved random location reuses its coordinates, without random replacement attempts.
Stored coordinates seed the existing safe-surface search, so the final drone spawn can move nearby.
Coordinates are finite numbers within latitude/longitude bounds. Stored names are nonempty trimmed strings with the same 80-character limit.
Stored content is untrusted: validate its version, shape, entries, duplicate keys and list limits before use.

| When | Result |
| --- | --- |
| No saved places | Show an empty-state explanation and available bookmarking actions |
| Invalid coordinates or empty favorite name | Reject the edit or addition; keep existing entries |
| Malformed storage or unsupported version | Start with empty in-memory lists; do not rewrite storage merely by reading it |
| Invalid entries inside a supported document | Keep valid entries, remove duplicate keys and enforce list limits during reading |
| Storage unavailable or quota exceeded | Keep changes in memory; show that changes could not be saved and are available for this session only |
| Launch is loading | Disable conflicting place actions and show the selected place as loading; block duplicate launch requests |
| Launch fails | Keep favorites and Recent unchanged. Show retry and return-to-picker actions; never offer Resume for a disposed flight |
| Random launch retries a different candidate | Record only the location that actually completes loading |

## Surfaces and acceptance

| Surface | Scope |
| --- | --- |
| Location picker | Places button and bookmarking the selected location; preserve search, map clicks, Random location and Fly Here |
| Pause menu | Places button and bookmarking the current position; preserve default-location and copy actions |
| `SimSession` | Record history after successful loading; own position capture and launch/replacement cleanup |
| Store and persistence | Validated bounded lists; add, rename, remove and clear operations; explicit persistence failure feedback |
| Verification | Store/persistence boundaries, duplicate handling, successful/cancelled/failed launches, dialog keyboard flow, reload persistence and immediate launching |

Run affected tests and the production build. Browser verification covers picker search/launch, saved-place launch, pause, keyboard throttle ramping and console errors.
Check desktop and mobile dialog layout, keyboard focus, current-position bookmarking and list persistence after reload.

## Out of scope

Cloud sync, import/export, folders, thumbnails, map routes and destination guidance remain outside this change.
Favorites save horizontal position and a name, not altitude, orientation, flight state or settings.
Existing spawn-altitude settings remain unchanged.
