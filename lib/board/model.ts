import { EFFECTS, inferEffectType, type EffectType } from "@/lib/pedalboard/chain"
import { PEDALS, type Pedal } from "@/lib/stompbox/pedals"
import { SLOT_BY_ID, type SlotId } from "@/lib/stompbox/chain"

/**
 * THE ONE BOARD MODEL, shared by both domains.
 *
 * There were two builders. The aggregator's knew about live stock, artist rigs,
 * power draw, cable runs and physical fit; the guide's knew what each circuit
 * actually does and drew the pedals. Both were good and neither was whole: you
 * could plan a board you could not buy, or buy a board nobody explained.
 *
 * WHY THIS LIVES IN `lib/board` AND NOT IN EITHER TREE. `lib/stompbox` may not
 * import ingestion, admin, affiliate, queue, auth, mail, cart or `lib/db`
 * (CLAUDE.md section 20), and that rule is what replaced a physical credential
 * boundary when the two projects merged. A shared module that quietly imported
 * the database would reopen the hole from the side the boundary test was not
 * looking at, so this tree obeys the SAME rule and
 * `tests/stompbox/boundary.test.ts` walks it too.
 *
 * The consequence shapes the whole design: **nothing here fetches anything.**
 * Commerce arrives as data, passed in by whichever page rendered the builder.
 * The aggregator passes prices, stores and buy links; the guide passes none,
 * and the same component renders both. That is not a limitation to work
 * around, it is how one page serves two domains with different rights over the
 * same rows.
 */

/** Where a board item came from, which decides what we are allowed to say about it. */
export type BoardSource =
  /** A documented circuit from the guide's own dataset. Has a writeup, has no price. */
  | "guide"
  /** A real product from a partner feed. Has a photo and possibly a price. */
  | "catalogue"

export type BoardItem = {
  /** Stable identity, unique across both sources, and what the share link encodes. */
  key: string
  name: string
  maker: string | null
  slot: SlotId
  source: BoardSource
  /** Product photo. Catalogue only: guide entries are drawn, never photographed. */
  imageUrl: string | null
  /** Slug of the catalogue model, for the buy link. Null for guide entries. */
  catalogSlug: string | null
  /**
   * The guide entry whose circuit description applies to this item, when one
   * does. THIS FIELD IS THE MARRIAGE: it is what lets a real Big Muff you can
   * buy carry the fuzz writeup that was previously only on the guide, and what
   * lets the attendant say something true about a product row.
   *
   * Null is the common and honest case. See `matchGuideEntry`.
   */
  guideSlug: string | null
  /** False when the player has switched it off. It stays on the board, out of the signal. */
  engaged: boolean

  /* --- electrical facts, used by the chain and power engines --- */
  buffered?: boolean
  wantsGuitarDirect?: boolean
  digital?: boolean
  /**
   * False when nobody has documented this circuit. The chain engine excludes
   * undocumented pedals from its buffer and impedance reasoning rather than
   * assuming, and says so, because silence would read as a clean bill of health.
   */
  circuitKnown: boolean
}

/** The commerce facts for one item, supplied by the page. Absent on the guide. */
export type ItemCommerce = {
  /** Cheapest live asking price, in cents. */
  cheapestCents: number | null
  /** How many live listings sit behind it. */
  listingCount: number
  /** Where the shopper is sent. Always a /go path, never a merchant URL. */
  buyHref: string | null
  /** Store names carrying it, for "three shops have this". */
  stores: string[]
}

/** Commerce for a whole board, keyed by item key. Empty object means no commerce. */
export type BoardCommerce = Record<string, ItemCommerce>

/* -------------------------------------------------------------------------- */
/*  Matching a product to a documented circuit                                */
/* -------------------------------------------------------------------------- */

/**
 * Normalise for comparison: lowercase, strip punctuation, collapse whitespace.
 *
 * Deliberately NOT stripping digits. "DS-1" and "DS-2" are different pedals and
 * a normaliser that threw away the number would merge them, which is the same
 * class of mistake `normalizeMpn()` rejects placeholders to avoid.
 */
function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Index of the guide's dataset, by normalised maker.
 *
 * Built once. The dataset is hand written and small by design, so this is a few
 * dozen entries rather than a scaling concern.
 */
const BY_MAKER = new Map<string, Pedal[]>()
for (const pedal of PEDALS) {
  const maker = norm(pedal.maker)
  const list = BY_MAKER.get(maker)
  if (list) list.push(pedal)
  else BY_MAKER.set(maker, [pedal])
}

/**
 * Which documented circuit, if any, describes this product.
 *
 * THE BIAS IS THE SAME AS ENTITY RESOLUTION'S: under-match rather than
 * over-match (CLAUDE.md section 4). An unmatched product still sits on the
 * board and still gets power, cable and chain advice from its type; a WRONG
 * match prints a confident paragraph about the wrong circuit on a page somebody
 * is about to spend money from. That is the same failure the reverse rig index
 * guards against when it refuses to match "Hamilton Beach Blender" to Kevin
 * Shields, and it is worse here because the text reads as fact rather than as
 * trivia.
 *
 * So three rules, all restrictive:
 *
 * 1. **Brand-scoped.** "Big Muff" under Electro-Harmonix is a Big Muff; under
 *    some other maker it is a clone with a different circuit and possibly a
 *    different answer to "what is it doing to my signal".
 * 2. **The guide's model name must appear as a whole-word run inside the
 *    product's.** A product called "Big Muff Pi Reissue" matches the entry
 *    "Big Muff"; a product called "Muff Fuzz" does not, because a substring
 *    test would let a three-letter fragment claim a paragraph.
 * 3. **A three-character floor**, and the longest match wins, so "DS-1" never
 *    beats "DS-1X" on a product that says DS-1X.
 */
