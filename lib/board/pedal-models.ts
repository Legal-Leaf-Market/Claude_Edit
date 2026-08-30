import { ENCLOSURES } from "@/lib/pedalboard/catalog/enclosures"
import { PEDALS as CATALOG_PEDALS } from "@/lib/pedalboard/catalog/pedals"
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

/**
 * The dimensions of one catalogue pedal, for the ones built in no standard box.
 *
 * A Whammy, a DL4 and a PolyTune have no Hammond number, so `enc()` has nothing
 * to read. They are not un-measured though: the planner's catalogue carries
 * their figures with the same provenance marker, because the layout engine
 * needs to place them. This reads those, so "do not type a dimension" holds for
 * every pedal rather than only the ones in a named box.
 *
 * Throws on an unknown id rather than returning a default, for the reason the
 * Impact catalogue ids do: a silent fallback here is a pedal quietly rendered
 * at somebody else's size.
 */
function catalogDims(id: string): { width: number; depth: number; height: number } {
  const pedal = CATALOG_PEDALS.find((p) => p.id === id)
  if (!pedal) throw new Error(`No catalogue pedal "${id}" to take dimensions from`)
  return { width: pedal.dims.widthMm, depth: pedal.dims.depthMm, height: pedal.dims.heightMm }
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
  /**
   * A tuner wedge: tall at the back, sloping down to the front.
   *
   * The slope is not styling, it is why you can read the thing standing up.
   * A tuner drawn as a flat box points its display at the ceiling, and the one
   * pedal on a board whose entire job is to be READ is the one that must not be
   * a rectangle.
   */
  | "wedge"

/**
 * STACKED IS A SECOND SHAFT, NOT A TALLER KNOB.
 *
 * A dual-concentric control is two pots on one hole: a big skirted knob with a
 * smaller one sitting on its shaft, each turning independently. Boss put the
 * whole high-gain line on them because five controls will not fit across 73mm
 * any other way, and drawing one as a single knob loses a control the pedal
 * actually has.
 */
export type KnobStyle = "dome" | "chicken-head" | "skirted" | "mini" | "stacked"

/**
 * How a model's MILLIMETRES become scene units, in one place.
 *
 * The viewer picked 0.01 because a pedal at true metre scale is a speck under
 * a default camera and every light and shadow constant would have had to be
 * tuned around it. That is fine for drawing, and it is a trap for anything
 * LEAVING the browser: the GLB exporter measured a DS-1 at 770 x 1326mm,
 * which is a plausible-looking coffee table. glTF is metres by specification,
 * so the exporter divides by this rather than by a 10 somebody typed, and the
 * day the viewer wants a different working scale the export follows it.
 */
export const SCENE_UNITS_PER_MM = 0.01

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
  /**
   * EVERY FOOTSWITCH, not one.
   *
   * This was a single switch or null, which was true of the pedals modelled
   * first and false of most of what people buy now: a Strymon compact has two,
   * a Boss 200 has two, a DL4 has four. A field that can only hold one does not
   * fail when a second is needed, it silently draws a two-switch pedal with one
   * switch, so the shape is the list and a plain stompbox is a list of one.
   *
   * An empty list is a real state and means the pedal has no switch at all: a
   * treadle has none, and neither does a Boss compact, where the hinged plate
   * IS the switch.
   */
  footswitches: { x: number; z: number; radius: number }[]
  /**
   * Slide faders, which a graphic EQ is nothing but.
   *
   * A different control again: a lever that travels in a slot rather than one
   * that turns. `travel` is the length of the slot and `at` is where the cap is
   * sitting, 0 at the bottom of the slot and 1 at the top. A GE-7 drawn with
   * seven knobs would not be recognisable as a GE-7 at all.
   */
  sliders?: { x: number; z: number; travel: number; at: number }[]
  /**
   * Mini toggle switches, which are what most boutique pedals put a mode on.
   *
   * A different piece of hardware from a footswitch and from a knob: a small
   * bat lever you flick with a finger, never with a foot. Drawing one as a
   * tiny knob is the same kind of lie as drawing a Boss plate as a button.
   */
  toggles?: { x: number; z: number }[]
  /**
   * A display window, for the pedals that have one. A dark inset rectangle,
   * because what it shows depends on what the pedal is doing and inventing a
   * reading is the same class of thing as inventing a price.
   */
  screen?: { x: number; z: number; width: number; depth: number }
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
  footswitches: [{ x: 0, z: 34, radius: 11 }],
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
  footswitches: [{ x: 0, z: 34, radius: 6.5 }],
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
  footswitches: [{ x: 0, z: 26, radius: 6.5 }],
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
  footswitches: [{ x: 0, z: 38, radius: 7 }],
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
  ...catalogDims("ibanez-ts9"),
  color: "#2f8f3f",
  ink: "#f4f4f0",
  knobs: [
    { x: -23, z: -42, radius: 8, height: 13, style: "skirted", label: "Drive", angle: -25 },
    { x: 0, z: -48, radius: 8, height: 13, style: "skirted", label: "Tone", angle: 30 },
    { x: 23, z: -42, radius: 8, height: 13, style: "skirted", label: "Level", angle: 85 },
  ],
  footswitches: [{ x: 0, z: 32, radius: 11 }],
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
  /* Width and depth are the diameter and height is the dome at its centre,
     which is why the round body reads them the way a box does. The planner
     marks these an estimate; taking them from there rather than typing a
     second guess means there is one number to correct when somebody measures
     a real one. */
  ...catalogDims("dallas-arbiter-fuzz-face"),
  color: "#0f3f8f",
  ink: "#f0f0ee",
  knobs: [
    { x: -28, z: -22, radius: 10, height: 14, style: "skirted", label: "Volume", angle: -35 },
    { x: 28, z: -22, radius: 10, height: 14, style: "skirted", label: "Fuzz", angle: 75 },
  ],
  footswitches: [{ x: 0, z: 26, radius: 11 }],
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
  /*
   * THE MAKER'S FIGURES, AND THEY ARE NOT WHAT THIS ENTRY USED TO SAY.
   *
   * Hand-typed, it read 124 x 92: wider than deep, with a note explaining that
   * this was unusual and was why a RAT sits sideways on a board. The planner
   * carries ProCo's own 89 x 114, which is the other way round, so the note
   * was a confident paragraph about a shape the pedal does not have. Widening
   * the cross-check to pedals with no standard enclosure is what caught it.
   */
  ...catalogDims("proco-rat"),
  color: "#141414",
  ink: "#efefef",
  knobs: knobRow(["Distortion", "Filter", "Volume"], { faceWidth: 89, z: -30, arc: 4 }),
  footswitches: [{ x: 0, z: 26, radius: 8 }],
  led: { x: -48, z: 6, color: "#ff2b2b" },
  legends: [{ text: "RAT", z: 8, size: 11 }],
  note: "Three big knobs in a row across an 89mm face and very little else, in flat black. The filter control works backwards from a tone knob, which is the one thing everybody has to be told.",
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
  footswitches: [{ x: 0, z: 28, radius: 8 }],
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
  footswitches: [{ x: 0, z: 34, radius: 6.5 }],
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
  footswitches: [{ x: -22, z: 34, radius: 9 }],
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
  /*
   * FROM THE CATALOGUE, THOUGH THE CATALOGUE CALLS IT AN ESTIMATE.
   *
   * This is the one pedal here where neither file had a measurement: the
   * planner marks its figures `estimate` and this one carried a hand-typed
   * 190mm wide that agreed with nothing. Two independent guesses is strictly
   * worse than one, and the catalogue's at least says what it is, so this
   * reads that and the cross-check holds them together like everything else.
   * If somebody measures a real one, it gets corrected in ONE place.
   */
  ...catalogDims("ehx-deluxe-memory-man"),
  color: "#c9ccd1",
  ink: "#17171a",
  knobs: knobRow(["Level", "Blend", "Feedback", "Delay", "Depth"], {
    faceWidth: 152,
    z: -34,
    arc: 3,
  }),
  footswitches: [{ x: 0, z: 40, radius: 9 }],
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
  footswitches: [{ x: 0, z: 34, radius: 11 }],
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
  footswitches: [{ x: 0, z: 34, radius: 11 }],
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
  footswitches: [{ x: 0, z: 34, radius: 11 }],
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
  footswitches: [],
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
    footswitches: [{ x: 0, z: 34, radius: 11 }],
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
    footswitches: [{ x: 0, z: 34, radius: 6.5 }],
    led: { x: 0, z: -48, color: "#ff4d2b" },
    legends: [{ text: spec.print, z: 8, size: spec.printSize ?? 6 }],
    note: spec.note,
  }
}

