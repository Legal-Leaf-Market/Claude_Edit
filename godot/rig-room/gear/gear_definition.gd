class_name GearDefinition
extends Resource

# WHAT A PIECE OF GEAR IS, APART FROM WHAT IT LOOKS LIKE.
#
# The mesh is the GLB; this is everything the game needs to know that a mesh
# cannot tell it. Keeping them apart is what lets an amp, a rack unit and a
# microphone reuse every system here without any of those systems learning the
# word "pedal".
#
# THE MILLIMETRES ARE NOT DECORATION. They are checked against the imported
# mesh's own bounding box at load time (see gear_rig.gd), because an asset
# exported at the wrong scale is the single most likely pipeline fault and it
# is invisible until a pedal is standing next to an amp.

export var id := ""
export var manufacturer := ""
export var model := ""
export var category := ""

export var width_mm := 0.0
export var depth_mm := 0.0
export var height_mm := 0.0

# How far off the surface it sits when held up for inspection. Derived from the
# mesh when zero, which is the normal case.
export var inspect_distance := 0.0

func display_name() -> String:
	return "%s %s" % [manufacturer, model]

func size_metres() -> Vector3:
	return Vector3(width_mm, height_mm, depth_mm) * 0.001
