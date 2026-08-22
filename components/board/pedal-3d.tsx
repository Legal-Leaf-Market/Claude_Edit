"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { enclosureSpec, type EnclosureSpec, type Jack } from "@/lib/board/enclosure-3d"
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

/** Millimetres to pixels. One number, applied once, so the spec can stay in
 *  real units and the proportions cannot drift. Sized so a 1590B fills the
 *  stage without its far corner leaving it when the box is turned edge on. */
const MM = 2.9

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

  const w = spec.width * MM
  const d = spec.depth * MM
  const h = spec.height * MM

  return (
    <div className="p3d">
      <div
        className="p3d-stage"
        data-dragging={dragging}
        role="img"
        aria-label={`A representative ${slot.name.toLowerCase()} enclosure for ${item.name}. Drag, or use the arrow keys, to turn it.`}
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
            <Faces spec={spec} w={w} d={d} h={h} />

            {/* Knobs and the switch stand on the top face, in the box's own 3D
                space rather than drawn onto it, which is what makes them
                disappear behind the enclosure as you turn it over. */}
            {spec.knobs.map((knob, i) => (
              <Cylinder
                key={`knob-${i}`}
                x={knob.x * MM}
                z={knob.z * MM}
                base={-h / 2}
                radius={knob.radius * MM}
                height={knob.height * MM}
                className="p3d-knob"
                pointer={knob.angle}
              />
            ))}

            {spec.switches.map((sw, i) => (
              <Cylinder
                key={`sw-${i}`}
                x={sw.x * MM}
                z={sw.z * MM}
                base={-h / 2}
                radius={sw.radius * MM}
                height={sw.height * MM}
                className="p3d-switch"
              />
            ))}

            {/* The LED, and it is the only saturated colour on the object,
                which is what it means everywhere else on this site. */}
            <Cylinder
              x={spec.led.x * MM}
              z={spec.led.z * MM}
              base={-h / 2}
              radius={spec.led.radius * MM}
              height={spec.led.radius * MM * 0.85}
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
          A representative {slot.name.toLowerCase()} enclosure, drawn from the kind of pedal this
          is rather than measured from this one. Knob count and layout are typical of the family.
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
function Faces({ spec, w, d, h }: { spec: EnclosureSpec; w: number; d: number; h: number }) {
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
        <Jacks jacks={spec.jacks} face="back" mm={MM} />
      </span>

      {/* RIGHT, the input side. */}
      <span
        className="p3d-face p3d-side"
        style={{ ...face(d, h, `translateX(${w / 2}px) rotateY(90deg)`), background: spec.tint }}
      >
        <Jacks jacks={spec.jacks} face="right" mm={MM} />
      </span>

      {/* LEFT, the output side. */}
      <span
        className="p3d-face p3d-side"
        style={{ ...face(d, h, `translateX(${-w / 2}px) rotateY(-90deg)`), background: spec.tint }}
      >
        <Jacks jacks={spec.jacks} face="left" mm={MM} />
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
