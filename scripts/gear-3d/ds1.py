"""
BOSS DS-1, authored as a real mesh and exported as glTF.

    blender --background --python scripts/gear-3d/ds1.py

THIS IS NOT THE SITE'S PEDAL VIEWER. `components/board/pedal-viewer-3d.tsx`
builds its pedals from three.js primitives at runtime, deliberately, because it
draws eighty-eight of them from measurements and one renderer is worth more
there than one beautiful model. This is the first asset for the separate 3D rig
room, which CLAUDE.md section 16 leaves open as the one place a heavier
approach earns its keep, and it is a mesh on disk rather than code that runs in
a browser.

WHY IT IS BUILT FROM A SWEPT PROFILE. The BOSS compact chassis is a stepped
casting: a low deck at the front under the tread plate, a riser, and a raised
control shelf at the back. That step IS the silhouette, and it is what a plain
rounded box cannot be talked into. A side profile extruded across the width
gets it exactly, and a bevel modifier then rounds every edge at once, which is
what stops it reading as CG.

NOTHING HERE IS TRACED FROM SOMEBODY ELSE'S MODEL. The brief points at a free
CGTrader mesh as a candidate source; that is unreachable from this machine and
would need its licence confirmed for commercial use before it could ship
anyway, which is the same rule section 13 applies to imagery. Everything below
is authored from the published external dimensions, so the asset is ours and
there is no licence to check.
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

MM = 0.001

# Published external size. Height includes the knobs, which is why the casting
# below stops short of it.
WIDTH = 73 * MM
DEPTH = 129 * MM
HEIGHT = 59 * MM

HALF_W = WIDTH / 2
HALF_D = DEPTH / 2

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEXTURES = os.path.join(ROOT, "scripts", "gear-3d", "textures")
OUT_GLB = os.path.join(ROOT, "public", "gear-3d", "boss-ds1.glb")
OUT_BLEND = os.path.join(ROOT, "scripts", "gear-3d", "boss-ds1-master.blend")

# ---------------------------------------------------------------------------
#  Scene
# ---------------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0


def link(obj, parent=None):
    """Link once, parent optionally.

    `bpy.ops.mesh.primitive_*_add` links what it creates to the active
    collection already, so calling this on an operator-made object without the
    guard is a hard error rather than a no-op.
    """
    if obj.name not in scene.collection.objects:
        scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def mesh_from(name, verts, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    return bpy.data.objects.new(name, mesh)


def shade_smooth(obj, angle=math.radians(38)):
    """Auto smooth: sharp where the casting has an edge, smooth around a bevel."""
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.data.use_auto_smooth = True
    obj.data.auto_smooth_angle = angle


def bevel(obj, width=1.2 * MM, segments=3, clamp=True):
    modifier = obj.modifiers.new("Bevel", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(35)
    modifier.use_clamp_overlap = clamp
    modifier.harden_normals = False
    return modifier


def apply_modifiers(obj):
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


# ---------------------------------------------------------------------------
#  Materials
# ---------------------------------------------------------------------------


def pbr(name, colour, metallic, roughness, alpha_blend=False, image=None, emissive=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    if emissive is not None:
        bsdf.inputs["Emission Color"].default_value = (*emissive, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 0.0

    if image:
        texture = material.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = bpy.data.images.load(image)
        texture.interpolation = "Cubic"
        material.node_tree.links.new(bsdf.inputs["Base Color"], texture.outputs["Color"])
        material.node_tree.links.new(bsdf.inputs["Alpha"], texture.outputs["Alpha"])
        material.blend_method = "BLEND"

    if alpha_blend:
        material.blend_method = "BLEND"

    return material


def srgb(hex_string):
    """Hex to linear, because Blender's node inputs are linear and a value
    pasted straight from a swatch comes out visibly washed."""
    value = hex_string.lstrip("#")
    out = []
    for i in (0, 2, 4):
        channel = int(value[i : i + 2], 16) / 255
        out.append(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4)
    return tuple(out)


PAINT = pbr("DS1_PaintOrange", srgb("#E4650F"), 0.18, 0.44)
RUBBER = pbr("DS1_Rubber", srgb("#17191d"), 0.0, 0.82)
CHROME = pbr("DS1_Chrome", srgb("#C6CBD2"), 0.95, 0.19)
KNOB = pbr("DS1_KnobBlack", srgb("#111214"), 0.0, 0.48)
KNOB_CAP = pbr("DS1_KnobCap", srgb("#B9BDC4"), 0.9, 0.26)
PLATE = pbr("DS1_BottomPlate", srgb("#1b1c1f"), 0.35, 0.55)
LED = pbr("DS1_LedLens", srgb("#c01818"), 0.0, 0.16, emissive=srgb("#ff2a1a"))
DARK = pbr("DS1_Socket", srgb("#0a0b0d"), 0.1, 0.7)

SHELF_DECAL = pbr(
    "DS1_PanelPrint", (1, 1, 1), 0.0, 0.5, image=os.path.join(TEXTURES, "ds1-shelf.png")
)
INPUT_DECAL = pbr(
    "DS1_InputPrint", (1, 1, 1), 0.0, 0.5, image=os.path.join(TEXTURES, "ds1-input.png")
)
OUTPUT_DECAL = pbr(
    "DS1_OutputPrint", (1, 1, 1), 0.0, 0.5, image=os.path.join(TEXTURES, "ds1-output.png")
)


def paint(obj, material):
    obj.data.materials.append(material)
    return obj


# ---------------------------------------------------------------------------
#  The casting
# ---------------------------------------------------------------------------

# Side profile, front at -Y. Blender is Z-up here; the glTF exporter converts to
# the Y-up, -Z-forward convention the brief asks for.
#
# The step is the whole shape: a 27mm deck at the nose, a riser at y = -6, and a
# 49mm shelf running back. Knobs then take it to the published 59mm.
SHELF_TOP = 49 * MM
DECK_BACK = 33 * MM
DECK_FRONT = 27 * MM
RISER_Y = -6 * MM
PLATE_T = 1.6 * MM

PROFILE = [
    (-HALF_D, 0.0),
    (HALF_D, 0.0),
    (HALF_D, SHELF_TOP),
    (RISER_Y, SHELF_TOP - 1.5 * MM),
    (RISER_Y, DECK_BACK),
    (-HALF_D, DECK_FRONT),
]


def sweep(name, profile, x_half):
    """Extrude a YZ profile across X. Two capped ends and a wall per segment."""
    verts = []
    for y, z in profile:
        verts.append((-x_half, y, z))
        verts.append((x_half, y, z))

    faces = []
    count = len(profile)
    for i in range(count):
        j = (i + 1) % count
        faces.append((i * 2, j * 2, j * 2 + 1, i * 2 + 1))
    faces.append(tuple(range(0, count * 2, 2))[::-1])
    faces.append(tuple(range(1, count * 2, 2)))
    return mesh_from(name, verts, faces)


body = paint(sweep("lower_body", PROFILE, HALF_W), PAINT)
link(body)
bevel(body, width=2.2 * MM, segments=4)
apply_modifiers(body)
shade_smooth(body)

# ---------------------------------------------------------------------------
#  Root, and the hierarchy the rig builder will raycast
# ---------------------------------------------------------------------------

root = link(bpy.data.objects.new("BOSS_DS1_ROOT", None))
root.empty_display_size = 0.02

enclosure = link(bpy.data.objects.new("ENCLOSURE", None), root)
body.parent = enclosure
body.name = "lower_body"

# The bottom plate: a real part, visible the moment anybody tips the pedal over.
plate = paint(
    mesh_from(
        "bottom_plate",
        [
            # z is the plate's INNER face and the solidify below grows
            # DOWNWARD from it, so this number is the plate's thickness rather
            # than a clearance. It read 0.4 and the pedal stood 1.2mm through
            # the floor in every render.
            (-HALF_W + 2 * MM, -HALF_D + 2 * MM, PLATE_T),
            (HALF_W - 2 * MM, -HALF_D + 2 * MM, PLATE_T),
            (HALF_W - 2 * MM, HALF_D - 2 * MM, PLATE_T),
            (-HALF_W + 2 * MM, HALF_D - 2 * MM, PLATE_T),
        ],
        [(0, 1, 2, 3)],
    ),
    PLATE,
)
link(plate, enclosure)
solid = plate.modifiers.new("Solidify", "SOLIDIFY")
solid.thickness = PLATE_T
solid.offset = -1
apply_modifiers(plate)


# ---------------------------------------------------------------------------
#  The tread plate, which is the other half of the silhouette
# ---------------------------------------------------------------------------


def rounded_plate(name, width, depth, thickness, radius=3 * MM, segments=6):
    """A plate with rounded corners in plan, built as a bevelled box.

    SCALE IS THE EDGE LENGTH, NOT THE HALF EXTENT. `primitive_cube_add(size=1)`
    is already a unit cube spanning -0.5 to 0.5, so scaling by half the wanted
    width delivers half the wanted plate. The tread plate was built at 32mm on
    a 73mm pedal for as long as this file has existed, and it did not read as a
    bug in the render: it read as a small plate, which is a thing a pedal could
    plausibly have.
    """
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width, depth, thickness)
    bpy.ops.object.transform_apply(scale=True)
    modifier = obj.modifiers.new("Bevel", "BEVEL")
    modifier.width = radius
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(35)
    apply_modifiers(obj)
    shade_smooth(obj)
    return obj


"""
THE PLATE IS BODY COLOURED, WHICH IS MOST OF WHY THE FIRST BUILD WAS
UNRECOGNISABLE. It was painted RUBBER, so the front half of a BOSS compact came
out as a black slab: the one solid mass of colour that makes this silhouette
readable across a room was cut in two. A BOSS compact is one colour from the
nose to the back wall, and the plate is a painted pressing of the same paint.
What separates it from the deck is a SEAM, not a colour, so the reveal either
side is a real gap with a real shadow in it rather than a change of material.
"""
TREAD_W = 66 * MM
TREAD_T = 4.4 * MM
"""
The hinge, and the plate's rest angle, are the DECK's, not a guess.

