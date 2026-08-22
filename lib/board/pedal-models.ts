import type { BoardItem } from "@/lib/board/model"

/**
 * REAL PEDALS, MEASURED, ONE ENTRY EACH.
 *
 * This is the file that makes the 3D viewer show a DS-1 rather than a box the
 * size of a DS-1. `enclosure-3d.ts` derives a generic from the slot, which is
 * the right answer for a catalogue of twelve thousand instruments and the
 * wrong answer for the handful of pedals everybody can picture. Those get
 * modelled properly, here, by hand.
 *
 * WHAT "MODELLED PROPERLY" MEANS, and the Boss compact is the example that
 * proves the point. It is not a 1590B with different paint. It is 73mm wide
 * against a 1590B's 59.5, and two thirds of its top is a HINGED TREAD PLATE
 * that pivots on a pin at the back and is held by a thumbscrew at the toe,
 * with the knobs on a shelf above it. Get that one detail wrong and no
 * guitarist believes the picture, however good the shading is. Get it right
 * and the shape alone identifies the pedal from across a room.
 *
 * MILLIMETRES, MEASURED FROM THE REAL THING. The viewer scales once at the
 * end, so every number here can be checked against a pedal on a desk, and a
 * wrong one is a wrong measurement rather than a tuning preference.
 *
 * ON THE NAMES. The geometry and the colour are the manufacturer's design and
 * this site links to their products for a living, which is the same footing
 * the merchant photographs on every other page sit on. What this file
 * deliberately does NOT carry is any attempt at a logo: the silkscreen is set
 * in the site's own type, the way a parts list names a part. A drawn
 * reproduction of a brand's mark is a different act from naming the product,
 * and only one of them is needed to say which pedal this is.
 *
 * ADDING ONE. Measure it, or find the manufacturer's own published
 * dimensions. Do not eyeball it from a photograph: the whole value of this
 * file is that it is measurements rather than impressions, and a guessed
 * enclosure is the generic with extra steps.
 */

/** Body styles that need genuinely different geometry, not different numbers. */
export type BodyStyle =
  /** A folded/cast box with a flat top. Most pedals. */
  | "box"
  /** Boss compact: sloped nose, knob shelf, and a hinged tread plate. */
  | "boss-compact"
  /** A rocking treadle, as a wah or a volume pedal. */
  | "treadle"

export type KnobStyle = "dome" | "chicken-head" | "skirted" | "mini"

export type PedalModel = {
  /** Matched against the board item. See `modelFor`. */
  match: { brand: RegExp; model: RegExp }
  /** What the panel calls it. */
  name: string
  maker: string
  style: BodyStyle
  /** Millimetres. Width across, depth toward the player, height off the floor. */
  width: number
  depth: number
  height: number
  /** Body colour, as a literal because it is the manufacturer's, not ours. */
  color: string
  /** Ink on the body. */
  ink: string
  knobs: ModelKnob[]
  /** Where the footswitch sits, mm from the middle. */
  footswitch: { x: number; z: number; radius: number } | null
  led: { x: number; z: number; color: string } | null
  /** Lines printed on the face, top to bottom, with their z in mm. */
  legends: { text: string; z: number; size: number }[]
  /** Only for boss-compact: the hinged plate that covers the front. */
  treadPlate?: { depth: number; hingeZ: number; thumbscrew: boolean }
  /** A sentence about what the shape tells you, shown beside the model. */
  note: string
}

export type ModelKnob = {
  x: number
  z: number
  radius: number
  height: number
  style: KnobStyle
  /** Printed under or beside it. */
  label: string
  /** Resting position, degrees, so a board of them does not look printed. */
  angle: number
  color?: string
}

/* --------------------------------------------------------------------- */

/**
 * A Boss DS-1 Distortion, in the Boss compact enclosure.
 *
 * 73 x 129 x 59mm over the whole pedal. The tread plate hinges at the BACK,
 * near the knob shelf, and swings up from the toe, which is the opposite of a
 * wah and the reason the thumbscrew is at the front: undo it and the plate
 * lifts to reach the battery.
 */
