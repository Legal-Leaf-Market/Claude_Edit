# Gear Avail rig room

A first-person 3D room you walk around, pick gear up in, and turn over in your
hands. Separate from the website in this repository on purpose: the pedalboard
**planner** stays in the DOM because it has to be indexable, keep `/go` as a
real anchor, share its TypeScript engines with the server and be reachable by a
screen reader, and a canvas keeps none of those. This is the other thing, the
one CLAUDE.md section 16 has always reserved an engine for.

## Run it

    xvfb-run -a godot3 --editor --quit --path godot/rig-room   # once, to import
    godot3 --path godot/rig-room

WASD to walk, mouse to look, **E** to pick up what you are aiming at. While
holding something: drag to turn it, wheel to zoom, **R** to reset the rotation,
**E** or **Esc** to put it back.

## Verify it

    xvfb-run -a godot3 --path godot/rig-room tools/verify.tscn

Walks the player to the board, aims, picks the pedal up, turns it over, zooms,
works a knob, stomps the switch, checks the lamp followed, drops it, and checks
it landed back exactly where it started. Nine steps, each asserted and each
photographed to `user://`. It exists because on this project things that
compile and look plausible have repeatedly not worked, and because an assertion
catches a wrong state while only a picture catches a wrong render.

It has already earned itself: turning the pedal over is what found the
underside of the GLB z-fighting, which nine fixed validation angles in three.js
never looked at.

## Engine version

**Godot 3.5**, and that is a constraint rather than a recommendation. Godot 4 is
the right target; no Godot 4 binary was obtainable in the environment this was
built in, and shipping GDScript for an engine that cannot be launched is how
this project has burned rounds before. Everything here runs and is verified.
The port is mechanical:

| 3.5 | 4.x |
|---|---|
| `Spatial` | `Node3D` |
| `Camera` | `Camera3D` |
| `KinematicBody` + `move_and_slide(v, UP)` | `CharacterBody3D` + `velocity` |
| `RayCast` | `RayCast3D` |
| `.instance()` | `.instantiate()` |
| `export var x := 1` | `@export var x := 1` |
| `Transform` | `Transform3D` |

## Layout

    assets/      GLBs, built by scripts/gear-3d/ in the repository root
    gear/        GearDefinition (a Resource) and GearRig (the bridge)
    systems/     Interactable, Inspectable, RotatableControl, ToggleControl,
                 Indicator, CableSocket. Nothing here knows the word "pedal"
    player/      first-person controller and the reach raycast
    world/       the room
    tools/       the verification harness

## Adding gear

Two files and one line. Export the GLB with the naming convention below, write
a `.tres` beside it, and add it to `GEAR` in `world/room.gd`. There is no
per-product script and there must not be one: eighty-eight of those is the same
fork the website already refused for its pedal renderer.

`gear/gear_rig.gd` reads these node names off the asset:

| Node | Becomes |
|---|---|
| `CONTROL_<NAME>` | a knob that turns, exposed as `rig.controls["<NAME>"]` |
| `PEDAL_TREADLE` | a footswitch with travel about its own pivot |
| `LED_<NAME>` | an emissive indicator, lit by the switch |
| `SOCKET_INPUT` / `SOCKET_OUTPUT` / `SOCKET_DC` | cable points, with a facing |

Two things the exporter has to get right, because no code here can fix them:
each knob needs its **own pivot at its shaft** or it sweeps through the body
when it turns, and the tread plate's pivot has to be the **hinge** rather than
the plate's centre or a stomp reads as a seesaw.

The rig also checks the mesh against the millimetres in the `.tres` and refuses
to build on a mismatch. An asset exported at the wrong scale looks completely
fine on its own and only gives itself away standing next to something else.

## What is not here yet

Cables, signal routing, placing gear onto a board, and PBR texture maps. The
DS-1 is correct geometry with flat materials: it is painted-orange-and-black
rather than painted metal with wear on the edges, and that gap is the art
pipeline's, not this project's.
