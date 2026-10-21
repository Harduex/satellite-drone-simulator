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
parser.add_argument('--models', nargs='+', choices=[
    'audi-a3', 'mazda-cx5', 'sports-wedge', 'sports-berlinetta', 'sports-turbo',
])
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
    export_car(name, length, width, height)


def make_sports_car(name, length, width, height, style):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    paint = material('BodyPaint', (1, 0, 1), 0, .38)
    trim = material('Trim', (.018, .024, .03), 0, .85)
    glass = material('Glass', (.025, .045, .06), .15, .22)
    details = material('Details', (1, 1, 1), .25, .5, True)
    half, w = length / 2, width / 2
    wedge = style == 'wedge'
    turbo = style == 'turbo'
    radius, axle = .30, length * .305
    waist = .69 if wedge else .74
    # Concave side profiles leave the wheel openings clear of body paint.
    bottom = [(-half, .22)]
    arch = radius + .035
    for x in [-axle, axle]:
        bottom.append((x - arch, radius))
        bottom.extend((x + arch * math.cos(angle), radius + arch * math.sin(angle))
                      for angle in [math.pi - i * math.pi / 12 for i in range(1, 13)])
    bottom.append((half, .22))
    top = [(-half, waist * .87), (-half + .30, waist),
           (.45, waist), (half - .45, .67 if wedge else .70), (half, .38 if wedge else .49)]
    for side in [-1, 1]:
        outline = bottom + list(reversed(top))
        mesh('WheelArchSide', [(x, side * w * .95, z) for x, z in outline],
             [tuple(range(len(outline)))], paint)
    vertices = [(x, side * w * .95, z) for side in [-1, 1] for x, z in top]
    mesh('SculptedDeck', vertices,
         [(i, i + 1, i + 1 + len(top), i + len(top)) for i in range(len(top) - 1)], paint)
    box('Underbody', (0, 0, .24), (length * .92, width * .66, .12), trim)
    for x, z in [(-half, waist * .55), (half, .29 if wedge else .36)]:
        box('EndPanel', (x, 0, z), (.025, width * .95, .23), paint)
        box('BumperStrip', (x * 1.002, 0, z - .07), (.03, width * .95, .05), trim)
    rear_base, front_base = -.95, .80 if wedge else .95
    rear_roof, front_roof = -.55, .12 if wedge else .22
    roof_z = height - (.12 if turbo else .025)
    roof_width = w * (.67 if wedge else .72)
    cabin = [(rear_base, -w * .86, waist), (rear_base, w * .86, waist),
             (front_base, -w * .84, waist), (front_base, w * .84, waist),
             (rear_roof, -roof_width, roof_z), (rear_roof, roof_width, roof_z),
             (front_roof, -roof_width, roof_z), (front_roof, roof_width, roof_z)]
    mesh('CabinGlass', cabin, [(0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4), (2, 6, 7, 3)], glass)
    mesh('LowRoof', cabin, [(4, 5, 7, 6)], paint)
    for side in [-1, 1]:
        for lower, upper in [(rear_base, rear_roof), (front_base, front_roof)]:
            mesh('WindowPillar', [(lower + offset, side * w * .86, waist)
                 for offset in [-.035, .035]] +
                 [(upper + offset, side * roof_width, roof_z) for offset in [.035, -.035]],
                 [(0, 1, 2, 3)], paint)
        box('Mirror', (.45, side * (w - .04), waist + .05), (.18, .08, .065), paint)
        box('DoorHandle', (-.25, side * w * .955, waist - .075), (.15, .012, .025), trim)
        if wedge:
            mesh('AngularSideIntake', [(-1.1, side * w * .957, .56),
                 (-.65, side * w * .957, .62), (-.8, side * w * .957, .37),
                 (-1.2, side * w * .957, .38)], [(0, 1, 2, 3)], trim)
        else:
            box('SideIntake', (-.85, side * w * .957, .59), (.4, .015, .11), trim)
        for x in [-axle, axle]:
            y = side * (w - .12)
            cylinder('SportsTire', x, y, radius, radius, .23, trim, 20)
            cylinder('AlloyRim', x, y + side * .119, radius, radius * .74, .012, details, 16)
            cylinder('DarkHub', x, y + side * .127, radius, radius * .24, .014, trim, 12)
            for spoke in range(5):
                angle = spoke * math.tau / 5
                points = [(x + r * math.cos(angle) + s * .025 * math.sin(angle),
                           y + side * .136,
                           radius + r * math.sin(angle) - s * .025 * math.cos(angle))
                          for r, s in [(.08, -1), (.205, -1), (.205, 1), (.08, 1)]]
                mesh('WheelSpoke', points, [(0, 1, 2, 3)], trim)
        box('PopupHeadlampCover', (half - .48, side * w * .64, .59 if wedge else .69),
            (.30, .29, .025), paint)
        box('FrontLamp', (half + .018, side * w * .64, .34 if wedge else .44),
            (.018, .28, .07), details, (.9, .93, 1, 1))
        if wedge:
            box('TailLamp', (-half - .018, side * w * .61, waist * .61),
                (.018, .42, .12), details, (.8, .012, .018, 1))
        else:
            for y in [.47, .72]:
                lamp = cylinder('RoundTailLamp', 0, 0, 0, .065, .018, details, 12)
                # The cylinder helper's axle is Y; rear lamps face along X.
                for vertex in lamp.data.vertices:
                    px, py, pz = vertex.co
                    vertex.co = (-half - .022 + py, side * w * y + px, waist * .61 + pz)
                for color in lamp.data.color_attributes['Color'].data:
                    color.color = (.8, .012, .018, 1)
    for i in range(7):
        box('EngineLouvre', (-1.1 - i * .09, 0, waist + .012),
            (.045, width * .53, .02), trim)
    box('FrontAirIntake', (half + .024, 0, .27 if wedge else .34),
        (.018, width * .42, .09), trim)
    if turbo or wedge:
        wing_z = height - .035
        for side in [-1, 1]:
            box('WingUpright', (-half + .27, side * w * .65, (waist + wing_z) / 2),
                (.09, .045, wing_z - waist), paint)
        box('RearWing', (-half + .24, 0, wing_z), (.28, width * .91, .055), paint)
    else:
        box('RearLip', (-half + .10, 0, waist * .95), (.14, width * .88, .045), trim)
        for side in [-1, 1]:
            mesh('RearButtress', [(-.55, side * roof_width, roof_z),
                 (-1.45, side * w * .86, waist), (-.95, side * w * .86, waist)],
                 [(0, 1, 2)], paint)
    export_car(name, length, width, height)


def export_car(name, length, width, height):
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


models = args.models or ['audi-a3', 'mazda-cx5', 'sports-wedge', 'sports-berlinetta', 'sports-turbo']
if 'audi-a3' in models:
    make_car('audi-a3',4.343,1.816,1.458,2.630,False)
if 'mazda-cx5' in models:
    make_car('mazda-cx5',4.550,1.840,1.675,2.700,True)
for name, length, width, height, style in [
    ('sports-wedge', 4.14, 1.89, 1.07, 'wedge'),
    ('sports-berlinetta', 4.23, 1.80, 1.12, 'berlinetta'),
    ('sports-turbo', 4.36, 1.90, 1.15, 'turbo'),
]:
    if name in models:
        make_sports_car(name, length, width, height, style)
