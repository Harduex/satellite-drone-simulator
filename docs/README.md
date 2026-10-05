# Documentation index

Start here for project knowledge. Agent instructions for documentation live in [AGENTS.md](AGENTS.md); repository-wide instructions remain in [../AGENTS.md](../AGENTS.md).

## Product and architecture

| Document | Purpose |
|---|---|
| [Project README](../README.md) | Setup, controls, current behavior and technical overview |
| [Product roadmap](../ROADMAP.md) | Outcomes, Now/Next/Later horizons, dependencies and decision status; central index of postponed ideas and undecided proposals |
| [Product requirements](../SATELLITE_DRONE_SIM_PRD.md) | Original product requirements |
| [Design](../DESIGN.md) | Existing design reference |
| [Implementation plan](../PLAN.md) | Original implementation plan; verify current status against code |

## Experiments

| Document | Status |
|---|---|
| [Offline and custom maps](experiments/offline-maps.md) | Helsinki and textured Grove Street feasibility findings; future brainstorming questions |
| [Archived rendering roadmap](experiments/rendering-roadmap.md) | Six recovered proposals; historical assumptions corrected in the audit below |
| [Simulator improvements](experiments/simulator-improvements.md) | Wind/daylight scope, deferred proposals and reproduced crash-timing evidence |
| [Living-world and traffic research](experiments/living-world-research.md) | Verified sources and free-data/reuse constraints; road traffic implementation in progress, aircraft and weather deferred |

## Audits

| Document | Scope |
|---|---|
| [Rendering quick wins — October 2026](audits/quick-wins-2026-10.md) | Current renderer evidence, ranked experiments and assessment of the six rendering proposals |

## Feature designs

| Document | Status |
| --- | --- |
| [Flight video recording](superpowers/specs/2026-10-04-flight-recording-design.md) | Implemented locally; Chrome capture/playback verified; provider video-use permission remains unresolved |
| [Flight recording implementation plan](superpowers/plans/2026-10-04-flight-recording.md) | Implementation and verification record, including browser coverage limits |
| [Wind and daylight design](superpowers/specs/2026-10-05-wind-daylight-design.md) | P1/P2 implemented locally; Google photographed-shadow limitations documented |
| [Wind and daylight implementation plan](superpowers/plans/2026-10-05-wind-daylight.md) | Completed implementation and verification record |
| [Road traffic V1 design](superpowers/specs/2026-10-05-road-traffic-design.md) | Approved; implemented locally, final review and performance verification in progress |
| [Road traffic implementation plan](superpowers/plans/2026-10-05-road-traffic.md) | Native execution record with source, alignment, asset and performance gates |

Keep experiment findings under `experiments/`. Add further categories when there is a document to place in them. Local assets, screenshots and logs remain outside this tracked documentation tree.
