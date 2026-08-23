import { ENCLOSURES } from "@/lib/pedalboard/catalog/enclosures"
import type { EnclosureId } from "@/lib/pedalboard/catalog/types"
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
 *
 * BETTER STILL, DO NOT TYPE THE DIMENSIONS AT ALL. Most pedals here are built
 * in a standard box that the planner's catalogue already names and measures,
 * with a provenance marker on every figure. `enc()` below reads that table, so
 * a pedal in a known enclosure takes the same numbers the layout engine uses
 * and cannot disagree with it.
 *
 * THAT IS NOT TIDINESS: THE TWO TABLES HAD ALREADY DRIFTED. Hand-typed, the
 * Big Muff came out 89mm wide and the Small Stone 145, which is the two of
 * them swapped. The Big Muff is the famous board hog and it rendered as the
 * narrow one, and nothing failed, because nothing was comparing the two files.
 * `tests/board/pedal-models.test.ts` compares them now.
 */

/**
 * The dimensions of a standard enclosure, from the planner's own table.
 *
 * Millimetres, and the source of each figure is recorded beside it in
 * `lib/pedalboard/catalog/enclosures.ts` as `maker` or `enclosure`. A pedal
 * with no standard box (a Klon, a Fuzz Face, a Deluxe Memory Man) still gets
 * hand-measured numbers, and says so where it is defined.
 */
function enc(id: EnclosureId): { width: number; depth: number; height: number } {
  const { widthMm, depthMm, heightMm } = ENCLOSURES[id].dims
  return { width: widthMm, depth: depthMm, height: heightMm }
}

/** Body styles that need genuinely different geometry, not different numbers. */
export type BodyStyle =
  /** A folded/cast box with a flat top. Most pedals. */
  | "box"
  /** Boss compact: sloped nose, knob shelf, and a hinged tread plate. */
  | "boss-compact"
  /** A rocking treadle, as a wah or a volume pedal. */
  | "treadle"
  /** A Fuzz Face: a shallow dome on a circular base, not a box at all. */
  | "round"

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
  /**
   * Only for treadle: the rocking plate and the fixed cheeks either side.
   *
   * CARRIED ON THE MODEL rather than looked up, because the renderer takes a
   * PedalModel and nothing else. Leaving it off is what broke the wah when the
   * viewer moved to three.js: `style` still said "treadle", the renderer had
   * no branch for it, and a Cry Baby quietly came out as a plain box.
   */
  treadle?: {
    plateWidth: number
    plateDepth: number
    plateThickness: number
    pivotZ: number
    pivotY: number
    tilt: number
    cheekHeelHeight: number
    cheekToeHeight: number
  }
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
  ...enc("boss-compact"),
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
  match: { brand: /^(mxr|dunlop)$/i, model: /\bphase\s*90\b|\bm101\b/i },
  name: "Phase 90",
  maker: "MXR",
  style: "box",
  ...enc("mxr-compact"),
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
  ...enc("mxr-mini"),
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
  match: { brand: /^electro-?harmonix$/i, model: /^(?!.*\b(nano|mini|little|op-?amp)\b).*\bbig\s*muff\b/i },
  name: "Big Muff Pi",
  maker: "Electro-Harmonix",
  style: "box",
  ...enc("ehx-large"),
  color: "#d8d5cc",
  ink: "#1a1a1a",
  knobs: [
    { x: -46, z: -34, radius: 12, height: 16, style: "skirted", label: "Volume", angle: -20 },
    { x: 0, z: -34, radius: 12, height: 16, style: "skirted", label: "Tone", angle: 50 },
    { x: 46, z: -34, radius: 12, height: 16, style: "skirted", label: "Sustain", angle: 110 },
  ],
  footswitch: { x: 0, z: 38, radius: 7 },
  led: { x: -56, z: 20, color: "#ff2b2b" },
  legends: [{ text: "Big Muff Pi", z: 6, size: 10 }],
  note: "146mm across, which is why it is called the board hog: three full-size knobs sit in a row with room to spare, and it takes the width of two ordinary pedals.",
}

/**
 * An Ibanez Tube Screamer, TS9 housing: 75 x 124 x 53mm, the sloped Ibanez
 * body with three knobs on the shelf above a full-width switch plate.
 */
