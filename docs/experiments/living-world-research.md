# Living-world and live-traffic research

Assessed 2026-10-05. Research and next-step direction; [traffic V1 design](../superpowers/specs/2026-10-05-road-traffic-design.md) is approved and implemented locally. The [implementation record](../superpowers/plans/2026-10-05-road-traffic.md) tracks verification and delivery gates. Aircraft, live congestion and weather remain separate future tasks.

## Recommendation

**W1:** Use **God’s Eye View**, formerly WorldView, as the main reference. Adapt selected data-source and scene-lifecycle patterns into the existing Cesium simulator. The implemented traffic adapter follows those patterns; further feed choices are tracked in [the roadmap](../ROADMAP.md). Do not replace the simulator with an intelligence dashboard.

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

**T4:** For stronger traffic behavior, [Eclipse SUMO](https://eclipse.dev/sumo/) is the relevant separate reference. It imports [OSM road networks](https://sumo.dlr.de/docs/Networks/Import/OpenStreetMap.html) and models [junction signals](https://sumo.dlr.de/docs/Simulation/Traffic_Lights.html). Real signal programs/demand still require calibration. A worldwide SUMO runtime would introduce substantially more infrastructure than the existing local adapter.

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

## Roadmap and lasting constraints

Living-world initiatives LW1–LW5 and LW2-G are maintained only in [the product roadmap](../ROADMAP.md), including their decision status and sequence.

- Reuse Cesium, coordinates, session ownership, settings and diagnostics. Prefer browser-side operation, free public data and local assets; a new backend, paid feed or service requires its own decision.
- Existing Google API access does not establish that another product is enabled, free or suitable. Tiles and location/elevation services do not provide a semantic lane network.
- Geographic/object/request/work budgets require measured frame-time, placement, pause/reset, location cleanup and recording checks.

### Google congestion evidence

Google Routes exposes `NORMAL`, `SLOW` and `TRAFFIC_JAM` intervals along requested route polylines; Maps JavaScript TrafficLayer is a display layer, rather than a documented raw city-wide congestion feed. Those categories do not locate individual vehicles or measure their count. Coverage, billing and permitted reuse remain provider constraints. [Routes intervals](https://developers.google.com/maps/documentation/routes/traffic_on_polylines), [TrafficLayer](https://developers.google.com/maps/documentation/javascript/trafficlayer).

## Remaining uncertainties

**U1:** The exact remembered product is probable, not confirmed. **U2:** Actual nearby live-feed coverage and end-to-end latency need a future provider probe. **U3:** Traffic now uses a small local adapter, rather than importing GEV's runtime; hardware measurement is recorded in the implementation plan. **U4:** Conservative height checks improve road alignment but cannot identify every flat roof or resolve all bridge approaches. Related flight-improvement decisions are maintained in [the roadmap](../ROADMAP.md).

## Aircraft source checks — 2026-10-07

- **A1 — ADSB.lol:** A public 20-nautical-mile query around central Sofia returned HTTP 200 and seven positioned aircraft; six supplied geometric altitude. Position ages were 0–1.361 seconds in that snapshot. A repeat command-line request with `Origin: http://localhost:5173` returned no `Access-Control-Allow-Origin` header. A subsequent direct browser fetch from the same local origin failed with `Failed to fetch`; browser-access feasibility is not established. The API is free under ODbL, with dynamic limits; its documentation asks production users to contact the operator. [API and terms](https://api.adsb.lol/docs), [rate limits](https://github.com/adsblol/api).
- **A2 — adsb.fi:** The documented v3 radius endpoint returned HTTP 200 and 16 aircraft in a later Sofia snapshot, with geometric altitude on five. Its response also lacked the browser-access header, and the direct browser fetch failed with `Failed to fetch`. Public access is limited to one request per second and personal, non-commercial use with attribution. [Documentation and terms](https://github.com/adsbfi/opendata).
- **A3 — Airplanes.live:** The documented radius endpoint rejected the probe and requested project details by email. No operator contact was made. The published response schema distinguishes WGS84 geometric altitude in feet from barometric altitude, position age and ground speed. [API documentation](https://airplanes.live/api-docs/).
- **A4 — Integration requirement:** Aircraft should preserve front-end-only deployment where feasible, use a free service and support arbitrary worldwide locations. Prefer a provider permitting direct browser requests without a private credential. A small relay is a fallback if direct access cannot be established; deployment remains a separate decision. The two failed browser probes used ordinary CORS fetches with omitted credentials and a 15-second timeout, without a proxy. Their generic errors do not establish the exact failure cause or rule out all browser-compatible feeds. Verify browser access and deployment permission before implementation. Preserve report provenance, real coordinates and altitude, cap extrapolation, remove stale reports and keep polling outside drone physics. Do not treat barometric altitude as WGS84 height or fill gaps with simulated flights.

**A5 — Regional samples:** Sequential command-line radius queries at 50 nautical miles, with an Origin header and at least 1.2 seconds between region pairs, produced the following snapshots. Counts include ground and potentially stale reports; they are not a count of usable airborne models. Geometric counts refer to positioned reports supplying `alt_geom`.

| Airport region | ADSB.lol positioned / geometric | adsb.fi positioned / geometric |
| --- | --- | --- |
| Sofia (42.6746, 23.3597) | 5 / 3 | 13 / 3 |
| London (51.47, -0.45) | 73 / 43 | 77 / 43 |
| New York (40.64, -73.78) | 273 / 196 | 264 / 196 |
| São Paulo (-23.43, -46.47) | 41 / 33 | 40 / 33 |
| Johannesburg (-26.14, 28.24) | 2 / 1 | 2 / 1 |
| Tokyo (35.55, 139.78) | 13 / 3 | 13 / 3 |
| Sydney (-33.95, 151.18) | HTTP 429; sampling stopped | 52 / 21 |

ADSB.lol used `/v2/point/{lat}/{lon}/50`; adsb.fi used `/api/v3/lat/{lat}/lon/{lon}/dist/50`. Successful responses lacked `Access-Control-Allow-Origin`. Maximum reported position age reached approximately 60 seconds. These samples establish data beyond Sofia on six inhabited continents, not complete country, ocean or low-altitude coverage. Aircraft activity and receiver coverage cannot be separated using one snapshot.

**A6 — Browser controls:** A standalone page served by the existing development server performed ordinary direct CORS fetches with omitted credentials. OpenFreeMap's public `planet` metadata returned HTTP 200 with response type `cors`, establishing that this browser could read a permitted cross-origin feed. adsb.fi failed with `Failed to fetch` in all seven regions. AvioADSB succeeded from the same browser but returned zero aircraft around Sofia. This strengthens the browser-access finding without attributing every generic fetch error to CORS alone. No proxy, security override or provider contact was used.

**A7 — Additional provider checks:** Documentation claims and actual access are separate:

| Provider | Free-access constraints | Observed result / verdict |
| --- | --- | --- |
| [AvioADSB](https://avioadsb.org/docs/api) | Personal/research service; 100 anonymous requests/day per network, one every 10 seconds; contributor tier requires receiver hardware and a private key | Direct browser HTTP 200, empty Sofia sample. At ten-second polling the anonymous quota lasts about 17 minutes; not suitable for unrestricted sessions. Worldwide coverage remains unverified. |
| [adsb.win](https://adsb.win/privacy-license) | Free open-source/non-commercial use with attribution; commercial agreement required | Public map client uses a same-origin access grant and credentials. Direct regional `re-api` query returned HTTP 401; localhost browser fetch failed. No supported external browser authentication flow established. |
| [IntelSky](https://www.intelsky.org/api-docs.php) | Documentation advertises free keyless access, 60 live requests/minute and browser CORS; commercial use asks for contact | Command-line `/api/` yielded 465 positioned reports and 461 non-null geometric altitudes, without a CORS header. Direct browser request failed. General civilian coverage and reuse permission remain unverified; documentation alone is insufficient. |
| [FlightLogic](https://flightlogic.co.uk/api/) | Documents keyless browser access and no published per-client quota; live-feed reuse rights not established by its airport/airline-data licenses | Documented London `/api/flights` query returned HTTP 502; direct browser fetch failed. Not a verified viable source. |
| [PocketWorld](https://pocketworld.org/api) | Documents free keyless access and 300 requests/minute; [terms](https://pocketworld.org/terms) retain upstream restrictions | Bounded London `wire=1&bbox=-1.5,50.5,0.5,52.5` query returned 154 rows, 81 marked fresh, but no CORS header; browser fetch failed. Response identified adsb.fi, ADSB.lol and OpenSky source constraints. It does not eliminate upstream permission requirements. |
| [OpenSky](https://opensky-network.org/about/terms-of-use) | Prior written agreement required for operational REST use in a live product, including non-profit use | Not an approved free plug-and-play option; no operational permission obtained. |

**A8 — Research conclusion:** No tested provider currently satisfies all three requirements for this feature: free usable sessions, worldwide geographic scope and verified direct browser access. ADSB.lol remains the strongest candidate for a provider discussion because of its open-data terms and multi-continent samples. Confirm supported browser access, intended deployment use and a sustainable free polling rate with the operator before choosing it. A small relay can resolve cross-origin browser access while keeping aircraft rendering and simulation in the client; it cannot resolve receiver gaps, altitude quality, provider rate limits or usage permission. Operator contact and deployment are not authorized by this research. Implementation remains pending in [LW3](../ROADMAP.md).

**A9 — Free relay hosting:** [Cloudflare Workers Free](https://developers.cloudflare.com/workers/platform/limits/) currently permits 100,000 inbound requests/day and 10 ms CPU per invocation; waiting for an upstream fetch does not consume CPU time. At one browser request every ten seconds, 100,000 requests represents approximately 278 aggregate user-hours/day before other requests, retries or shared account usage. This is a capacity illustration, not measured load, guaranteed free scale or a deployment recommendation already validated. A relay would need bounded regional queries, caching, timeouts and upstream backoff. Sustainable ADSB.lol traffic and the actual relay CPU budget remain unverified.

These are point-in-time source checks, not evidence of continuous coverage, browser integration, provider permission for every deployment, or completed aircraft rendering.

### Aircraft feasibility recheck — 2026-10-18

**A10 — Browser-access constraint persists:** Bounded command-line GETs with `Origin: http://localhost:5173` returned HTTP 200 from ADSB.lol (`/v2/point/51.47/-0.45/20`) and adsb.fi (`/api/v3/lat/51.47/lon/-0.45/dist/20`). Neither response included `Access-Control-Allow-Origin`; ordinary browser JavaScript cannot read those responses from that origin. ADSB.lol returned 55 aircraft reports, including ground reports, not 55 usable airborne models. These checks revalidate response headers, not a fresh browser run or worldwide coverage. The local development server was not running.

**A11 — Upstream budget matters even with a relay:** The ADSB.lol response advertised `x-ratelimit-limit: 4, 4;w=1, 60;w=60, 500;w=86400`. The daily window corresponds to 500 requests, approximately 83 minutes at one request every ten seconds before other usage or retries, assuming that allowance applies throughout. Limit scope and reset behavior were not established. The [provider README](https://github.com/adsblol/api#rate-limits) describes dynamic limits, so this is an observed allowance, not a guaranteed quota. Relay hosting capacity in A9 does not establish sustainable upstream capacity, and shared relay egress could concentrate consumption.

**A12 — Recommendation and remaining confirmation:** Retain ADSB.lol as the first provider candidate. Confirm supported external browser origins, a sustainable free polling allowance for a public simulator, and whether a bounded shared caching relay is supported. The [API source](https://github.com/adsblol/api/blob/main/src/adsb_api/app.py) describes free access under ODbL; this does not promise request capacity. adsb.fi still documents personal/non-commercial use and one request per second in its [terms](https://github.com/adsbfi/opendata#terms), without establishing browser compatibility. ADSB.lol publishes an operator contact on its [contact page](https://www.adsb.lol/privacy-license/#contact). No operator contact or deployment occurred. Current evidence does not establish a provider meeting all LW3 requirements.

## Traffic V1 implementation evidence

**V1 — Source:** Browser probes of public `https://tiles.openfreemap.org/planet` metadata and z14 transportation tiles succeeded without credentials in Paris, San Francisco and London. Initial 16-tile samples produced 6,100 / 6,235 / 8,775 admitted road segments respectively. Retained-data accounting was subsequently made more conservative: a Paris integration probe reported 12.05 MB, below the 24 MiB ceiling. Actual access/direction fields can be missing; the adapter treats omitted direction as two-way and rejects explicit unsupported values. Geometry is clipped to tile boundaries before topology is assembled. Only transportation is decoded; byte, feature and geometry-command limits precede allocation. This does not establish hosted-service availability guarantees. [Provider access](https://openfreemap.org/), [transportation schema](https://openmaptiles.org/schema/#transportation).

**V2 — Assets:** Three locally packaged Kenney Car Kit models use CC0, shared 512×512 texture data and 2,032–2,474 triangles each. Dimensions, axis/origin corrections and body-only recoloring are recorded in the [asset manifest](../../public/models/traffic/ATTRIBUTION.md). They do not require a remote asset host.

**V2-A — Approved additions:** Original CC0 Audi A3 and Mazda CX-5 representations add two texture-free variants at 832 and 884 triangles, four materials each. Blender exports and GLB accessor bounds match the manufacturer's published overall body dimensions; visual details are stylized. Actual night comparison reproduced cars missing the map's exposure grading despite having lit PBR materials. The shared environment callback now grades car diffuse/emissive materials too, retaining the current value through asynchronous loads and fleet recreation.

**V3 — Integration:** The existing viewer, ENU conversion, selected clock, settings, diagnostics and recording pipeline are reused. Traffic advances at 10 Hz outside flight physics. Actual browser checks exercised autocomplete/Fly Here, HUD, smooth keyboard input, ESC pause, Road Traffic Off/On, reset and location exit. Credits remained visible in a downloaded recording. Raising a rendered car 30 m changed an unfiltered surface sample by 31.74 m; excluding the actual model restored the road sample, and the drone sampler included that exclusion.

**V4 — Placement limits:** Sampling runs in `scene.preUpdate`, alongside the existing terrain sampler. A controlled comparison reproduced unrelated photogrammetry texture artifacts with traffic disabled as well as enabled. Missing surfaces, tunnels, implausible slopes and narrow rooftop ridges remain empty. Wide flat roofs, photographed stationary vehicles, approximate right-hand driving and disconnected grade-separated approaches remain V1 limitations. Model shadows are disabled; photographed shadows remain baked into Google's mesh.

**V5 — Verification:** Review reproduced and corrected unstable road identities, unsafe buffered seams, async pause completion, connected-edge following, abrupt turns, speed inheritance and early junction release. Regression tests include motorway turns subdivided into short segments and blocked junction exits. Final repeated GPU measurements and their limits are maintained in the [implementation record](../superpowers/plans/2026-10-05-road-traffic.md), rather than inferred from the upstream project's object cap.
