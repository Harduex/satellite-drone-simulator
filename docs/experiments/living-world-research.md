# Living-world and live-traffic research

Assessed 2026-10-05. Research and next-step direction; [traffic V1 design](../superpowers/specs/2026-10-05-road-traffic-design.md) is approved and implemented locally. The [implementation record](../superpowers/plans/2026-10-05-road-traffic.md) tracks verification and delivery gates. Aircraft, live congestion and weather remain separate future tasks.

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

## Selected next-step direction

The selected sequence is three separate tasks: **LW1/LW2 traffic first**, **LW3 aircraft second**, **LW4 live weather third**. This selects product priorities and design constraints, not an implementation specification. Ships, transit and LW5 remain undecided. LW4 revisits deferred P6 as a later task.

- **N1 — Traffic:** Simple 3D cars on real mapped roads, with simulated movement inspired by public data. Active roads and vehicles follow the drone's nearby area; cap work and rendering to protect flight performance. Implemented V1 uses estimated road-class/time demand, with live congestion deferred. Five local CC0 low-poly models provide body-color variation.
- **N2 — Aircraft:** Later, simple 3D planes driven by public flight-position reports, limited to a useful viewing distance. Report age, interpolation, coverage and permission to use a feed still need validation; a free public endpoint alone is insufficient.
- **N3 — Weather:** Later, optional live weather to support realistic atmosphere and experimentation. Keep this separate from traffic and aircraft work.
- **N4 — Infrastructure:** Reuse Cesium, coordinate utilities, session lifecycle, settings and diagnostics wherever they fit. Prefer browser-side operation and existing APIs; avoid a new backend, paid feeds, subscriptions or elaborate external services. Flag any necessary additional source or dependency before adopting it.
- **N5 — Data and cost:** New features should use free, publicly accessible data without additional paid API requirements. Existing Google API access does not establish that an additional product is enabled, free or suitable. Google tiles and existing location/elevation services do not supply a semantic road/lane network; a public road-geometry source needs evaluation. OpenFreeMap is a candidate: its hosted instance requires no key or registration, with attribution required. [Provider access and attribution](https://openfreemap.org/).
- **N6 — Verification:** Set the local radius and object/work budgets during traffic design, then measure frame-time impact. Verify road-height alignment, pause/reset, location changes and request cleanup; do not claim zero performance impact before a prototype is measured.

## Research proposals and recommended sequence

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

**U1:** The exact remembered product is probable, not confirmed. **U2:** Actual nearby live-feed coverage and end-to-end latency need a future provider probe. **U3:** Traffic now uses a small local adapter, rather than importing GEV's runtime; hardware measurement is recorded in the implementation plan. **U4:** Conservative height checks improve road alignment but cannot identify every flat roof or resolve all bridge approaches. Existing P3–P6 and R1–R5 decisions remain in [simulator improvement proposals](simulator-improvements.md).

## Traffic V1 implementation evidence

**V1 — Source:** Browser probes of public `https://tiles.openfreemap.org/planet` metadata and z14 transportation tiles succeeded without credentials in Paris, San Francisco and London. Initial 16-tile samples produced 6,100 / 6,235 / 8,775 admitted road segments respectively. Retained-data accounting was subsequently made more conservative: a Paris integration probe reported 12.05 MB, below the 24 MiB ceiling. Actual access/direction fields can be missing; the adapter treats omitted direction as two-way and rejects explicit unsupported values. Geometry is clipped to tile boundaries before topology is assembled. Only transportation is decoded; byte, feature and geometry-command limits precede allocation. This does not establish hosted-service availability guarantees. [Provider access](https://openfreemap.org/), [transportation schema](https://openmaptiles.org/schema/#transportation).

**V2 — Assets:** Three locally packaged Kenney Car Kit models use CC0, shared 512×512 texture data and 2,032–2,474 triangles each. Dimensions, axis/origin corrections and body-only recoloring are recorded in the [asset manifest](../../public/models/traffic/ATTRIBUTION.md). They do not require a remote asset host.

**V2-A — Approved additions:** Original CC0 Audi A3 and Mazda CX-5 representations add two texture-free variants at 832 and 884 triangles, four materials each. Blender exports and GLB accessor bounds match the manufacturer's published overall body dimensions; visual details are stylized. Actual night comparison reproduced cars missing the map's exposure grading despite having lit PBR materials. The shared environment callback now grades car diffuse/emissive materials too, retaining the current value through asynchronous loads and fleet recreation.

**V3 — Integration:** The existing viewer, ENU conversion, selected clock, settings, diagnostics and recording pipeline are reused. Traffic advances at 10 Hz outside flight physics. Actual browser checks exercised autocomplete/Fly Here, HUD, smooth keyboard input, ESC pause, Road Traffic Off/On, reset and location exit. Credits remained visible in a downloaded recording. Raising a rendered car 30 m changed an unfiltered surface sample by 31.74 m; excluding the actual model restored the road sample, and the drone sampler included that exclusion.

**V4 — Placement limits:** Sampling runs in `scene.preUpdate`, alongside the existing terrain sampler. A controlled comparison reproduced unrelated photogrammetry texture artifacts with traffic disabled as well as enabled. Missing surfaces, tunnels, implausible slopes and narrow rooftop ridges remain empty. Wide flat roofs, photographed stationary vehicles, approximate right-hand driving and disconnected grade-separated approaches remain V1 limitations. Model shadows are disabled; photographed shadows remain baked into Google's mesh.

**V5 — Verification:** Review reproduced and corrected unstable road identities, unsafe buffered seams, async pause completion, connected-edge following, abrupt turns, speed inheritance and early junction release. Regression tests include motorway turns subdivided into short segments and blocked junction exits. Final repeated GPU measurements and their limits are maintained in the [implementation record](../superpowers/plans/2026-10-05-road-traffic.md), rather than inferred from the upstream project's object cap.
