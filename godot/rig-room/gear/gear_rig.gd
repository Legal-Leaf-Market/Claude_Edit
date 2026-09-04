class_name GearRig
extends StaticBody

# THE BRIDGE BETWEEN AN EXPORTED ASSET AND THE GAME'S SYSTEMS.
#
# This is the piece that decides whether the pipeline scales. Every gear asset
# is exported with the SAME node naming convention, and this reads it: a node
# called CONTROL_<NAME> becomes a knob, PEDAL_TREADLE becomes a footswitch,
# SOCKET_<ROLE> becomes a cable point, LED_<NAME> becomes an indicator. Nothing
# here knows the word "DS-1", so the tenth pedal and the first amplifier need a
# GLB and a .tres and no code at all.
#
# THE ALTERNATIVE IS A SCRIPT PER PRODUCT, and that is the fork the web side of
# this repository already learned not to take: one renderer for eighty-eight
# measured pedals rather than eighty-eight renderers. The same argument holds
# harder here, because a per-product script also has to be kept in step with an
# art pipeline somebody else is editing.
#
# IT VERIFIES THE ASSET RATHER THAN TRUSTING IT. Scale is checked against the
# GearDefinition's millimetres, and a mismatch is reported loudly, because an
# asset exported in centimetres looks completely fine on its own and only
# reveals itself when it is standing next to something else.

const CONTROL_PREFIX := "CONTROL_"
const SOCKET_PREFIX := "SOCKET_"
const INDICATOR_PREFIX := "LED_"
const TREADLE_NAME := "PEDAL_TREADLE"

# How far the mesh may be off the stated size before it is called a fault.
# Generous, because knobs, jack nuts and a DC socket all stand outside the
# published envelope of a pedal and are supposed to.
const SCALE_TOLERANCE := 0.25

signal control_changed(name, value)
signal switched(engaged)

var definition: GearDefinition
var model: Spatial
var interactable: Interactable

var controls := {}
var sockets := {}
var indicators := {}
var switch: ToggleControl

var _bounds := AABB()

func setup(gear: GearDefinition, scene: PackedScene) -> bool:
	definition = gear
	model = scene.instance()
	if model == null:
		push_error("gear rig: %s has no scene" % gear.id)
		return false
	add_child(model)
	name = gear.id

	_bounds = Inspectable._bounds(model)
	if not _check_scale():
		return false

	_wire(model)
	_add_collision()
	_add_interactable()
	return true

func _check_scale() -> bool:
	var stated := definition.size_metres()
	var actual := _bounds.size
	# Compared per axis against the LONGEST axis, so a 2mm jack nut does not
	# fail a 129mm pedal on a percentage of its own thickness.
	var scale := stated.length()
	if scale <= 0.0:
		push_warning("gear rig: %s states no dimensions, cannot verify the export" % definition.id)
		return true
	var drift := (actual - stated).length() / scale
	if drift > SCALE_TOLERANCE:
		push_error("gear rig: %s exported at %s mm, the definition says %s mm" % [
			definition.id, actual * 1000.0, stated * 1000.0])
		return false
	return true

func _wire(node: Node) -> void:
	var label := String(node.name)

	if label == TREADLE_NAME and node is Spatial:
		switch = ToggleControl.new()
		add_child(switch)
		switch.bind(node)
		switch.connect("toggled", self, "_on_switched")

	elif label.begins_with(CONTROL_PREFIX) and node is Spatial:
		# Only the group, never its _knob/_cap/_indicator children: those turn
		# WITH the knob because they are parented to it, and binding one
		# separately would twist the pointer off the cap it is printed on.
		var key := label.substr(CONTROL_PREFIX.length())
		if not key.find("_") == -1:
			pass
		elif not controls.has(key):
			var knob := RotatableControl.new()
			add_child(knob)
			knob.bind(node)
			knob.connect("changed", self, "_on_control_changed", [key])
			controls[key] = knob

	elif label.begins_with(SOCKET_PREFIX) and node is Spatial:
		var role_name := label.substr(SOCKET_PREFIX.length())
		var socket := CableSocket.new()
		add_child(socket)
		socket.bind(node, _role_for(role_name))
		sockets[role_name] = socket

	elif label.begins_with(INDICATOR_PREFIX):
		var lamp := Indicator.new()
		add_child(lamp)
		lamp.bind(node)
		indicators[label.substr(INDICATOR_PREFIX.length())] = lamp

	for child in node.get_children():
		_wire(child)

static func _role_for(role_name: String) -> int:
	if role_name == "OUTPUT":
		return CableSocket.Role.AUDIO_OUT
	if role_name == "DC":
		return CableSocket.Role.POWER
	return CableSocket.Role.AUDIO_IN

func _add_collision() -> void:
	# ONE BOX. The direction doc calls for simplified collision and it is right
	# for a reason worth stating: a convex hull of a bevelled casting with three
	# knobs on it is thousands of planes, and the player can feel none of them
	# through a raycast and a walk cycle.
	var shape := BoxShape.new()
	shape.extents = _bounds.size * 0.5
	var collider := CollisionShape.new()
	collider.shape = shape
	collider.translation = _bounds.position + _bounds.size * 0.5
	add_child(collider)

func _add_interactable() -> void:
	interactable = Interactable.new()
	interactable.name = "Interactable"
	interactable.prompt = "Inspect the %s" % definition.display_name()
	add_child(interactable)

func bounds() -> AABB:
	return _bounds

func _on_control_changed(value: float, key: String) -> void:
	emit_signal("control_changed", key, value)

func _on_switched(engaged: bool) -> void:
	# The lamp follows the switch. This is the one behavioural link that is
	# genuinely universal across effects gear, so it lives here rather than in
	# a per-product script.
	for lamp in indicators.values():
		lamp.set_lit(engaged)
	emit_signal("switched", engaged)
