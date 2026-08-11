import type { EffectType } from "@/lib/pedalboard/chain"

/**
 * The physical spec catalogue behind the board planner.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE INGESTED CATALOGUE. `canonical_gear` is
 * built from partner feeds and knows what a pedal costs and who has one. It
 * does not know how big the pedal is, and it never will: no feed here carries
 * enclosure dimensions or current draw. A planner that lays gear out to scale
 * needs millimetres and milliamps, so those are hand-authored here and joined
 * to live listings by brand and model at render time.
 *
 * The split also decides what belongs in which file, and the rule is sharp:
 *
 *   PHYSICS LIVES HERE. Dimensions, weight, current draw, voltage, polarity.
 *   These are properties of the object. They do not change when a feed goes
 *   stale, and a five-year-old measurement of a Boss compact is still right.
 *
 *   PRICES NEVER LIVE HERE. There is deliberately no `price` field below, and
 *   adding one would be a mistake rather than a convenience. A hand-typed
 *   street price is wrong within weeks, and the house rule is that prices
 *   shown must be prices the shopper can actually get. Every number with a
 *   currency symbol on the planner comes from a live listing through the same
 *   path the rest of the site uses, or it does not appear at all.
 *
 * HOW MUCH TO TRUST A NUMBER. Every dimension and every power figure carries
 * its own provenance, because "the Strymon needs 250mA" and "a delay is
 * probably about 100mA" are different kinds of claim and a tool that presents
 * them identically is lying by omission. `SpecSource` is that distinction, it
 * is surfaced in the UI, and the power planner refuses to call a board "safe"
 * on estimated figures alone. This is chain.ts's second rule (typical draws
 * are not a guarantee) given a type.
 */

/** Millimetres. Everything physical in this catalogue is mm; inches are display only. */
export type Mm = number

/**
 * Where a number came from, in descending order of trust.
 *
 * - `maker`     published by the manufacturer for this specific product
 * - `enclosure` derived from a standard enclosure this pedal is known to use
 * - `estimate`  a typical figure for this kind of pedal, and nothing more
 *
 * The distinction is load bearing, not decorative. Reversed polarity kills
 * pedals and an undersized supply causes noise that people chase for months,
 * so a planner that cannot say which of its numbers are guesses is worse than
 * no planner.
 */
export type SpecSource = "maker" | "enclosure" | "estimate"

/** DC plug polarity. Center negative is the near-universal convention. */
export type Polarity = "center-negative" | "center-positive"

export type PowerSpec = {
  /** Current draw in mA at the nominal voltage. */
  ma: number
  /** Nominal supply voltage. 9 unless the pedal says otherwise. */
  volts: number
  polarity: Polarity
  /**
   * False for pedals with no DC input at all, which is most vintage fuzz: a
   * Fuzz Face, a Rangemaster and a Tone Bender take a battery and nothing
   * else. They need no output on the supply, and a planner that silently
   * allocated them one would under-report how many outputs are really free.
   */
  dcJack?: boolean
  /**
   * True when the pedal wants AC rather than DC, which almost no supply on a
   * board provides. The Line 6 DL4 is the famous one. Getting this wrong is
   * not a noise problem, it is a dead pedal, so it is called out loudly.
   */
  ac?: boolean
  /** Barrel size in mm, when it is not the usual 2.1mm. */
  barrelMm?: number
  source: SpecSource
  /** Anything a player needs to know before plugging it in. */
  note?: string
}

export type Dimensions = {
  /** Left to right, as the pedal sits facing the player. */
  widthMm: Mm
  /** Front to back, toward the player. Footswitch end is the front. */
  depthMm: Mm
  /** Tallest point including knobs, which is what decides case clearance. */
  heightMm: Mm
  source: SpecSource
}

export type PedalSpec = {
  /** Stable slug. Never reuse one: shared board URLs are built from these. */
  id: string
  brand: string
  model: string
  type: EffectType
  dims: Dimensions
  power: PowerSpec
  /** Grams. Null when unknown rather than guessed, so totals can say so. */
  weightG: number | null
  /** The standard enclosure this uses, when it uses one. */
  enclosure?: EnclosureId
  /**
   * A treadle (wah, volume, expression). They are much deeper than they are
   * wide, usually go at one end of a board, and the player's foot needs room
   * to rock, which the layout engine accounts for.
   */
  treadle?: boolean
  /**
   * Not a pedal that mounts on a board: a rack unit, a tabletop tape echo, an
   * amp-top box. Half the documented rigs contain one (Gilmour's Binson
   * Echorec, Edge's SDD-3000, the Space Echo on countless records) and they
   * are genuinely part of the rig, so they belong in the catalogue and in the
   * signal chain. They are just never laid out on the board, and saying that
   * plainly beats reporting that a tape echo does not fit a Pedaltrain.
   */
  offBoard?: boolean
  /** Model names that should also find this pedal in search. */
  aliases?: string[]
}

