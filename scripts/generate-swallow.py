"""Original CC0 animated swallow. Run in a Blender 5.0+ factory-startup batch."""
import argparse
import json
import math
from pathlib import Path
import struct
import sys

import bpy
import bmesh

parser = argparse.ArgumentParser()
parser.add_argument('--output-directory', type=Path, required=True)
parser.add_argument('--source-directory', type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.output_directory.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.render.fps = 30
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 13


def material(name, color):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .72
    return result


navy = material('BlueBlackBack', (.025, .045, .085))
cream = material('CreamBreast', (.84, .83, .74))
rust = material('RustThroat', (.36, .095, .045))
black = material('EyesAndBeak', (.008, .009, .012))


def ellipsoid(name, position, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    return obj


body = ellipsoid('StreamlinedBody', (0, 0, 0), (.025, .085, .026), navy)
body.data.materials.append(cream)
for polygon in body.data.polygons:
    if polygon.center.z < -.05:
        polygon.material_index = 1
ellipsoid('Head', (0, .073, .012), (.023, .028, .023), navy)
ellipsoid('RustThroat', (0, .082, -.006), (.018, .021, .012), rust)
for side in [-1, 1]:
    ellipsoid('Eye', (side * .021, .083, .018), (.003, .004, .003), black)


def prism(name, outline, thickness, mat):
    count = len(outline)
    vertices = [(x, y, z) for z in [-thickness / 2, thickness / 2] for x, y in outline]
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    normals = bmesh.new()
    normals.from_mesh(data)
    bmesh.ops.recalc_face_normals(normals, faces=normals.faces)
    normals.to_mesh(data)
    normals.free()
    data.materials.append(mat)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


prism('Beak', [(-.009, .09), (0, .116), (.009, .09)], .007, black)
for side in [-1, 1]:
    wing = prism('LeftWing' if side < 0 else 'RightWing', [
        (0, .032), (side * .058, .035), (side * .17, -.075),
        (side * .073, -.022), (side * .035, -.043), (0, -.03),
    ], .004, navy)
    wing.location.z = .008
    for frame in range(1, 14):
        wing.rotation_euler.y = side * math.sin((frame - 1) / 12 * math.tau) * .62
        wing.keyframe_insert(data_path='rotation_euler', frame=frame)
    wing.animation_data.action.name = wing.name + 'Fly'
    prism('TailStreamer', [(0, -.05), (side * .027, -.077),
                           (side * .05, -.205), (side * .008, -.115)], .003, navy)

bpy.context.scene.frame_set(1)
if args.source_directory:
    args.source_directory.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.source_directory / 'swallow.blend'))

output = args.output_directory / 'swallow.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
                          export_yup=False, export_animations=True,
                          export_animation_mode='ACTIONS', export_force_sampling=True,
                          export_extras=False, export_copyright='Original simulator asset, CC0-1.0')

# Rigid wing actions share one timeline so the renderer can request one fly clip.
data = output.read_bytes()
json_length = struct.unpack_from('<I', data, 12)[0]
document = json.loads(data[20:20 + json_length])
samplers, channels = [], []
for animation in document.get('animations', []):
    offset = len(samplers)
    samplers.extend(animation['samplers'])
    for channel in animation['channels']:
        channels.append({**channel, 'sampler': channel['sampler'] + offset})
if not channels:
    raise RuntimeError('Swallow export has no animated wing channels')
document['animations'] = [{'name': 'fly', 'samplers': samplers, 'channels': channels}]
encoded = json.dumps(document, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
binary_chunk = data[20 + json_length:]
output.write_bytes(struct.pack('<4sII', b'glTF', 2, 20 + len(encoded) + len(binary_chunk))
                   + struct.pack('<I4s', len(encoded), b'JSON') + encoded + binary_chunk)
print(json.dumps({'asset': output.name, 'bytes': output.stat().st_size,
                  'animatedChannels': len(channels), 'blender': bpy.app.version_string}))