/**
 * A Strymon compact: the two-footswitch pedal most modern boards have on them.
 *
 * THE REASON THE SWITCH FIELD IS A LIST. 102 x 114mm, three big knobs across
 * the top, two small ones and a three-position toggle under them, and TWO
 * footswitches along the front. Before this the model could hold one switch,
 * so a Strymon would have rendered with a single switch dead centre: not an
 * error, just a picture of a pedal that does not exist.
 */
function strymonCompact(spec: {
  model: RegExp
  name: string
  color: string
  ink: string
  big: [string, string, string]
  small: [string, string]
  print: string
  note: string
}): PedalModel {
  return {
    match: { brand: /^strymon$/i, model: spec.model },
    name: spec.name,
    maker: "Strymon",
    style: "box",
    ...enc("strymon-compact"),
    color: spec.color,
    ink: spec.ink,
    knobs: [
      ...knobRow(spec.big, { faceWidth: 102, z: -42, arc: 3, radius: 11 }),
      /*
       * THE SECOND ROW NESTLES BETWEEN THE FIRST, which is what the real pedal
       * does and is not decoration: it is the only place it fits.
       *
       * The first attempt put both small knobs directly in front of two of the
       * big ones, which planted them on the words TIME and REPEATS. Moving
       * them forward could not fix it either, because a knob standing 10mm off
       * the face hides roughly 20mm behind itself at this camera angle, and
       * there is not 20mm of clear shelf to find. Offsetting them in x is what
       * works, and it is what Strymon actually did.
       *
       * 13mm is not arbitrary: it is what clears the WIDEST label in the top
       * row, which is the Flint's "Intensity". A longer control name than that
       * would collide again, and the test says so by name rather than leaving
       * it to somebody looking at a render.
       */
      { x: -13, z: -8, radius: 6.5, height: 9.5, style: "skirted" as const, label: spec.small[0], angle: -20 },
      { x: 13, z: -8, radius: 6.5, height: 9.5, style: "skirted" as const, label: spec.small[1], angle: 40 },
    ],
    toggles: [{ x: 34, z: 4 }],
    /* Both switches on the front edge, far enough apart to hit one without
       the other, which is the whole reason a pedal this wide exists. */
    footswitches: [
      { x: -26, z: 40, radius: 9 },
      { x: 26, z: 40, radius: 9 },
    ],
    led: { x: 0, z: 30, color: "#ff4d2b" },
    legends: [{ text: spec.print, z: 18, size: 7 }],
    note: spec.note,
  }
}

const STRYMON_EL_CAPISTAN = strymonCompact({
  model: /\bel\s*capistan\b/i,
  name: "El Capistan",
  color: "#1d5c4a",
  ink: "#eef4f1",
  big: ["Time", "Mix", "Repeats"],
  small: ["Wow", "Flutter"],
  print: "El Capistan",
  note: "A tape echo modelled in DSP, in the Strymon compact box: two footswitches, so the second one can tap the tempo without taking the delay out.",
})

const STRYMON_BLUESKY = strymonCompact({
  model: /\bblue\s*sky\b/i,
  name: "blueSky",
  color: "#7fb6dd",
  ink: "#12222e",
  big: ["Decay", "Mix", "Tone"],
  small: ["Pre-Delay", "Mod"],
  print: "blueSky",
  note: "The pale blue one, and the reverb a lot of boards settled on. Same casting and the same pair of switches as the rest of the Strymon compacts.",
})

const STRYMON_FLINT = strymonCompact({
  model: /\bflint\b/i,
  name: "Flint",
  color: "#2b3f63",
  ink: "#e8eef7",
  big: ["Intensity", "Speed", "Mix"],
  small: ["Decay", "Colour"],
  print: "Flint",
  note: "Tremolo and reverb in one box, which is why it has two footswitches doing two different jobs rather than one plus a tap.",
})

/**
 * A Strymon large: three footswitches, a display, and seven knobs.
 *
 * 171 x 133mm, nearly two Boss compacts side by side, and the third switch is
 * what the size is for: two to move through banks and one to engage. The
 * screen carries nothing, as ever, because what it shows is the preset you
 * happen to be on.
 */
function strymonLarge(spec: {
  model: RegExp
  name: string
  color: string
  ink: string
  top: [string, string, string, string]
  second: [string, string, string]
  print: string
  note: string
}): PedalModel {
  return {
    match: { brand: /^strymon$/i, model: spec.model },
    name: spec.name,
    maker: "Strymon",
    style: "box",
    ...enc("strymon-large"),
    color: spec.color,
    ink: spec.ink,
    knobs: [
      ...knobRow(spec.top, { faceWidth: 171, z: -48, arc: 2, radius: 11 }),
      /* Offset between the first row rather than in line with it, for the
         reason the compact's second row is: a knob hides the print behind it,
         and there is no forward room to buy on a 133mm face. */
      /* 128 is not a face width, it is the pitch that lands these three
         BETWEEN the four above: their columns are at +/-57.7 and +/-19.2, so
         the midpoints are 0 and +/-38.5. Anything else buries a top label. */
      ...knobRow(spec.second, { faceWidth: 128, z: -16, radius: 9 }),
    ],
    footswitches: [
      { x: -58, z: 48, radius: 9 },
      { x: 0, z: 48, radius: 9 },
      { x: 58, z: 48, radius: 9 },
    ],
    screen: { x: 60, z: 14, width: 40, depth: 16 },
    led: { x: -66, z: 14, color: "#ff4d2b" },
    legends: [{ text: spec.print, z: 14, size: 9 }],
    note: spec.note,
  }
}

const STRYMON_TIMELINE = strymonLarge({
  model: /\btime\s*line\b/i,
  name: "TimeLine",
  color: "#b9c9ae",
  ink: "#1d2418",
  top: ["Time", "Repeats", "Mix", "Filter"],
  second: ["Grit", "Speed", "Depth"],
  print: "TimeLine",
  note: "171mm across and three footswitches: two to move through banks and one to engage, which is what a pedal with two hundred presets needs and a compact cannot offer.",
})

const STRYMON_BIGSKY = strymonLarge({
  model: /\bbig\s*sky\b/i,
  name: "BigSky",
  color: "#aebccd",
  ink: "#161e2a",
  top: ["Decay", "Pre-Dly", "Mix", "Tone"],
  second: ["Param", "Mod", "Type"],
  print: "BigSky",
  note: "The large box in pale blue. Twelve reverb machines behind one Type selector, which is why two of its knobs do a different job on each machine.",
})

const STRYMON_MOBIUS = strymonLarge({
  model: /\bmobius\b/i,
  name: "Mobius",
  color: "#bdb4c9",
  ink: "#1f1a26",
  top: ["Speed", "Depth", "Level", "Param"],
  second: ["Mix", "Low", "Type"],
  print: "Mobius",
  note: "Twelve modulation machines in the large box. Several of its knobs are deliberately unnamed on the face, because what they do changes with the machine.",
})

/**
 * A Boss 200: the compact grown up, with a screen and a second switch.
 *
 * 101 x 138mm, and no tread plate at all: the 200 series went back to ordinary
 * round footswitches, two of them, with the display sitting between the knobs
 * and the switches.
 */
function boss200(spec: {
  model: RegExp
  name: string
  controls: [string, string, string, string]
  print: [string, string]
  note: string
}): PedalModel {
  return {
    match: { brand: /^boss$/i, model: spec.model },
    name: spec.name,
    maker: "Boss",
    style: "box",
    ...enc("boss-200"),
    color: "#1e2126",
    ink: "#e8ebef",
    knobs: knobRow(spec.controls, { faceWidth: 101, z: -46, arc: 3, radius: 9 }),
    screen: { x: 0, z: -12, width: 44, depth: 16 },
    footswitches: [
      { x: -26, z: 46, radius: 9 },
      { x: 26, z: 46, radius: 9 },
    ],
    led: { x: -42, z: 14, color: "#ff2b2b" },
    legends: [
      { text: spec.print[0], z: 14, size: 8 },
      { text: spec.print[1], z: 23, size: 4.2 },
    ],
    note: spec.note,
  }
}

const BOSS_DD200 = boss200({
  model: /\bdd-?200\b/i,
  name: "DD-200 Digital Delay",
  controls: ["E.Level", "F.Back", "Time", "Mode"],
  print: ["DD-200", "Digital Delay"],
  note: "The compact's circuit in a bigger box with somewhere to keep presets: two footswitches and a screen, and no tread plate, because the 200 series went back to ordinary switches.",
})

