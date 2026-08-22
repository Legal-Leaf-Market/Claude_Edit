"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  enclosureSpec,
  type EnclosureSpec,
  type Jack,
  type Treadle,
} from "@/lib/board/enclosure-3d"
import type { BoardItem } from "@/lib/board/model"
import { SLOT_BY_ID } from "@/lib/stompbox/chain"

/**
 * A PEDAL YOU CAN PICK UP AND TURN OVER.
 *
 * Not a picture of a box, and not a tilted card: a real solid, six faces in a
 * shared 3D space, with knobs and a footswitch that are extruded cylinders
 * standing proud of the top and jacks cut into the sides. Spin it and the far
 * faces go away and the near ones come round, because they are actually there.
 *
 * WHY DOM AND NOT A CANVAS, and this is the same argument section 16 makes
 * about the planner rather than a new one. A canvas has no DOM, so it has no
 * screen reader, nothing to index, and no way for the /go link that pays for
 * this site to live inside it. Everything below is real elements: the pedal
 * announces itself, the controls are buttons, and the whole thing degrades to
 * a labelled flat drawing when 3D transforms are unavailable.
 *
 * WHY IT IS PROCEDURAL AND SAYS SO. `lib/board/enclosure-3d.ts` derives the
 * box from the slot, because there is no legitimate source of per-product 3D
 * models for a catalogue this size and hand-modelling does not scale past one.
 * So this is a REPRESENTATIVE enclosure of that kind of pedal, the panel says
 * exactly that in words, and the real product photograph sits next to it when
 * we have one. Dressing a generated box up as a scan of somebody's actual
 * pedal would be the same act as publishing a market price from two listings.
 *
 * NOTHING SPINS AT IDLE. It rests at a three-quarter view and stays there
 * until somebody drags it, which is section 16's rule and also just what a
 * pedal on a shelf does.
 */

/** How many flat strips make a cylinder. Twelve is round enough at this size
 *  and costs twelve elements rather than the sixty a smooth one would. */
const SEGMENTS = 12

/**
 * How much of the stage the longest side of the object should take.
 *
 * FIT TO FRAME, NOT ONE FIXED SCALE, and the treadle is why. A wah is 254mm
 * deep against a 1590B's 111.5mm, so a single millimetres-to-pixels factor
 * either shrinks every stompbox to a chip or runs the wah off three sides of
 * the panel. Every object is scaled to fill the same frame instead.
 *
 * The cost is that a wah no longer LOOKS bigger than a fuzz, and pixels are a
 * bad place to lose a true fact. So the panel prints the real millimetres
 * underneath, which says it better than relative size ever did.
 */
const FRAME_PX = 268

/** The resting three-quarter view: turned to the right, seen from above. */
const HOME = { yaw: -26, pitch: 22 }