const BOSS_DS1: PedalModel = {
  match: { brand: /^boss$/i, model: /\bds-?1\b/i },
  name: "DS-1 Distortion",
  maker: "Boss",
  style: "boss-compact",
  width: 73,
  depth: 129,
  height: 59,
  /* The vermillion orange. */
  color: "#ef7215",
  ink: "#1a1a1a",
  knobs: [
    { x: -22, z: -44, radius: 8.5, height: 14, style: "skirted", label: "Tone", angle: -30 },
    { x: 0, z: -50, radius: 8.5, height: 14, style: "skirted", label: "Level", angle: 40 },
    { x: 22, z: -44, radius: 8.5, height: 14, style: "skirted", label: "Dist", angle: 95 },
  ],
  /* Kept for the record even though the viewer draws no button on a Boss
     compact: the plate is the switch. See the note in pedal-viewer-3d. */
  footswitch: { x: 0, z: 34, radius: 11 },
  led: { x: 0, z: -61, color: "#ff2b2b" },
  /* Both on the rear shelf, which runs from the back edge to the hinge at
     z = -12. Anything printed forward of that lands on the tread plate, which
     on a real one is blank. */
  legends: [
    { text: "DS-1", z: -22, size: 8 },
    { text: "Distortion", z: -15, size: 4.5 },
  ],
  treadPlate: { depth: 78, hingeZ: -12, thumbscrew: true },
  note: "The Boss compact is its own casting, not a 1590B: wider, with a sloped nose and a hinged tread plate that pivots at the back so the toe lifts for the battery.",
}

/**
 * An MXR-style micro, which is the 1590B everybody pictures when they say
 * "pedal": 66 x 111 x 38mm, two knobs, one switch, and nothing else.
 */
const MXR_MICRO: PedalModel = {
  match: { brand: /^(mxr|dunlop)$/i, model: /\b(phase\s*90|micro|m101|m290)\b/i },
  name: "Phase 90",
  maker: "MXR",
  style: "box",
  width: 66,
  depth: 111,
  height: 38,
  color: "#f47b20",
  ink: "#1c1c1c",
  knobs: [{ x: 0, z: -28, radius: 11, height: 15, style: "chicken-head", label: "Speed", angle: -55 }],
  /* An MXR switch cap is about 12mm across, not 20. */
  footswitch: { x: 0, z: 34, radius: 6.5 },
  led: { x: 0, z: -48, color: "#ff4d2b" },
  legends: [{ text: "Phase 90", z: 8, size: 6 }],
  note: "The 1590B: 66 by 111mm of folded aluminium, and the shape most people mean by the word pedal.",
}

/**
 * A TC Electronic Hall of Fame Mini. The interesting thing about it is how
 * SMALL it is: 48 x 93 x 48mm, one knob, and the whole top is footswitch.
 */
const TC_HOF_MINI: PedalModel = {
  match: { brand: /^tc\s*electronic$/i, model: /\bhall\s*of\s*fame\b.*\bmini\b|\bhof\b.*\bmini\b/i },
  name: "Hall of Fame Mini",
  maker: "TC Electronic",
  style: "box",
  width: 48,
  depth: 93,
  height: 48,
  /* The pale seafoam the Mini shipped in. */
  color: "#7fd4c4",
  ink: "#14322c",
  knobs: [{ x: 0, z: -26, radius: 9, height: 13, style: "dome", label: "Decay", angle: 15 }],
  footswitch: { x: 0, z: 26, radius: 6.5 },
  led: { x: 0, z: -42, color: "#3ad46a" },
  legends: [{ text: "Hall of Fame", z: 6, size: 4 }],
  note: "A mini enclosure, 48mm across. Almost the whole top face is switch, which is why the single knob sits so high on it.",
}

/**
 * An Electro-Harmonix Big Muff, in the modern compact housing rather than the
 * original tank: 89 x 117 x 54mm, three knobs across the top.
 */
const EHX_BIG_MUFF: PedalModel = {
  match: { brand: /^electro-?harmonix$/i, model: /\bbig\s*muff\b/i },
  name: "Big Muff Pi",
  maker: "Electro-Harmonix",
  style: "box",
  width: 89,
  depth: 117,
  height: 54,
  color: "#d8d5cc",
  ink: "#1a1a1a",
  knobs: [
    { x: -27, z: -36, radius: 10, height: 15, style: "skirted", label: "Volume", angle: -20 },
    { x: 0, z: -36, radius: 10, height: 15, style: "skirted", label: "Tone", angle: 50 },
    { x: 27, z: -36, radius: 10, height: 15, style: "skirted", label: "Sustain", angle: 110 },
  ],
  footswitch: { x: 0, z: 38, radius: 7 },
  led: { x: 0, z: -52, color: "#ff2b2b" },
  legends: [{ text: "Big Muff Pi", z: 4, size: 5.5 }],
  note: "Wider than most at 89mm, because three full-size knobs have to sit in a row across the top.",
}

/**
 * An Ibanez Tube Screamer, TS9 housing: 75 x 124 x 53mm, the sloped Ibanez
 * body with three knobs on the shelf above a full-width switch plate.
 */
