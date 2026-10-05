# Pedestrian assets

These unmodified GLB models and their shared texture originate from [Kenney Mini Characters](https://kenney.nl/assets/mini-characters), version 1.0, downloaded 2026-10-05 from the [official ZIP](https://kenney.nl/media/pages/assets/mini-characters/bfc7e272b4-1774770718/kenney_mini-characters.zip). The pack is released under [Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); its original `License.txt` is retained. Attribution is appreciated but not required.

| Local file | Original filename | Bytes | Triangles | Vertices | Native bounds: X width × Y height × Z depth |
| --- | --- | --- | --- | --- | --- |
| male-a.glb | character-male-a.glb | 246,916 | 723 | 1,259 | 0.767168 × 0.671325 × 0.340000 |
| male-b.glb | character-male-b.glb | 247,332 | 690 | 1,266 | 0.767168 × 0.661325 × 0.389472 |
| female-a.glb | character-female-a.glb | 273,448 | 876 | 1,576 | 1.098787 × 0.775528 × 0.499530 |

Bounds come from glTF POSITION accessor minima/maxima in the source pose, including spread arms and hairstyles; they are not animated bounds or real-world human dimensions. Y is up, feet begin at Y approximately zero, and facial geometry points toward +Z. Runtime scaling determines displayed height. The intentionally stylized proportions remain unchanged.

Each model has two mesh primitives, one nonmetallic double-sided textured material, two seven-joint skins, and 32 animation clips. The `walk` clip lasts approximately 0.666667 seconds, with seven channels and 140 input keys. Its root translation has no X/Z travel and Y bobbing from 0 to 0.05 native units; six other channels rotate the torso, head, arms and legs. Route movement is separate from the clip.

The original external `Textures/colormap.png` is shared by all three models: 512 × 512 pixels, 8,706 bytes. Keep this relative path when copying the GLBs. No asset-host request is needed at runtime.

## Clothing palette verification

The source UVs identify a torso/sleeve region independently of skin and hair. For each model, selecting `abs(U - shirtU) < 0.01` and `0.50 < V < 0.75` gives the following complete triangles, with no partially selected triangles:

| Model | shirtU | Selected triangles |
| --- | --- | --- |
| male-a.glb | 0.21875 | 121 |
| male-b.glb | 0.59375 | 105 |
| female-a.glb | 0.96875 | 105 |

Selected vertices occupy native Y 0.17625 to 0.36825; no head triangles use the selected regions. This permits clothing variation while retaining the original skin, hair and facial colors. These values apply to the exact native files above; replacing an asset requires checking its UVs again.

## Integrity

SHA-256 values, verified against the downloaded originals:

```text
Source ZIP: 9e1d48e6d7b8479ebbe84df71eb5bd8e1b3f0da546dea641890dccc8a02d0999
male-a.glb: 77572792bfe2773b715b8cd8e18644b52b3e1f155fe10450254b50f9c364382a
male-b.glb: 791fc0c203924c175c0a3d5b60d030daf36797b039506689cf7cd01ef5253b3c
female-a.glb: 8cfcff43460da8b421f2a7fdfb43ec177321cad2746db9497cbf128d5806e2a8
```
