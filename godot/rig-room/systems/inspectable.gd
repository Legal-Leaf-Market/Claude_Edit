class_name Inspectable
extends Node

# HOLDING AN OBJECT UP AND TURNING IT OVER.
#
# The direction doc is blunt that this is the important one, and the reason is
# that it is the whole claim: the player is looking at a real object from an
# angle nobody chose in advance, not at a picture somebody framed.
#
# WHAT IT REFUSES TO DO. It never reparents the gear and it never writes to the
# gear's own transform in a way it cannot undo. The original transform is
# recorded on entry and restored on exit, and everything during inspection is
# driven from a separate orientation the system owns. Reparenting into the
# camera is the obvious implementation and it is how an object ends up
# permanently scaled by a camera's own transform, or left in the camera's tree
# when the mode is exited by a path nobody tested.
#
# ROTATION IS ACCUMULATED AS A BASIS, NOT AS EULER ANGLES. Yawing then pitching
# with euler angles gimbal-locks the moment the player tilts to look at the
# bottom of a pedal, which is exactly what they will do first, and the symptom
# is an object that suddenly refuses to turn on one axis.

signal entered(gear)
signal exited(gear)

export var rotation_speed := 0.010
export var zoom_speed := 0.045
# Distance is expressed in MULTIPLES OF THE OBJECT'S OWN SIZE, so a pedal and a
# 4x12 cabinet both arrive framed rather than one filling the screen and the
# other being a speck.
# HELD CLOSE. The first pass framed it at 1.9x its own diagonal and a pedal
# came up as a thumbnail in the middle of a dark room: the whole promise of
# inspection is that the thing is in your hands, and at that distance it reads
# as a thing on a shelf across the room.
export var min_distance_factor := 0.62
export var max_distance_factor := 3.0

var active := false

var _gear: Spatial
var _anchor: Spatial
var _origin: Transform
var _origin_parent: Node
var _orientation := Basis()
var _distance := 0.0
var _size := 0.0
# The object's own centre, in ITS OWN space, measured once. Recomputing it per
# frame from the bounds reads a transform this script is writing, which is a
# feedback loop: the object creeps across the screen while you turn it.
var _pivot := Vector3.ZERO

func begin(gear: Spatial, anchor: Spatial) -> bool:
	if active or gear == null or anchor == null:
		return false
	_gear = gear
	_anchor = anchor
	_origin = gear.global_transform
	_origin_parent = gear.get_parent()
	_orientation = Basis()
	var box := _bounds(gear)
	_size = max(box.size.length(), 0.02)
	_pivot = gear.global_transform.affine_inverse().xform(box.position + box.size * 0.5)
	_distance = _size * 1.05
	active = true
	emit_signal("entered", gear)
	return true

func end() -> void:
	if not active:
		return
	var gear := _gear
	# Put it back exactly where it was, in world space, so an inspection can
	# never nudge a pedal off the board it was sitting on.
	gear.global_transform = _origin
	active = false
	_gear = null
	_anchor = null
	emit_signal("exited", gear)

func turn(delta_x: float, delta_y: float) -> void:
	if not active:
		return
	# Yaw about the CAMERA's up and pitch about the camera's right, not about
	# the object's own axes: after a half turn, rotating about the object's
	# local Y sends the mouse the wrong way and it feels broken rather than
	# inverted.
	var up := _anchor.global_transform.basis.y
	var right := _anchor.global_transform.basis.x
	_orientation = Basis(up, -delta_x * rotation_speed) * _orientation
	_orientation = Basis(right, -delta_y * rotation_speed) * _orientation
	_orientation = _orientation.orthonormalized()

func zoom(steps: float) -> void:
	if not active:
		return
	_distance = clamp(
		_distance - steps * zoom_speed * _size,
		_size * min_distance_factor,
		_size * max_distance_factor)

func reset_rotation() -> void:
	_orientation = Basis()

func update(_delta: float) -> void:
	if not active:
		return
	var anchor := _anchor.global_transform
	var target := anchor.origin - anchor.basis.z * _distance
	# Held by its CENTRE rather than by its origin. This GLB is anchored
	# bottom-centre, which is right for standing it on a board and wrong for
	# turning it over: spinning about the origin swings the pedal around the
	# room on the end of an invisible arm.
	var basis := _orientation
	_gear.global_transform = Transform(basis, target - basis.xform(_pivot))

func held() -> Spatial:
	return _gear

# WORLD SPACE, NOT PARENT SPACE. `get_transformed_aabb()` returns a mesh's box
# in its OWN parent's space, so on a hierarchy three deep it silently answers
# for the wrong frame, and the error looks like a slightly wrong pivot rather
# than a bug.
static func _bounds(node: Node) -> AABB:
	var out := AABB()
	var first := true
	for child in _walk(node):
		if child is MeshInstance:
			var box: AABB = child.global_transform.xform(child.get_aabb())
			if first:
				out = box
				first = false
			else:
				out = out.merge(box)
	return out

static func _walk(node: Node) -> Array:
	var found := [node]
	for child in node.get_children():
		found += _walk(child)
	return found
