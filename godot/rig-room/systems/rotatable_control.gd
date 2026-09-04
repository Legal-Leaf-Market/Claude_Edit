class_name RotatableControl
extends Node

# A KNOB. Its VALUE is the thing the rest of the game cares about; the rotation
# is how it says so.
#
# It turns the node it is given about that node's own Y, which is why the
# exporter has to give every knob its own pivot at the shaft rather than
# merging it into the body. A knob whose origin is the pedal's origin sweeps
# through the enclosure when you turn it.

signal changed(value)

export var min_angle := -150.0
export var max_angle := 150.0
export var value := 0.5 setget set_value

var control: Spatial

func bind(node: Spatial) -> void:
	control = node
	_apply()

func set_value(next: float) -> void:
	var clamped: float = clamp(next, 0.0, 1.0)
	if is_equal_approx(clamped, value):
		return
	value = clamped
	_apply()
	emit_signal("changed", value)

func nudge(amount: float) -> void:
	set_value(value + amount)

func _apply() -> void:
	if control == null:
		return
	var angle: float = lerp(min_angle, max_angle, value)
	control.rotation = Vector3(control.rotation.x, deg2rad(-angle), control.rotation.z)