const IBANEZ_TS9: PedalModel = {
  match: { brand: /^ibanez$/i, model: /\b(ts-?9|ts-?808|tube\s*screamer)\b/i },
  name: "TS9 Tube Screamer",
  maker: "Ibanez",
  style: "boss-compact",
  width: 75,
  depth: 124,
  height: 53,
  color: "#2f8f3f",
  ink: "#f4f4f0",
  knobs: [
    { x: -23, z: -42, radius: 8, height: 13, style: "skirted", label: "Drive", angle: -25 },
    { x: 0, z: -48, radius: 8, height: 13, style: "skirted", label: "Tone", angle: 30 },
    { x: 23, z: -42, radius: 8, height: 13, style: "skirted", label: "Level", angle: 85 },
  ],
  footswitch: { x: 0, z: 32, radius: 11 },
  led: { x: 0, z: -58, color: "#ff3b1f" },
  legends: [{ text: "TS9", z: -20, size: 7 }],
  treadPlate: { depth: 74, hingeZ: -10, thumbscrew: false },
  note: "Ibanez borrowed the hinged-plate idea, so the TS9 shares the Boss silhouette: knobs on a shelf, plate over the front.",
}

/** Every pedal modelled by hand, most specific first. */
export const PEDAL_MODELS: PedalModel[] = [
  BOSS_DS1,
  IBANEZ_TS9,
  EHX_BIG_MUFF,
  TC_HOF_MINI,
  MXR_MICRO,
]

/**
 * Find the hand-modelled pedal for a board item, if there is one.
 *
 * BRAND AND MODEL BOTH, and brand first, which is the same rule as
 * `matchGuideEntry`, `creditsForGear` and `isTreadle`. "Phase 90" under MXR is
 * a Phase 90; "Phase 90" in somebody's title for a clone is not, and showing a
 * shopper a confident MXR on a page where they are about to buy something else
 * is exactly the failure those other matchers are scoped to avoid.
 *
 * NO MATCH IS THE COMMON CASE and it is not a failure: the viewer falls back
 * to the derived generic in `enclosure-3d.ts`, which is honest about being
 * one. Only the handful of pedals worth measuring are in here.
 */
export function modelFor(item: BoardItem): PedalModel | null {
  const brand = (item.maker ?? "").trim()
  const model = item.name.trim()
  if (!brand || !model) return null

  return (
    PEDAL_MODELS.find((entry) => entry.match.brand.test(brand) && entry.match.model.test(model)) ??
    null
  )
}

/* --------------------------------------------------------------------- */
/*  The fallback, so there is only ever ONE renderer                      */
/* --------------------------------------------------------------------- */

/**
 * Turn the slot-derived generic into the same shape a measured pedal has.
 *
 * ONE RENDERER, TWO SOURCES OF NUMBERS. `enclosure-3d.ts` already derives a
 * fair box (and a treadle) for any item from its slot; this adapts that into a
 * `PedalModel` so the three.js viewer never needs a second code path. Section
 * 7's "never fork the logic" applied to geometry: the alternative is a
 * measured renderer and a generic renderer that drift, and the drift shows up
 * as two pedals on one board lit differently.
 *
 * IT STAYS HONEST ABOUT WHICH IT IS. The `note` says so in words, the viewer
 * prints it, and the colour comes from the site's palette rather than from a
 * manufacturer, because a generic in somebody's brand colour is a claim the
 * generic has not earned.
 */
export function genericModel(item: BoardItem, spec: GenericSpec): PedalModel {
  return {
    match: { brand: /$^/, model: /$^/ },
    name: item.name,
    maker: item.maker ?? "",
    style: spec.shape === "treadle" ? "treadle" : "box",
    width: spec.width,
    depth: spec.depth,
    height: spec.height,
    /* Deliberately the site's metal, not a guess at the real finish. */
    color: "#1d3563",
    ink: "#dfe6f2",
    knobs: spec.knobs.map((knob) => ({
      x: knob.x,
      z: knob.z,
      radius: knob.radius,
      height: knob.height,
      style: "dome" as const,
      /* Unlabelled on purpose. We know how many controls this KIND of pedal
         carries and nothing about what any of them does, and inventing
         "Tone" under a knob is the same class of lie as inventing a price. */
      label: "",
      angle: knob.angle,
    })),
    footswitch: spec.switches[0]
      ? { x: spec.switches[0].x, z: spec.switches[0].z, radius: spec.switches[0].radius }
      : null,
    led: { x: spec.led.x, z: spec.led.z, color: "#24e07a" },
    legends: [
      { text: item.name, z: spec.legendZ, size: 5 },
      ...(item.maker ? [{ text: item.maker, z: spec.legendZ + 7, size: 3 }] : []),
    ],
    note: "Not this pedal: a representative enclosure of its kind, sized from the slot rather than measured. The photograph beside it is the real one.",
  }
}

/** The shape `enclosureSpec()` returns, named here to avoid a circular import. */
export type GenericSpec = {
  shape: "box" | "treadle"
  width: number
  depth: number
  height: number
  legendZ: number
  knobs: { x: number; z: number; radius: number; height: number; angle: number }[]
  switches: { x: number; z: number; radius: number }[]
  led: { x: number; z: number }
}
