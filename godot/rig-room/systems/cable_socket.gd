class_name CableSocket
extends Node

# WHERE A PLUG GOES, AND WHICH WAY IT FACES.
#
# Deliberately empty of cable logic. The direction doc is explicit that the
# cable system is a later phase and that the assets should be cable-READY now,
# so this records the transform and the role and nothing else. A socket that
# knew how to draw a cable would have to be rewritten by whoever finally builds
# the cable system, which is the definition of work done too early.

enum Role { AUDIO_IN, AUDIO_OUT, POWER }

var role: int = Role.AUDIO_IN
var point: Spatial
var occupied_by: Node = null

func bind(node: Spatial, socket_role: int) -> void:
	point = node
	role = socket_role

# World transform a plug should snap to. -Z is out of the socket, which is the
# convention the GLB's own SOCKET_* empties were exported with.
func plug_transform() -> Transform:
	return point.global_transform if point != null else Transform()

func is_free() -> bool:
	return occupied_by == null
