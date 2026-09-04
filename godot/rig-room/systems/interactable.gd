class_name Interactable
extends Spatial

# THE ONE THING THE PLAYER'S RAYCAST LOOKS FOR.
#
# Every system below composes onto this rather than extending it, because a
# guitar is grabbable and inspectable but not placeable on a board, an amp is
# inspectable but nobody picks it up, and a wall socket is none of those. A
# single Interactable base class with virtual methods for all of it is how you
# end up with an amp that has a `place_on_board()` it must never call.

signal focused
signal unfocused
signal interacted(by)

export var prompt := "Interact"
export var enabled := true

var _focused := false

func focus() -> void:
	if _focused or not enabled:
		return
	_focused = true
	emit_signal("focused")

func unfocus() -> void:
	if not _focused:
		return
	_focused = false
	emit_signal("unfocused")

func interact(by: Node) -> void:
	if not enabled:
		return
	emit_signal("interacted", by)

func is_focused() -> bool:
	return _focused
