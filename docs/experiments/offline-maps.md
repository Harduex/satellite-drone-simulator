# Offline and custom maps — experiment notes

Status: feasibility demonstrated; product design deferred for later brainstorming.

## Roadmap

Map-source directions D1–D4 and brainstorming B1–B6 are consolidated under MAP IDs in [the product roadmap](../ROADMAP.md). Google remains the default.

“Offline” means an independent dataset with its own assets, not downloading Google tiles for permanent reuse. Serving assets from localhost proves local rendering; it does not establish a hosted game's offline installation or storage behavior.

## Experiments and evidence

Both experiments use a separate Cesium Viewer and reuse `GameLoop`, `TerrainSampler`, FPV camera, controller mapping and HUD. No production map selector was added. Google mode and its source files remain unchanged.

| ID | Dataset | Result | Limits |
|---|---|---|---|
| E1 | Helsinki Kalasatama 2017 textured reality mesh; one roughly 250 m tile | Approximately 51 MB extracted data; 25/25 height samples; flight worked; about 60 FPS in an observed view | Small area; older tile format emits deprecation warnings; no coverage outside the subset |
| E2 | San Andreas, Grove Street district; objects intersecting a 600 m square | Approximately 28 MB GLB; 721 embedded texture images; 25/25 height samples; flight, ESC pause and reset exercised; user confirmed the result works well | Full intersecting objects extend beyond the selection; not the full city/state; one unpartitioned tile |

These are observations, not performance guarantees. The Grove Street probe observed roughly 136 MiB tile memory and zero external resource requests on a clean load. Frame rate varies with view and competing tabs. Height sampling does not certify facade, underpass or watertight mesh collisions.

## Asset preparation lessons

| ID | Lesson |
|---|---|
| L1 | Check for real texture images before choosing an export. The initial Los Santos GLBs lacked textures and were unsuitable for the intended test. |
| L2 | Preserve source geometry and textures; convert a bounded district first. Exclude distant LOD objects, preserve world transforms, then translate to a local origin. Treat one game unit as one metre provisionally; scale is not surveyed. |
| L3 | Importing this FBX produced zero default opacity factors on many materials. glTF multiplied those factors with texture alpha, hiding roads/buildings. Set the factor to one while retaining image alpha for vegetation and cutouts. |
| L4 | A GLB can be wrapped in a 3D Tiles 1.1 manifest and positioned with an ENU transform. In this Cesium traversal, a zero tileset-wide geometric error skipped rendering. Use a meaningful error for the empty representation; the fully detailed leaf can have zero error. |
| L5 | Validate embedded image counts, missing files, bounds, checksums and external URIs independently. Reuse a saved Blender checkpoint for export retries instead of reimporting the whole city. |
| L6 | Connected radios retain priority over keyboard. Check actual stick input before attributing unexpected movement to the map or physics. |

## Provenance and local reproduction

Helsinki source: [City of Helsinki 3D data](https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/helsinki-3d), [Kalasatama mesh directory](https://3d.hel.ninja/data/mesh/Kalasatama/). The experiment records CC BY 4.0 attribution.

San Andreas source: [tostiman/dv_san_andreas](https://git.tostiman.com/tostiman/dv_san_andreas), revision `a26b004435f079e6d9e6500e3e3cfc805c405701`. Only `Assets/san_andreas/la.fbx` and texture PNGs were used; repository Unity/mod code was not executed. FBX SHA-256: `97dd2eda77c7d4f0e447060321ac3c28a7390afc486402d879539b9a51c08aae`. Public availability does not establish redistribution permission for Rockstar assets. Keep this dataset a local proof of concept; evaluate rights separately before distribution.

Local, untracked artifacts remain under `.local/helsinki/` and `.local/san-andreas/`; Helsinki content is under `public/experiments/helsinki/`. With the development server running, open `/.local/helsinki/probe.html` or `/.local/san-andreas/probe.html`. The San Andreas directory contains conversion scripts, a Blender checkpoint, the GLB, tileset manifest and checksum/bounds report. These files are not shipped with the repository; a fresh clone will not contain the experiments.

## Further work

The map-pack contract, import/storage, lifecycle, coverage, chunking, catalog and reconstruction decisions are maintained in [the roadmap](../ROADMAP.md).

These experiments demonstrate conventional textured meshes, not an AI-generated worldwide map.
