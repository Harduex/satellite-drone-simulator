# Bird assets

These low-poly animated bird models are used for ambient wildlife and flight chase targets.

| File | Title | Author | License | Source |
| --- | --- | --- | --- | --- |
| `pigeon.glb` | Animated Bird, Pigeon | [dudecon](https://sketchfab.com/dudecon) | CC-BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/animated-bird-pigeon-797d27b68af3453e865149435df6aa30) |
| `seagull.glb` | Low-Poly Seagull (with Animation & Rigged) | [simonaskLDE](https://sketchfab.com/simonaskLDE) | CC-BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/low-poly-seagull-with-animation-rigged-985024328902444c8270c0f09acc897e) |
| `eagle.glb` | Low Poly Eagle | [Nikola1998](https://sketchfab.com/Nikola1998) | CC-BY 4.0 | [Sketchfab](https://sketchfab.com/3d-models/low-poly-eagle-60578c2b11064a2da915ea899614b0b8) |
| `swallow.glb` | Stylized swallow | Original simulator asset | CC0-1.0 | [Generator](../../../scripts/generate-swallow.py) |

## Modifications
- Models imported into Blender, scaled to realistic wingspans (pigeon ~0.45m length, seagull ~1.2m wingspan, eagle ~2.1m wingspan).
- Flapping animations normalized with standard clip name `fly`.
- Exported as self-contained binary glTF (`.glb`).
- Pigeon color variations (grey, brown, black, white) applied dynamically via custom fragment shader at runtime.

The swallow is an original low-poly model with a blue-black back, cream breast,
rust throat, swept pointed wings and forked tail streamers. Its physical wingspan
is 0.34 m before the configured presentation scale. Two rigid wing channels form
the `fly` clip (0.4 seconds); phase zero is the extended-wing glide pose.

Regenerate with Blender 5.0+ in a factory-startup background process:

```sh
blender --background --factory-startup --python scripts/generate-swallow.py -- --output-directory public/models/birds
```

An optional `--source-directory` saves editable Blender source outside the public
asset directory. The exported GLB contains geometry, materials and animation;
it has no external textures, local source paths or author contact information.
