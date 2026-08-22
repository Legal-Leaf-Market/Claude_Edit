"use client"

import { Suspense, useMemo, useRef } from "react"
import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber"
import { OrbitControls, RoundedBox, ContactShadows } from "@react-three/drei"
import * as THREE from "three"
import type { ModelKnob, PedalModel } from "@/lib/board/pedal-models"

/**
 * A PEDAL YOU CAN ACTUALLY PICK UP.
 *
 * Real 3D: a scene, a camera you orbit, lights, and materials that respond to
 * them. The CSS version this replaces was six divs in `preserve-3d`, which is
 * a genuine solid and still looks like a diagram, because painted gradients
 * cannot do a specular highlight travelling across a curved knob as you turn
 * the object. That difference is the whole point of the exercise.
 *
 * WHY THIS IS NOT A GAME ENGINE. The canvas has to sit inside a dialog on a
 * page whose DOM board, `/go` links and screen-reader path all survive
 * untouched, and section 16 protects exactly those four things. three.js is
 * about 150KB and mounts inside the existing React tree; Godot would ship tens
 * of megabytes of WASM and its own export pipeline to do the same job. Godot
 * stays reserved for the separate rig room that section already sanctions,
 * where physics and sound would actually earn it.
 *
 * WHY IT IS ONLY EVER IN THE DIALOG. Nothing on the board or the guide renders
 * a canvas: the row of pedals stays real DOM buttons, so the page is still
 * indexable, still tabbable, still read aloud, and the outbound link that pays
 * for the site is still an anchor. You opt into WebGL by picking a pedal up.
 *
 * THE MODELS ARE MEASURED, NOT EYEBALLED. Everything below is driven from
 * `lib/board/pedal-models.ts`, in millimetres off the real pedal. The Boss
 * compact is the reason the `boss-compact` branch exists at all: it is a
 * stepped casting with the knobs on a raised rear shelf and a hinged plate
 * over the front, and no amount of shading makes a plain box read as one.
 */

/** Millimetres to scene units. One number, so the specs stay in real units. */
const MM = 0.01

/**
 * How much of a face the printed decal covers.
 *
 * Short of the edges, because the shell's corners are rounded and a square
 * plane at full size pokes its corners out past the radius as four bright
 * tabs. Used BOTH to size the plane and to map millimetres onto the texture,
 * so the two can never disagree.
 */
const DECAL_W = 0.88
const DECAL_D = 0.9

/* --------------------------------------------------------------------- */
/*  Materials                                                             */
/* --------------------------------------------------------------------- */

/**
 * A painted die-cast body.
 *
 * Enclosures are powder-coated or anodised aluminium: not glossy plastic and
 * not bare metal. A little metalness with real roughness is what gives the
 * broad soft highlight down the side that says "painted metal" rather than
 * "toy".
 */
function bodyMaterial(color: string) {
  return { color, roughness: 0.42, metalness: 0.28, clearcoat: 0.25 }
}

/* --------------------------------------------------------------------- */
/*  The silkscreen, drawn to a texture                                    */
/* --------------------------------------------------------------------- */

/**
 * The printing on the top face, as a canvas texture.
 *
 * DRAWN RATHER THAN TYPESET IN THE SCENE, for two reasons. A 3D text helper
 * needs a font file, and every one of them fetches from a CDN, which this
 * site's CSP forbids and which would put a network round trip in front of a
 * pedal rendering. And silkscreen IS a flat print on a surface, so a texture
 * is the honest representation rather than a shortcut.
 *
 * The type is the SITE'S own, not a reproduction of anybody's logo. Naming the
 * product is what a parts list does; redrawing a brand's mark is a different
 * act and is not needed to say which pedal this is.
 */
