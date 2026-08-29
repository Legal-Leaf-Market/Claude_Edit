class_name RigPlayer
extends KinematicBody

# THE PERSON IN THE ROOM.
#
# Walking, looking, and the raycast that decides what is under the crosshair.
# Inspection itself is NOT here: it is a component (systems/inspectable.gd) that
# this drives, because the day a workbench or a camera tripod wants to inspect
# something the player is not holding, the mode must not be welded to the legs.
#
# EVERY INPUT PATH ENDS IN A PUBLIC METHOD, and that is deliberate rather than
# tidy. The verification harness in tools/ drives walk(), look(), interact()
# and turn() directly, so the systems can be exercised headlessly without
# synthesising fake mouse events. Keys and buttons are one thin layer on top,
# and that layer is the only part a controller or a VR rig would replace.

export var walk_speed := 2.6
export var mouse_sensitivity := 0.0022
# REACH IS FROM THE EYE, NOT FROM THE HAND, and a pedalboard is on the floor.
# At 1.6m a standing player could not reach a pedal they were directly over:
# the eye is 1.62m up, so anything on the deck is already 1.7m away down the
# diagonal before they have stepped back far enough to see it. The first run of
# the harness failed every interaction step on exactly this.
export var reach := 2.4
export var eye_height := 1.62

var head: Spatial
var camera: Camera
var anchor: Spatial
var ray: RayCast
var inspector: Inspectable

var focused: Interactable = null

func _ready() -> void:
	head = Spatial.new()
	head.name = "Head"
	head.translation = Vector3(0, eye_height, 0)
	add_child(head)

	camera = Camera.new()
	camera.name = "Camera"
	camera.fov = 68.0
	camera.near = 0.02
	camera.far = 60.0
	head.add_child(camera)
	camera.current = true

	# Where an inspected object is held. A child of the camera so it follows
	# the look, but a separate node so the held distance can be changed without
	# touching the camera's own transform.
	anchor = Spatial.new()
	anchor.name = "InspectionAnchor"
	camera.add_child(anchor)

	ray = RayCast.new()
	ray.name = "Reach"
	ray.cast_to = Vector3(0, 0, -reach)
	ray.enabled = true
	camera.add_child(ray)
	# Never hit yourself. The eye sits above the capsule today, so this changes
	# nothing today; it changes everything the first time somebody crouches.
	ray.add_exception(self)

	inspector = Inspectable.new()
	inspector.name = "Inspector"
	add_child(inspector)

	_bind_keys()
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

static func _bind_keys() -> void:
	# Built in code rather than stored in project.godot. The serialised input
	# map is a wall of InputEventKey object literals that nobody can read in a
	# diff, and the mapping is the part the direction doc says will change.
	var keys := {
		"walk_forward": KEY_W, "walk_back": KEY_S,
		"walk_left": KEY_A, "walk_right": KEY_D,
		"interact": KEY_E, "cancel": KEY_ESCAPE, "reset_view": KEY_R,
	}
	for action in keys:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action)
		var event := InputEventKey.new()
		event.scancode = keys[action]
		InputMap.action_add_event(action, event)

# --- the public surface the harness and the input layer both use -------------

func look(delta_yaw: float, delta_pitch: float) -> void:
	rotate_y(-delta_yaw)
	head.rotation.x = clamp(head.rotation.x - delta_pitch, deg2rad(-89), deg2rad(89))

# Point the head at a place in the world. The mouse path does not use this,
# but crouching, scripted camera moves and the verification harness all do, and
# writing it once means none of them do the trigonometry themselves.
func look_at_point(target: Vector3) -> void:
	var eye := head.global_transform.origin
	var to_target := target - eye
	if to_target.length() < 0.001:
		return
	rotation.y = atan2(-to_target.x, -to_target.z)
	var flat := Vector2(to_target.x, to_target.z).length()
	head.rotation.x = clamp(atan2(to_target.y, flat), deg2rad(-89), deg2rad(89))
	ray.force_raycast_update()

func walk(direction: Vector3, delta: float) -> void:
	if inspector.active or direction == Vector3.ZERO:
		return
	var world := (global_transform.basis.xform(direction)).normalized()
	world.y = 0.0
	# move_and_slide wants a velocity; delta is applied by the physics step, so
	# it is passed a speed rather than a distance.
	move_and_slide(world * walk_speed, Vector3.UP)

func aim_at() -> Interactable:
	if not ray.is_colliding():
		return null
	var hit := ray.get_collider()
	if hit == null:
		return null
	return _interactable_of(hit)

func interact() -> void:
	if inspector.active:
		inspector.end()
		return
	var target := aim_at()
	if target == null:
		return
	target.interact(self)
	var rig := target.get_parent()
	if rig is GearRig:
		inspector.begin(rig.model, anchor)

func turn_held(delta_x: float, delta_y: float) -> void:
	inspector.turn(delta_x, delta_y)

func zoom_held(steps: float) -> void:
	inspector.zoom(steps)

# --- engine plumbing ---------------------------------------------------------

func _physics_process(delta: float) -> void:
	var direction := Vector3.ZERO
	if Input.is_action_pressed("walk_forward"):
		direction.z -= 1.0
	if Input.is_action_pressed("walk_back"):
		direction.z += 1.0
	if Input.is_action_pressed("walk_left"):
		direction.x -= 1.0
	if Input.is_action_pressed("walk_right"):
		direction.x += 1.0
	walk(direction, delta)
	_refocus()
	inspector.update(delta)

func _refocus() -> void:
	var target := null if inspector.active else aim_at()
	if target == focused:
		return
	if focused != null:
		focused.unfocus()
	focused = target
	if focused != null:
		focused.focus()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		if inspector.active:
			turn_held(event.relative.x, event.relative.y)
		else:
			look(event.relative.x * mouse_sensitivity, event.relative.y * mouse_sensitivity)
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == BUTTON_WHEEL_UP:
			zoom_held(1.0)
		elif event.button_index == BUTTON_WHEEL_DOWN:
			zoom_held(-1.0)
	elif event.is_action_pressed("interact"):
		interact()
	elif event.is_action_pressed("reset_view") and inspector.active:
		inspector.reset_rotation()
	elif event.is_action_pressed("cancel"):
		if inspector.active:
			inspector.end()
		else:
			Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

static func _interactable_of(node: Node) -> Interactable:
	for child in node.get_children():
		if child is Interactable:
			return child
	return null