const BOSS_RV200 = boss200({
  model: /\brv-?200\b/i,
  name: "RV-200 Reverb",
  controls: ["E.Level", "Time", "Tone", "Mode"],
  print: ["RV-200", "Reverb"],
  note: "The same 101mm box as the DD-200 and the same pair of switches. Twelve reverb modes on the fourth knob, with the screen naming whichever one you land on.",
})

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

const BOSS_DS2 = bossCompact({
  model: /\bds-?2\b/i,
  name: "DS-2 Turbo Distortion",
  color: "#e05a2b",
  controls: ["Tone", "Level", "Dist", "Turbo"],
  print: ["DS-2", "Turbo Distortion"],
  note: "A DS-1 with a second, hotter voicing on a fourth control, which is a selector rather than a sweep even though it is shaped like a knob.",
})

const BOSS_OC3 = bossCompact({
  model: /\boc-?3\b/i,
  name: "OC-3 Super Octave",
  color: "#e6e8ea",
  controls: ["Direct", "Oct 1", "Oct 2", "Mode"],
  print: ["OC-3", "Super Octave"],
  note: "The first Boss octave that tracked polyphonically, which is why it has a Mode control at all rather than just two octave levels.",
})

const BOSS_PH3 = bossCompact({
  model: /\bph-?3\b/i,
  name: "PH-3 Phase Shifter",
  color: "#6fbf73",
  ink: "#14240f",
  controls: ["Rate", "Depth", "Res", "Stage"],
  print: ["PH-3", "Phase Shifter"],
  note: "Stage is the knob that makes this more than one pedal: four, eight, ten and twelve stages of phasing off one control.",
})

/*
 * A TUNER, WHICH IS THE FIRST PEDAL HERE WITH A SCREEN AND NO KNOBS.
 *
 * The face is almost entirely a display window. Nothing is written in it, for
 * the reason `Screen` gives: what a tuner shows depends on what you are
 * playing, and drawing a plausible needle is inventing a reading.
 */
const BOSS_TU3: PedalModel = {
  ...bossCompact({
    model: /\btu-?3\b/i,
    name: "TU-3 Chromatic Tuner",
    color: "#d9dde1",
    controls: [],
    print: ["TU-3", "Chromatic Tuner"],
    note: "The Boss casting with the controls replaced by a window: no knobs at all, because the only thing to set is a mode button and the rest is read rather than adjusted.",
  }),
  screen: { x: 0, z: -40, width: 46, depth: 20 },
  /* The tuner's own indicator, not the bypass LED, and it sits beside the
     window rather than at the back where a compact usually carries one. */
  led: { x: 0, z: -60, color: "#ff2b2b" },
}

/** A TU-2, which is a TU-3 with the previous number on it. Same rule as the DD-2. */
const BOSS_TU2: PedalModel = {
  ...BOSS_TU3,
  match: { brand: /^boss$/i, model: /\btu-?2\b/i },
  name: "TU-2 Chromatic Tuner",
  legends: [
    { text: "TU-2", z: -23, size: 8 },
    { text: "Chromatic Tuner", z: -15.5, size: 4.2 },
  ],
  note: "The tuner that was on almost every board before the TU-3 replaced it, in the same casting with the same window and one number different.",
}

/*
 * THE TWO CONTROLS THE BOSS LINE NEEDED THAT NOTHING ELSE HERE HAS.
 *
 * A graphic EQ is eight faders, and a high-gain Boss is five controls on three
 * holes. Both are the same point: the face is 73mm wide, so when a circuit
 * wants more controls than that will hold in a row, the answer is different
 * hardware rather than smaller knobs.
 */

/** Turn one knob of a factory row into a dual-concentric pair. */
function stack(model: PedalModel, index: number): PedalModel {
  return {
    ...model,
    knobs: model.knobs.map((k, i) => (i === index ? { ...k, style: "stacked" as const } : k)),
  }
}

const BOSS_GE7: PedalModel = {
  ...bossCompact({
    model: /\bge-?7\b/i,
    name: "GE-7 Equalizer",
    color: "#d7dadd",
    controls: [],
    print: ["GE-7", "Equalizer"],
    note: "Seven bands and a level, all of them faders rather than knobs, which is what makes the curve you have dialled in readable at a glance and is the whole point of a graphic EQ.",
  }),
  /*
   * ALL EIGHT SET FLAT, which is where a pedal out of the box sits.
   *
   * A curve drawn here would be somebody's EQ setting presented as the
   * product's, and this file does not invent settings any more than it invents
   * dimensions. Flat is the honest state and is also what the pedal looks like
   * before anybody has touched it.
   */
  sliders: [
    { x: -30, z: -42, travel: 18, at: 0.5 },
    { x: -21.5, z: -42, travel: 18, at: 0.5 },
    { x: -13, z: -42, travel: 18, at: 0.5 },
    { x: -4.5, z: -42, travel: 18, at: 0.5 },
    { x: 4, z: -42, travel: 18, at: 0.5 },
    { x: 12.5, z: -42, travel: 18, at: 0.5 },
    { x: 21, z: -42, travel: 18, at: 0.5 },
    { x: 30, z: -42, travel: 18, at: 0.5 },
  ],
}

const BOSS_MT2 = stack(
  bossCompact({
    model: /\bmt-?2\b|\bmetal\s*zone\b/i,
    name: "MT-2 Metal Zone",
    color: "#232529",
    ink: "#e9ecef",
    controls: ["Level", "EQ", "Dist"],
    print: ["MT-2", "Metal Zone"],
    note: "Five controls on three holes: the middle one is a dual-concentric pair for the mid frequency and its level, which is the only way a parametric mid fits on a 73mm face.",
  }),
  1,
)

const BOSS_HM2 = stack(
  bossCompact({
    model: /\bhm-?2\b/i,
    name: "HM-2 Heavy Metal",
    color: "#1c1f24",
    ink: "#e9ecef",
    controls: ["Level", "Colour", "Dist"],
    print: ["HM-2", "Heavy Metal"],
    note: "The Swedish chainsaw. A stacked pair for the two colour controls, and the reason a whole genre is described by the phrase all knobs to the right.",
  }),
  1,
)

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

/*
 * THE MINI BOX, which is a different pedal shape rather than a smaller one.
 *
 * 42mm across leaves room for one knob and nothing else in a row, so what a
 * mini actually does is move the modes onto toggles. Drawing those as tiny
 * knobs would say the pedal is adjustable where it is switched.
 */
const MXR_PHASE_95: PedalModel = {
  match: { brand: /^(mxr|dunlop)$/i, model: /\bphase\s*95\b|\bm290\b/i },
  name: "Phase 95",
  maker: "MXR",
  style: "box",
  ...enc("mxr-mini"),
  color: "#f47b20",
  ink: "#1c1c1c",
  knobs: [{ x: 0, z: -30, radius: 8, height: 12, style: "chicken-head", label: "", angle: -50 }],
  toggles: [
    { x: -9, z: -13 },
    { x: 9, z: -13 },
  ],
  footswitches: [{ x: 0, z: 28, radius: 6 }],
  led: { x: 0, z: -42, color: "#ff4d2b" },
  legends: [{ text: "Phase 95", z: 8, size: 4.5 }],
  note: "Four phasers in a mini box: two toggles pick between the 45 and the 90 circuits and between script and block voicings, because there is no room for four knobs.",
}

const IBANEZ_TS_MINI: PedalModel = {
  match: { brand: /^ibanez$/i, model: /\btube\s*screamer\b.*\bmini\b|\bts\s*mini\b/i },
  name: "Tube Screamer Mini",
  maker: "Ibanez",
  style: "box",
  ...enc("mxr-mini"),
  color: "#2f9b4e",
  ink: "#0f2415",
  knobs: [
    { x: -11, z: -32, radius: 4.5, height: 7, style: "dome", label: "", angle: -30 },
    { x: 11, z: -32, radius: 4.5, height: 7, style: "dome", label: "", angle: 25 },
    { x: 0, z: -20, radius: 4.5, height: 7, style: "dome", label: "", angle: 70 },
  ],
  footswitches: [{ x: 0, z: 28, radius: 6 }],
  led: { x: 0, z: -6, color: "#ff4d2b" },
  legends: [
    { text: "Tube Screamer", z: 8, size: 3.4 },
    { text: "Mini", z: 14, size: 3.4 },
  ],
  note: "The Tube Screamer circuit in a mini box, and a completely different enclosure from a TS9: three knobs in a triangle because 42mm will not take them in a row.",
}

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
  footswitches: [{ x: 0, z: 38, radius: 7 }],
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
  footswitches: [{ x: 0, z: 32, radius: 8 }],
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
  footswitches: [{ x: 0, z: 34, radius: 8 }],
  led: { x: -34, z: 6, color: "#ff2b2b" },
  legends: [{ text: "Micro POG", z: 6, size: 7 }],
  note: "Polyphonic octaves in the XO box: three knobs that are really three faders, one for the dry signal and one for each octave.",
}

