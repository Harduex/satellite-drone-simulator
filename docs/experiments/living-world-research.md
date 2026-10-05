# Living-world and live-traffic research

Assessed 2026-10-05. Research only; no simulator integration approved or implemented.

## Recommendation

**W1:** Use **God’s Eye View**, formerly WorldView, as the main reference. Adapt selected data-source and scene-lifecycle patterns into the existing Cesium simulator. Start with believable local road traffic; add live feeds after road placement works. Do not replace the simulator with an intelligence dashboard.

The exact remembered product cannot be established without a screenshot/link, but God’s Eye View is the strongest match to a photorealistic live globe with road traffic. Its [original repository](https://github.com/bilawalsidhu/gods-eye-view) identifies Bilawal Sidhu’s WorldView as its predecessor. Source inspection pinned upstream revision `b74a0233d9b94bd48329e60009d3877532e04ab2`, package version 0.2.1. Read upstream documentation and selected implementation files directly; no third-party application was installed or executed.

## Candidate identification

| ID | Product | Fit |
| --- | --- | --- |
| W1 | [God’s Eye View](https://github.com/bilawalsidhu/gods-eye-view) | Best match: CesiumJS, Google Photorealistic 3D Tiles, aircraft, vessels, satellites, traffic, transit and weather layers. MIT source code; provider data/models have separate terms. |
| W2 | [ShadowBroker](https://github.com/BigBodyCobain/Shadowbroker) | Alternative if the remembered interface was a dark global intelligence map. MapLibre/Next.js/Python/FastAPI; primarily multi-source monitoring. AGPL-3.0 code. Less direct renderer fit. |
| W3 | [World Monitor](https://github.com/koala73/worldmonitor) | Alternative if the emphasis was news/events and geopolitical monitoring. globe.gl/Three.js and deck.gl/MapLibre; AGPL-3.0 code. Useful source discovery, less useful for close-up flight. |

Licenses checked from the projects’ [GEV](https://github.com/bilawalsidhu/gods-eye-view/blob/main/LICENSE), [ShadowBroker](https://github.com/BigBodyCobain/Shadowbroker/blob/main/LICENSE) and [World Monitor](https://github.com/koala73/worldmonitor/blob/main/LICENSE) license files. The [GEV data register](https://github.com/bilawalsidhu/gods-eye-view/blob/main/DATA_SOURCES.md) explicitly separates source-code permissions from dataset/model permissions.

## What “real-time world” actually means

| ID | Layer | Real input | Reconstructed or simulated component |
| --- | --- | --- | --- |
| D1 | Road traffic | Mapped roads; optional TomTom segment congestion | Individual cars, density, placement and movement are simulated. No live worldwide position feed for every car was found in these projects. |
| D2 | Aircraft | Received ADS-B position, altitude, velocity and heading | Interpolation between reports; model appearance and missing orientation details. Coverage and report age vary. |
| D3 | Ships | AIS position/movement reports | Interpolation, vessel dimensions/model where incomplete; gaps in receiver coverage. |
| D4 | Transit | Operator vehicle-position feeds | Delayed smooth playback between updates; coverage limited to participating operators. |
| D5 | Satellites | Published orbital elements | Orbit propagation predicts position; this is not a live camera observing each satellite. |
| D6 | Weather | Forecast fields, radar/satellite observations | Local cloud geometry, turbulence and precipitation appearance remain approximations. |

These distinctions come from GEV’s [layer inventory](https://github.com/bilawalsidhu/gods-eye-view#whats-on-the-globe), cross-checked against [TomTom’s segment fields](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/flow-segment-data), [OpenSky’s state vectors](https://openskynetwork.github.io/opensky-api/rest.html), [AISStream messages](https://aisstream.io/documentation), and [GTFS-Realtime](https://gtfs.org/documentation/realtime/reference/).

**D7:** The globe is a fusion of sources with different dates, accuracy and coverage, not a synchronized digital copy of everything happening worldwide. Google supplies a [photogrammetric 3D surface](https://developers.google.com/maps/documentation/tile/3d-tiles), not semantic lanes or a live road-scene feed. Inference: cars/shadows baked into a tile cannot be individually removed simply by adding animated vehicles.

## Traffic implementation: source-level findings

**T1:** Current GEV road acquisition uses OpenFreeMap/OpenMapTiles geometry, with TomTom/OSM/Hybrid options. Cached older source views still described Overpass requests; direct GitHub API inspection at the pinned revision confirms the current vector-tile implementation. Avoid copying an old fork’s acquisition path. [Pinned source](https://github.com/bilawalsidhu/gods-eye-view/blob/b74a0233d9b94bd48329e60009d3877532e04ab2/src/layers/traffic/source.js).

**T2:** Its traffic display spawns randomized dots along road segments, assigns road-class speeds with variation, scales movement by congestion, and inserts approximate stop/creep behavior. It is not a full lane/junction/car-following simulation. Current code respects depth occlusion. These dots are useful for an overview; inference: they will not look like convincing cars near an FPV camera. [Animation](https://github.com/bilawalsidhu/gods-eye-view/blob/b74a0233d9b94bd48329e60009d3877532e04ab2/src/layers/traffic/animation.js), [flow mapping](https://github.com/bilawalsidhu/gods-eye-view/blob/main/src/data/trafficFlowStyle.js).

**T3:** Road placement is a major integration problem. Upstream subdivides long roads, acquires rendered-surface heights, rejects unrelated foreground depth hits and waits for usable surface frames. Its dot height offset is 3 m; this should not become a car’s ground-contact height. Its 6,000-dot cap and bounded caches are upstream design limits, not measured performance promises for this simulator. [Surface acquisition](https://github.com/bilawalsidhu/gods-eye-view/blob/b74a0233d9b94bd48329e60009d3877532e04ab2/src/layers/traffic/surface.js), [policy](https://github.com/bilawalsidhu/gods-eye-view/blob/b74a0233d9b94bd48329e60009d3877532e04ab2/src/layers/traffic/policy.js).

**T4:** For stronger traffic behavior, [Eclipse SUMO](https://eclipse.dev/sumo/) is the relevant separate reference. It imports [OSM road networks](https://sumo.dlr.de/docs/Networks/Import/OpenStreetMap.html) and models [junction signals](https://sumo.dlr.de/docs/Simulation/Traffic_Lights.html). Real signal programs/demand still require calibration. Recommendation: consider an offline-generated district scenario or separate simulation process later; a worldwide SUMO runtime is disproportionate to the first feature.

## Fit with this simulator

**I1:** Reuse the existing Cesium viewer, coordinate utilities and SimSession ownership. GEV exposes traffic/source factories and service adapters, making selective reuse feasible, but not plug-and-play. Its app adapter expects ground, credits and render services; its full package includes additional dependencies and a newer Node runtime requirement. Evaluate selected modules against the installed Cesium before adding a dependency. [Factory](https://github.com/bilawalsidhu/gods-eye-view/blob/b74a0233d9b94bd48329e60009d3877532e04ab2/src/layers/traffic/index.js), [adapter](https://github.com/bilawalsidhu/gods-eye-view/blob/b74a0233d9b94bd48329e60009d3877532e04ab2/src/app/layers/traffic.js), [package](https://github.com/bilawalsidhu/gods-eye-view/blob/b74a0233d9b94bd48329e60009d3877532e04ab2/package.json).

**I2:** Keep network polling/decoding outside the 500 Hz flight loop. Load a bounded neighborhood around the drone, cache static roads, cap moving objects and interpolate rendering. Preserve the 6 GiB tile budget, LOD/globe fixes and session teardown. Near vehicles need dimensioned models; distant vehicles can use cheaper representations.

**I3:** The existing [TerrainSampler](../../src/world/TerrainSampler.ts) samples a surface height, not a semantic road lane. Bridges, tunnels and road/mesh offsets require explicit handling. Exclude traffic models from drone ground-height sampling to avoid cars becoming the flight floor. Start with visual traffic; vehicle collisions remain a separate P3 decision.

**I4:** Each feed should carry observation time, source and state: observed, predicted/interpolated, simulated, stale or unavailable. Limit extrapolation and fade stale objects. Pause should freeze local simulation; resume should deliberately rejoin the live timeline. Pleasant solar noon can coexist with live UTC feeds, but should not be described as a wholly synchronized real-time scene.

**I5:** Live providers may require a backend, which this client-only simulator does not currently have. AISStream explicitly prohibits direct browser connections; upstream TomTom and OpenSky credentials also use server-side adapters. A production relay/cache is new infrastructure, requiring its own scope decision. [AISStream](https://aisstream.io/documentation), [GEV traffic provider](https://github.com/bilawalsidhu/gods-eye-view/blob/b74a0233d9b94bd48329e60009d3877532e04ab2/server/providers/traffic.js).

## Access, cost and fidelity constraints

- **C1:** TomTom currently lists 200K monthly free vector traffic-tile requests, versus 20K monthly segment-data requests. These are different products. Cache/budget controls and a key are still needed. Illustrative calculation: refreshing 20 uncached tiles every two minutes costs 600 requests/hour; shared caching and viewport movement change actual usage. [Provider pricing](https://docs.tomtom.com/pricing).
- **C2:** OpenSky’s current terms require a previous written agreement for operational REST integration into a live product, including non-profit use. Upstream “keyless” availability does not settle permission to ship it. Anonymous state access has 10-second resolution and 400 daily credits; a global request costs four credits, so continuous global polling is unsuitable. [Terms](https://opensky-network.org/about/terms-of-use), [API limits](https://openskynetwork.github.io/opensky-api/rest.html).
- **C3:** AISStream requires backend credentials and region filters; it provides no delivery/uptime guarantee. Transit is operator-specific, and GTFS guidance allows vehicle reports approaching 90 seconds old. Smooth animation cannot turn old fixes into exact current positions. [AISStream](https://aisstream.io/documentation), [GTFS best practices](https://gtfs.org/documentation/realtime/realtime-best-practices/).
- **C4:** Open-Meteo can supply wind/gusts/cloud cover/visibility, but it combines weather-model output, not building-scale airflow measurements. Its free hosted API is non-commercial; commercial hosted access uses a subscription. Do not map forecast peak gust directly to our bounded gust-variation control. [Variables/model resolution](https://open-meteo.com/en/docs), [hosted access](https://open-meteo.com/en/pricing). P6 remains deferred.
- **C5:** Code licensing, road-data attribution, feed permissions and vehicle-model licenses are separate. OpenFreeMap permits hosted or self-hosted use, but OSM/OpenMapTiles attribution remains relevant. Retain provider credits in screenshots/recording. [OpenFreeMap](https://openfreemap.org/), [GEV license](https://github.com/bilawalsidhu/gods-eye-view/blob/main/LICENSE).

## Proposed order — all undecided

| ID | Proposal | Recommendation |
| --- | --- | --- |
| LW1 | Optional local simulated road traffic | First: one validated district, 3D cars, lane direction, basic following/intersections, smooth movement, pause/reset and bounded rendering cost. This most directly improves ordinary low-altitude flight. |
| LW2 | Live congestion controlling simulated traffic | After LW1; obtain access and label cars as simulated. Start with a single region and explicit request budget. |
| LW3 | Live aircraft, vessels or transit | One feed at a time. Choose aircraft for aviation scenery, ships for harbors, transit for a well-supported city; verify reuse permission and timestamps first. |
| LW4 | Optional weather-driven atmosphere/wind | Extend deferred P6 when approved. Keep pleasant defaults and an explicit choice between realistic conditions and moderated flight conditions. |
| LW5 | Richer traffic behavior via SUMO | Later, if lightweight traffic fails close-up quality goals. Start with a prepared district and known demand, not the entire planet. |

**LW2-G — Google congestion source, undecided:** Consider Google traffic conditions as an input to LW2: adjust simulated vehicle speeds and spacing, with vehicle counts estimated from road class and congestion. This would approximate the traffic scene; it would not locate individual real vehicles or measure their count. Google Routes API exposes `NORMAL`, `SLOW` and `TRAFFIC_JAM` categories along requested route polylines. The Maps JavaScript TrafficLayer displays traffic rather than providing a documented raw city-wide congestion feed. Evaluate route sampling coverage, billing and permitted simulator use before selecting Google as the provider; do not scrape map colors. No API integration is approved by this proposal. [Routes traffic intervals](https://developers.google.com/maps/documentation/routes/traffic_on_polylines), [TrafficLayer](https://developers.google.com/maps/documentation/javascript/trafficlayer).

First research-to-prototype gate: choose a district with clear surface roads; verify road alignment and occlusion; render a small fleet; compare frame time against the unchanged scene; check pause/location teardown and recording. Include a bridge/tunnel case before claiming general coverage. No integration or performance benchmark was conducted in this research.

## Remaining uncertainties

**U1:** The exact remembered product is probable, not confirmed. **U2:** Actual nearby feed coverage and end-to-end latency need a future provider probe. **U3:** The traffic module’s services/dependencies have not been integrated or benchmarked here. **U4:** Close-up road alignment and model licensing need a district prototype. Existing P3–P6 and R1–R5 decisions remain in [simulator improvement proposals](simulator-improvements.md).
