# Documentation index

Start here for project knowledge. Agent instructions for documentation live in [AGENTS.md](AGENTS.md); repository-wide instructions remain in [../AGENTS.md](../AGENTS.md).

## Product and architecture

| Document | Purpose |
|---|---|
| [Project README](../README.md) | Setup, controls, current behavior and technical overview |
| [Product roadmap](ROADMAP.md) | Outcomes, Now/Next/Later horizons, dependencies and decision status; central index of postponed ideas and undecided proposals |
| [Product requirements](../SATELLITE_DRONE_SIM_PRD.md) | Historical MVP requirements; future candidates moved to the product roadmap |
| [Design](../DESIGN.md) | Existing design reference |
| [Implementation plan](../PLAN.md) | Historical implementation plan; verify current status against code |

## Experiments

| Document | Status |
|---|---|
| [Offline and custom maps](experiments/offline-maps.md) | Helsinki and textured Grove Street feasibility evidence; future scope lives in the roadmap |
| [Simulator improvements](experiments/simulator-improvements.md) | Wind/daylight scope and reproduced crash-timing evidence; decisions live in the roadmap |
| [Living-world and traffic research](experiments/living-world-research.md) | Verified sources and free-data/reuse constraints; road traffic implemented locally, aircraft and weather deferred |

## Audits

| Document | Scope |
|---|---|
| [Public-repository safety](audits/public-safety-2026-10-05.md) | Outgoing branch/history disclosure checks, scanner self-tests and local stash metadata advisory |
| [Rendering quick wins — October 2026](audits/quick-wins-2026-10.md) | Source-confirmed renderer corrections and minimap evidence; candidates live in the roadmap |

## Feature designs

| Document | Status |
| --- | --- |
| [Flight video recording](superpowers/specs/2026-10-04-flight-recording-design.md) | Implemented locally; Chrome capture/playback verified; provider video-use permission remains unresolved |
| [Flight recording implementation plan](superpowers/plans/2026-10-04-flight-recording.md) | Implementation and verification record, including browser coverage limits |
| [Wind and daylight design](superpowers/specs/2026-10-05-wind-daylight-design.md) | P1/P2 implemented locally; Google photographed-shadow limitations documented |
| [Wind and daylight implementation plan](superpowers/plans/2026-10-05-wind-daylight.md) | Completed implementation and verification record |
| [Road traffic V1 design](superpowers/specs/2026-10-05-road-traffic-design.md) | Implemented/verified locally; five car variants, scene exposure and repeated GPU gates |
| [Road traffic implementation plan](superpowers/plans/2026-10-05-road-traffic.md) | Native execution record with source, alignment, asset and performance gates |

Keep experiment findings under `experiments/`. Add further categories when there is a document to place in them. Local assets, screenshots and logs remain outside this tracked documentation tree.