/** Standard Hammond-pattern and maker-standard enclosures, keyed by the name players use. */
export type EnclosureId =
  | "1590A"
  | "1590B"
  | "1590BB"
  | "1590XX"
  | "125B"
  | "boss-compact"
  | "boss-200"
  | "boss-500"
  | "ehx-nano"
  | "ehx-xo"
  | "ehx-large"
  | "mxr-compact"
  | "mxr-mini"
  | "strymon-compact"
  | "strymon-large"
  | "wah-treadle"
  | "volume-treadle"

export type Enclosure = {
  id: EnclosureId
  label: string
  dims: Dimensions
  /** What players typically build or find in this box. */
  examples: string
}

/**
 * A pedalboard.
 *
 * `usable` is the flat area you can actually mount pedals on, which is smaller
 * than the marketing dimension on every tiered board: a Pedaltrain Classic is
 * sold as 24 inches and has rails with gaps between them. The planner works in
 * usable area, because a board that "fits" on the box dimension and not on the
 * rails is exactly the mistake this tool exists to prevent.
 */
export type BoardSpec = {
  id: string
  brand: string
  model: string
  /** The size on the box, for recognising it in a shop. Display only. */
  labelWidthIn: number
  labelDepthIn: number
  usableWidthMm: Mm
  usableDepthMm: Mm
  /** Height of the board itself at its tallest, for case clearance. */
  heightMm: Mm
  weightG: number | null
  /**
   * Rails, front to back. A pedal has to sit ON a rail or bridge two of them,
   * which is why a deep pedal can fail to fit a shallow-railed board even
   * when the overall area looks fine.
   */
  rails: BoardRail[]
  /** Whether a power supply can be mounted underneath, freeing surface area. */
  underMount: boolean
  tiered: boolean
  aliases?: string[]
  note?: string
}

export type BoardRail = {
  /** Distance from the back edge of the usable area to this rail's back edge. */
  offsetMm: Mm
  /** Front-to-back width of the rail itself. */
  depthMm: Mm
}

/**
 * One output, or one group of identical outputs, on a power supply.
 *
 * Grouped because supplies are specified that way ("6 x 9V 100mA, 2 x 9V
 * 250mA") and because expanding them into individual outputs is the planner's
 * job, not the catalogue's.
 */
export type SupplyOutput = {
  count: number
  /**
   * Every voltage this output can be set to, so more than one entry IS the
   * switchable flag. A separate boolean would be a second source of truth for
   * the same fact and would eventually disagree with this array.
   */
  volts: number[]
  /** Maximum current per output at the nominal voltage. */
  ma: number
  polarity: Polarity
  ac?: boolean
  /** How the maker labels these on the unit, so the plan can name them. */
  label: string
}

export type SupplySpec = {
  id: string
  brand: string
  model: string
  outputs: SupplyOutput[]
  /**
   * How much to trust the output table above. Supplies vary the per-output
   * current far more than pedals vary their draw, and a plan built on a
   * guessed output map is worse than no plan, so the planner says which
   * supplies it is confident about.
   */
  source: SpecSource
  /**
   * True when every output is transformer or converter isolated from every
   * other. This is the whole reason to buy a brick rather than a daisy chain,
   * and it is what fixes the hum people otherwise chase for months.
   */
  isolated: boolean
  dims: Dimensions
  weightG: number | null
  /** Fits under a tiered board rather than eating surface area. */
  mountsUnder: boolean
  aliases?: string[]
  note?: string
}

export const MM_PER_INCH = 25.4

export function mmToIn(mm: Mm): number {
  return mm / MM_PER_INCH
}

export function inToMm(inches: number): Mm {
  return inches * MM_PER_INCH
}

/** Footprint after rotation. 90 and 270 swap width and depth. */
export function rotatedFootprint(
  dims: Pick<Dimensions, "widthMm" | "depthMm">,
  rotation: Rotation,
): { widthMm: Mm; depthMm: Mm } {
  return rotation === 90 || rotation === 270
    ? { widthMm: dims.depthMm, depthMm: dims.widthMm }
    : { widthMm: dims.widthMm, depthMm: dims.depthMm }
}

/**
 * Quarter turns only.
 *
 * Every planner worth comparing against restricts to these, and it is not a
 * limitation: pedals sit square to the rails because the rails are straight,
 * and free rotation would let someone build a layout that cannot be screwed
 * or velcroed down in the real world.
 */
export type Rotation = 0 | 90 | 180 | 270

export const ROTATIONS: Rotation[] = [0, 90, 180, 270]
