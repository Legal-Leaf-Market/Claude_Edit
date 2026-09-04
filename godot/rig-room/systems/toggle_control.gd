class_name ToggleControl
extends Node

# A FOOTSWITCH, OR ANY OTHER PART THAT HAS TWO POSITIONS AND TRAVEL.
#
# The travel is a rotation about the part's own pivot, which for a BOSS tread
# plate is the HINGE at the back rather than the plate's centre. That is a fact
# about the asset, not about this script: the exporter places the pivot and
# this turns it. A plate hinged at its middle rises at the back as it falls at
# the front, which reads as a seesaw rather than a stomp.

signal toggled(engaged)

export var travel_degrees := 3.4
export var engaged := false

var part: Spatial
var _rest := 0.0

func bind(node: Spatial) -> void:
	part = node
	_rest = node.rotation.x
	_apply()

func press() -> void:
	engaged = not engaged
	_apply()
	emit_signal("toggled", engaged)

func _apply() -> void:
	if part == null:
		return
	var offset: float = deg2rad(travel_degrees) if engaged else 0.0
	part.rotation.x = _rest + offset
