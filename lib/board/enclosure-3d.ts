import type { SlotId } from "@/lib/stompbox/chain"
import type { BoardItem } from "@/lib/board/model"

/**
 * The geometry of one pedal, as a solid.
 *
 * WHY THIS IS A MODULE AND NOT MARKUP. The viewer that renders it builds a
 * real box out of DOM elements in a 3D space, and the numbers deciding how
 * many knobs it has and how big the box is are DATA, derived from the item the
 * same way the chain rules and the power estimate are. Keeping them here makes
 * them testable, which matters because "a delay gets four knobs and a wide
 * enclosure" is a claim about pedals rather than about CSS.
 *
 * WHY IT IS NOT A 3D MODEL FILE. There is no legitimate source of per-product
 * 3D models for a catalogue this size, and hand-modelling one pedal does not
 * scale to thousands. The same rule as section 2 and section 13: if there is
 * no legitimate feed for something, either derive it from what is actually
 * known or do not publish it. Everything below is derived from the slot, which
 * we do know, and it produces a HONEST GENERIC of that kind of pedal rather
 * than a claim to be a specific manufacturer's box.
 *
 * That distinction is load bearing and the viewer states it in words: this is
 * a representative enclosure, not a likeness of the product. Passing a
 * procedural box off as a scan of a real Big Muff would be the same act as
 * inventing a market price.
 *
 * UNITS ARE MILLIMETRES, at roughly life size, so the proportions come out
 * right without anybody tuning them by eye. A 1590B is 111.5 x 59.5 x 31mm and
 * that is the standard box below; the wide one is a 1590BB. The viewer applies
 * one scale factor at the end.
 */

/** A right-handed millimetre box. X across, Y up, Z toward the player. */
export type EnclosureSpec = {
  /** Left to right, as the player looks down at it. */
  width: number
  /** Toward the player. The long axis of a stompbox. */
  depth: number
  /** Off the floor. */
  height: number
  /** Face tint, as a CSS colour. Always a token so both themes resolve it. */
  tint: string
  knobs: Knob[]
  switches: Footswitch[]
  /** Panel-mounted sockets, cut into the sides and the back. */
  jacks: Jack[]
  led: { x: number; z: number; radius: number }
  /**
   * What the silkscreen says. The viewer prints this on the top face, so it is
   * the item's own name rather than anything invented here.
   */
  legend: string
  sublegend: string | null
  /**
   * Where the silkscreen goes, in mm from the middle of the box.
   *
   * COMPUTED, NOT A CSS PERCENTAGE, because the free band between the last row
   * of knobs and the LED moves when the knob count does. The first draft put
   * it at a fixed "bottom: 14%" and it landed underneath the footswitch, which
   * is a thing that cannot happen if the position is derived from the layout
   * that pushed it there.
   */
  legendZ: number
}

export type Knob = {
  /** Centre on the top face, in mm from the middle of the box. */
  x: number
  z: number
  radius: number
  /** How far it stands proud of the enclosure. */
  height: number
  /** Where the pointer line is drawn, in degrees. Cosmetic, but it has to be
   *  deterministic or the knob jumps every render. */
  angle: number
}

export type Footswitch = {
  x: number
  z: number
  radius: number
  height: number
}

export type Jack = {
  /** Which face it is cut into. */
  face: "left" | "right" | "back"
  /** Position along that face, in mm from its centre. */
  offset: number
  radius: number
  kind: "audio" | "power"
}

/* --------------------------------------------------------------------- */
/*  How many controls a kind of pedal has                                 */
/* --------------------------------------------------------------------- */

/**
 * Knob count per slot, and these are claims about real pedals rather than
 * round numbers.
 *
 * A tuner has none: it has a screen. A volume pedal has none either, because
 * it is a treadle and the only adjustment is your foot, so it gets no knob
 * rather than a fake one. Everything else is the common case for that family:
 * a fuzz is famously three (volume, tone, sustain), a delay is four (time,
 * feedback, mix, and usually a mode), a graphic EQ is sliders which the box
 * below approximates as a row of six.
 *
 * These are DEFAULTS FOR A FAMILY, not a lookup of a specific product, which
 * is the whole reason the viewer calls itself representative.
 */
const KNOBS_BY_SLOT: Record<SlotId, number> = {
  tuner: 0,
  filter: 3,
  dynamics: 4,
  fuzz: 3,
  drive: 3,
  eq: 6,
  gate: 2,
  volume: 0,
  modulation: 3,
  delay: 4,
  reverb: 3,
}

/**
 * The face tint per family.
 *
 * Every value is a token, never a literal, so both themes resolve from the one
 * palette and section 16's rule holds. The variation is deliberate and small:
 * a board of eleven identical blue boxes is dull, and real pedals differ, but
 * a rainbow would put a second saturated colour beside the LED and break the
 * one rule the palette is built on. So these are all mixes of the metal with
 * a little of an existing token, which reads as anodising rather than paint.
 */
