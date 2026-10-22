# Bird encounters

**Date:** 2026-10-22
**Scope:** Continuous nearby bird encounters, solo flyers, swallows and drone avoidance.
**Status:** Proposed design; implementation requested, detailed behavior awaiting approval.

## Design

Bird encounters follow the flight route through gradual population turnover. The
simulation retains the existing 30-bird budget and 10 Hz update cadence. Birds
remain client-side, using packaged assets and the existing Birds switch.

| ID | Decision | Reason |
| --- | --- | --- |
| B1 | Retain watched birds; replace distant birds or groups individually outside the actual camera frustum | Avoid whole-population resets and protect ongoing chases. Distance alone cannot authorize visible removal. |
| B2 | Scatter encounters around the current flight area with varied bearings, heights and headings | Remove fixed north-facing placements. Use the real camera orientation, including tilt and aspect ratio, to test candidate visibility. |
| B3 | Start with two pigeon flocks of six, five gulls, nine swallows, three independent solo flyers and one eagle | Add variety within the existing 30-model budget. Solo pigeon, gull and swallow each have independent flock membership. |
| B4 | Keep visible or nearby chased birds alive while the drone travels | Population refresh cannot teleport a chase target. If no safe replacement is available, defer turnover. |
| B5 | Make swallows visibly distinct with pointed wings, a forked tail and fast banked flight | A recolored existing species does not satisfy the new bird type. Package an original animated model with reproducible source, following the traffic-asset generator pattern. |
| B6 | Strengthen existing avoidance with distance-sensitive escape steering, bounded turns, timed flock alarm propagation and gradual recovery | Birds react to approach without snapping direction. Independent birds do not receive another solo bird's flock alarm. |
| B7 | Drive flap/glide appearance from simulated flight state | Fleeing birds visibly flap; gliding birds hold an appropriate wing pose. Animation and motion freeze on pause. |

Replacement candidates begin beyond close encounter distance, outside the view
with a safety margin, and within the configured population radius. IDs remain
stable for surviving birds. Replacement poses start with matching previous and
current states so interpolation cannot draw a flight across the map. Population
maintenance has a bounded candidate-attempt budget per simulation update.

Normal flight remains independent of the drone; birds escape when approached
and recover after the threat passes. Swallows use tighter turns than the other
small birds. This is plausible game behavior, not a biological simulation.

## Approach

Extend `BirdSimulation`, `BirdController`, `BirdConfig`, `BirdTypes` and
`BirdRenderer`. Keep camera/frustum queries in the controller/render layer;
the simulation receives plain data or a visibility predicate. Reuse existing
model loading, disposal, interpolation, exposure and session lifecycle paths.
Whole-flock replacement at a fixed travel threshold is removed. Persistent
worldwide bird populations add storage and work without improving nearby flight.

## Failure behavior and limits

| When | Result |
| --- | --- |
| All replacement positions are visible | Keep existing birds and defer replacement. |
| Model loading fails or finishes after pause/disposal | Reuse the existing guarded loading and cleanup behavior; no repeated per-frame load failures. |
| Flight restarts or Birds is disabled | Clear prior population and pending renderer ownership through existing lifecycle paths. |
| Drone teleports or travels rapidly | Replenish through bounded turnover without resetting surviving visible targets. |

Pedestrian and traffic distribution stay unchanged. Habitat classification,
terrain/building avoidance, bird collisions, scoring and persistent wildlife
are outside this change. Bird altitude bands remain relative to encounter
origins; this does not establish clearance from scanned buildings or trees.

## Acceptance

Regression tests cover repeated travel, stationary flight, camera directions,
visible target retention, bounded counts, solo isolation, swallow registration,
escape and recovery, alarm propagation, interpolation, pause/reset and late loads.
The build and affected tests pass. Foreground browser checks exercise takeoff,
travel and turns, inspect all species and solo birds, and compare population
frame timings against the current implementation under comparable loading.