const EHX_NANO_BIG_MUFF: PedalModel = {
  match: { brand: /^electro-?harmonix$/i, model: /\bnano\b.*\bbig\s*muff\b|\bbig\s*muff\b.*\bnano\b/i },
  name: "Nano Big Muff Pi",
  maker: "Electro-Harmonix",
  style: "box",
  ...enc("ehx-nano"),
  color: "#171719",
  ink: "#f0f0ee",
  knobs: knobRow(["Volume", "Tone", "Sustain"], { faceWidth: 70, z: -32, arc: 4 }),
  footswitches: [{ x: 0, z: 32, radius: 8 }],
  led: { x: 0, z: 14, color: "#ff2b2b" },
  legends: [{ text: "Big Muff Pi", z: -4, size: 6 }],
  note: "The same circuit as the 146mm board hog in a 70mm box, which is the whole product: half the width, none of the argument about whether it fits.",
}

const EHX_SMALL_CLONE: PedalModel = {
  match: { brand: /^electro-?harmonix$/i, model: /\bsmall\s*clone\b/i },
  name: "Small Clone",
  maker: "Electro-Harmonix",
  style: "box",
  ...enc("ehx-nano"),
  color: "#2f6fb5",
  ink: "#eef3f9",
  knobs: [{ x: 0, z: -32, radius: 11, height: 15, style: "skirted", label: "Rate", angle: -25 }],
  toggles: [{ x: 22, z: -8 }],
  footswitches: [{ x: 0, z: 32, radius: 8 }],
  led: { x: -22, z: -8, color: "#ff2b2b" },
  legends: [{ text: "Small Clone", z: 10, size: 6 }],
  note: "One knob for rate and a two-position depth toggle, which is the entire control set and the reason it sounds like one thing rather than a chorus you have to dial in.",
}

const EHX_HOLY_GRAIL: PedalModel = {
  match: { brand: /^electro-?harmonix$/i, model: /\bholy\s*grail\b/i },
  name: "Holy Grail",
  maker: "Electro-Harmonix",
  style: "box",
  ...enc("ehx-xo"),
  color: "#b9bcc0",
  ink: "#17171a",
  knobs: [
    { x: -18, z: -34, radius: 11, height: 15, style: "skirted", label: "Reverb", angle: -20 },
    { x: 18, z: -34, radius: 9, height: 13, style: "chicken-head", label: "Mode", angle: 60 },
  ],
  footswitches: [{ x: 0, z: 34, radius: 8 }],
  led: { x: 0, z: -12, color: "#ff2b2b" },
  legends: [{ text: "Holy Grail", z: 6, size: 7 }],
  note: "Spring, hall and flerb off one selector, with a single amount control beside it. The XO box, and about as few decisions as a reverb can offer.",
}

/*
 * TWO MORE TREADLES, which takes that body to five users.
 *
 * The V846 is the grey hammertone one and the WH10 is the odd one out: a
 * plastic-bodied wah rather than a cast chassis, in the same footprint the
 * planner's table gives every treadle.
 */
const VOX_V846: PedalModel = {
  ...DUNLOP_CRY_BABY,
  match: { brand: /^vox$/i, model: /\bv846\b/i },
  name: "V846 Wah",
  maker: "Vox",
  color: "#6b6d70",
  ink: "#f0f0ee",
  legends: [{ text: "Vox", z: 112, size: 11 }],
  note: "The grey hammertone one, and the wah the reissues are all measured against. Same chassis as every treadle since, in the finish the originals wore.",
}

