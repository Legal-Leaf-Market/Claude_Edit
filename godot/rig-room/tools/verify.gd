extends Node

# DRIVE THE WHOLE LOOP AND PHOTOGRAPH IT.
#
#   xvfb-run -a godot3 --path godot/rig-room tools/verify.tscn
#
# The Godot half of what scripts/gear-3d/validate-glb.mjs does for the asset,
# and it exists for the same reason: on this project, things that compile and
# look plausible have repeatedly not worked. A pedal shipped as a rectangle, a
# pick-up button was not clickable at all, a tread plate was half size for
# months. None of them threw.
#
# So this walks the player up to the board, aims at the pedal, picks it up,
# turns it over, zooms, works a knob, stomps the switch, checks the lamp
# followed, drops it and checks it landed back exactly where it started. Every
# step asserts, and every step is photographed, because the assertions catch
# what is wrong with the state and only a picture catches what is wrong with
# the render.

const ROOM := preload("res://world/room.tscn")
const SHOT_DIR := "user://"

var room: Spatial
var player: RigPlayer
var rig: GearRig
var step := 0
var settle := 0
var failures := []
var resting := Transform()

# Each step gets a name, an action, and a check that runs after it has drawn.
var script_steps := []

# A HARNESS THAT CAN HANG IS NOT A HARNESS. If a step's action never lands the
# state its check wants, the loop simply never advances and the run sits there
# until something outside kills it, reporting nothing. This is the difference
# between "step 3 failed" and a timeout with an empty log.
const DEADLINE_SECONDS := 90.0
var _elapsed := 0.0

func _ready() -> void:
	room = ROOM.instance()
	add_child(room)
	player = room.player
	if room.rigs.empty():
		_fail("no gear was built into the room")
		_finish()
		return
	rig = room.rigs[0]
	resting = rig.model.global_transform
	_build_steps()

func _build_steps() -> void:
	script_steps = [
		{"id": "00-walk-in", "do": "_walk_in", "check": "_check_sees_gear"},
		{"id": "01-focused", "do": "_noop", "check": "_check_focus"},
		{"id": "02-picked-up", "do": "_pick_up", "check": "_check_inspecting"},
		{"id": "03-turned-side", "do": "_turn_side", "check": "_check_moved"},
		{"id": "04-turned-over", "do": "_turn_over", "check": "_check_moved"},
		{"id": "05-zoomed-in", "do": "_zoom_in", "check": "_check_closer"},
		{"id": "06-knob-turned", "do": "_turn_knob", "check": "_check_knob"},
		{"id": "07-stomped", "do": "_stomp", "check": "_check_lamp"},
		{"id": "08-dropped", "do": "_drop", "check": "_check_returned"},
	]

func _process(delta: float) -> void:
	if step >= script_steps.size():
		return
	_elapsed += delta
	if _elapsed > DEADLINE_SECONDS:
		_fail("timed out at step %d (%s)" % [step, script_steps[step]["id"]])
		_finish()
		return
	var current: Dictionary = script_steps[step]

	if settle == 0:
		call(current["do"])
	settle += 1
	# Three frames: the action, the physics step that follows it, and a drawn
	# frame to photograph. Shooting on the action frame gives a picture of the
	# state BEFORE it, which is the most misleading possible output.
	if settle < 4:
		return

	var image := get_viewport().get_texture().get_data()
	image.flip_y()
	image.save_png("%srig-%s.png" % [SHOT_DIR, current["id"]])

	var problem: String = call(current["check"])
	if problem == "":
		print("  ok   %s" % current["id"])
	else:
		_fail("%s: %s" % [current["id"], problem])

	settle = 0
	step += 1
	if step >= script_steps.size():
		_finish()

# --- actions -----------------------------------------------------------------

func _noop() -> void:
	pass

func _walk_in() -> void:
	# Stand where somebody looking down at a board stands, then aim at the
	# pedal's actual centre rather than at a hand-typed angle: a hardcoded
	# pitch is a test that passes because of where the furniture happens to be.
	player.translation = Vector3(0, 0, 0.78)
	var box := rig.bounds()
	player.look_at_point(rig.global_transform.origin + Vector3(0, box.size.y * 0.5, 0))

func _pick_up() -> void:
	player.interact()

func _turn_side() -> void:
	player.turn_held(150.0, 0.0)

func _turn_over() -> void:
	player.turn_held(60.0, 190.0)

func _zoom_in() -> void:
	player.zoom_held(6.0)

func _turn_knob() -> void:
	if rig.controls.has("DIST"):
		rig.controls["DIST"].set_value(0.92)

func _stomp() -> void:
	if rig.switch != null:
		rig.switch.press()

func _drop() -> void:
	player.interact()

# --- checks ------------------------------------------------------------------

var _before_turn := Transform()
var _before_zoom := 0.0

func _check_sees_gear() -> String:
	player.ray.force_raycast_update()
	return "" if player.ray.is_colliding() else "the reach raycast hit nothing at the board"

func _check_focus() -> String:
	if player.focused == null:
		return "nothing became focused while aiming at the pedal"
	_before_turn = rig.model.global_transform
	return ""

func _check_inspecting() -> String:
	if not player.inspector.active:
		return "interact did not enter inspection"
	if player.inspector.held() != rig.model:
		return "inspection picked up something other than the pedal"
	_before_turn = rig.model.global_transform
	_before_zoom = rig.model.global_transform.origin.distance_to(player.camera.global_transform.origin)
	return ""

func _check_moved() -> String:
	var now := rig.model.global_transform
	# A rotation that changes nothing is the failure this catches, and it is
	# the exact failure a euler-angle implementation gives you at the poles.
	if now.basis.is_equal_approx(_before_turn.basis):
		return "the model did not rotate"
	_before_turn = now
	_before_zoom = now.origin.distance_to(player.camera.global_transform.origin)
	return ""

func _check_closer() -> String:
	var now := rig.model.global_transform.origin.distance_to(player.camera.global_transform.origin)
	return "" if now < _before_zoom - 0.001 else "zoom did not bring it closer (%f -> %f)" % [_before_zoom, now]

func _check_knob() -> String:
	if not rig.controls.has("DIST"):
		return "no DIST control was wired from the asset (found: %s)" % [rig.controls.keys()]
	var knob: RotatableControl = rig.controls["DIST"]
	if abs(knob.control.rotation.y) < 0.01:
		return "the DIST knob did not turn"
	return ""

func _check_lamp() -> String:
	if rig.switch == null:
		return "no PEDAL_TREADLE was wired from the asset"
	if not rig.switch.engaged:
		return "the switch did not engage"
	if rig.indicators.empty():
		return "no LED_* was wired from the asset"
	for lamp in rig.indicators.values():
		if not lamp.is_lit():
			return "the switch engaged but the lamp stayed dark"
	return ""

func _check_returned() -> String:
	if player.inspector.active:
		return "interact did not leave inspection"
	var now := rig.model.global_transform
	if now.origin.distance_to(resting.origin) > 0.0005:
		return "the pedal did not land back where it started (off by %f mm)" % [
			now.origin.distance_to(resting.origin) * 1000.0]
	if not now.basis.is_equal_approx(resting.basis):
		return "the pedal came back rotated"
	return ""

# --- reporting ---------------------------------------------------------------

func _fail(reason: String) -> void:
	failures.append(reason)
	printerr("  FAIL %s" % reason)

func _finish() -> void:
	print("")
	if failures.empty():
		print("rig room: all %d steps passed" % script_steps.size())
		get_tree().quit(0)
	else:
		print("rig room: %d failure(s)" % failures.size())
		get_tree().quit(1)
