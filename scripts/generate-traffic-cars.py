"""Original CC0 stylized traffic cars. Run with Blender 5.0+ in a factory-startup batch."""
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


def material(name, color, metallic=0, roughness=.6, vertex=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    if vertex:
        colors = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        colors.layer_name = 'Color'
        mat.node_tree.links.new(colors.outputs['Color'], node.inputs['Base Color'])
    return mat


def mesh(name, vertices, faces, mat, color=(.7, .72, .75, 1)):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    normals = bmesh.new()
    normals.from_mesh(data)
    bmesh.ops.recalc_face_normals(normals, faces=normals.faces)
    normals.to_mesh(data)
    normals.free()
    data.materials.append(mat)
    colors = data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for item in colors.data:
        # glTF multiplies vertex colors into every material after joining meshes.
        item.color = color if mat.name.startswith('Details') else (1, 1, 1, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


def box(name, center, dimensions, mat, color=(.7, .72, .75, 1)):
    x, y, z = center
    a, b, c = (value / 2 for value in dimensions)
    vertices = [(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name, vertices, [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)], mat, color)


def cylinder(name, x, y, z, radius, depth, mat, sides=16):
    vertices = [(x+radius*math.cos(i*2*math.pi/sides),y+side*depth/2,z+radius*math.sin(i*2*math.pi/sides)) for side in [-1,1] for i in range(sides)]
    faces = [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    faces += [tuple(range(sides)),tuple(range(sides,sides*2))]
    return mesh(name, vertices, faces, mat)


def make_car(name, length, width, height, wheelbase, suv):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    paint = material('BodyPaint', (1,0,1), 0, .6)
    trim = material('Trim', (.018,.024,.03), 0, .85)
    glass = material('Glass', (.025,.045,.06), .15, .22)
    details = material('Details', (1,1,1), .25, .5, True)
    half, w = length/2, width/2
    radius = .355 if suv else .31
    waist = 1.06 if suv else .93
    wheel_z = radius
    wheel_x = [wheelbase/2, -wheelbase/2]
    base = wheel_z
    arch = radius + .045
    profile = [(-half,base)]
    for x in sorted(wheel_x):
        profile.append((x-arch,base))
        profile.extend((x+arch*math.cos(angle),base+arch*math.sin(angle)) for angle in [math.pi-i*math.pi/10 for i in range(1,11)])
    profile.append((half,base))
    top = [(-half,waist*.88),(-half+.28,waist),(-.9,waist),(.7,waist),(half-.5,waist*.96),(half,waist*.83)]
    for side in [-1,1]:
        outline = profile + list(reversed(top))
        mesh('SculptedSide'+str(side),[(x,side*w*.95,z) for x,z in outline],[tuple(range(len(outline)))],paint)
    vertices = [(x,side*w*.95,z) for side in [-1,1] for x,z in top]
    mesh('UpperBody',vertices,[(i,i+1,i+1+len(top),i+len(top)) for i in range(len(top)-1)],paint)
    box('Chassis',(0,0,waist*.54),(length*.91,width*.72,waist*.49),trim if suv else paint)
    for x in [-half,half]:
        box('Bumper',(x,0,base+.08),(.025,width*.89,.24),trim if suv else paint)
    rear_base, front_base = -half+.33, .95 if suv else 1.02
    rear_roof, front_roof = (-1.15,.25) if suv else (-1.12,.34)
    cabin = [(rear_base,-w*.88,waist),(rear_base,w*.88,waist),(front_base,-w*.88,waist),(front_base,w*.88,waist),(rear_roof,-w*.79,height),(rear_roof,w*.79,height),(front_roof,-w*.79,height),(front_roof,w*.79,height)]
    mesh('Windows',cabin,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3)],glass)
    mesh('Roof',cabin,[(4,5,7,6)],paint)
    for side in [-1,1]:
        for x in [-.48, front_base-.035, rear_base+.04]:
            # Pillars are surface strips, leaving the sloped window panels intact.
            upper_x = max(rear_roof,min(front_roof,x))
            mesh('Pillar',[(x-.035,side*w*.882,waist),(x+.035,side*w*.882,waist),(upper_x+.035,side*w*.792,height),(upper_x-.035,side*w*.792,height)],[(0,1,2,3)],paint)
        box('Mirror',(.72,side*(w-.045),waist+.08),(.22,.09,.09),paint)
        for x in [-.8,.25]:
            box('DoorHandle',(x,side*w*.952,waist-.10),(.16,.015,.024),details)
        for x in wheel_x:
            y = side*(w-.12)
            cylinder('Tire',x,y,wheel_z,radius,.20,trim)
            cylinder('Alloy',x,y+side*.103,wheel_z,radius*.65,.012,details,12)
            cylinder('Hub',x,y+side*.115,wheel_z,radius*.18,.015,trim,10)
            for spoke in range(5 if not suv else 10):
                angle=spoke*math.tau/(5 if not suv else 10)
                r0,r1=radius*.22,radius*.59
                points=[(x+r*math.cos(angle)+s*.017*math.sin(angle),y+side*.118,wheel_z+r*math.sin(angle)-s*.017*math.cos(angle)) for r,s in [(r0,-1),(r1,-1),(r1,1),(r0,1)]]
                mesh('Spoke',points,[(0,1,2,3)],trim)
    front = half+.017
    grille = [(-.57,waist*.87),(.57,waist*.87),(.63,waist*.7),(.43,waist*.37),(-.43,waist*.37),(-.63,waist*.7)]
    mesh('Grille',[(front,y,z) for y,z in grille],[tuple(range(6))],trim)
    center_z=waist*.64
    inner=[(y*.94,center_z+(z-center_z)*.94) for y,z in grille]
    rim=[(front+.002,y,z) for y,z in grille+inner]
    mesh('GrilleSurround',rim,[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)],details)
    for side in [-1,1]:
        mesh('Headlamp',[(front,side*y,z) for y,z in [(.57,waist*.89),(.84,waist*.9),(.80,waist*.77),(.59,waist*.78)]],[(0,1,2,3)],details,(.86,.9,.95,1))
        mesh('TailLamp',[(-half-.017,side*y,z) for y,z in [(.5,waist*.84),(.84,waist*.87),(.82,waist*.71),(.51,waist*.73)]],[(0,1,2,3)],details,(.7,.015,.02,1))
    if suv:
        for side in [-1,1]:
            box('RoofRail',(-.5,side*w*.73,height+.009),(1.6,.028,.018),trim)
    else:
        box('HatchSpoiler',(rear_roof-.06,0,height-.013),(.16,width*.8,.035),paint)
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = next(obj for obj in bpy.context.scene.objects if obj.type=='MESH')
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name=name
    lo=[min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    hi=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    size=[length,width,height]
    for vertex in obj.data.vertices:
        for i in range(3):
            vertex.co[i]=(vertex.co[i]-(lo[i] if i==2 else (lo[i]+hi[i])/2))*size[i]/(hi[i]-lo[i])
    obj.data.update()
    obj.data.calc_loop_triangles()
    triangles=len(obj.data.loop_triangles)
    assert 0 < triangles <= 5000 and len(obj.data.materials)<=4
    assert all(triangle.area > 1e-10 for triangle in obj.data.loop_triangles)
    if args.source_directory:
        args.source_directory.mkdir(parents=True,exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str((args.source_directory/(name+'.blend')).resolve()))
    path=args.output_directory/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path.resolve()),export_format='GLB',use_selection=True,export_yup=False,export_apply=True)
    raw=path.read_bytes()
    document=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
    accessors=[document['accessors'][primitive['attributes']['POSITION']] for mesh in document['meshes'] for primitive in mesh['primitives']]
    bounds=[max(a['max'][i] for a in accessors)-min(a['min'][i] for a in accessors) for i in range(3)]
    assert all(abs(a-b)<1e-5 for a,b in zip(bounds,size)), (bounds,size)
    assert len(document['materials'])<=4
    binary_start = 28 + struct.unpack_from('<I', raw, 12)[0]
    for mesh_data in document['meshes']:
        for primitive in mesh_data['primitives']:
            if document['materials'][primitive['material']]['name'] != 'BodyPaint':
                continue
            paint_pbr = document['materials'][primitive['material']]['pbrMetallicRoughness']
            assert paint_pbr['baseColorFactor'] == [1, 0, 1, 1]
            assert paint_pbr.get('metallicFactor', 1) == 0
            accessor = document['accessors'][primitive['attributes']['COLOR_0']]
            assert accessor['componentType'] == 5126 or accessor.get('normalized', False)
            view = document['bufferViews'][accessor['bufferView']]
            format_code, component_size, white = {5126: ('f', 4, 1.0), 5123: ('H', 2, 65535), 5121: ('B', 1, 255)}[accessor['componentType']]
            channels = {'VEC3': 3, 'VEC4': 4}[accessor['type']]
            start = binary_start + view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
            stride = view.get('byteStride', channels * component_size)
            for index in range(accessor['count']):
                values = struct.unpack_from('<' + format_code * channels, raw, start + index * stride)
                assert all(value == white for value in values), 'Body paint must keep neutral vertex colors'
    print(json.dumps({'model':name,'bounds':bounds,'triangles':triangles,'materials':len(document['materials']),'bytes':len(raw)}))


make_car('audi-a3',4.343,1.816,1.458,2.630,False)
make_car('mazda-cx5',4.550,1.840,1.675,2.700,True)
