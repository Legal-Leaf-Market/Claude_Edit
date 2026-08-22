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
  match: { brand: /^(mxr|dunlop)$/i, model: /\bphase\s*90\b|\bm101\b/i },
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
  match: { brand: /^electro-?harmonix$/i, model: /^(?!.*\b(nano|mini|little|op-?amp)\b).*\bbig\s*muff\b/i },
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
  width: 66,
  depth: 111,
  height: 38,
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
  width: 145,
  depth: 95,
  height: 55,
  color: "#1d1d1f",
  ink: "#e8e8e6",
  knobs: [{ x: 38, z: -22, radius: 11, height: 15, style: "skirted", label: "Rate", angle: -20 }],
  footswitch: { x: -34, z: 4, radius: 9 },
  led: { x: 38, z: 14, color: "#ff2b2b" },
  legends: [{ text: "Small Stone", z: -30, size: 8 }],
  note: "Much bigger than people remember, and wider than it is deep: 145mm across, with the switch and the knob at opposite corners.",
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
  width: 73,
  depth: 129,
  height: 59,
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
  width: 73,
  depth: 129,
  height: 59,
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
  width: 73,
  depth: 129,
  height: 59,
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
  width: 100,
  depth: 254,
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

/** Every pedal modelled by hand, most specific first. */
export const PEDAL_MODELS: PedalModel[] = [
  /* Boss compacts first: their model patterns are the most specific, and
     `modelFor` takes the first match. */
  BOSS_DS1,
  BOSS_DD,
  BOSS_DD2,
  BOSS_CE,
  BOSS_BD2,
  IBANEZ_TS9,
  /* EHX: Big Muff before the rest only because it is the one people search. */
  EHX_BIG_MUFF,
  EHX_SMALL_STONE,
  EHX_MEMORY_MAN,
  /* Dunlop's three are different bodies from each other, which is half the
     reason they are all worth measuring. */
  DUNLOP_CRY_BABY,
  DUNLOP_FUZZ_FACE,
  MXR_DYNA_COMP,
  MXR_MICRO,
  PROCO_RAT,
  PROCO_RAT2,
  KLON_CENTAUR,
  TC_HOF_MINI,
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