The deck is a ramp: 33mm at the riser falling to 27mm at the nose over 58mm,
which is 5.9 degrees. The first build had the plate at 3.2 degrees, so it
agreed with the deck at the hinge and stood 3mm off it at the toe, and the
render showed a slab hovering over its own pedal with daylight under the front
edge. A hinged plate at rest lies ON what it covers; it is the STOMP that opens
that gap, and the stomp is the application's to animate.
"""
TREAD_DROP = math.degrees(math.atan2(DECK_BACK - DECK_FRONT, HALF_D + RISER_Y))

treadle = paint(rounded_plate("tread_plate", TREAD_W, 57 * MM, TREAD_T, radius=2.5 * MM), PAINT)
link(treadle)

treadle_root = link(bpy.data.objects.new("PEDAL_TREADLE", None), root)
"""
THE PIVOT IS THE HINGE, NOT THE CENTRE.

The brief asks for a treadle that can rotate a few degrees for a stomp, and a
plate that rotates about its own middle rises at the back as it falls at the
front, which is not what a hinged plate does. The empty sits on the hinge line
so the application can turn it and get the real motion for free.

AND EVERY CHILD BELOW IS POSITIONED IN THIS EMPTY'S SPACE. That reads as
obvious and it is exactly what the first build got wrong: the thumbscrew was
given the coordinates it has on the pedal and then parented here, so the
parent's own offset was added on top and a chrome disc ended up floating 7mm
off the nose and 26mm above it, in mid-air, in all nine renders.
"""
treadle_root.location = (0, RISER_Y - 0.5 * MM, DECK_BACK + 0.4 * MM)
# POSITIVE, and the sign is worth deriving rather than trying: a rotation of a
# about X sends z to y*sin(a) + z*cos(a), and the toe is at NEGATIVE y, so only
# a positive angle lowers it. The first build used a negative one and lifted
# the nose of the plate 3.5mm clear of the deck it is hinged to.
treadle_root.rotation_euler = (math.radians(TREAD_DROP), 0, 0)
treadle.parent = treadle_root
treadle.location = (0, -29 * MM, TREAD_T / 2)

# The thumbscrew that holds the plate down at the toe, in the PLATE's frame.
bpy.ops.mesh.primitive_cylinder_add(radius=4.2 * MM, depth=2.6 * MM, vertices=28)
screw = paint(bpy.context.active_object, CHROME)
screw.name = "treadle_thumbscrew"
screw.location = (0, -54 * MM, TREAD_T)
bevel(screw, width=0.5 * MM, segments=2)
apply_modifiers(screw)
shade_smooth(screw)
link(screw, treadle_root)


# ---------------------------------------------------------------------------
#  Controls
# ---------------------------------------------------------------------------


def knob(name, x, y):
    """A knob is three parts: the ribbed body, the metal cap, and the pointer."""
    group = link(bpy.data.objects.new(name, None), root)
    group.location = (x, y, SHELF_TOP)

    bpy.ops.mesh.primitive_cylinder_add(radius=8.4 * MM, depth=9 * MM, vertices=40)
    barrel = paint(bpy.context.active_object, KNOB)
    barrel.name = f"{name}_knob"
    barrel.location = (0, 0, 4.5 * MM)
    # A slight taper, the way a moulded knob is drafted.
    for vert in barrel.data.vertices:
        if vert.co.z > 0:
            vert.co.x *= 0.93
            vert.co.y *= 0.93
    bevel(barrel, width=0.7 * MM, segments=2)
    apply_modifiers(barrel)
    shade_smooth(barrel)
    barrel.parent = group

    bpy.ops.mesh.primitive_cylinder_add(radius=5.4 * MM, depth=1.1 * MM, vertices=36)
    cap = paint(bpy.context.active_object, KNOB_CAP)
    cap.name = f"{name}_cap"
    cap.location = (0, 0, 9.4 * MM)
    bevel(cap, width=0.3 * MM, segments=2)
    apply_modifiers(cap)
    shade_smooth(cap)
    cap.parent = group

    bpy.ops.mesh.primitive_cube_add(size=1)
    pointer = paint(bpy.context.active_object, KNOB_CAP)
    pointer.name = f"{name}_indicator"
    pointer.scale = (0.8 * MM, 6.2 * MM, 0.6 * MM)
    pointer.location = (0, -3.4 * MM, 9.1 * MM)
    bpy.ops.object.transform_apply(scale=True)
    pointer.parent = group

    return group


KNOB_Y = 30 * MM
knob("CONTROL_TONE", -21.5 * MM, KNOB_Y)
knob("CONTROL_LEVEL", 0, KNOB_Y)
knob("CONTROL_DIST", 21.5 * MM, KNOB_Y)

# The CHECK indicator, behind the knobs where the real one sits.
bpy.ops.mesh.primitive_uv_sphere_add(radius=2.4 * MM, segments=20, ring_count=10)
led = paint(bpy.context.active_object, LED)
led.name = "LED_CHECK"
led.scale = (1, 1, 0.55)
led.location = (0, 52 * MM, SHELF_TOP + 0.4 * MM)
bpy.ops.object.transform_apply(scale=True)
shade_smooth(led)
link(led, root)


# ---------------------------------------------------------------------------
#  Jacks, and the transforms a cable will snap to
# ---------------------------------------------------------------------------


def jack(name, socket_name, location, rotation, facing, outer=6.4 * MM, inner=4.3 * MM):
    """
    A NUT IS A WASHER, AND A SOLID ONE MAKES THE PEDAL LOOK UNPLUGGABLE.

    The first build drew the nut as a filled cylinder, so all three jacks came
    out as bright chrome coins stuck to the walls with nothing behind them. A
    jack is read almost entirely by its HOLE: the dark bore inside a thin ring
    is the whole signal that something plugs in there, and a disc says the
    opposite. So the ring is cut for real, with the bore recessed just inside
    it, which also gives the hole its own shading rather than a painted-on
    dark spot.
    """
    group = link(bpy.data.objects.new(name, None), root)
    group.location = location
    group.rotation_euler = rotation

    bpy.ops.mesh.primitive_cylinder_add(radius=outer, depth=2.2 * MM, vertices=48)
    nut = paint(bpy.context.active_object, CHROME)
    nut.name = f"{name}_nut"
    nut.rotation_euler = (math.radians(90), 0, 0)
    # Proud of the wall, the way a nut tightened onto a panel actually sits,
    # rather than half sunk into it.
    nut.location = (0, 1.1 * MM, 0)
    bevel(nut, width=0.35 * MM, segments=2)

    bpy.ops.mesh.primitive_cylinder_add(radius=inner, depth=12 * MM, vertices=48)
    cutter = bpy.context.active_object
    cutter.name = f"{name}_cutter"
    cutter.rotation_euler = (math.radians(90), 0, 0)
    cutter.location = (0, 1.1 * MM, 0)
    boolean = nut.modifiers.new("Bore", "BOOLEAN")
    boolean.operation = "DIFFERENCE"
    boolean.object = cutter
    apply_modifiers(nut)
    bpy.data.objects.remove(cutter, do_unlink=True)
    shade_smooth(nut)
    nut.parent = group

    """
    ONE LOCAL FRAME FOR ALL THREE JACKS: -Y IS INTO THE PEDAL.

    It was not, and the two side jacks bored outward: a 6mm black cylinder
    standing proud of each wall like a stub of pipe, which is what pushed the
    exported width to 85mm on a 73mm pedal. Fixing it per jack by flipping a
    group rotation is how the DC one ends up right and the other two wrong
    again, so the frame is stated once and every part below reads from it.
    """
    bpy.ops.mesh.primitive_cylinder_add(radius=inner - 0.15 * MM, depth=9 * MM, vertices=48)
    bore = paint(bpy.context.active_object, DARK)
    bore.name = f"{name}_bore"
    bore.rotation_euler = (math.radians(90), 0, 0)
    # Its mouth sits 1.2mm inside the nut's face, so the ring casts a shadow
    # into the hole instead of the hole ending flush and reading as paint.
    bore.location = (0, -3.5 * MM, 0)
    shade_smooth(bore)
    bore.parent = group

    """
    THE SOCKET IS A TRANSFORM, NOT A MESH.

    The brief asks for a place a future cable plug can snap to and a direction
    for it to face. An empty is exactly that and it costs no triangles: the rig
    room reads its world matrix, puts the plug there, and points it down -Y in
    the empty's own space.
    """
    socket = link(bpy.data.objects.new(socket_name, None), group)
    socket.empty_display_type = "SINGLE_ARROW"
    socket.empty_display_size = 0.01
    # At the MOUTH, just outside the nut: a plug meets the jack there, and a
    # transform buried inside the casting would put the plug inside the pedal.
    socket.location = (0, 3 * MM, 0)
    socket.rotation_euler = facing
    return group


# High on the wall, not halfway down it: the jack is drilled through the
# SHELF's side, which is the only part of this casting deep enough to take a
# quarter-inch socket, and the first build put it at 20mm where the wall is
# still the low deck's.
JACK_Z = 31 * MM
JACK_Y = 34 * MM
# On a BOSS compact the input is on the right and the output on the left, as
# the player looks down at it.
jack("JACK_INPUT", "SOCKET_INPUT", (HALF_W, JACK_Y, JACK_Z), (0, 0, math.radians(-90)), (0, 0, 0))
jack("JACK_OUTPUT", "SOCKET_OUTPUT", (-HALF_W, JACK_Y, JACK_Z), (0, 0, math.radians(90)), (0, 0, 0))
# The DC socket faces straight out of the back, so its own frame IS the
# model's: no rotation at all now that -Y means inward for every jack. It is
# also a 2.1mm barrel inlet rather than a quarter-inch jack, so it is drawn
# smaller: at the shared radius it read as a third instrument socket on the
# back wall, which is a specification this pedal does not have.
jack("JACK_DC", "SOCKET_DC", (0, HALF_D, 40 * MM), (0, 0, 0), (0, 0, 0),
     outer=5.2 * MM, inner=3.4 * MM)


# ---------------------------------------------------------------------------
#  Printed graphics
# ---------------------------------------------------------------------------


def decal(name, material, width, depth, location, rotation):
    """A plane a hair off the surface it is printed on, with its own alpha."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    plane = bpy.context.active_object
    plane.name = name
    plane.scale = (width, depth, 1)
    bpy.ops.object.transform_apply(scale=True)
    plane.location = location
    plane.rotation_euler = rotation
    plane.data.materials.append(material)
    link(plane, graphics)
    return plane