export function Pedal3D({
  item,
  /** Rendered beside the solid when the catalogue has a photograph. */
  photoUrl,
}: {
  item: BoardItem
  photoUrl?: string | null
}) {
  const spec = useMemo(() => enclosureSpec(item), [item])
  const slot = SLOT_BY_ID[item.slot]

  /* A dead product URL must take the whole figure with it. A broken-image
     glyph under a caption reading "The actual product" is worse than no
     photograph at all, and marketplace URLs expire all the time. The ref
     catches the ones that finish failing before React hydrates. */
  const [photoFailed, setPhotoFailed] = useState(false)
  const checkPhoto = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setPhotoFailed(true)
  }, [])

  const [yaw, setYaw] = useState(HOME.yaw)
  const [pitch, setPitch] = useState(HOME.pitch)
  const [dragging, setDragging] = useState(false)

  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const glide = useRef<number | null>(null)

  const stopGlide = useCallback(() => {
    if (glide.current !== null) {
      cancelAnimationFrame(glide.current)
      glide.current = null
    }
  }, [])

  useEffect(() => stopGlide, [stopGlide])

  /**
   * Pitch is clamped just short of the poles.
   *
   * You can turn it all the way over and look at the base plate, which is the
   * point of being able to spin it, but exactly 90 degrees is where a
   * yaw-then-pitch pair stops having a sensible axis and the box appears to
   * flip sideways under your finger.
   */
  const clampPitch = (p: number) => Math.max(-88, Math.min(88, p))

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    stopGlide()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, vx: 0, vy: 0 }
    setDragging(true)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const from = drag.current
    if (!from) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    drag.current = { x: event.clientX, y: event.clientY, vx: dx, vy: dy }
    setYaw((y) => y + dx * 0.55)
    /* Drag down tips the top of the box toward you, which is what tipping a
       real object toward yourself does. */
    setPitch((p) => clampPitch(p + dy * 0.45))
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const from = drag.current
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!from) return

    /* Let go mid-turn and it keeps going, then settles. A solid that stops
       dead the instant you release feels like a slider, not an object.
       Anybody who has asked for less motion gets the turn and not the glide. */
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    let { vx, vy } = from
    if (Math.abs(vx) < 0.6 && Math.abs(vy) < 0.6) return

    const step = () => {
      vx *= 0.94
      vy *= 0.94
      setYaw((y) => y + vx * 0.55)
      setPitch((p) => clampPitch(p + vy * 0.45))
      if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
        glide.current = requestAnimationFrame(step)
      } else {
        glide.current = null
      }
    }
    glide.current = requestAnimationFrame(step)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const turn: Record<string, () => void> = {
      ArrowLeft: () => setYaw((y) => y - 12),
      ArrowRight: () => setYaw((y) => y + 12),
      ArrowUp: () => setPitch((p) => clampPitch(p - 10)),
      ArrowDown: () => setPitch((p) => clampPitch(p + 10)),
      Home: () => {
        setYaw(HOME.yaw)
        setPitch(HOME.pitch)
      },
    }
    const run = turn[event.key]
    if (!run) return
    event.preventDefault()
    stopGlide()
    run()
  }

  /* One factor per object, derived from its own longest side. */
  const mm = FRAME_PX / Math.max(spec.depth, spec.width)
  const w = spec.width * mm
  const d = spec.depth * mm
  const h = spec.height * mm

  return (
    <div className="p3d">
      <div
        className="p3d-stage"
        data-dragging={dragging}
        role="img"
        aria-label={
          `A representative ${
            spec.shape === "treadle" ? "treadle" : `${slot.name.toLowerCase()} enclosure`
          } for ${item.name}. Drag, or use the arrow keys, to turn it.`
        }
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {/*
          The floor shadow is OUTSIDE the pivot on purpose: it belongs to the
          room, not to the pedal, so it must not roll over when the box does.
        */}
        <span className="p3d-shadow" style={{ width: w, height: d * 0.62 }} aria-hidden="true" />

        <div
          className="p3d-pivot"
          style={{
            /* Negative pitch looks DOWN at the top face: a positive rotateX
               swings the top away from the viewer, which shows the base. */
            transform: `rotateX(${-pitch}deg) rotateY(${yaw}deg)`,
          }}
        >
          <div className="p3d-box" style={{ width: w, height: h }}>
            <Faces spec={spec} w={w} d={d} h={h} mm={mm} />

            {/* A wah and a volume pedal are not boxes: two fixed cheeks and a
                plate that rocks between them. See lib/board/enclosure-3d.ts. */}
            {spec.treadle ? <TreadleParts spec={spec} tr={spec.treadle} w={w} h={h} mm={mm} yaw={yaw} /> : null}

            {/* Knobs and the switch stand on the top face, in the box's own 3D
                space rather than drawn onto it, which is what makes them
                disappear behind the enclosure as you turn it over. */}
            {spec.knobs.map((knob, i) => (
              <Cylinder
                key={`knob-${i}`}
                x={knob.x * mm}
                z={knob.z * mm}
                base={-h / 2}
                radius={knob.radius * mm}
                height={knob.height * mm}
                className="p3d-knob"
                pointer={knob.angle}
              />
            ))}

            {spec.switches.map((sw, i) => (
              <Cylinder
                key={`sw-${i}`}
                x={sw.x * mm}
                z={sw.z * mm}
                base={-h / 2}
                radius={sw.radius * mm}
                height={sw.height * mm}
                className="p3d-switch"
              />
            ))}

            {/* The LED, and it is the only saturated colour on the object,
                which is what it means everywhere else on this site. */}
            <Cylinder
              x={spec.led.x * mm}
              z={spec.led.z * mm}
              base={-h / 2}
              radius={spec.led.radius * mm}
              height={spec.led.radius * mm * 0.85}
              className="p3d-led"
              lit={item.engaged}
            />
          </div>
        </div>
      </div>

      <div className="p3d-controls">
        <p className="p3d-hint">
          Drag it to turn it over. Arrow keys work too, and Home puts it back.
        </p>
        <button
          type="button"
          className="stomp stomp-sm"
          onClick={() => {
            stopGlide()
            setYaw(HOME.yaw)
            setPitch(HOME.pitch)
          }}
        >
          Straighten up
        </button>
      </div>

      {/*
        THE HONEST LABEL, and it is not optional decoration.

        The box above is generated from the slot, so it is a fair drawing of
        what that kind of pedal looks like and is not a likeness of this
        product. Saying so is the same rule as a gear page printing "sample too
        small to publish a market price" rather than estimating one, and it is
        why the real photograph sits right beside it when we have one.
      */}
      <div className="p3d-truth">
        <p>
          {spec.shape === "treadle" ? (
            <>
              A representative treadle, drawn from the kind of pedal this is rather than measured
              from this one. The sweep, the travel and the switch under the toe are typical of the
              family.
            </>
          ) : (
            <>
              A representative {slot.name.toLowerCase()} enclosure, drawn from the kind of pedal
              this is rather than measured from this one. Knob count and layout are typical of the
              family.
            </>
          )}{" "}
          {/* Every object is scaled to the same frame, so the picture cannot
              show you that a wah is more than twice the length of a Big Muff.
              Saying the numbers is a better job of it than pixels were. */}
          Roughly {Math.round(spec.width)} by {Math.round(spec.depth)}mm on the floor.
        </p>
        {photoUrl && !photoFailed ? (
          <figure className="p3d-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={checkPhoto}
              src={photoUrl}
              alt={`${item.name}, as photographed by the shop selling it`}
              loading="lazy"
              decoding="async"
              onError={() => setPhotoFailed(true)}
            />
            <figcaption>The actual product</figcaption>
          </figure>
        ) : null}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- */
/*  The six faces                                                          */
/* --------------------------------------------------------------------- */

/**
 * The box.
 *
 * Every face is centred on the box origin with margins rather than a
 * translate, so its `transform` starts from the middle of the solid and the
 * rotations below read as the geometry they are. A `translate(-50%, -50%)`
 * in front of them would move the origin first and then rotate about the
 * moved point, which is a different and much harder thing to reason about.
 */
function Faces({
  spec,
  w,
  d,
  h,
  mm,
}: {
  spec: EnclosureSpec
  w: number
  d: number
  h: number
  mm: number
}) {
  const face = (width: number, height: number, transform: string) => ({
    width,
    height,
    marginLeft: -width / 2,
    marginTop: -height / 2,
    transform,
  })

  return (
    <>
      {/* TOP. Where the silkscreen and every control live. */}
      <span
        className="p3d-face p3d-top"
        style={{ ...face(w, d, `translateY(${-h / 2}px) rotateX(90deg)`), background: spec.tint }}
      >
        {/* Positioned from the spec, not from a CSS percentage: the clear
            strip on the face moves when the knob count does, and a fixed
            percentage put the name under the footswitch. */}
        <span
          className="p3d-legend"
          style={{ top: `${((spec.legendZ + spec.depth / 2) / spec.depth) * 100}%` }}
        >
          <b>{spec.legend}</b>
          {spec.sublegend ? <i>{spec.sublegend}</i> : null}
        </span>
      </span>

      {/* BOTTOM. A base plate with four feet, because turning it over and
          finding nothing there is what gives a fake solid away. */}
      <span
        className="p3d-face p3d-bottom"
        style={face(w, d, `translateY(${h / 2}px) rotateX(-90deg)`)}
      >
        <span className="p3d-plate" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>

      {/* FRONT, toward the player. */}
      <span
        className="p3d-face p3d-side"
        style={{ ...face(w, h, `translateZ(${d / 2}px)`), background: spec.tint }}
      />

      {/* BACK, where the power goes in. */}
      <span
        className="p3d-face p3d-side"
        style={{ ...face(w, h, `translateZ(${-d / 2}px) rotateY(180deg)`), background: spec.tint }}
      >
        <Jacks jacks={spec.jacks} face="back" mm={mm} />
      </span>

      {/* RIGHT, the input side. */}
      <span
        className="p3d-face p3d-side"
        style={{ ...face(d, h, `translateX(${w / 2}px) rotateY(90deg)`), background: spec.tint }}
      >
        <Jacks jacks={spec.jacks} face="right" mm={mm} />
      </span>

      {/* LEFT, the output side. */}
      <span
        className="p3d-face p3d-side"
        style={{ ...face(d, h, `translateX(${-w / 2}px) rotateY(-90deg)`), background: spec.tint }}
      >
        <Jacks jacks={spec.jacks} face="left" mm={mm} />
      </span>
    </>
  )
}

/** Sockets, drawn flat on the face they are cut into. */
function Jacks({ jacks, face, mm }: { jacks: Jack[]; face: Jack["face"]; mm: number }) {
  return (
    <>
      {jacks
        .filter((jack) => jack.face === face)
        .map((jack, i) => (
          <span
            key={i}
            className="p3d-jack"
            data-kind={jack.kind}
            aria-hidden="true"
            style={{
              width: jack.radius * 2 * mm,
              height: jack.radius * 2 * mm,
              marginLeft: -jack.radius * mm + jack.offset * mm,
              marginTop: -jack.radius * mm,
            }}
          />
        ))}
    </>
  )
}

/* --------------------------------------------------------------------- */
/*  Treadles                                                               */
/* --------------------------------------------------------------------- */

/**
 * The two things a treadle has that a box does not.
 *
 * THE CHEEKS ARE WHY A WAH IS RECOGNISABLE. Two fixed plates rising from the
 * chassis toward the heel, with the rocking plate slung between them. Each is
 * a single element cut to a trapezoid with `clip-path`, which is safe here
 * only because a cheek is a LEAF: clip-path forces `transform-style: flat` on
 * whatever carries it, exactly as overflow does, so putting one on anything
 * with 3D children would quietly collapse the solid.
 *
 * THE PLATE ROCKS ABOUT A REAL AXIS. The pivot span sits at the hinge, rotates
 * there, and the plate's own faces are then placed relative to it. Rotating
 * the plate about its own centre instead would swing the whole thing through
 * the chassis rather than tipping it.
 */
function TreadleParts({
  spec,
  tr,
  w,
  h,
  mm,
  yaw,
}: {
  spec: EnclosureSpec
  tr: Treadle
  w: number
  h: number
  mm: number
  /** Needed to order the cheeks front to back. See below. */
  yaw: number
}) {
  const d = spec.depth * mm
  const heel = tr.cheekHeelHeight * mm
  const toe = tr.cheekToeHeight * mm
  const pivotZ = tr.pivotZ * mm
  const pw = tr.plateWidth * mm
  const pd = tr.plateDepth * mm
  const pt = tr.plateThickness * mm

  /*
   * A cheek face is rotated 90 degrees about Y, so its own x axis runs along
   * the pedal's z. On the RIGHT cheek local x=0 lands at the heel; on the LEFT
   * it lands at the toe, because that face is turned the other way. The
   * trapezoid is mirrored to match, which is the sort of thing that looks like
   * a typo until you turn the pedal around and see one cheek sloping backwards.
   */
  const drop = (1 - toe / heel) * 100
  const cheek = (side: "left" | "right") => ({
    width: d,
    height: heel,
    marginLeft: -d / 2,
    marginTop: -heel / 2,
    transform:
      `translateX(${side === "right" ? w / 2 : -w / 2}px) ` +
      `translateY(${-h / 2 - heel / 2}px) ` +
      `rotateY(${side === "right" ? 90 : -90}deg)`,
    /* The tint reaches the polygon as currentColor. See CheekShape. */
    color: spec.tint,
  })

  return (
    <>
      {/*
        THE FAR CHEEK, THEN THE PLATE, THEN THE NEAR ONE. This ordering is not
        cosmetic and it is not paranoia.

        The browser does not depth-sort these against each other: it paints
        them in DOM order. An A/B render proved it, by moving the cheeks after
        the plate and watching the treadle correctly disappear behind the near
        wall at both side-on views, having shown straight through it before.
        Two earlier suspects were ruled out the same way, a nested pivot
        element and a clip-path, and neither was the cause.

        So this does the sorting itself, which is all a painter's algorithm
        ever was. Which cheek is nearer follows from the yaw: rotating by theta
        about Y sends a face at x to a depth of -x sin(theta), so the right
        cheek comes toward the viewer exactly while sin(theta) is negative.
      */}
      {orderedCheeks(yaw).map((side) => (
        <Fragment key={side}>
          <span className="p3d-face p3d-cheek" style={cheek(side)} aria-hidden="true">
            <CheekShape drop={drop} side={side} />
          </span>
          {side === farCheek(yaw) ? <PlateFaces tr={tr} h={h} mm={mm} /> : null}
        </Fragment>
      ))}

    </>
  )
}

/**
 * The cheek's trapezoid, AS AN SVG POLYGON RATHER THAN A `clip-path`.
 *
 * This is not a style preference, it is the fix for a real defect. A clip-path
 * makes its element a grouping element, which takes it out of the parent's 3D
 * depth sort: the cheek stopped being tested against the plate and got painted
 * behind it, so turning the pedal side on showed the treadle straight through
 * the near wall. An A/B render with and without the clip proved it.
 *
 * The same is true of `filter`, which is why the shading below is a second
 * polygon at low opacity rather than a `brightness()` on the span. Anything
 * that groups an element is off limits inside this subtree; only properties
 * that leave it a plain participant in the 3D context are safe.
 *
 * `preserveAspectRatio="none"` lets one 100x100 viewBox stretch to whatever
 * the cheek's real pixel size is, so the geometry stays in the spec.
 */
function CheekShape({ drop, side }: { drop: number; side: "left" | "right" }) {
  const points =
    side === "right"
      ? `0,0 100,${drop} 100,100 0,100`
      : `0,${drop} 100,0 100,100 0,100`
  return (
    <svg
      className="p3d-cheek-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={points} fill="currentColor" />
      {/* The shading a brightness() filter used to do, without the grouping. */}
      <polygon points={points} fill="#000" opacity="0.22" />
    </svg>
  )
}

/**
 * The rocking plate, as SIX SIBLINGS rather than a nested subtree.
 *
 * The hinge used to be its own rotated element with the plate inside it, which
 * is the natural way to express "rotate about an axis". It is baked into each
 * face's transform instead so that every surface of the pedal is a sibling in
 * one 3D context, which is what lets the ordering above work at all.
 *
 * The chain reads outward from the axis: stand at the hinge, tip by the rest
 * angle, then step back to the plate's own middle. That is a rock rather than
 * a slide, which is the whole point of a treadle.
 */
function PlateFaces({ tr, h, mm }: { tr: Treadle; h: number; mm: number }) {
  const pw = tr.plateWidth * mm
  const pd = tr.plateDepth * mm
  const pt = tr.plateThickness * mm
  const pivotZ = tr.pivotZ * mm

  return (
    <>
      {plateFaces(pw, pd, pt).map(({ key, width, height, local, className }) => (
        <span
          key={key}
          className={`p3d-face ${className}`}
          aria-hidden="true"
          style={{
            width,
            height,
            marginLeft: -width / 2,
            marginTop: -height / 2,
            transform:
              `translate3d(0px, ${-h / 2 - tr.pivotY * mm}px, ${pivotZ}px) ` +
              `rotateX(${-tr.tilt}deg) ` +
              `translate3d(0px, ${-pt / 2}px, ${-pivotZ}px) ` +
              local,
          }}
        />
      ))}
    </>
  )
}

/** Which cheek the camera is looking past, at this yaw. */
function farCheek(yaw: number): "left" | "right" {
  return Math.sin((yaw * Math.PI) / 180) < 0 ? "left" : "right"
}

/** Far first, near last, so the near one paints over what it stands in front of. */
function orderedCheeks(yaw: number): ("left" | "right")[] {
  const far = farCheek(yaw)
  return [far, far === "left" ? "right" : "left"]
}

/** The plate's own six faces, in its local frame. Ribbed side up. */
function plateFaces(pw: number, pd: number, pt: number) {
  return [
    { key: "tread", width: pw, height: pd, local: `translateY(${-pt / 2}px) rotateX(90deg)`, className: "p3d-tread" },
    { key: "under", width: pw, height: pd, local: `translateY(${pt / 2}px) rotateX(-90deg)`, className: "p3d-plateside" },
    { key: "heel", width: pw, height: pt, local: `translateZ(${pd / 2}px)`, className: "p3d-plateside" },
    { key: "toe", width: pw, height: pt, local: `translateZ(${-pd / 2}px) rotateY(180deg)`, className: "p3d-plateside" },
    { key: "right", width: pd, height: pt, local: `translateX(${pw / 2}px) rotateY(90deg)`, className: "p3d-plateside" },
    { key: "left", width: pd, height: pt, local: `translateX(${-pw / 2}px) rotateY(-90deg)`, className: "p3d-plateside" },
  ]
}

/* --------------------------------------------------------------------- */
/*  Cylinders                                                              */
/* --------------------------------------------------------------------- */

/**
 * A knob, a footswitch or an LED: all the same solid.
 *
 * Twelve flat strips arranged around an axis, plus a cap on each end. The
 * strips are cut to the TANGENT width rather than the chord (2r·tan, not
 * 2r·sin) so consecutive strips overlap slightly at the seams instead of
 * leaving twelve hairline gaps you can see straight through.
 *
 * The bottom cap exists even though it sits flat on the enclosure and is never
 * visible from above. Turn the pedal over far enough and a cylinder without
 * one is a hollow tube, which is exactly the kind of detail that decides
 * whether the thing reads as solid.
 */
function Cylinder({
  x,
  z,
  base,
  radius,
  height,
  className,
  pointer,
  lit,
}: {
  x: number
  z: number
  /** CSS y of the surface it stands on: the top face, so a negative number. */
  base: number
  radius: number
  height: number
  className: string
  /** Degrees to draw the indicator line at, on knobs. */
  pointer?: number
  lit?: boolean
}) {
  const strip = 2 * radius * Math.tan(Math.PI / SEGMENTS)
  const step = 360 / SEGMENTS
  const cap = { width: radius * 2, height: radius * 2, marginLeft: -radius, marginTop: -radius }

  return (
    <span
      className={`p3d-cyl ${className}`}
      data-lit={lit}
      aria-hidden="true"
      style={{ transform: `translate3d(${x}px, ${base - height / 2}px, ${z}px)` }}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className="p3d-cyl-side"
          style={{
            width: strip,
            height,
            marginLeft: -strip / 2,
            marginTop: -height / 2,
            transform: `rotateY(${i * step}deg) translateZ(${radius}px)`,
            /* Shade each strip by how far it has turned away from the light,
               which is what stops twelve identical strips reading as a
               twelve-sided prism painted one colour. */
            filter: `brightness(${(0.62 + 0.5 * Math.cos(((i * step - 35) * Math.PI) / 180)).toFixed(3)})`,
          }}
        />
      ))}

      <span
        className="p3d-cyl-cap"
        style={{ ...cap, transform: `translateY(${-height / 2}px) rotateX(90deg)` }}
      >
        {pointer !== undefined ? (
          <i className="p3d-pointer" style={{ transform: `rotate(${pointer}deg)` }} />
        ) : null}
      </span>

      <span
        className="p3d-cyl-cap p3d-cyl-floor"
        style={{ ...cap, transform: `translateY(${height / 2}px) rotateX(-90deg)` }}
      />
    </span>
  )
}
