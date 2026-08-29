class_name Indicator
extends Node

# AN LED. Lit means the effect is on, and nothing else in the room may use it
# to mean anything else.
#
# It drives EMISSION rather than albedo. A lamp that changes colour but not
# brightness reads as a painted dot under any lighting the player walks into,
# and the whole point of a check light is that you can see it across a dark
# stage.

export var energy := 3.2

var _material: SpatialMaterial
var _lit := false

func bind(node: Node) -> void:
	if not (node is MeshInstance):
		return
	var mesh := node as MeshInstance
	var source := mesh.get_active_material(0)
	# Duplicated: the GLB shares one material across every instance of a part,
	# so writing to it in place lights every LED in the room at once.
	_material = source.duplicate() if source is SpatialMaterial else SpatialMaterial.new()
	mesh.material_override = _material
	set_lit(false)

func set_lit(on: bool) -> void:
	_lit = on
	if _material == null:
		return
	_material.emission_enabled = on
	_material.emission = Color(1.0, 0.18, 0.10)
	_material.emission_energy = energy if on else 0.0

func is_lit() -> bool:
	return _lit