graphics = link(bpy.data.objects.new("GRAPHICS", None), root)

"""
The shelf print, drawn in the same 68 x 66 frame the SVG uses, so a legend's
position in that file is its position on the pedal.

IT IS LAID DOWN SHORT OF THE EDGES, because the casting's corners are rounded
by a 2.2mm bevel and a plane the full width of the pedal hangs its four corners
out over that curve as bright tabs. The same trap the runtime viewer's decals
already carry a note about, and the fix is the same one: the plane is inset and
the texture is scaled with it, from the same pair of numbers, so the two cannot
drift apart.
"""
SHELF_DECAL_W = 68 * MM
SHELF_DECAL_D = 66 * MM
decal(
    "panel_print",
    SHELF_DECAL,
    SHELF_DECAL_W,
    SHELF_DECAL_D,
    (0, RISER_Y + 35 * MM, SHELF_TOP + 0.25 * MM),
    (0, 0, 0),
)

"""
A SIDE DECAL HAS TO FACE OUT OF THE SIDE, AND THE FIRST PAIR FACED THE BACK.

Blender composes an XYZ euler as Rz * Ry * Rx, and `(0, 90, 90)` works out to a
plane whose normal is +Y: both labels stood edge-on to the wall they were meant
to be printed on, readable only from behind the pedal, with their 10mm axis
running ACROSS the body. That last part is why it was catchable without
looking: two 40mm planes lying flat in the wrong axis pushed the exported
bounding box out to 85mm on a 73mm pedal, and a bounding box is a number.

So the rotations below are derived rather than tried. Wanted, for the +X wall:
the 40mm axis along +Y, the 10mm axis along +Z, the normal along +X. Rx(90)
sends local Y to +Z and the normal to -Y; Rz(90) then sends local X to +Y and
that normal to +X. The -X wall is the mirror, and it takes Rz(-90) rather than
a negative Rx, because negating the Rx flips the text upside down instead of
end for end.
"""
decal(
    "input_print",
    INPUT_DECAL,
    40 * MM,
    10 * MM,
    (HALF_W + 0.25 * MM, JACK_Y, JACK_Z + 12.5 * MM),
    (math.radians(90), 0, math.radians(90)),
)
decal(
    "output_print",
    OUTPUT_DECAL,
    40 * MM,
    10 * MM,
    (-HALF_W - 0.25 * MM, JACK_Y, JACK_Z + 12.5 * MM),
    (math.radians(90), 0, math.radians(-90)),
)


# ---------------------------------------------------------------------------
#  Metadata, transforms, export
# ---------------------------------------------------------------------------

root["id"] = "boss-ds1"
root["manufacturer"] = "BOSS"
root["model"] = "DS-1"
root["category"] = "distortion"
root["widthMM"] = 73
root["depthMM"] = 129
root["heightMM"] = 59
root["anchor"] = "bottom-center"

bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.object.select_all(action="DESELECT")

os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
)

print(f"WROTE {OUT_GLB}")
print(f"WROTE {OUT_BLEND}")
