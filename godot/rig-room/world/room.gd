extends Spatial

# THE ROOM, AND WHAT IS STANDING IN IT.
#
# Set dressing (floor, walls, board, lights) is authored in room.tscn so it can
# be edited in the editor like any scene. What this script does is the part
# that must not be hand-placed: it builds each piece of gear from its
# GearDefinition and its GLB, so adding a second pedal is two files and one
# line rather than a node somebody positioned by eye.

const PLAYER := preload("res://player/player.tscn")

# id -> where it sits on the board. Everything else about the gear comes from
# its own resource and its own mesh.
const GEAR := [
	{
		"definition": "res://gear/boss_ds1.tres",
		"scene": "res://assets/boss-ds1.glb",
		"at": Vector3(0, 0, 0),
		"facing": 0.0,
	},
]

var player: RigPlayer
var rigs := []

func _ready() -> void:
	_spawn_gear()
	_spawn_player()

func _spawn_gear() -> void:
	var board := get_node_or_null("Board")
	var deck_top := 0.0
	if board is Spatial:
		# Stand the gear ON the board rather than at the room's origin, read
		# from the board's own geometry so moving it in the editor moves the
		# pedals with it.
		deck_top = board.translation.y + Inspectable._bounds(board).size.y * 0.5

	for entry in GEAR:
		var definition = load(entry["definition"])
		var scene = load(entry["scene"])
		if definition == null or scene == null:
			push_error("room: could not load %s" % entry["definition"])
			continue
		var rig := GearRig.new()
		add_child(rig)
		if not rig.setup(definition, scene):
			rig.queue_free()
			continue
		var at: Vector3 = entry["at"]
		rig.translation = Vector3(at.x, deck_top + at.y, at.z)
		rig.rotation.y = deg2rad(entry["facing"])
		rigs.append(rig)

func _spawn_player() -> void:
	player = PLAYER.instance()
	add_child(player)
	# Standing back from the board, looking at it, which is where a person
	# walks in. Starting inside the gear is a surprisingly easy mistake and it
	# reads as the room having failed to load.
	player.translation = Vector3(0, 0, 1.15)
	player.look(0.0, deg2rad(30))