const IBANEZ_WH10: PedalModel = {
  ...DUNLOP_CRY_BABY,
  match: { brand: /^ibanez$/i, model: /\bwh-?10\b/i },
  name: "WH10 Wah",
  maker: "Ibanez",
  color: "#1a1a1e",
  ink: "#e6e6e6",
  legends: [{ text: "WH10", z: 112, size: 10 }],
  note: "The plastic-bodied one, which is why originals are so often found cracked. A different material from every other treadle here and the same footprint.",
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
  footswitches: [{ x: 0, z: 36, radius: 8 }],
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
  footswitches: [{ x: 0, z: 28, radius: 6 }],
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
  footswitches: [],
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

/* --------------------------------------------------------------------- */
/*  Three more 1590Bs, which is what the boutique shelf is made of         */
/* --------------------------------------------------------------------- */

/*
 * ALL THREE HAVE A TOGGLE, and that is the point of grouping them.
 *
 * The boutique answer to "this pedal should do two things" is a mini toggle
 * rather than a second knob, so a shelf of 1590Bs is mostly three knobs and a
 * bat lever. Drawing the lever as a small knob would say the mode is a sweep.
 */
const JHS_MORNING_GLORY: PedalModel = {
  match: { brand: /^jhs(\s*pedals)?$/i, model: /\bmorning\s*glory\b/i },
  name: "Morning Glory",
  maker: "JHS Pedals",
  style: "box",
  ...enc("1590B"),
  color: "#eceff2",
  ink: "#16223a",
  knobs: knobRow(["Volume", "Tone", "Drive"], { faceWidth: 64, z: -32, arc: 4 }),
  toggles: [{ x: -22, z: 8 }],
  footswitches: [{ x: 0, z: 36, radius: 8 }],
  led: { x: 22, z: 8, color: "#ff4d2b" },
  legends: [{ text: "Morning Glory", z: 20, size: 5 }],
  note: "A transparent overdrive in the standard 1590B, with a bright-cut toggle between the knobs and the switch where a fourth control would otherwise go.",
}

const WALRUS_JULIA: PedalModel = {
  match: { brand: /^walrus(\s*audio)?$/i, model: /\bjulia\b/i },
  name: "Julia",
  maker: "Walrus Audio",
  style: "box",
  ...enc("1590B"),
  color: "#1f6f74",
  ink: "#eef6f6",
  knobs: knobRow(["Rate", "Depth", "Lag", "D-V"], { faceWidth: 64, z: -30, arc: 3, radius: 5.5 }),
  toggles: [{ x: -22, z: 8 }],
  footswitches: [{ x: 0, z: 36, radius: 8 }],
  led: { x: 22, z: 8, color: "#3ad46a" },
  legends: [{ text: "Julia", z: 20, size: 6 }],
  note: "Chorus and vibrato off one blend control, which is what the D-V knob does: all the way over is vibrato, in the middle is chorus.",
}

const KEELEY_COMPRESSOR_PLUS: PedalModel = {
  match: { brand: /^keeley$/i, model: /\bcompressor\b/i },
  name: "Compressor Plus",
  maker: "Keeley",
  style: "box",
  ...enc("1590B"),
  color: "#1b3a63",
  ink: "#eef3f9",
  knobs: knobRow(["Sustain", "Level", "Tone"], { faceWidth: 64, z: -32, arc: 4 }),
  toggles: [{ x: -22, z: 8 }],
  footswitches: [{ x: 0, z: 36, radius: 8 }],
  led: { x: 22, z: 8, color: "#ff4d2b" },
  legends: [{ text: "Compressor", z: 20, size: 5 }],
  note: "The studio-style optical compressor most boards ended up with, in a 1590B, with a single-coil and humbucker toggle rather than an input trim.",
}

/* --------------------------------------------------------------------- */
/*  Four more off the boutique shelf                                      */
/* --------------------------------------------------------------------- */

const WALRUS_SLO: PedalModel = {
  match: {
    brand: /^walrus(\s*audio)?$/i,
    /*
     * NO TRAILING \b, BECAUSE THE NAME ENDS IN A NON-ASCII LETTER.
     *
     * JavaScript's \b is ASCII-only unless the pattern is unicode-aware, so
     * "ö" counts as a non-word character: in "Slö Reverb" there is no boundary
     * between the "ö" and the space, and `\bsl(o|ö)\b` matched nothing at all.
     * The model was in the table and unreachable, exactly as the Fuzz Face was
     * when its brand pattern did not allow for "Dallas".
     */
    model: /\bsl(o|ö)(?![a-z])/i,
  },
  name: "Slö",
  maker: "Walrus Audio",
  style: "box",
  ...enc("1590B"),
  color: "#8fa6c4",
  ink: "#141c28",
  knobs: knobRow(["Decay", "Filter", "Mix"], { faceWidth: 64, z: -32, arc: 4 }),
  toggles: [{ x: -22, z: 8 }],
  footswitches: [{ x: 0, z: 36, radius: 8 }],
  led: { x: 22, z: 8, color: "#3ad46a" },
  legends: [{ text: "Slö", z: 20, size: 7 }],
  note: "A 1590B again, with the mode toggle picking between three reverb programmes. The dark, rise and dream settings are the whole product and there is no knob for them.",
}

const EQD_DISPATCH_MASTER: PedalModel = {
  match: { brand: /^earthquaker(\s*devices)?$/i, model: /\bdispatch\s*master\b/i },
  name: "Dispatch Master",
  maker: "EarthQuaker Devices",
  style: "box",
  ...enc("125B"),
  color: "#e7e3d8",
  ink: "#1a1a1c",
  knobs: knobRow(["Time", "Repeats", "Mix", "Reverb"], { faceWidth: 66, z: -32, arc: 3, radius: 5.5 }),
  footswitches: [{ x: 0, z: 38, radius: 8 }],
  led: { x: 0, z: 6, color: "#ff4d2b" },
  legends: [{ text: "Dispatch Master", z: 20, size: 4.5 }],
  note: "Delay and reverb on one switch in a 125B, which is a 1590B with more room inside. Four knobs across 66mm is as many as that width takes.",
}

const ORIGIN_CALI76: PedalModel = {
  match: { brand: /^origin(\s*effects)?$/i, model: /\bcali\s*-?76\b/i },
  name: "Cali76 Compact",
  maker: "Origin Effects",
  style: "box",
  ...enc("125B"),
  color: "#b4b8bd",
  ink: "#17171a",
  knobs: knobRow(["In", "Out", "Dry", "Ratio"], { faceWidth: 66, z: -32, arc: 3, radius: 5.5 }),
  footswitches: [{ x: 0, z: 38, radius: 8 }],
  led: { x: 0, z: 6, color: "#ff4d2b" },
  legends: [{ text: "Cali76", z: 20, size: 6 }],
  note: "A studio FET compressor shrunk into a 125B, with a dry blend so the compression sits under the signal rather than on top of it.",
}

/*
 * A PEDAL WITH NO KNOB AT ALL, which is worth having for the same reason the
 * treadle is: the shape is the product. Everything an EP Booster does is set
 * on dip switches inside the box, so the face carries a switch, an indicator
 * and nothing else.
 */
const XOTIC_EP_BOOSTER: PedalModel = {
  match: { brand: /^xotic$/i, model: /\bep\s*booster\b/i },
  name: "EP Booster",
  maker: "Xotic",
  style: "box",
  ...enc("1590A"),
  color: "#e8e4d6",
  ink: "#1a1a1c",
  knobs: [{ x: 0, z: -28, radius: 6, height: 9, style: "dome", label: "", angle: -20 }],
  footswitches: [{ x: 0, z: 28, radius: 6 }],
  led: { x: 0, z: -8, color: "#ff4d2b" },
  legends: [{ text: "EP Booster", z: 8, size: 3.6 }],
  note: "A 1590A with one control on the face and two dip switches inside it, which is the whole design: set it once and leave it on.",
}

/* --------------------------------------------------------------------- */
/*  The big digital boxes, and the last two treadles                       */
/* --------------------------------------------------------------------- */

/*
 * A WHAMMY IS A TREADLE, and it is the one that proves the body is general.
 *
 * 133 x 197mm from the planner's own figures: shorter than a wah and half
 * again as wide, because the chassis has to carry a display and a mode knob
 * beside the plate. Every other treadle here is a wah-shaped 102 x 254.
 */
const DIGITECH_WHAMMY: PedalModel = {
  match: { brand: /^digitech$/i, model: /\bwhammy\b/i },
  name: "Whammy",
  maker: "DigiTech",
  style: "treadle",
  ...catalogDims("digitech-whammy"),
  /* Chassis only, as with every treadle: the table's height is the pedal
     standing at rest with the plate up. */
  height: 30,
  color: "#b2201f",
  ink: "#f4f4f2",
  knobs: [],
  footswitches: [],
  led: null,
  legends: [{ text: "Whammy", z: 84, size: 10 }],
  treadle: {
    plateWidth: 74,
    plateDepth: 168,
    plateThickness: 12,
    pivotZ: 14,
    pivotY: 32,
    tilt: 9,
    cheekHeelHeight: 40,
    cheekToeHeight: 11,
  },
  note: "A treadle that is not a wah: shorter and much wider, because the mode selector and the display sit on the chassis beside the plate rather than under your foot.",
}

/**
 * A Line 6 DL4: 305mm across and FOUR footswitches.
 *
 * The widest thing modelled here by a long way, and the reason the switch
 * field had to become a list: three presets and a tap, in a row, on a box that
 * takes the width of four ordinary pedals.
 */
const LINE6_DL4: PedalModel = {
  match: { brand: /^line\s*6$/i, model: /\bdl-?4\b/i },
  name: "DL4 Delay Modeler",
  maker: "Line 6",
  style: "box",
  ...catalogDims("line-6-dl4"),
  color: "#2f7d4f",
  ink: "#eef5f0",
  knobs: [
    ...knobRow(["Delay", "Repeats", "Tweak", "Tweez", "Mix"], {
      faceWidth: 250,
      z: -52,
      arc: 3,
      radius: 13,
    }),
    /* Out on the far left where the real one is, and clear of the row: at
       -110 its 15mm body ran into the 13mm knob beside it. */
    { x: -128, z: -52, radius: 15, height: 20, style: "chicken-head", label: "Model", angle: -40 },
  ],
  footswitches: [
    { x: -105, z: 52, radius: 11 },
    { x: -35, z: 52, radius: 11 },
    { x: 35, z: 52, radius: 11 },
    { x: 105, z: 52, radius: 11 },
  ],
  /* Beside the name, not inside it: at x = 0 the indicator landed in the
     middle of the "L". */
  led: { x: -70, z: 12, color: "#ff4d2b" },
  legends: [{ text: "DL4", z: 12, size: 14 }],
  note: "305mm across and four footswitches: three presets and a tap. The green box that sat on the left of a great many boards, and the reason a pedal needs a switch list rather than a switch.",
}

/**
 * A Boss 500: the biggest thing Boss puts in a stompbox format.
 *
 * 170 x 138mm, three switches and a real display, which is what a pedal with
 * a full preset library and stereo routing needs.
 */
function boss500(spec: {
  model: RegExp
  name: string
  controls: [string, string, string, string]
  print: [string, string]
  note: string
}): PedalModel {
  return {
    match: { brand: /^boss$/i, model: spec.model },
    name: spec.name,
    maker: "Boss",
    style: "box",
    ...enc("boss-500"),
    color: "#20242a",
    ink: "#e8ebef",
    knobs: knobRow(spec.controls, { faceWidth: 150, z: -48, arc: 3, radius: 11 }),
    screen: { x: 0, z: -14, width: 62, depth: 20 },
    footswitches: [
      { x: -55, z: 48, radius: 10 },
      { x: 0, z: 48, radius: 10 },
      { x: 55, z: 48, radius: 10 },
    ],
    led: { x: -68, z: 16, color: "#ff2b2b" },
    legends: [
      { text: spec.print[0], z: 16, size: 9 },
      { text: spec.print[1], z: 26, size: 4.5 },
    ],
    note: spec.note,
  }
}

const BOSS_DD500 = boss500({
  model: /\bdd-?500\b/i,
  name: "DD-500 Digital Delay",
  controls: ["E.Level", "F.Back", "Time", "Mode"],
  print: ["DD-500", "Digital Delay"],
  note: "170mm across, three switches and a display: the compact's job with a preset library behind it, which is the whole reason a delay grows to this size.",
})

const BOSS_RV500 = boss500({
  model: /\brv-?500\b/i,
  name: "RV-500 Reverb",
  controls: ["E.Level", "Time", "Tone", "Mode"],
  print: ["RV-500", "Reverb"],
  note: "The same 170mm box as the DD-500. Twenty-one reverb modes and stereo routing, which is what the screen and the third footswitch are for.",
})

const BOSS_RC5: PedalModel = {
  ...bossCompact({
    model: /\brc-?5\b/i,
    name: "RC-5 Loop Station",
    color: "#d3d7da",
    controls: ["Memory", "Level"],
    print: ["RC-5", "Loop Station"],
    note: "A looper in the compact casting, which means the tread plate is still the switch and the display has to share the shelf with two knobs.",
  }),
  screen: { x: 0, z: -38, width: 34, depth: 17 },
}

/* --------------------------------------------------------------------- */
/*  Two more racks of faders                                              */
/* --------------------------------------------------------------------- */

/*
 * THE SECOND AND THIRD FADER PEDALS, which is what makes the control worth
 * having: a GE-7 alone could have been a special case.
 */
const MXR_TEN_BAND: PedalModel = {
  match: { brand: /^(mxr|dunlop)$/i, model: /\b10-?\s*band\b|\bm108\b/i },
  name: "10-Band EQ",
  maker: "MXR",
  style: "box",
  ...catalogDims("mxr-10-band-eq"),
  color: "#161719",
  ink: "#eceff2",
  knobs: [],
  sliders: Array.from({ length: 12 }, (_, i) => ({
    x: -55 + i * 10,
    z: -34,
    travel: 30,
    at: 0.5,
  })),
  footswitches: [{ x: 0, z: 52, radius: 9 }],
  led: { x: -52, z: 20, color: "#ff4d2b" },
  legends: [{ text: "10 Band EQ", z: 20, size: 8 }],
  note: "Twelve faders across 121mm: ten bands plus volume and gain. The widest row of controls on any pedal here, and unreadable as anything but an EQ.",
}

const EHX_MICRO_SYNTH: PedalModel = {
  match: { brand: /^electro-?harmonix$/i, model: /\bmicro\s*synth(esizer)?\b/i },
  name: "Micro Synth",
  maker: "Electro-Harmonix",
  style: "box",
  ...enc("ehx-large"),
  color: "#b9bcc0",
  ink: "#17171a",
  knobs: [],
  sliders: Array.from({ length: 10 }, (_, i) => ({
    x: -58 + i * 13,
    z: -30,
    travel: 26,
    at: 0.5,
  })),
  footswitches: [{ x: 0, z: 42, radius: 8 }],
  led: { x: -58, z: 16, color: "#ff2b2b" },
  legends: [{ text: "Micro Synth", z: 16, size: 8 }],
  note: "Ten faders in the 146mm box, which is the only way an analogue synthesiser's worth of controls fits on a pedal: attack, filter sweep and three voices, all set by eye.",
}

/* --------------------------------------------------------------------- */
/*  Four more boutique boxes, and a tuner with a face full of screen       */
/* --------------------------------------------------------------------- */

const EHX_POG2: PedalModel = {
  match: { brand: /^electro-?harmonix$/i, model: /\bpog\s*2\b/i },
  name: "POG2",
  maker: "Electro-Harmonix",
  style: "box",
  ...enc("ehx-large"),
  color: "#26282c",
  ink: "#eceff2",
  knobs: knobRow(["Dry", "Sub", "Oct Up", "Detune", "Filter"], {
    faceWidth: 146,
    z: -34,
    arc: 4,
    radius: 9,
  }),
  footswitches: [{ x: 0, z: 40, radius: 8 }],
  led: { x: -58, z: 12, color: "#ff2b2b" },
  legends: [{ text: "POG2", z: 12, size: 10 }],
  note: "Five knobs across the 146mm box and eight presets underneath them: polyphonic octaves with enough control to build an organ out of a guitar.",
}

const WAMPLER_TUMNUS_DELUXE: PedalModel = {
  match: { brand: /^wampler$/i, model: /\btumnus\s*deluxe\b/i },
  name: "Tumnus Deluxe",
  maker: "Wampler",
  style: "box",
  ...enc("125B"),
  color: "#b99539",
  ink: "#211a08",
  knobs: knobRow(["Level", "Gain", "Bass", "Treble"], {
    faceWidth: 66,
    z: -32,
    arc: 3,
    radius: 5.5,
  }),
  toggles: [{ x: -22, z: 8 }],
  footswitches: [{ x: 0, z: 38, radius: 8 }],
  led: { x: 22, z: 8, color: "#ff4d2b" },
  legends: [{ text: "Tumnus Deluxe", z: 20, size: 4.2 }],
  note: "The mini grown into a 125B so the tone control can be a real two-band EQ. Same circuit and the same gold, four knobs instead of three.",
}

const JHS_THREE_SERIES_HALL: PedalModel = {
  match: { brand: /^jhs(\s*pedals)?$/i, model: /\b3\s*series\b.*\bhall\b/i },
  name: "3 Series Hall Reverb",
  maker: "JHS Pedals",
  style: "box",
  ...enc("1590B"),
  color: "#d9dcdf",
  ink: "#1a1a1c",
  knobs: knobRow(["Verb", "Decay", "Mix"], { faceWidth: 64, z: -32, arc: 4 }),
  toggles: [{ x: -22, z: 8 }],
  footswitches: [{ x: 0, z: 36, radius: 8 }],
  led: { x: 22, z: 8, color: "#ff4d2b" },
  legends: [{ text: "3 Series Hall", z: 20, size: 4.5 }],
  note: "The cheap line in the standard 1590B: three knobs, one toggle, and deliberately nothing else, which is the entire pitch of the series.",
}

const XOTIC_SP_COMPRESSOR: PedalModel = {
  match: { brand: /^xotic$/i, model: /\bsp\s*compressor\b/i },
  name: "SP Compressor",
  maker: "Xotic",
  style: "box",
  ...enc("1590A"),
  color: "#dfe2e5",
  ink: "#1a1a1c",
  knobs: [{ x: 0, z: -28, radius: 6, height: 9, style: "dome", label: "", angle: -20 }],
  toggles: [{ x: 0, z: -10 }],
  footswitches: [{ x: 0, z: 28, radius: 6 }],
  led: { x: -13, z: -10, color: "#ff4d2b" },
  legends: [{ text: "SP Comp", z: 10, size: 3.6 }],
  note: "A studio compressor in a 1590A. One blend knob and a three-position toggle on the face, with the rest on dip switches inside, which is the Xotic pattern.",
}

const CHASE_BLISS_MOOD: PedalModel = {
  match: { brand: /^chase\s*bliss(\s*audio)?$/i, model: /\bmood\b/i },
  name: "Mood",
  maker: "Chase Bliss Audio",
  style: "box",
  ...enc("1590B"),
  color: "#9ec6c4",
  ink: "#14201f",
  knobs: knobRow(["Time", "Length", "Modify", "Clock"], {
    faceWidth: 64,
    z: -32,
    arc: 3,
    radius: 5.5,
  }),
  toggles: [
    { x: -16, z: 10 },
    { x: 16, z: 10 },
  ],
  footswitches: [
    { x: -16, z: 38, radius: 7 },
    { x: 16, z: 38, radius: 7 },
  ],
  led: { x: 0, z: 10, color: "#3ad46a" },
  legends: [{ text: "Mood", z: 24, size: 6 }],
  note: "Two footswitches and two toggles on a 1590B, with sixteen dip switches on the back that are the real control set. Everything about it is a decision you make once.",
}

/**
 * Korg's Pitchblack X: the one sloped enclosure here.
 *
 * WHY IT IS WORTH A NEW BODY STYLE. Every other pedal in this file is a box, a
 * Boss casting, a treadle or a dome, and a tuner is none of them: the top face
 * is a ramp so the display faces the player rather than the ceiling. Drawn flat
 * it is an unmarked black rectangle, which is the exact failure the style
 * branches exist to prevent.
 *
 * THE DISPLAY STAYS DARK. A specification for this model asked for an emissive
 * readout showing a note letter and a tuning bar, and that is the one thing
 * section 16 forbids inside a modelled screen: what a tuner reads depends on
 * what you are playing, and drawing a needle is inventing a measurement the way
 * a market price under MIN_SAMPLE_SIZE is. An unlit window is what the pedal
 * looks like unplugged, and the wedge alone is enough to say "tuner".
 */
const KORG_PITCHBLACK_X: PedalModel = {
  match: { brand: /^korg$/i, model: /\bpitch\s*black\b/i },
  name: "Pitchblack X",
  maker: "Korg",
  style: "wedge",
  ...catalogDims("korg-pitchblack-x"),
  /* Charcoal rather than black. Pure #000 has no form under any lighting: the
     chamfers and the slope both disappear and it renders as a hole. */
  color: "#17191c",
  ink: "#e8ebef",
  knobs: [],
  /* Most of the ramp. A tuner has nothing to set and everything to read. */
  screen: { x: 0, z: -20, width: 44, depth: 30 },
  footswitches: [{ x: 0, z: 36, radius: 9 }],
  led: null,
  /* Between the window and the switch, which is the only clear strip on a
     face that is mostly display. */
  legends: [{ text: "Pitchblack X", z: 14, size: 4.5 }],
  note: "A wedge rather than a box: the top face is a ramp so the display faces you standing up, and the switch sits at the low front end where your foot lands.",
}

const TC_POLYTUNE_3: PedalModel = {
  match: { brand: /^tc\s*electronic$/i, model: /\bpoly\s*tune\b/i },
  name: "PolyTune 3",
  maker: "TC Electronic",
  style: "box",
  ...catalogDims("tc-polytune-3"),
  color: "#1b1d20",
  ink: "#e8ebef",
  knobs: [],
  screen: { x: 0, z: -22, width: 52, depth: 34 },
  footswitches: [{ x: 0, z: 40, radius: 8 }],
  led: null,
  legends: [{ text: "PolyTune", z: 14, size: 6 }],
  note: "Almost the whole face is display, because a tuner has nothing to set and everything to read. Strum all six strings and it shows all six at once, which is what the poly means.",
}

/* --------------------------------------------------------------------- */
/*  The last of the pedals the catalogue has maker's figures for           */
/* --------------------------------------------------------------------- */

/**
 * A TS808, which is a TS9 in a different green.
 *
 * The catalogue gives both the same 74 x 124 x 53 from Ibanez, so the casting
 * is confirmed shared rather than assumed. Same rule as the DD-2 and the RAT 2:
 * one entry each, because the print is what tells them apart and a pattern
 * loose enough to catch both would have to get one wrong.
 */
const IBANEZ_TS808: PedalModel = {
  ...IBANEZ_TS9,
  match: { brand: /^ibanez$/i, model: /\bts-?808\b/i },
  name: "TS808 Tube Screamer",
  color: "#4c8f4a",
  /* The TS9's own shelf positions, not the Boss factory's: this housing puts
     its knobs at -42 and -48, so the print sits at -20 rather than -23. */
  legends: [{ text: "TS808", z: -20, size: 7 }],
  note: "The original, in the olive green the reissues copy. Same Ibanez casting as a TS9 to the millimetre; what differs is the output section and the number on the shelf.",
}

/*
 * A Z.VEX FUZZ FACTORY, and the shape is the fact worth having: 102 x 64,
 * WIDER than it is deep, which almost nothing else here is. Five knobs across
 * a face that shallow is why it looks like nothing else on a board.
 */
const ZVEX_FUZZ_FACTORY: PedalModel = {
  match: { brand: /^z\.?\s*vex$/i, model: /\bfuzz\s*factory\b/i },
  name: "Fuzz Factory",
  maker: "Z.Vex",
  style: "box",
  ...catalogDims("zvex-fuzz-factory"),
  /* The hand-painted ones are all different, so this is the plain enclosure
     rather than any particular painting: inventing one artist's design would
     be a claim about a specific unit. */
  color: "#e6e1d4",
  ink: "#1a1a1c",
  knobs: knobRow(["Volume", "Gate", "Comp", "Drive", "Stab"], {
    faceWidth: 102,
    z: -18,
    arc: 2,
    radius: 6.5,
  }),
  footswitches: [{ x: 0, z: 22, radius: 7 }],
  led: null,
  legends: [{ text: "Fuzz Factory", z: 4, size: 4.5 }],
  note: "Wider than it is deep, which almost nothing else is, with five knobs across a 64mm depth. Every one is hand-painted, so no two look alike and this is the bare enclosure.",
}

const EVENTIDE_H9: PedalModel = {
  match: { brand: /^eventide$/i, model: /\bh9\b/i },
  name: "H9",
  maker: "Eventide",
  style: "box",
  ...catalogDims("eventide-h9"),
  color: "#3a3d42",
  ink: "#e8ebef",
  knobs: [{ x: 34, z: -34, radius: 11, height: 15, style: "skirted", label: "", angle: -30 }],
  screen: { x: -14, z: -34, width: 44, depth: 20 },
  footswitches: [
    { x: -24, z: 40, radius: 8 },
    { x: 24, z: 40, radius: 8 },
  ],
  led: null,
  legends: [{ text: "H9", z: 6, size: 11 }],
  note: "One knob and a screen, because everything else is set from a phone. An unusual answer to a pedal with hundreds of algorithms in it, and the reason the face is nearly empty.",
}

const TC_DITTO: PedalModel = {
  match: { brand: /^tc\s*electronic$/i, model: /\bditto\b/i },
  name: "Ditto Looper",
  maker: "TC Electronic",
  style: "box",
  ...catalogDims("tc-ditto"),
  color: "#c6ccd2",
  ink: "#1a1c20",
  knobs: [{ x: 0, z: -26, radius: 9, height: 13, style: "dome", label: "", angle: 10 }],
  footswitches: [{ x: 0, z: 26, radius: 6.5 }],
  led: { x: 0, z: -6, color: "#3ad46a" },
  legends: [{ text: "Ditto", z: 8, size: 4.5 }],
  note: "One knob, one switch, and nothing else at all: the looper that sold on having no menu. 47mm across, which is the narrowest thing modelled here.",
}

/** The TC 72mm box, which the Hall of Fame 2 and the Flashback 2 both use. */
function tcCompact(spec: {
  model: RegExp
  name: string
  color: string
  controls: [string, string, string, string]
  print: string
  note: string
}): PedalModel {
  return {
    match: { brand: /^tc\s*electronic$/i, model: spec.model },
    name: spec.name,
    maker: "TC Electronic",
    style: "box",
    ...catalogDims("tc-hall-of-fame-2"),
    color: spec.color,
    ink: "#0f2018",
    knobs: knobRow(spec.controls, { faceWidth: 72, z: -34, arc: 3, radius: 6.5 }),
    footswitches: [{ x: 0, z: 34, radius: 8 }],
    led: { x: 0, z: 4, color: "#3ad46a" },
    legends: [{ text: spec.print, z: 16, size: 5 }],
    note: spec.note,
  }
}

const TC_HOF_2 = tcCompact({
  model: /\bhall\s*of\s*fame\s*2\b|\bhof\s*2\b/i,
  name: "Hall of Fame 2",
  color: "#3fa88a",
  controls: ["Decay", "Tone", "Level", "Type"],
  print: "Hall of Fame 2",
  note: "The full-size Hall of Fame rather than the mini: four knobs and a mode selector, in the 72mm box TC uses for most of its line.",
})

const TC_FLASHBACK_2 = tcCompact({
  model: /\bflashback\s*2\b/i,
  name: "Flashback 2 Delay",
  color: "#2f7f68",
  controls: ["Delay", "F.Back", "Level", "Type"],
  print: "Flashback 2",
  note: "The delay in the same 72mm box as the Hall of Fame 2, and the one that learns a strumming pattern rather than a tempo.",
})

const SOURCE_AUDIO_NEMESIS: PedalModel = {
  match: { brand: /^source\s*audio$/i, model: /\bnemesis\b/i },
  name: "Nemesis Delay",
  maker: "Source Audio",
  style: "box",
  ...catalogDims("source-audio-nemesis"),
  color: "#1f3350",
  ink: "#e6ecf5",
  knobs: knobRow(["Time", "Mix", "F.Back", "Depth"], {
    faceWidth: 114,
    z: -18,
    arc: 2,
    radius: 7,
  }),
  footswitches: [
    { x: -30, z: 22, radius: 7 },
    { x: 30, z: 22, radius: 7 },
  ],
  led: { x: -46, z: 4, color: "#3ad46a" },
  legends: [{ text: "Nemesis", z: 4, size: 5 }],
  note: "114 x 70, wider than it is deep, with two switches on a face that shallow. Twelve delay engines and a mode selector, all of it set from the four knobs.",
}

const UA_GOLDEN: PedalModel = {
  match: { brand: /^universal\s*audio$/i, model: /\bgolden\b/i },
  name: "UAFX Golden Reverberator",
  maker: "Universal Audio",
  style: "box",
  ...catalogDims("universal-audio-golden"),
  color: "#c9ccd0",
  ink: "#17171a",
  knobs: knobRow(["Decay", "Pre-Dly", "Mix", "Bass", "Treble"], {
    faceWidth: 96,
    z: -42,
    arc: 3,
    radius: 6,
  }),
  /* Forward of the knob labels, not between the rows: a 10mm lever buries
     print about 20mm behind it and the labels sit at -33. */
  toggles: [{ x: 0, z: -2 }],
  footswitches: [
    { x: -24, z: 46, radius: 8 },
    { x: 24, z: 46, radius: 8 },
  ],
  led: { x: -34, z: 20, color: "#ff4d2b" },
  legends: [{ text: "Golden", z: 20, size: 6 }],
  note: "Three spring and plate reverbs on one selector, in a two-switch box the size of a Strymon compact. The brushed lid is the family look across the whole UAFX line.",
}

/*
 * A VOLUME PEDAL THAT IS NOT FULL SIZE, and the treadle body's sixth user.
 *
 * 70 x 172 against a wah's 102 x 254, which is most of the reason people buy
 * it: a full-size treadle takes the end of a board and this one does not.
 */
const DUNLOP_VOLUME_MINI: PedalModel = {
  match: { brand: /^(jim\s*)?dunlop$/i, model: /\bvolume\b.*\bmini\b|\bdvp4\b/i },
  name: "Volume (X) Mini",
  maker: "Dunlop",
  style: "treadle",
  ...catalogDims("dunlop-volume-x-mini"),
  /* Chassis only, as with every treadle here. */
  height: 24,
  color: "#1a1a1c",
  ink: "#e6e6e6",
  knobs: [],
  footswitches: [],
  led: null,
  legends: [{ text: "Dunlop", z: 72, size: 7 }],
  treadle: {
    plateWidth: 56,
    plateDepth: 146,
    plateThickness: 11,
    pivotZ: 12,
    pivotY: 26,
    tilt: 9,
    cheekHeelHeight: 32,
    cheekToeHeight: 9,
  },
  note: "A treadle at two thirds scale: 70 x 172 rather than a wah's 102 x 254, which is the whole product. It rocks the same way and takes far less of the board.",
}

/**
 * An MXR in the big box, which is a third MXR size and not the compact.
 *
 * 121 x 145, the same enclosure as the 10-Band EQ, and the reason a Flanger
 * never sat beside a Phase 90 as neatly as people expected.
 */
const MXR_FLANGER: PedalModel = {
  match: { brand: /^(mxr|dunlop)$/i, model: /^flanger$|\bm117\b/i },
  name: "Flanger",
  maker: "MXR",
  style: "box",
  ...catalogDims("mxr-flanger"),
  color: "#f47b20",
  ink: "#1c1c1c",
  knobs: knobRow(["Manual", "Width", "Speed", "Regen"], {
    faceWidth: 121,
    z: -44,
    arc: 3,
    radius: 10,
  }),
  footswitches: [{ x: 0, z: 50, radius: 9 }],
  led: { x: -44, z: 14, color: "#ff4d2b" },
  legends: [{ text: "Flanger", z: 14, size: 9 }],
  note: "The big MXR box at 121 x 145, not the compact: a third size in the same orange, and the reason this one never lined up with a Phase 90 on a board.",
}

const ROSS_COMPRESSOR: PedalModel = {
  match: { brand: /^ross$/i, model: /\bcompressor\b/i },
  name: "Compressor",
  maker: "Ross",
  style: "box",
  ...catalogDims("ross-compressor"),
  color: "#9aa4ab",
  ink: "#1a1c1e",
  knobs: [
    { x: -22, z: -30, radius: 10, height: 14, style: "skirted", label: "Sustain", angle: -25 },
    { x: 22, z: -30, radius: 10, height: 14, style: "skirted", label: "Level", angle: 55 },
  ],
  footswitches: [{ x: 0, z: 34, radius: 8 }],
  led: null,
  legends: [{ text: "Compressor", z: 6, size: 6 }],
  note: "The grey box every modern compressor is a copy of, with two knobs and no indicator at all. The catalogue's figures for it are an estimate rather than a published spec.",
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
  BOSS_DS2,
  BOSS_OC3,
  BOSS_PH3,
  BOSS_TU3,
  BOSS_TU2,
  BOSS_GE7,
  BOSS_MT2,
  BOSS_HM2,
  /* The 200 series is a different enclosure entirely, but its patterns are
     Boss model numbers so it reads better beside them. */
  BOSS_DD200,
  BOSS_RV200,
  BOSS_DD500,
  BOSS_RV500,
  BOSS_RC5,
  /* The Ibanez housing borrowed the Boss mechanism, so it sits with them. */
  /* The 808 first: its number is the specific one, and the TS9's pattern is
     written to refuse it either way. */
  IBANEZ_TS808,
  IBANEZ_TS9,
  /* The Mini is a mini box and nothing like the TS9, which is exactly why it
     used to be wrong to let one pattern catch both. */
  IBANEZ_TS_MINI,

  /* Electro-Harmonix, in the three boxes it actually ships. */
  /* The Nano first: its pattern is the specific one, and the big one's is
     written to refuse it either way. */
  EHX_NANO_BIG_MUFF,
  EHX_BIG_MUFF,
  EHX_ELECTRIC_MISTRESS,
  EHX_SMALL_STONE,
  EHX_MICRO_POG,
  EHX_SOUL_FOOD,
  EHX_SMALL_CLONE,
  EHX_HOLY_GRAIL,
  EHX_POG2,
  EHX_MICRO_SYNTH,
  EHX_MEMORY_MAN,

  /* Treadles. Two wahs and a volume pedal, which is a treadle with nothing
     in it: the second and third users of that body, which is what stops the
     shape being a thing only one pedal has ever proved. */
  DUNLOP_CRY_BABY,
  /* Not a wah at all, and the treadle body's fifth and sixth users. */
  DIGITECH_WHAMMY,
  DUNLOP_VOLUME_MINI,
  /* The V846 before the general Vox pattern, which would otherwise take it. */
  VOX_V846,
  VOX_WAH,
  IBANEZ_WH10,
  EB_VOLUME,

  /* MXR's folded box, and the one round pedal on the site. */
  DUNLOP_FUZZ_FACE,
  MXR_DYNA_COMP,
  /* The 95 before the 90: "Phase 9" is a prefix of neither, but keeping the
     more specific number first is the habit that stops the next pair going
     wrong. */
  MXR_PHASE_95,
  MXR_MICRO,
  MXR_MICRO_AMP,
  MXR_DISTORTION_PLUS,
  MXR_CARBON_COPY,
  MXR_TEN_BAND,
  MXR_FLANGER,

  /* Everything with a body of its own. */
  PROCO_RAT,
  PROCO_RAT2,
  KLON_CENTAUR,
  TC_HOF_MINI,
  EQD_PLUMES,
  WAMPLER_TUMNUS,

  /* Two footswitches, which the model could not carry until this batch. */
  STRYMON_EL_CAPISTAN,
  STRYMON_BLUESKY,
  STRYMON_FLINT,

  /* Three footswitches and a screen: the largest things modelled here. */
  STRYMON_TIMELINE,
  STRYMON_BIGSKY,
  STRYMON_MOBIUS,

  /* The boutique 1590B shelf, all toggle-and-three-knobs. */
  JHS_MORNING_GLORY,
  WALRUS_JULIA,
  WALRUS_SLO,
  KEELEY_COMPRESSOR_PLUS,
  EQD_DISPATCH_MASTER,
  ORIGIN_CALI76,
  XOTIC_EP_BOOSTER,
  XOTIC_SP_COMPRESSOR,
  JHS_THREE_SERIES_HALL,
  WAMPLER_TUMNUS_DELUXE,
  CHASE_BLISS_MOOD,
  TC_POLYTUNE_3,
  KORG_PITCHBLACK_X,
  /* The 2s before the Mini, whose pattern requires the word and would not take
     them, but the order says which is the specific one. */
  TC_HOF_2,
  TC_FLASHBACK_2,
  TC_DITTO,
  LINE6_DL4,
  ZVEX_FUZZ_FACTORY,
  EVENTIDE_H9,
  SOURCE_AUDIO_NEMESIS,
  UA_GOLDEN,
  ROSS_COMPRESSOR,
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
    /* The derived generic carries whatever switches its slot says it has,
       which for every box is one and for a treadle is the one under the toe. */
    footswitches: spec.switches.map((sw) => ({ x: sw.x, z: sw.z, radius: sw.radius })),
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