const TINT_BY_SLOT: Record<SlotId, string> = {
  tuner: "color-mix(in srgb, var(--metal) 82%, var(--chrome-dk))",
  filter: "color-mix(in srgb, var(--metal) 74%, var(--accent-text))",
  dynamics: "color-mix(in srgb, var(--metal) 88%, var(--chrome))",
  /* NOT --signal, however much a fuzz wants to be orange. Brass means "the
     signal trace" and exactly one thing on this site is allowed to be brass
     (section 16), so the gain family separates itself by going lighter and
     steelier rather than by going warm. */
  fuzz: "color-mix(in srgb, var(--metal) 66%, var(--metal-hi))",
  drive: "color-mix(in srgb, var(--metal) 80%, var(--metal-hi))",
  eq: "color-mix(in srgb, var(--metal) 86%, var(--chrome-dk))",
  gate: "color-mix(in srgb, var(--metal) 90%, #000)",
  volume: "color-mix(in srgb, var(--metal) 84%, var(--chrome-dk))",
  modulation: "color-mix(in srgb, var(--metal) 72%, var(--accent-text))",
  delay: "color-mix(in srgb, var(--metal) 76%, var(--chrome-dk))",
  reverb: "color-mix(in srgb, var(--metal) 68%, var(--accent-text))",
}

/** A 1590B, and the 1590BB the wider layouts need. */
const STANDARD = { width: 59.5, depth: 111.5, height: 31 }
const WIDE = { width: 92, depth: 118.5, height: 34 }

/**
 * Lay the knobs out.
 *
 * One row for up to three, two rows above that, because that is how the boxes
 * are actually built: you cannot fit four 20mm knobs across 59.5mm of a 1590B,
 * which is exactly why four-knob pedals come in the wider enclosure.
 */
function layOutKnobs(count: number, width: number, depth: number): Knob[] {
  if (count <= 0) return []

  /*
   * Sized so they do not touch, which the first pass got wrong.
   *
   * `span` below is the span of CENTRES, so the check is that the step between
   * centres exceeds one diameter. At radius 9 on a 59.5mm box the three
   * centres came out 15.75mm apart carrying 18mm knobs, and the row rendered
   * as one lump. Real 1590B knobs are around 14mm across for exactly this
   * reason: the box is only 59.5mm wide.
   */
  const radius = count >= 5 ? 5.5 : 7
  const height = count >= 5 ? 8 : 11
  const rows = count <= 3 ? 1 : 2
  const perRow = Math.ceil(count / rows)

  /* The controls live in the back half; the front half belongs to the
     footswitch and the foot that lands on it. */
  const backEdge = -depth / 2
  const rowGap = 26

  const knobs: Knob[] = []
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow)
    const inRow = i % perRow
    /* The last row can be short; centre it rather than left-aligning it. */
    const rowCount = Math.min(perRow, count - row * perRow)
    const span = width - 2 * (radius + 4)
    const step = rowCount > 1 ? span / (rowCount - 1) : 0
    const x = rowCount > 1 ? -span / 2 + inRow * step : 0

    knobs.push({
      x,
      z: backEdge + 20 + row * rowGap,
      radius,
      height,
      /* Deterministic, and spread so a row does not look like a printed
         pattern: every knob is set somewhere different, as a used pedal is. */
      angle: -120 + ((i * 47) % 240),
    })
  }
  return knobs
}

/**
 * The whole box for one item.
 *
 * Pure, so the viewer can call it during render without a memo, and so a test
 * can assert that a delay is wider than a fuzz without touching the DOM.
 */
export function enclosureSpec(item: BoardItem): EnclosureSpec {
  const knobCount = KNOBS_BY_SLOT[item.slot] ?? 3
  const body = knobCount >= 4 ? WIDE : STANDARD

  const knobs = layOutKnobs(knobCount, body.width, body.depth)

  return {
    ...body,
    tint: TINT_BY_SLOT[item.slot] ?? "var(--metal)",
    knobs,
    switches: [
      {
        x: 0,
        /* Far enough forward that a boot lands on it and not on a knob, which
           is the reason the real ones sit where they sit. */
        z: body.depth / 2 - 22,
        radius: 6,
        height: 8,
      },
    ],
    jacks: [
      /* Input on the right, output on the left, looking down at the pedal
         from behind it, which is the near-universal convention. */
      { face: "right", offset: -8, radius: 6, kind: "audio" },
      { face: "left", offset: -8, radius: 6, kind: "audio" },
      { face: "back", offset: 0, radius: 4.5, kind: "power" },
    ],
    led: {
      x: 0,
      z: body.depth / 2 - 40,
      radius: 2.5,
    },
    legend: item.name,
    sublegend: item.maker,
    /* Halfway between the last row of knobs and the LED, which is the only
       clear strip on the face and is where a manufacturer prints the name. */
    legendZ: knobs.length
      ? ((knobs[knobs.length - 1].z + 14) + (body.depth / 2 - 40 - 8)) / 2
      : -6,
  }
}
