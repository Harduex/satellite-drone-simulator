# Traffic car assets

Sedan, hatchback-sports and SUV originate from [Kenney Car Kit](https://kenney.nl/assets/car-kit), version 3.1, downloaded 2026-10-05. The kit is released under Creative Commons CC0; its original license is retained in `LICENSE.txt`.

These GLB derivatives separate painted body triangles into a `BodyPaint` material and normalize dimensions/contact origin. Model coordinates are X forward, Y left, Z up. The shared original 512×512 palette texture remains local under `Textures/`.

| Asset | Dimensions: length × width × height | Original triangle count |
| --- | --- | --- |
| sedan.glb | 4.3 × 1.8 × 1.5 m | 2,032 |
| hatchback-sports.glb | 4.1 × 1.8 × 1.45 m | 2,088 |
| suv.glb | 4.6 × 1.9 × 1.7 m | 2,474 |

Body paint is marked magenta for the runtime body-only shader. Windows, lamps and tires keep their original textured materials. No runtime requests to an asset host are required.