function useSilkscreen(model: PedalModel, face: { zMin: number; zMax: number; width: number }) {
  return useMemo(() => {
    /* Square, and big enough that 4mm type is still crisp when the camera is
       close. The face is mapped to whatever aspect it really has. */
    const px = 1024
    const canvas = document.createElement("canvas")
    canvas.width = px
    canvas.height = px
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.fillStyle = model.color
    ctx.fillRect(0, 0, px, px)
    ctx.fillStyle = model.ink
    ctx.textAlign = "center"

    /*
     * Millimetres to texture pixels, mapped over THE FACE THIS TEXTURE IS
     * PAINTED ON rather than over the whole pedal.
     *
     * Getting that wrong is what the first pass did: it mapped across the
     * DS-1's full 129mm and then painted the result onto a 52mm rear shelf,
     * so every legend arrived squashed into a third of its intended width and
     * anything printed forward of the hinge vanished off the edge entirely.
     * A texture has to know which surface it is for.
     */
    const faceDepth = face.zMax - face.zMin
    const zPx = (mm: number) => ((mm - face.zMin) / faceDepth) * px
    const xPx = (mm: number) => ((mm + face.width / 2) / face.width) * px
    /* Type is sized against the face too, so 5mm of print is 5mm of print. */
    const pt = (mm: number) => mm * (px / faceDepth)

    for (const legend of model.legends) {
      ctx.font = `700 ${pt(legend.size)}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(legend.text.toUpperCase(), px / 2, zPx(legend.z))
    }

    /* Knob labels, printed just below each shaft the way they really are. */
    ctx.font = `600 ${pt(3.4)}px ui-sans-serif, system-ui, sans-serif`
    for (const knob of model.knobs) {
      if (!knob.label) continue
      ctx.fillText(knob.label.toUpperCase(), xPx(knob.x), zPx(knob.z + knob.radius + 6))
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [model, face.zMin, face.zMax, face.width])
}

/* --------------------------------------------------------------------- */
/*  Parts                                                                 */
/* --------------------------------------------------------------------- */

/**
 * A control knob.
 *
 * Four real shapes, because the shape is how you tell what a control does
 * before you touch it. A skirted knob has a wide flanged base with the pointer
 * printed on the skirt; a chicken head is a pointed wedge you read at a
 * glance; a dome is a plain cap. Drawing all three as cylinders is what made
 * the CSS version look like a diagram.
 */
function Knob({ knob }: { knob: ModelKnob }) {
  const r = knob.radius * MM
  const h = knob.height * MM
  const plastic = { color: knob.color ?? "#141414", roughness: 0.35, metalness: 0.05 }

  return (
    <group
      position={[knob.x * MM, 0, knob.z * MM]}
      rotation={[0, THREE.MathUtils.degToRad(-knob.angle), 0]}
    >
      {knob.style === "chicken-head" ? (
        <>
          {/*
            SQUAT AND POINTED, which is what a chicken head actually is. The
            first pass made it a tall cylinder with a slab bolted to the side
            and it read as a knob hovering over the pedal rather than a
            pointer sitting on it. The real part is barely taller than it is
            wide, and the beak is a flattened cone.
          */}
          <mesh castShadow position={[0, h * 0.3, 0]}>
            <cylinderGeometry args={[r * 0.58, r * 0.72, h * 0.6, 28]} />
            <meshStandardMaterial {...plastic} />
          </mesh>
          <mesh
            castShadow
            position={[0, h * 0.3, -r * 0.85]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <coneGeometry args={[r * 0.36, r * 1.15, 4]} />
            <meshStandardMaterial {...plastic} />
          </mesh>
          <mesh position={[0, h * 0.61, 0]}>
            <cylinderGeometry args={[r * 0.58, r * 0.58, h * 0.05, 28]} />
            <meshStandardMaterial {...plastic} roughness={0.25} />
          </mesh>
        </>
      ) : (
        <>
          {/* The skirt: the flange a pointer is printed on. */}
          {knob.style === "skirted" && (
            <mesh castShadow position={[0, h * 0.12, 0]}>
              <cylinderGeometry args={[r, r * 1.04, h * 0.24, 32]} />
              <meshStandardMaterial {...plastic} />
            </mesh>
          )}
          {/* The body, slightly tapered the way a moulded knob is. */}
          <mesh castShadow position={[0, h * 0.55, 0]}>
            <cylinderGeometry args={[r * 0.74, r * 0.86, h * 0.9, 32]} />
            <meshStandardMaterial {...plastic} roughness={0.32} />
          </mesh>
          {/* Knurling: shallow flutes you grip. */}
          {Array.from({ length: 20 }, (_, i) => (
            <mesh
              key={i}
              position={[
                Math.cos((i / 20) * Math.PI * 2) * r * 0.8,
                h * 0.55,
                Math.sin((i / 20) * Math.PI * 2) * r * 0.8,
              ]}
              rotation={[0, -(i / 20) * Math.PI * 2, 0]}
            >
              <boxGeometry args={[r * 0.09, h * 0.86, r * 0.09]} />
              <meshStandardMaterial {...plastic} roughness={0.5} />
            </mesh>
          ))}
          {/* The cap, and the pointer line cut into it. */}
          <mesh castShadow position={[0, h * 1.0, 0]}>
            <cylinderGeometry args={[r * 0.74, r * 0.74, h * 0.08, 32]} />
            <meshStandardMaterial {...plastic} roughness={0.25} />
          </mesh>
          <mesh position={[0, h * 1.045, -r * 0.36]}>
            <boxGeometry args={[r * 0.12, h * 0.02, r * 0.7]} />
            <meshStandardMaterial color="#f2f2f2" roughness={0.4} />
          </mesh>
        </>
      )}
    </group>
  )
}

/** The footswitch: a threaded collar with a stomped metal cap on top. */
function Footswitch({ x, z, radius }: { x: number; z: number; radius: number }) {
  const r = radius * MM
  return (
    <group position={[x * MM, 0, z * MM]}>
      <mesh castShadow position={[0, r * 0.18, 0]}>
        <cylinderGeometry args={[r * 0.82, r * 0.92, r * 0.36, 28]} />
        <meshStandardMaterial color="#8b8f96" roughness={0.42} metalness={0.85} />
      </mesh>
      <mesh castShadow position={[0, r * 0.52, 0]}>
        <cylinderGeometry args={[r * 0.68, r * 0.74, r * 0.42, 28]} />
        <meshStandardMaterial color="#c3c8cf" roughness={0.28} metalness={0.92} />
      </mesh>
    </group>
  )
}

/** The indicator. Emissive, so it actually throws light on the body. */
function Led({ x, z, color, on }: { x: number; z: number; color: string; on: boolean }) {
  return (
    <group position={[x * MM, 0, z * MM]}>
      <mesh position={[0, 0.008, 0]}>
        <sphereGeometry args={[0.018, 20, 16]} />
        <meshStandardMaterial
          color={on ? color : "#3a3a3a"}
          emissive={on ? color : "#000000"}
          emissiveIntensity={on ? 0.9 : 0}
          roughness={0.2}
        />
      </mesh>
      {/* Enough to catch the casting right around the bezel and no more. A
          real 3mm LED does not light the pedal, it just is lit. */}
      {/* No point light at all. Two passes of turning it down still washed the
          print out around the bezel; a real indicator is a bright dot, and the
          casting around it stays the colour it was painted. */}
    </group>
  )
}

/* --------------------------------------------------------------------- */
/*  Bodies                                                                */
/* --------------------------------------------------------------------- */

/**
 * The plain folded/cast box: a 1590B and everything shaped like one.
 *
 * Rounded, because a real enclosure has a generous radius on every vertical
 * edge and a chamfer on the top. A hard-edged box is the single strongest
 * "this is CG" signal there is.
 */
function BoxBody({ model }: { model: PedalModel }) {
  const w = model.width * MM
  const d = model.depth * MM
  const h = model.height * MM
  /*
   * The printed region, which is the DECAL PLANE's extent and not the face's.
   *
   * These have to agree or the mapping lies: the plane is inset to stay inside
   * the rounded corners, so a texture mapped across the full face would land
   * every legend about 10% closer to the middle than the millimetres say, and
   * the knob labels would drift out from under their knobs. Same numbers in
   * both places, derived from one pair of constants.
   */
  const texture = useSilkscreen(model, {
    zMin: (-model.depth / 2) * DECAL_D,
    zMax: (model.depth / 2) * DECAL_D,
    width: model.width * DECAL_W,
  })

  return (
    <>
      <RoundedBox args={[w, h, d]} radius={Math.min(w, d) * 0.06} smoothness={5} castShadow receiveShadow>
        <meshPhysicalMaterial {...bodyMaterial(model.color)} />
      </RoundedBox>
      {/*
        The printed face, floated a hair above the shell so it cannot z-fight.

        Inset well inside the shell, because the shell's corners are ROUNDED
        and this plane is not: at 97% its square corners poked out past the
        radius as four bright tabs, which is a tell you cannot unsee once you
        have noticed it. Silkscreen stops short of the edge on a real pedal
        anyway.
      */}
      {texture && (
        <mesh position={[0, h / 2 + 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w * DECAL_W, d * DECAL_D]} />
          <meshStandardMaterial map={texture} roughness={0.5} metalness={0.15} />
        </mesh>
      )}
    </>
  )
}

/**
 * The Boss compact, and this branch exists because the shape is the pedal.
 *
 * Three parts: a shallow chassis, a raised REAR SHELF carrying the knobs, and
 * a TREAD PLATE hinged at the back of that shelf which slopes down over the
 * front two thirds. The thumbscrew at the toe is what holds the plate shut;
 * undo it and the plate lifts for the battery, which is why the hinge is at
 * the back and not, as on a wah, in the middle.
 */
function BossCompactBody({ model }: { model: PedalModel }) {
  const w = model.width * MM
  const d = model.depth * MM
  const h = model.height * MM
  const plate = model.treadPlate!
  const plateDepth = plate.depth * MM
  const hingeZ = plate.hingeZ * MM

  /*
   * The chassis carries most of the height and the shelf is a modest step up.
   * The first pass split it 52/48 and the shelf towered over the plate like a
   * wall; on the real pedal the tread plate sits only a little below the knob
   * shelf, which is what lets your foot roll onto it.
   */
  const chassisH = h * 0.66
  const shelfH = h - chassisH
  const shelfDepth = d / 2 + hingeZ

  /* ONLY the rear shelf is printed, and only the inset part of it. */
  const shelfBack = -model.depth / 2
  const shelfFront = plate.hingeZ
  const shelfMid = (shelfBack + shelfFront) / 2
  const shelfHalf = ((shelfFront - shelfBack) / 2) * DECAL_D
  const texture = useSilkscreen(model, {
    zMin: shelfMid - shelfHalf,
    zMax: shelfMid + shelfHalf,
    width: model.width * DECAL_W,
  })

  return (
    <>
      {/* Chassis. */}
      <RoundedBox
        args={[w, chassisH, d]}
        radius={w * 0.05}
        smoothness={5}
        position={[0, -h / 2 + chassisH / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial {...bodyMaterial(model.color)} />
      </RoundedBox>

      {/* The rear shelf the knobs are mounted through. */}
      <RoundedBox
        args={[w, shelfH, shelfDepth]}
        radius={w * 0.045}
        smoothness={5}
        position={[0, -h / 2 + chassisH + shelfH / 2 - 0.002, -d / 2 + shelfDepth / 2]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial {...bodyMaterial(model.color)} />
      </RoundedBox>

      {/* The shelf's printed face. */}
      {texture && (
        <mesh
          position={[0, -h / 2 + chassisH + shelfH + 0.0008, -d / 2 + shelfDepth / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[w * DECAL_W, shelfDepth * DECAL_D]} />
          <meshStandardMaterial map={texture} roughness={0.5} metalness={0.15} />
        </mesh>
      )}

      {/* The tread plate, hinged at the shelf and sloping to the toe. */}
      <group position={[0, -h / 2 + chassisH, -d / 2 + shelfDepth]} rotation={[0.075, 0, 0]}>
        <RoundedBox
          args={[w * 0.95, h * 0.06, plateDepth]}
          radius={w * 0.02}
          smoothness={4}
          position={[0, h * 0.05, plateDepth / 2]}
          castShadow
        >
          <meshPhysicalMaterial
            {...bodyMaterial(model.color)}
            roughness={0.36}
            metalness={0.34}
          />
        </RoundedBox>
        {plate.thumbscrew && (
          <mesh castShadow position={[0, h * 0.09, plateDepth - 0.055]}>
            <cylinderGeometry args={[0.035, 0.035, 0.018, 20]} />
            <meshStandardMaterial color="#b9bec7" roughness={0.3} metalness={0.9} />
          </mesh>
        )}
      </group>
    </>
  )
}

/* --------------------------------------------------------------------- */
/*  The pedal, and the scene around it                                    */
/* --------------------------------------------------------------------- */

function Pedal({ model, engaged }: { model: PedalModel; engaged: boolean }) {
  const group = useRef<THREE.Group>(null)
  const h = model.height * MM

  /* A hair of drift so it never looks frozen, far too slow to read as a spin.
     Section 16's "nothing spins at idle" is about attention-seeking motion;
     this is below the threshold of noticing and stops on any interaction. */
  useFrame((state) => {
    if (!group.current) return
    group.current.rotation.y += Math.sin(state.clock.elapsedTime * 0.2) * 0.00012
  })

  /* Knobs sit on the highest surface either way: the rear shelf on a Boss
     compact reaches the same height as a plain box's top face, which is what
     `height` measures on both. */
  const controlY = h / 2

  return (
    <group ref={group}>
      {model.style === "boss-compact" ? (
        <BossCompactBody model={model} />
      ) : (
        <BoxBody model={model} />
      )}

      <group position={[0, controlY, 0]}>
        {model.knobs.map((knob, i) => (
          <Knob key={i} knob={knob} />
        ))}
        {model.led && (
          <Led x={model.led.x} z={model.led.z} color={model.led.color} on={engaged} />
        )}
      </group>

      {/*
        NO ROUND FOOTSWITCH ON A BOSS COMPACT, and getting this wrong is the
        kind of detail that gives a model away instantly. There is no button
        to press on a DS-1: the whole hinged tread plate IS the switch, and
        you stomp the plate. A chrome dome sitting on top of it would be a
        pedal nobody has ever seen. The same is true of the Ibanez housing,
        which borrowed the mechanism.
      */}
      {model.footswitch && model.style !== "boss-compact" && (
        <group position={[0, h / 2, 0]}>
          <Footswitch {...model.footswitch} />
        </group>
      )}
    </group>
  )
}

export function PedalViewer3D({
  model,
  engaged,
}: {
  model: PedalModel
  engaged: boolean
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [1.35, 1.15, 1.85], fov: 32 }}
      /* The scene's own ground, so the canvas is not a transparent hole in the
         panel and the shadow has something to fall on. */
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        {/* Three-point-ish: a key with shadow, a cool fill, and a rim to pick
            out the top edge of the casting against a dark panel. */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[2.2, 3.4, 1.8]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={0.1}
          shadow-camera-far={12}
          shadow-camera-left={-1.5}
          shadow-camera-right={1.5}
          shadow-camera-top={1.5}
          shadow-camera-bottom={-1.5}
        />
        <directionalLight position={[-2.4, 1.4, -1.2]} intensity={0.7} color="#9fc0ff" />
        <directionalLight position={[0, 0.6, -3]} intensity={0.5} color="#ffffff" />

        <Pedal model={model} engaged={engaged} />

        <ContactShadows
          position={[0, -(model.height * MM) / 2 - 0.002, 0]}
          opacity={0.5}
          scale={3}
          blur={2.2}
          far={1.4}
        />

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={1.15}
          maxDistance={4.5}
          /* All the way over to the base plate, but not through the floor. */
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI - 0.15}
          enableDamping
          dampingFactor={0.08}
        />
      </Suspense>
    </Canvas>
  )
}

/** Keeps TS happy about the R3F intrinsic elements in this file. */
export type { ThreeElements }
