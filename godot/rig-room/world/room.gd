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
	# One line per pedal, in signal order across two rows, the way somebody
	# actually lays a board out: gain at the toe, time and space behind it.
	# The GLB and the .tres are both written by the exporter, so adding a
	# thirteenth is a slug in its ROOM list, a re-run, and a line here.
	{"id": "dunlop--cry-baby",                    "at": Vector3(-0.30, 0, 0.10)},
	{"id": "ibanez--ts9-tube-screamer",           "at": Vector3(-0.11, 0, 0.10)},
	{"id": "boss--ds-1-distortion",               "at": Vector3(-0.02, 0, 0.10)},
	{"id": "proco--rat-2",                        "at": Vector3(0.07, 0, 0.10)},
	{"id": "electro-harmonix--big-muff-pi",       "at": Vector3(0.19, 0, 0.10)},
	{"id": "dunlop--fuzz-face",                   "at": Vector3(0.32, 0, 0.10)},
	{"id": "boss--bd-2-blues-driver",             "at": Vector3(-0.30, 0, -0.09)},
	{"id": "mxr--phase-90",                       "at": Vector3(-0.21, 0, -0.09)},
	{"id": "boss--ge-7-equalizer",                "at": Vector3(-0.12, 0, -0.09)},
	{"id": "electro-harmonix--deluxe-memory-man", "at": Vector3(0.01, 0, -0.09)},
	{"id": "tc-electronic--hall-of-fame-2",       "at": Vector3(0.14, 0, -0.09)},
	{"id": "line-6--dl4-delay-modeler",           "at": Vector3(0.32, 0, -0.09)},
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
		# CONVENTION RATHER THAN TWO PATHS PER ENTRY. The exporter writes
		# gear/<id>.tres beside assets/<id>.glb, always, so an entry that names
		# one and not the other cannot exist. A missing pair is reported and
		# skipped rather than crashing the room: one bad asset must not cost
		# you the other eleven.
		var definition = load("res://gear/%s.tres" % entry["id"])
		var scene = load("res://assets/%s.glb" % entry["id"])
		if definition == null or scene == null:
			push_warning("room: no asset pair for %s, skipping it" % entry["id"])
			continue
		var rig := GearRig.new()
		add_child(rig)
		if not rig.setup(definition, scene):
			rig.queue_free()
			continue
		var at: Vector3 = entry["at"]
		rig.translation = Vector3(at.x, deck_top + at.y, at.z)
		if entry.has("facing"):
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