const IBANEZ_TS9: PedalModel = {
  match: {
    brand: /^ibanez$/i,
    /*
     * THE TS9 AND THE BARE FAMILY NAME, and nothing else in the family.
     *
     * This used to read `ts-?9|ts-?808|tube screamer`, which handed the TS9's
     * body and the TS9's silkscreen to a Tube Screamer Mini: a different, much
     * smaller enclosure, rendered confidently as a pedal it is not. The 808 is
     * the same casting in a different finish, so it is a colour we have not
     * checked rather than a shape we have, and it falls to the honest generic
     * until somebody does.
     *
     * The unqualified "Tube Screamer" is deliberately kept, anchored. The
     * guide's entry is about the circuit rather than one revision, the TS9 is
     * what that circuit is drawn as everywhere, and the face still prints TS9,
     * so a reader is shown a real product under its own name.
     */
    model: /\bts-?9\b|^tube\s*screamer$/i,
  },
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


/**
 * A Dunlop Fuzz Face, and it is the reason `round` exists as a body style.
 *
 * Not a box: a 111mm circular casting with a domed lid, two knobs and the
 * switch between them, famously said to have started as a microphone stand
 * base. Nothing about a rectangular enclosure reads as one, so the renderer
 * gets a branch rather than a squashed cylinder.
 */
const DUNLOP_FUZZ_FACE: PedalModel = {
  match: {
    /* "Dallas Arbiter" is what the guide calls it and what the reissues say on
       the box, so an `arbiter`-only pattern matched nothing at all. */
    brand: /^(jim\s*)?dunlop$|arbiter$/i,
    model: /\bfuzz\s*face\b/i,
  },
  name: "Fuzz Face",
  maker: "Dunlop",
  style: "round",
  /* Width and depth are the diameter; height is the dome at its centre. */
  width: 111,
  depth: 111,
  height: 55,
  color: "#0f3f8f",
  ink: "#f0f0ee",
  knobs: [
    { x: -28, z: -22, radius: 10, height: 14, style: "skirted", label: "Volume", angle: -35 },
    { x: 28, z: -22, radius: 10, height: 14, style: "skirted", label: "Fuzz", angle: 75 },
  ],
  footswitch: { x: 0, z: 26, radius: 11 },
  led: null,
  legends: [{ text: "Fuzz Face", z: 2, size: 6 }],
  note: "A 111mm circular casting with a domed lid, which is why it sits on a board like nothing else. The original had no indicator at all, and this one does not either.",
}

/**
 * A ProCo RAT: 124 x 92 x 51mm of flat black box, wider than it is deep,
 * with three big knobs in a row and the name in a script across the front.
 */
const PROCO_RAT: PedalModel = {
  match: { brand: /^pro-?co$/i, model: /\brat\b(?!\s*2)/i },
  name: "RAT",
  maker: "ProCo",
  style: "box",
  width: 124,
  depth: 92,
  height: 51,
  color: "#141414",
  ink: "#efefef",
  knobs: [
    { x: -38, z: -22, radius: 12, height: 16, style: "skirted", label: "Distortion", angle: -40 },
    { x: 0, z: -22, radius: 12, height: 16, style: "skirted", label: "Filter", angle: 20 },
    { x: 38, z: -22, radius: 12, height: 16, style: "skirted", label: "Volume", angle: 70 },
  ],
  footswitch: { x: 0, z: 26, radius: 8 },
  led: { x: -48, z: 6, color: "#ff2b2b" },
  legends: [{ text: "RAT", z: 8, size: 11 }],
  note: "Wider than it is deep, which is unusual and is why a RAT sits sideways on most boards. Three big knobs in a row and very little else.",
}

/**
 * A RAT 2, which is the same box with a 2 after the name.
 *
 * Spread from the RAT for the same reason the DD-2 is spread from the DD-3:
 * the casting genuinely is shared and the print genuinely is not, and a
 * pattern loose enough to catch both would have to print one of them wrong.
 */
const PROCO_RAT2: PedalModel = {
  ...PROCO_RAT,
  match: { brand: /^pro-?co$/i, model: /\brat\s*2\b/i },
  name: "RAT 2",
  legends: [{ text: "RAT 2", z: 8, size: 11 }],
}

/**
 * A Klon Centaur: 121 x 95 x 39mm, gold, three knobs. The horse is not drawn,
 * for the same reason no logo on this site is.
 */
const KLON_CENTAUR: PedalModel = {
  match: { brand: /^klon$/i, model: /\bcentaur\b|\bktr\b/i },
  name: "Centaur",
  maker: "Klon",
  style: "box",
  width: 121,
  depth: 95,
  height: 39,
  color: "#c9a227",
  ink: "#241d05",
  knobs: [
    { x: -36, z: -24, radius: 10, height: 14, style: "skirted", label: "Gain", angle: -30 },
    { x: 0, z: -24, radius: 10, height: 14, style: "skirted", label: "Treble", angle: 25 },
    { x: 36, z: -24, radius: 10, height: 14, style: "skirted", label: "Output", angle: 80 },
  ],
  footswitch: { x: 0, z: 28, radius: 8 },
  led: { x: 0, z: -42, color: "#ff6a1f" },
  legends: [{ text: "Centaur", z: 6, size: 7 }],
  note: "A wide, low gold box. The horse on the real one is a drawing we deliberately do not reproduce; the shape and the finish are what identify it here.",
}

/** An MXR Dyna Comp: the 1590B again, two knobs, in the familiar red. */
const MXR_DYNA_COMP: PedalModel = {
  match: { brand: /^(mxr|dunlop)$/i, model: /\bdyna\s*comp\b|\bm102\b/i },
  name: "Dyna Comp",
  maker: "MXR",
  style: "box",
  ...enc("mxr-compact"),
  color: "#c0182a",
  ink: "#f2f2f2",
  knobs: [
    { x: -16, z: -30, radius: 9, height: 13, style: "skirted", label: "Output", angle: -30 },
    { x: 16, z: -30, radius: 9, height: 13, style: "skirted", label: "Sensitivity", angle: 55 },
  ],
  footswitch: { x: 0, z: 34, radius: 6.5 },
  led: { x: 0, z: -48, color: "#ff4d2b" },
  legends: [{ text: "Dyna Comp", z: 8, size: 5.5 }],
  note: "The same 1590B as a Phase 90 in a different colour, which is exactly why MXR could ship so many pedals so fast.",
}

/**
 * An Electro-Harmonix Small Stone, in the big EHX chassis: 145 x 95 x 55mm,
 * one knob and a colour switch, and far larger than people remember.
 */
const EHX_SMALL_STONE: PedalModel = {
  match: { brand: /^electro-?harmonix$/i, model: /\bsmall\s*stone\b/i },
  name: "Small Stone",
  maker: "Electro-Harmonix",
  style: "box",
  ...enc("ehx-xo"),
  color: "#1d1d1f",
  ink: "#e8e8e6",
  knobs: [{ x: 24, z: -38, radius: 11, height: 15, style: "skirted", label: "Rate", angle: -20 }],
  footswitch: { x: -22, z: 34, radius: 9 },
  /* Beside the switch, which is where the reissue puts it, and clear of the
     one label on the face: at x = 24 it sat directly under the word RATE. */
  led: { x: -22, z: 22, color: "#ff2b2b" },
  legends: [{ text: "Small Stone", z: 4, size: 8 }],
  note: "The XO box: 89mm across, one knob for rate and a colour switch, and nothing else on the face at all.",
}

/**
 * An Electro-Harmonix Deluxe Memory Man: 190 x 120 x 60mm, five knobs, and
 * genuinely the largest thing most people put on a board.
 */
const EHX_MEMORY_MAN: PedalModel = {
  match: { brand: /^electro-?harmonix$/i, model: /\bmemory\s*man\b/i },
  name: "Deluxe Memory Man",
  maker: "Electro-Harmonix",
  style: "box",
  width: 190,
  depth: 120,
  height: 60,
  color: "#c9ccd1",
  ink: "#17171a",
  knobs: [
    { x: -68, z: -34, radius: 10, height: 14, style: "skirted", label: "Level", angle: -35 },
    { x: -34, z: -34, radius: 10, height: 14, style: "skirted", label: "Blend", angle: 10 },
    { x: 0, z: -34, radius: 10, height: 14, style: "skirted", label: "Feedback", angle: 45 },
    { x: 34, z: -34, radius: 10, height: 14, style: "skirted", label: "Delay", angle: 80 },
    { x: 68, z: -34, radius: 10, height: 14, style: "skirted", label: "Depth", angle: 115 },
  ],
  footswitch: { x: 0, z: 40, radius: 9 },
  led: { x: 0, z: -52, color: "#ff2b2b" },
  legends: [{ text: "Deluxe Memory Man", z: -8, size: 7 }],
  note: "190mm across and five knobs in a row: the biggest thing most players ever put on a board, and the reason its power supply is its own problem.",
}

/** A Boss DD-3 Digital Delay: the compact again, four knobs on the shelf. */
const BOSS_DD: PedalModel = {
  match: { brand: /^boss$/i, model: /\bdd-?3\b/i },
  name: "DD-3 Digital Delay",
  maker: "Boss",
  style: "boss-compact",
  ...enc("boss-compact"),
  color: "#f0f4f7",
  ink: "#16161a",
  knobs: [
    { x: -24, z: -46, radius: 7.5, height: 13, style: "skirted", label: "E.Level", angle: -30 },
    { x: 0, z: -52, radius: 7.5, height: 13, style: "skirted", label: "F.Back", angle: 25 },
    { x: 24, z: -46, radius: 7.5, height: 13, style: "skirted", label: "Time", angle: 85 },
  ],
  footswitch: { x: 0, z: 34, radius: 11 },
  led: { x: 0, z: -61, color: "#ff2b2b" },
  legends: [
    { text: "DD-3", z: -22, size: 8 },
    { text: "Digital Delay", z: -15, size: 4.2 },
  ],
  treadPlate: { depth: 78, hingeZ: -12, thumbscrew: true },
  note: "The same Boss casting as a DS-1. The whole compact line shares it, which is why a board of Boss pedals lines up so neatly.",
}

/**
 * A Boss DD-2, which is the same pedal as the DD-3 with a different number on
 * it and is in the guide by name.
 *
 * A SEPARATE ENTRY RATHER THAN A WIDER REGEX, and that is the whole point.
 * `DD_3`'s pattern used to read `dd-?[238]|digital delay`, so a DD-2 got the
 * DD-3's model and the DD-3's silkscreen: a confident render of a product the
 * shopper is not looking at, printed with the wrong model number. The casting
 * really is shared, so the geometry is spread from the DD-3; what is NOT
 * shared is the print, so that is restated. Same rule as `matchGuideEntry`:
 * when a pattern would have to lie to match, narrow the pattern.
 */
const BOSS_DD2: PedalModel = {
  ...BOSS_DD,
  match: { brand: /^boss$/i, model: /\bdd-?2\b/i },
  name: "DD-2 Digital Delay",
  legends: [
    { text: "DD-2", z: -22, size: 8 },
    { text: "Digital Delay", z: -15, size: 4.2 },
  ],
  note: "The first digital delay in a compact pedal, in the Boss casting every one of them uses. Identical to a DD-3 from the outside apart from the number.",
}

/** A Boss CE-2 Chorus. Same casting, two knobs, the pale blue. */
const BOSS_CE: PedalModel = {
  match: { brand: /^boss$/i, model: /\bce-?2\b/i },
  name: "CE-2 Chorus",
  maker: "Boss",
  style: "boss-compact",
  ...enc("boss-compact"),
  color: "#6fa8dc",
  ink: "#14202e",
  knobs: [
    { x: -18, z: -48, radius: 8, height: 13, style: "skirted", label: "Rate", angle: -25 },
    { x: 18, z: -48, radius: 8, height: 13, style: "skirted", label: "Depth", angle: 60 },
  ],
  footswitch: { x: 0, z: 34, radius: 11 },
  led: { x: 0, z: -61, color: "#ff2b2b" },
  legends: [
    { text: "CE-2", z: -24, size: 8 },
    { text: "Chorus", z: -16, size: 4.5 },
  ],
  treadPlate: { depth: 78, hingeZ: -12, thumbscrew: true },
  note: "The Boss compact casting once more, in the pale blue the chorus pedals have always worn.",
}

/** A Boss BD-2 Blues Driver, since it is all over the catalogue. */
const BOSS_BD2: PedalModel = {
  match: { brand: /^boss$/i, model: /\bbd-?2\b|\bblues\s*driver\b/i },
  name: "BD-2 Blues Driver",
  maker: "Boss",
  style: "boss-compact",
  ...enc("boss-compact"),
  color: "#3f6fd8",
  ink: "#f2f4f8",
  knobs: [
    { x: -22, z: -44, radius: 8.5, height: 14, style: "skirted", label: "Level", angle: -30 },
    { x: 0, z: -50, radius: 8.5, height: 14, style: "skirted", label: "Tone", angle: 35 },
    { x: 22, z: -44, radius: 8.5, height: 14, style: "skirted", label: "Gain", angle: 90 },
  ],
  footswitch: { x: 0, z: 34, radius: 11 },
  led: { x: 0, z: -61, color: "#ff2b2b" },
  legends: [
    { text: "BD-2", z: -22, size: 8 },
    { text: "Blues Driver", z: -15, size: 4.2 },
  ],
  treadPlate: { depth: 78, hingeZ: -12, thumbscrew: true },
  note: "Boss compact again. Three knobs and the blue that has meant this circuit since 1995.",
}

/**
 * A Dunlop Cry Baby, MEASURED rather than derived.
 *
 * The slot-derived generic already produces a fair treadle for anything the
 * name test catches, and this exists so the most recognisable one is right:
 * 100 x 254mm on the floor, 63mm at the heel, with the plate at rest toe up.
 */
const DUNLOP_CRY_BABY: PedalModel = {
  match: { brand: /^(dunlop|jim\s*dunlop)$/i, model: /\bcry\s*baby\b/i },
  name: "Cry Baby",
  maker: "Dunlop",
  style: "treadle",
  ...enc("wah-treadle"),
  /* The table's 64mm is the pedal standing at rest, plate and all. The CHASSIS
     the plate rocks on is much shallower, and that is what `height` means
     everywhere else in this file, so it is the one figure not taken from the
     table. `tests/board/pedal-models.test.ts` exempts a treadle's height for
     exactly this reason and holds the footprint to the table regardless. */
  height: 26,
  color: "#17171a",
  ink: "#e6e6e6",
  knobs: [],
  footswitch: null,
  led: null,
  legends: [{ text: "Cry Baby", z: 112, size: 9 }],
  treadle: {
    plateWidth: 86,
    plateDepth: 218,
    plateThickness: 12,
    pivotZ: 18,
    pivotY: 30,
    tilt: 9,
    cheekHeelHeight: 37,
    cheekToeHeight: 10,
  },
  note: "A treadle, not a box: a shallow chassis with two fixed cheeks and a plate that rocks between them, toe up at rest because the switch under the toe is what turns it on.",
}

/* --------------------------------------------------------------------- */
/*  Two factories, because most of a family is one casting in a colour     */
/* --------------------------------------------------------------------- */

/**
 * Knobs in a row across a face of a given width, laid out rather than typed.
 *
 * WHY THIS IS A FUNCTION. The knob-overlap test exists because the very first
 * hand-typed row put three 18mm knobs 15.75mm apart and rendered them as one
 * lump. Every family below shares a face, so every family would repeat that
 * arithmetic once per pedal and get one wrong eventually. Derived from the
 * count, it cannot collide: the pitch is the usable width divided by the
 * count, and the radius is a fraction of the pitch.
 *
 * The row arcs BACK at the middle on odd counts, the way a real three-knob
 * face does, so the outer two clear the sloped nose.
 */
function knobRow(
  labels: string[],
  opts: { faceWidth: number; z: number; arc?: number; style?: KnobStyle; radius?: number },
): ModelKnob[] {
  const usable = opts.faceWidth * 0.9
  const pitch = labels.length > 1 ? usable / labels.length : 0
  const radius = opts.radius ?? Math.min(11, pitch * 0.39)
  const arc = opts.arc ?? 0
  const mid = (labels.length - 1) / 2

  return labels.map((label, i) => ({
    x: (i - mid) * pitch,
    /* Deeper in the middle, so a three-knob row sits in an arc. */
    z: opts.z - (mid === 0 ? 0 : arc * (1 - Math.abs(i - mid) / mid)),
    radius,
    height: radius * 1.5,
    style: opts.style ?? ("skirted" as const),
    label,
    /* Spread the pointers so a row is not five knobs at the same setting,
       and deterministic so a render is reproducible. */
    angle: -35 + i * 47,
  }))
}

/**
 * A Boss compact in a colour, with its own print and its own controls.
 *
 * THE CASTING IS THE SAME PEDAL EVERY TIME and has been since 1977: 73mm
 * wide, sloped nose, knobs on a rear shelf, and a hinged tread plate that is
 * the switch. What actually differs between a DS-1 and a TR-2 is the paint,
 * the number of knobs and what is printed on the shelf, so those are the only
 * things a caller gives.
 *
 * The DS-1, TS9-housing and DD-3 above are written out longhand because each
 * carries a detail this does not cover; everything routed through here is the
 * plain case.
 */
function bossCompact(spec: {
  model: RegExp
  name: string
  color: string
  ink?: string
  controls: string[]
  print: [string, string]
  note: string
}): PedalModel {
  const ink = spec.ink ?? "#1a1a1a"
  return {
    match: { brand: /^boss$/i, model: spec.model },
    name: spec.name,
    maker: "Boss",
    style: "boss-compact",
    ...enc("boss-compact"),
    color: spec.color,
    ink,
    /* The shelf runs from the back edge to the hinge, so the knobs sit on it
       and the print sits in front of them, clear of both. */
    knobs: knobRow(spec.controls, { faceWidth: 73, z: -45, arc: 6, radius: 7.5 }),
    footswitch: { x: 0, z: 34, radius: 11 },
    led: { x: 0, z: -61, color: "#ff2b2b" },
    legends: [
      { text: spec.print[0], z: -23, size: 8 },
      { text: spec.print[1], z: -15.5, size: 4.2 },
    ],
    treadPlate: { depth: 78, hingeZ: -12, thumbscrew: true },
    note: spec.note,
  }
}

/** An MXR compact: the folded box, one to three knobs, a small switch cap. */
function mxrCompact(spec: {
  model: RegExp
  name: string
  color: string
  ink: string
  controls: string[]
  print: string
  printSize?: number
  note: string
}): PedalModel {
  return {
    match: { brand: /^(mxr|dunlop)$/i, model: spec.model },
    name: spec.name,
    maker: "MXR",
    style: "box",
    ...enc("mxr-compact"),
    color: spec.color,
    ink: spec.ink,
    knobs: knobRow(spec.controls, { faceWidth: 60, z: -30, arc: 4 }),
    footswitch: { x: 0, z: 34, radius: 6.5 },
    led: { x: 0, z: -48, color: "#ff4d2b" },
    legends: [{ text: spec.print, z: 8, size: spec.printSize ?? 6 }],
    note: spec.note,
  }
}

/* --------------------------------------------------------------------- */
/*  The rest of the Boss compact line                                     */
/* --------------------------------------------------------------------- */

/*
 * COLOUR IS THE MODEL NUMBER on a Boss board, which is the whole reason these
 * are worth separate entries when the casting is identical. A player picks the
 * yellow one out of a row of eight without reading a word on it.
 */
const BOSS_SD1 = bossCompact({
  model: /\bsd-?1\b|\bsuper\s*overdrive\b/i,
  name: "SD-1 Super Overdrive",
  color: "#f2c318",
  controls: ["Level", "Tone", "Drive"],
  print: ["SD-1", "Super OverDrive"],
  note: "The yellow one. An asymmetric-clipping cousin of the Tube Screamer in the Boss casting, and one of the most common pedals on any board anywhere.",
})

const BOSS_CH1 = bossCompact({
  model: /\bch-?1\b|\bsuper\s*chorus\b/i,
  name: "CH-1 Super Chorus",
  color: "#8ec6ec",
  ink: "#14202e",
  controls: ["E.Level", "EQ", "Rate", "Depth"],
  print: ["CH-1", "Super Chorus"],
  note: "Four knobs on the shelf rather than three, which is as many as the Boss casting takes across, and the pale blue every Boss chorus has worn.",
})

const BOSS_BF2 = bossCompact({
  model: /\bbf-?2\b/i,
  name: "BF-2 Flanger",
  color: "#6a4ea8",
  controls: ["Manual", "Depth", "Rate", "Res"],
  print: ["BF-2", "Flanger"],
  note: "The purple one, and an analogue bucket-brigade flanger rather than a digital one, which is why it still turns up on boards forty years on.",
})

const BOSS_TR2 = bossCompact({
  model: /\btr-?2\b/i,
  name: "TR-2 Tremolo",
  color: "#93c74e",
  ink: "#17240d",
  controls: ["Rate", "Wave", "Depth"],
  print: ["TR-2", "Tremolo"],
  note: "The green one. A Wave control between the rate and the depth, which is the knob that turns a square-wave chop into something you can play under.",
})

const BOSS_CS3 = bossCompact({
  model: /\bcs-?3\b/i,
  name: "CS-3 Compression Sustainer",
  color: "#2f7fd0",
  controls: ["Level", "Tone", "Attack", "Sustain"],
  print: ["CS-3", "Compression Sustainer"],
  note: "Four knobs, and the only Boss compressor most people have used. The Tone control is there because the circuit takes the top off if you let it.",
})

const BOSS_RV6 = bossCompact({
  model: /\brv-?6\b/i,
  name: "RV-6 Reverb",
  color: "#3aa36c",
  controls: ["E.Level", "Time", "Tone", "Mode"],
  print: ["RV-6", "Reverb"],
  note: "The green reverb. Mode is a knob rather than a switch, which is how eight reverb types fit on a face with room for four controls.",
})

const BOSS_DD8 = bossCompact({
  model: /\bdd-?8\b/i,
  name: "DD-8 Digital Delay",
  color: "#cf4a90",
  controls: ["E.Level", "F.Back", "Time", "Mode"],
  print: ["DD-8", "Digital Delay"],
  note: "The current compact delay, in magenta rather than the DD-3's white. Same casting, forty years apart.",
})

/* --------------------------------------------------------------------- */
/*  The rest of the MXR compacts                                          */
/* --------------------------------------------------------------------- */

const MXR_DISTORTION_PLUS = mxrCompact({
  model: /\bdistortion\s*\+|\bdistortion\s*plus\b|\bm104\b/i,
  name: "Distortion+",
  color: "#f2d024",
  ink: "#1c1c1c",
  controls: ["Output", "Distortion"],
  print: "Distortion +",
  printSize: 5,
  note: "The yellow MXR: a germanium-clipping hard distortion with two knobs and nothing else, and the sound of a great deal of 1970s rock.",
})

/*
 * THE PEDAL THAT USED TO RENDER AS A PHASE 90. `micro` under MXR matched it,
 * so a Micro Amp came up orange with a chicken-head knob and the wrong name
 * on it. It has its own entry now, which is the honest version of that fix.
 */
const MXR_MICRO_AMP = mxrCompact({
  model: /\bmicro\s*amp\b|\bm133\b/i,
  name: "Micro Amp",
  color: "#e9e6da",
  ink: "#1c1c1c",
  controls: ["Gain"],
  print: "Micro Amp",
  note: "One knob and one job: a clean boost in the MXR box. The single control is why it is so often mistaken for a Phase 90 at a glance, and they are not the same pedal.",
})

const MXR_CARBON_COPY = mxrCompact({
  model: /\bcarbon\s*copy\b|\bm169\b/i,
  name: "Carbon Copy",
  color: "#1f6b45",
  ink: "#e8f0e9",
  controls: ["Regen", "Mix", "Delay"],
  print: "Carbon Copy",
  printSize: 5,
  note: "A genuine bucket-brigade analogue delay in the MXR box, in the dark green everybody knows. Three knobs, and the modulation is a switch rather than a control.",
})

/* --------------------------------------------------------------------- */
/*  Three more Electro-Harmonix, in the two boxes it actually ships        */
/* --------------------------------------------------------------------- */

const EHX_ELECTRIC_MISTRESS = {
  match: { brand: /^electro-?harmonix$/i, model: /\belectric\s*mistress\b/i },
  name: "Electric Mistress",
  maker: "Electro-Harmonix",
  style: "box" as const,
  ...enc("ehx-large"),
  color: "#b9bcc0",
  ink: "#17171a",
  knobs: knobRow(["Rate", "Range", "Color"], { faceWidth: 146, z: -34, arc: 5 }),
  footswitch: { x: 0, z: 38, radius: 7 },
  led: { x: 0, z: 8, color: "#ff2b2b" },
  legends: [{ text: "Electric Mistress", z: -8, size: 8 }],
  note: "The same 146mm box as a Big Muff, in brushed silver. A filter-matrix flanger with a Range control, which is the knob that parks it as a fixed comb filter.",
}

const EHX_SOUL_FOOD = {
  match: { brand: /^electro-?harmonix$/i, model: /\bsoul\s*food\b/i },
  name: "Soul Food",
  maker: "Electro-Harmonix",
  style: "box" as const,
  ...enc("ehx-nano"),
  color: "#d7d9dc",
  ink: "#17171a",
  knobs: knobRow(["Drive", "Treble", "Volume"], { faceWidth: 70, z: -32, arc: 4 }),
  footswitch: { x: 0, z: 32, radius: 8 },
  led: { x: 0, z: -50, color: "#ff2b2b" },
  legends: [{ text: "Soul Food", z: -4, size: 7 }],
  note: "The Nano box, 70mm across. A transparent overdrive in the Klon lineage at a fraction of the price, which is most of why it sold.",
}

const EHX_MICRO_POG = {
  match: { brand: /^electro-?harmonix$/i, model: /\bmicro\s*pog\b/i },
  name: "Micro POG",
  maker: "Electro-Harmonix",
  style: "box" as const,
  ...enc("ehx-xo"),
  color: "#8d9298",
  ink: "#17171a",
  knobs: knobRow(["Dry", "Sub Oct", "Oct Up"], { faceWidth: 89, z: -34, arc: 5 }),
  footswitch: { x: 0, z: 34, radius: 8 },
  led: { x: 0, z: -14, color: "#ff2b2b" },
  legends: [{ text: "Micro POG", z: 6, size: 7 }],
  note: "Polyphonic octaves in the XO box: three knobs that are really three faders, one for the dry signal and one for each octave.",
}

/* --------------------------------------------------------------------- */
/*  Two boutique boxes, and a second treadle                              */
/* --------------------------------------------------------------------- */

const EQD_PLUMES = {
  match: { brand: /^earthquaker(\s*devices)?$/i, model: /\bplumes\b/i },
  name: "Plumes",
  maker: "EarthQuaker Devices",
  style: "box" as const,
  ...enc("1590B"),
  color: "#b6a4d8",
  ink: "#1a1620",
  knobs: knobRow(["Level", "Tone", "Gain"], { faceWidth: 64, z: -32, arc: 4 }),
  footswitch: { x: 0, z: 36, radius: 8 },
  led: { x: 0, z: 10, color: "#ff4d2b" },
  legends: [{ text: "Plumes", z: -6, size: 7 }],
  note: "A Hammond 1590B, which is the box most boutique pedals are built in: 64 by 121mm, and the reason a shelf of them all take the same space on a board.",
}

const WAMPLER_TUMNUS = {
  match: { brand: /^wampler$/i, model: /\btumnus\b(?!\s*deluxe)/i },
  name: "Tumnus",
  maker: "Wampler",
  style: "box" as const,
  ...enc("1590A"),
  color: "#b99539",
  ink: "#211a08",
  /* Three knobs will not sit in a row across 39mm, so they sit as they really
     do: two at the back and one in front, which is what a mini box forces. */
  knobs: [
    { x: -9.5, z: -30, radius: 5.5, height: 8, style: "dome" as const, label: "", angle: -30 },
    { x: 9.5, z: -30, radius: 5.5, height: 8, style: "dome" as const, label: "", angle: 20 },
    { x: 0, z: -17, radius: 5.5, height: 8, style: "dome" as const, label: "", angle: 70 },
  ],
  footswitch: { x: 0, z: 28, radius: 6 },
  led: { x: 0, z: -3, color: "#ff4d2b" },
  legends: [{ text: "Tumnus", z: 10, size: 4.5 }],
  note: "A Hammond 1590A at 39mm across, which is as small as a pedal gets before the jacks stop fitting. A Klon circuit in a box a fifth of the size.",
}

/*
 * A SECOND TREADLE, which is the point of it as much as the pedal is.
 *
 * The wah body was written for one pedal, and a shape with exactly one user is
 * a shape nobody has checked. The Vox is the same enclosure class in the
 * planner's own table (`wah-treadle`), so it exercises the geometry against a
 * second set of numbers rather than proving it against itself.
 */
const VOX_WAH: PedalModel = {
  ...DUNLOP_CRY_BABY,
  match: { brand: /^vox$/i, model: /\bv8[0-9]{2}\b|\bwah\b/i },
  name: "V847 Wah",
  maker: "Vox",
  legends: [{ text: "Vox", z: 112, size: 11 }],
  note: "The other treadle everybody has stood on. Same shape as a Cry Baby and the same inductor argument, in a chassis Vox has been making since 1967.",
}

/*
 * A VOLUME PEDAL, which is a treadle with nothing in it.
 *
 * `volume-treadle` is its own row in the planner's enclosure table and it is
 * NARROWER than a wah, which is the only thing that separates them on a board.
 * No knobs, no LED, and no footswitch: the pedal has no bypass at all, because
 * heel-down IS off.
 */
const EB_VOLUME: PedalModel = {
  match: { brand: /^ernie\s*ball$/i, model: /\bvp\b|\bvolume\b/i },
  name: "VP Jr",
  maker: "Ernie Ball",
  style: "treadle",
  ...enc("volume-treadle"),
  /* The table's height is the whole pedal with the treadle standing at rest;
     the chassis under it is much shallower, and that is what the body is. */
  height: 26,
  color: "#1a1a1c",
  ink: "#e6e6e6",
  knobs: [],
  footswitch: null,
  led: null,
  legends: [{ text: "Ernie Ball", z: 112, size: 7 }],
  treadle: {
    plateWidth: 80,
    plateDepth: 218,
    plateThickness: 12,
    pivotZ: 18,
    pivotY: 30,
    tilt: 9,
    cheekHeelHeight: 37,
    cheekToeHeight: 10,
  },
  note: "A volume pedal is a treadle with a pot in it and nothing else: no knobs, no indicator, and no bypass switch, because heel down already is off.",
}

/** Every pedal modelled by hand, most specific first. */
export const PEDAL_MODELS: PedalModel[] = [
  /*
   * ORDER MATTERS: `modelFor` takes the FIRST match, so anything whose pattern
   * could also be read by a looser one above it has to come first. In practice
   * every pattern here is narrow enough that the order is documentation rather
   * than load bearing, and the tests hold it that way. Keeping it narrow is
   * the rule; relying on the order to disambiguate is not.
   */

  /* Boss compacts. One casting, thirteen paint jobs. */
  BOSS_DS1,
  BOSS_SD1,
  BOSS_DD,
  BOSS_DD2,
  BOSS_DD8,
  BOSS_CE,
  BOSS_CH1,
  BOSS_BF2,
  BOSS_TR2,
  BOSS_CS3,
  BOSS_RV6,
  BOSS_BD2,
  /* The Ibanez housing borrowed the Boss mechanism, so it sits with them. */
  IBANEZ_TS9,

  /* Electro-Harmonix, in the three boxes it actually ships. */
  EHX_BIG_MUFF,
  EHX_ELECTRIC_MISTRESS,
  EHX_SMALL_STONE,
  EHX_MICRO_POG,
  EHX_SOUL_FOOD,
  EHX_MEMORY_MAN,

  /* Treadles. Two wahs and a volume pedal, which is a treadle with nothing
     in it: the second and third users of that body, which is what stops the
     shape being a thing only one pedal has ever proved. */
  DUNLOP_CRY_BABY,
  VOX_WAH,
  EB_VOLUME,

  /* MXR's folded box, and the one round pedal on the site. */
  DUNLOP_FUZZ_FACE,
  MXR_DYNA_COMP,
  MXR_MICRO,
  MXR_MICRO_AMP,
  MXR_DISTORTION_PLUS,
  MXR_CARBON_COPY,

  /* Everything with a body of its own. */
  PROCO_RAT,
  PROCO_RAT2,
  KLON_CENTAUR,
  TC_HOF_MINI,
  EQD_PLUMES,
  WAMPLER_TUMNUS,
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
    /* Passed straight through, so a wah nobody has measured still renders as
       a treadle rather than falling back to a box. */
    ...(spec.treadle ? { treadle: spec.treadle } : {}),
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
  treadle: {
    plateWidth: number
    plateDepth: number
    plateThickness: number
    pivotZ: number
    pivotY: number
    tilt: number
    cheekHeelHeight: number
    cheekToeHeight: number
  } | null
}
