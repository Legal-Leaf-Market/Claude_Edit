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

/**
 * FIT TO FRAME: how much of the view the longest side of the pedal fills.
 *
 * The camera is fixed, and the pedals are not remotely the same size: a Cry
 * Baby is 254mm end to end and an MXR micro is 42mm wide, so a scene framed
 * for either one loses the other entirely. The CSS viewer this replaced sized
 * itself to the enclosure and the three.js one silently did not, which shipped
 * a wah cropped out of its own dialog.
 *
 * So the pedal is scaled to a constant footprint rather than shown at true
 * relative size. Everything that reports a DIMENSION still reports the real
 * millimetres (the panel prints them under the canvas), which is where a
 * shopper reads how big the thing actually is; the render is a portrait, not a
 * ruler.
 */
const FIT = 1.25

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
     * MIDDLE, NOT THE DEFAULT ALPHABETIC BASELINE.
     *
     * Every z in `pedal-models.ts` is a position on the face, measured the
     * same way as a knob's. On the default baseline a legend hangs ABOVE its
     * z by three quarters of its cap height instead of straddling it, so a
     * 9mm name sat 3.4mm further back than the number said and crept into the
     * knob labels behind it. Centring the type makes the number mean what it
     * looks like it means, which is also what lets the clearance test in
     * `tests/board/pedal-models.test.ts` do arithmetic on it.
     */
    ctx.textBaseline = "middle"

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

    /*
     * A SQUARE CANVAS ON A FACE THAT IS NOT SQUARE, so the two axes carry
     * different millimetres per pixel and unscaled type comes out stretched.
     *
     * This is the same class of mistake as mapping the decal over the wrong
     * face, and it hid for exactly as long: on a roughly square top the
     * distortion is a few percent and reads as a font choice. The wah is where
     * it became obvious. Its printed heel is 88mm across and 40mm deep, so a
     * glyph drawn at 9mm tall came out 2.2 times too wide and "CRY BABY"
     * overflowed both edges of the plate it was printed on.
     *
     * Height is already right, because the font size is derived from the depth
     * mapping. Only the horizontal needs correcting, by exactly the ratio
     * between the two mappings.
     */
    const squash = faceDepth / face.width
    function print(text: string, xMm: number, zMm: number) {
      ctx!.save()
      ctx!.translate(xPx(xMm), zPx(zMm))
      ctx!.scale(squash, 1)
      ctx!.fillText(text, 0, 0)
      ctx!.restore()
    }

    for (const legend of model.legends) {
      ctx.font = `700 ${pt(legend.size)}px ui-sans-serif, system-ui, sans-serif`
      print(legend.text.toUpperCase(), 0, legend.z)
    }

    /* Knob labels, printed just below each shaft the way they really are. */
    ctx.font = `600 ${pt(3.4)}px ui-sans-serif, system-ui, sans-serif`
    for (const knob of model.knobs) {
      if (!knob.label) continue
      print(knob.label.toUpperCase(), knob.x, knob.z + knob.radius + 6)
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

  /*
   * ONLY THE REAR SHELF IS PRINTED, AND THE INSET IS ASYMMETRIC.
   *
   * The back edge is the rounded corner of the casting, so the decal has to
   * stand off it or its corners poke out as two bright tabs, the same reason
   * `DECAL_D` exists at all. The FRONT edge is not a corner: it is the straight
   * step the tread plate hinges against, and the plate covers whatever the
   * decal does there. Insetting both ends equally cost 2.5mm of shelf at the
   * only end that is short of room, and it showed: with the type centred on its
   * z, "SUPER CHORUS" ran off the front of the plate it was printed on.
   */
  const shelfBack = -model.depth / 2
  const shelfFront = plate.hingeZ
  const shelfRun = shelfFront - shelfBack
  const printBack = shelfBack + shelfRun * (1 - DECAL_D)
  const printFront = shelfFront - shelfRun * 0.01
  const texture = useSilkscreen(model, {
    zMin: printBack,
    zMax: printFront,
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

      {/* The shelf's printed face. Sized and placed from the SAME two numbers
          the texture is mapped over, so the plane and the mapping cannot
          disagree about where the print goes. */}
      {texture && (
        <mesh
          position={[
            0,
            -h / 2 + chassisH + shelfH + 0.0008,
            ((printBack + printFront) / 2) * MM,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[w * DECAL_W, (printFront - printBack) * MM]} />
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

/**
 * A TREADLE: a wah or a volume pedal.
 *
 * THIS BRANCH IS A REGRESSION FIX AS MUCH AS A FEATURE. The CSS viewer drew
 * treadles; when the renderer moved to three.js the body switch only had
 * `boss-compact` and a box, so `style: "treadle"` fell through and a Cry Baby
 * shipped as a plain rectangle. A discriminated style with no branch for one
 * of its cases fails silently, which is exactly the shape of bug this file's
 * comments keep warning about.
 *
 * The cheeks are EXTRUDED, not planes. In CSS they had to be flat trapezoids
 * and read as fins from any angle where you saw their edge; here they are real
 * walls with thickness, which is most of why the shape now reads.
 */
function TreadleBody({ model }: { model: PedalModel }) {
  const tr = model.treadle!
  const w = model.width * MM
  const d = model.depth * MM
  const h = model.height * MM

  const wall = 7 * MM
  const heel = tr.cheekHeelHeight * MM
  const toe = tr.cheekToeHeight * MM

  /*
   * The cheek profile, in the shape's own plane: x runs from the toe to the
   * heel and y is height off the top of the chassis. Extruded along its
   * normal, then stood up on edge, so `wall` really is the thickness of the
   * casting rather than a fudge factor.
   */
  const cheek = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-d / 2, 0)
    shape.lineTo(d / 2, 0)
    shape.lineTo(d / 2, heel)
    shape.lineTo(-d / 2, toe)
    shape.closePath()
    return new THREE.ExtrudeGeometry(shape, { depth: wall, bevelEnabled: false })
  }, [d, heel, toe, wall])

  /* Only the heel of the chassis is printed: the plate covers the rest. */
  const texture = useSilkscreen(model, {
    zMin: model.depth / 2 - 40,
    zMax: model.depth / 2,
    width: model.width * DECAL_W,
  })

  const plateW = tr.plateWidth * MM
  const plateD = tr.plateDepth * MM
  const plateT = tr.plateThickness * MM

  return (
    <>
      {/* The chassis. */}
      <RoundedBox args={[w, h, d]} radius={w * 0.045} smoothness={5} castShadow receiveShadow>
        <meshPhysicalMaterial {...bodyMaterial(model.color)} />
      </RoundedBox>

      {/* Its printed heel. */}
      {texture && (
        <mesh
          position={[0, h / 2 + 0.0008, model.depth / 2 * MM - 20 * MM]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[w * DECAL_W, 40 * MM]} />
          <meshStandardMaterial map={texture} roughness={0.5} metalness={0.15} />
        </mesh>
      )}

      {/* The two fixed cheeks, tall at the heel and low at the toe. */}
      {[1, -1].map((side) => (
        <mesh
          key={side}
          geometry={cheek}
          castShadow
          receiveShadow
          position={[side * (w / 2 - wall), h / 2, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <meshPhysicalMaterial {...bodyMaterial(model.color)} />
        </mesh>
      ))}

      {/*
        The rocking plate, on a real axle.

        The pivot group sits AT the hinge and rotates there; the plate is then
        placed relative to it. Rotating the plate about its own centre instead
        swings it through the chassis rather than tipping it, which is the
        difference between a treadle and a lid.
      */}
      <group
        position={[0, h / 2 + tr.pivotY * MM, tr.pivotZ * MM]}
        rotation={[THREE.MathUtils.degToRad(-tr.tilt), 0, 0]}
      >
        <RoundedBox
          args={[plateW, plateT, plateD]}
          radius={plateT * 0.3}
          smoothness={4}
          position={[0, 0, -tr.pivotZ * MM]}
          castShadow
        >
          <meshPhysicalMaterial
            {...bodyMaterial(model.color)}
            roughness={0.55}
            metalness={0.35}
          />
        </RoundedBox>

        {/* Grip ribs. The one surface on a pedalboard meant to take weight,
            and a smooth one reads as a lid. */}
        {Array.from({ length: 11 }, (_, i) => (
          <mesh
            key={i}
            position={[0, plateT / 2, -tr.pivotZ * MM + (i - 5) * (plateD / 13)]}
            castShadow
          >
            <boxGeometry args={[plateW * 0.86, plateT * 0.14, plateD * 0.022]} />
            <meshStandardMaterial color="#0d0d10" roughness={0.75} />
          </mesh>
        ))}
      </group>
    </>
  )
}

/**
 * A ROUND body: a Fuzz Face.
 *
 * A 111mm circular casting, which is not a box in any direction and is the one
 * pedal whose silhouette alone identifies it. Built as a base ring and a
 * tapered lid rather than a hemisphere, because the real one has a flat area
 * on top that the printing and the knobs actually sit on.
 */
function RoundBody({ model }: { model: PedalModel }) {
  const r = (model.width / 2) * MM
  const h = model.height * MM
  const topR = r * 0.84

  const texture = useSilkscreen(model, {
    zMin: -model.depth / 2 * DECAL_D,
    zMax: model.depth / 2 * DECAL_D,
    width: model.width * DECAL_D,
  })

  /*
   * ONE LATHED PROFILE, NOT TWO STACKED CYLINDERS.
   *
   * The first pass built the body from a wide cylinder with a narrower one on
   * top, which puts a hard step right where the casting's whole character is:
   * the shoulder is a continuous curve, and the step read as two objects
   * rather than one. A profile revolved about the axis gets the curve for
   * free, and the silhouette is the only thing that identifies this pedal.
   *
   * The wall is straight to just under half height, then a quarter ellipse
   * turns it in to the flat that the knobs and the printing sit on. Tangent is
   * vertical where it leaves the wall and horizontal where it meets the flat,
   * so neither junction shows.
   */
  const profile = useMemo(() => {
    const wall = h * 0.42
    const points = [new THREE.Vector2(0.0001, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r, wall)]
    const steps = 14
    for (let i = 1; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2)
      points.push(
        new THREE.Vector2(topR + (r - topR) * Math.cos(a), wall + (h - wall) * Math.sin(a)),
      )
    }
    points.push(new THREE.Vector2(0.0001, h))
    return new THREE.LatheGeometry(points, 64)
  }, [r, topR, h])

  return (
    <>
      <mesh geometry={profile} position={[0, -h / 2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial {...bodyMaterial(model.color)} />
      </mesh>

      {/* The printed top, clipped to the flat by a circular plane. */}
      {texture && (
        <mesh position={[0, h / 2 + 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[topR * 0.97, 56]} />
          <meshStandardMaterial map={texture} roughness={0.5} metalness={0.15} />
        </mesh>
      )}
    </>
  )
}

/* --------------------------------------------------------------------- */
/*  The pedal, and the scene around it                                    */
/* --------------------------------------------------------------------- */

function Pedal({
  model,
  engaged,
  fit,
}: {
  model: PedalModel
  engaged: boolean
  fit: number
}) {
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
  /* A treadle carries no knobs and no button: the plate is the control. */
  const showControls = model.style !== "treadle"

  return (
    <group ref={group} scale={fit}>
      {/* EVERY style needs a branch. A style with no branch does not error, it
          silently falls through to the box, which is how the treadle got lost
          when this viewer replaced the CSS one. */}
      {model.style === "boss-compact" ? (
        <BossCompactBody model={model} />
      ) : model.style === "treadle" && model.treadle ? (
        <TreadleBody model={model} />
      ) : model.style === "round" ? (
        <RoundBody model={model} />
      ) : (
        <BoxBody model={model} />
      )}

      <group position={[0, controlY, 0]}>
        {showControls && model.knobs.map((knob, i) => (
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
  /* The longest side on the floor decides the scale, so a wah lying along z
     and a wide 1590BB lying along x both end up filling the same frame. */
  const fit = FIT / (Math.max(model.width, model.depth) * MM)

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

        <Pedal model={model} engaged={engaged} fit={fit} />

        <ContactShadows
          /* Under the scaled pedal, not the unscaled one: a shadow floating
             halfway up a wah is worse than no shadow at all. */
          position={[0, (-(model.height * MM) / 2) * fit - 0.002, 0]}
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
