# Traffic car assets

Sedan, hatchback-sports and SUV originate from [Kenney Car Kit](https://kenney.nl/assets/car-kit), version 3.1, downloaded 2026-10-05. The kit is released under Creative Commons CC0; its original license is retained in `LICENSE.txt`.

These GLB derivatives separate painted body triangles into a `BodyPaint` material and normalize dimensions/contact origin. Model coordinates are X forward, Y left, Z up. The shared original 512×512 palette texture remains local under `Textures/`.

| Asset | Dimensions: length × width × height | Original triangle count |
| --- | --- | --- |
| sedan.glb | 4.3 × 1.8 × 1.5 m | 2,032 |
| hatchback-sports.glb | 4.1 × 1.8 × 1.45 m | 2,088 |
| suv.glb | 4.6 × 1.9 × 1.7 m | 2,474 |

Body paint is marked magenta for the runtime body-only shader. Windows, lamps and tires keep their original textured materials. No runtime requests to an asset host are required.

## Original additions

`audi-a3.glb` and `mazda-cx5.glb` are original, stylized representations created for this simulator, released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). To the extent possible under law, the authors waive copyright and related rights in these two mesh assets. They contain no downloaded manufacturer/game geometry or textures. Vehicle names identify the inspiration; these are not manufacturer CAD models or endorsed products.

| Asset | Reference | Bounds: length × width × height | Triangles | Materials / textures |
| --- | --- | --- | --- | --- |
| audi-a3.glb | 2020 A3 Sportback | 4.343 × 1.816 × 1.458 m | 832 | 4 / none |
| mazda-cx5.glb | 2018 CX-5 | 4.550 × 1.840 × 1.675 m | 884 | 4 / none |

Overall dimensions follow the [Audi technical sheet](https://www.audi-mediacenter.com/system/production/uploaded_files/18079/file/e7dfbf2097a576a4cf18555de94a397e756d4c92/etd_A3_Sportback_40_TFSI_e_S_tronic.pdf?disposition=attachment) and [Mazda owner's manual](https://www.mazdausa.com/static/manuals/2018/cx5/contents/10020110.html). Width is the published body width; small stylized mirrors fit within that budget. Shapes and proportions are approximate. Contact origin and axes match the Kenney derivatives. Lamps are reflective details, without independent light emission.

Reproduce the original assets with Blender 5.0+ (development tool only; no runtime dependency):

```sh
blender --background --factory-startup --python scripts/generate-traffic-cars.py -- --output-directory public/models/traffic
```

Add `--source-directory <directory>` to save editable Blender files. The generator validates triangle/material counts, nonzero triangle areas, exported bounds and neutral body vertex colors. Body paint uses zero metalness so the runtime magenta marker remains intact in Cesium's diffuse material stage. The runtime model names and following lengths share one manifest in `src/traffic/TrafficConfig.ts`.