export function matchGuideEntry(maker: string | null, model: string): Pedal | null {
  if (!maker) return null
  const candidates = BY_MAKER.get(norm(maker))
  if (!candidates?.length) return null

  const haystack = ` ${norm(model)} `
  let best: Pedal | null = null

  for (const pedal of candidates) {
    const needle = norm(pedal.name)
    if (needle.length < 3) continue
    if (!haystack.includes(` ${needle} `)) continue
    if (!best || needle.length > norm(best.name).length) best = pedal
  }

  return best
}

/* -------------------------------------------------------------------------- */
/*  Building items                                                             */
/* -------------------------------------------------------------------------- */

/** A documented circuit from the guide, placed on the board. */
export function itemFromGuide(pedal: Pedal, engaged = true): BoardItem {
  return {
    key: `g:${pedal.slug}`,
    name: pedal.name,
    maker: pedal.maker,
    slot: pedal.slot,
    source: "guide",
    imageUrl: null,
    catalogSlug: null,
    guideSlug: pedal.slug,
    engaged,
    buffered: pedal.buffered,
    wantsGuitarDirect: pedal.wantsGuitarDirect,
    digital: pedal.digital,
    circuitKnown: true,
  }
}

/** The shape a page hands in for a real product, from whatever query it ran. */
export type CatalogInput = {
  slug: string
  brand: string
  model: string
  imageUrl: string | null
  /** The aggregator's effect type, when the caller already computed it. */
  type?: string
}

/**
 * A real product, placed on the board, carrying the guide's knowledge when we
 * recognise it.
 *
 * Returns null only when the product has no slot in the signal chain at all: a
 * power supply or a patch cable is a real thing to buy and not a thing to put
 * in the chain, and pretending otherwise would put a cable between the drive
 * and the delay.
 */
export function itemFromCatalog(input: CatalogInput, engaged = true): BoardItem | null {
  const guide = matchGuideEntry(input.brand, input.model)
  const type = (input.type as EffectType | undefined) ?? inferEffectType(input.brand, input.model)
  const slot = guide?.slot ?? slotForEffectType(type)
  if (!slot) return null

  return {
    key: `c:${input.slug}`,
    name: input.model,
    maker: input.brand,
    slot,
    source: "catalogue",
    imageUrl: input.imageUrl,
    catalogSlug: input.slug,
    guideSlug: guide?.slug ?? null,
    engaged,
    /* Electrical facts come from the documented circuit or not at all. Guessing
       that an unknown fuzz loads the pickups would be inventing a measurement. */
    buffered: guide?.buffered,
    wantsGuitarDirect: guide?.wantsGuitarDirect,
    digital: guide?.digital,
    circuitKnown: guide !== null,
  }
}

/**
 * The aggregator's effect types mapped onto the guide's chain slots.
 *
 * The guide's slot list is canonical for ORDER (section 20), and this is the
 * other half of that agreement: the planner carries three types the guide has
 * no opinion on, and they have to land somewhere or the products carrying them
 * cannot go on a board at all.
 *
 * `looper` and `utility` return null deliberately. A looper belongs after
 * everything and a utility's position "depends entirely on the job it is
 * doing", so neither has a slot in a chain whose whole promise is that every
 * position has a reason.
 */
export function slotForEffectType(type: EffectType | string): SlotId | null {
  switch (type) {
    case "tuner":
      return "tuner"
    case "filter":
      return "filter"
    case "compressor":
      return "dynamics"
    case "fuzz":
      return "fuzz"
    case "drive":
      return "drive"
    case "eq":
      return "eq"
    case "gate":
      return "gate"
    case "volume":
      return "volume"
    /* Pitch sits with modulation: both are after the gain and before the
       ambience, and the guide has no pitch slot to disagree with. */
    case "pitch":
    case "modulation":
      return "modulation"
    case "delay":
      return "delay"
    case "reverb":
      return "reverb"
    default:
      return null
  }
}

/** The planner's type for an item, for the power and layout engines. */
export function effectTypeOf(item: BoardItem): EffectType {
  const direct = SLOT_TO_TYPE[item.slot]
  return direct in EFFECTS ? direct : "utility"
}

const SLOT_TO_TYPE: Record<SlotId, EffectType> = {
  tuner: "tuner",
  filter: "filter",
  dynamics: "compressor",
  fuzz: "fuzz",
  drive: "drive",
  eq: "eq",
  gate: "gate",
  volume: "volume",
  modulation: "modulation",
  delay: "delay",
  reverb: "reverb",
}

/* -------------------------------------------------------------------------- */
/*  Ordering and state                                                         */
/* -------------------------------------------------------------------------- */

const SLOT_ORDER: SlotId[] = Object.keys(SLOT_TO_TYPE) as SlotId[]

/**
 * Signal order, guitar first.
 *
 * STABLE WITHIN A SLOT: which of two overdrives goes first is a taste decision
 * this file has no business making, so the caller's order survives.
 */
export function orderBoard(items: BoardItem[]): BoardItem[] {
  const rank = (slot: SlotId) => SLOT_ORDER.indexOf(slot)
  return [...items].sort((a, b) => rank(a.slot) - rank(b.slot))
}

/** Only what is switched on. A bypassed pedal is on the board and out of the signal. */
export function engagedOf(items: BoardItem[]): BoardItem[] {
  return items.filter((item) => item.engaged)
}

/** What the slot is called, for anything printing a position. */
export function slotLabel(slot: SlotId): string {
  return SLOT_BY_ID[slot]?.name ?? slot
}

/** Why the slot sits where it does. The attendant's line about position. */
export function slotReason(slot: SlotId): string {
  return SLOT_BY_ID[slot]?.why ?? ""
}

export const MAX_ITEMS = 16
