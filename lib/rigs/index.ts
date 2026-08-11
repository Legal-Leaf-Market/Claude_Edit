import { EFFECTS, type EffectType } from "@/lib/pedalboard/chain"
import { RIGS, type Rig, type RigPedal, type RigRecord } from "@/lib/rigs/data"

export { RIGS }
export type { Rig, RigPedal, RigRecord }

/**
 * Lookups over the curated rig dataset.
 *
 * Everything here is derived from lib/rigs/data.ts at module load rather than
 * queried, because the dataset is a couple of dozen entries in the same
 * process. If it ever grows past the point where that is obviously fine, it
 * moves to its own table and these become SQL; nothing outside this file
 * should care which it is, which is why the callers only ever see functions.
 */

/** Which rigs lead the nav menu and the top of the index. */
export const FEATURED_RIG_SLUGS = [
  "jimi-hendrix",
  "david-gilmour",
  "the-edge",
  "stevie-ray-vaughan",
  "tom-morello",
  "jack-white",
  "jonny-greenwood",
  "billy-corgan",
]

export const RIG_BY_SLUG = new Map<string, Rig>(RIGS.map((r) => [r.slug, r]))

export function rigFromSlug(slug: string): Rig | null {
  return RIG_BY_SLUG.get(slug.toLowerCase()) ?? null
}

/** The one pedal a player is most identified with, for the index card and the nav hint. */
export function signaturePedal(rig: Rig): RigPedal {
  return rig.pedals.find((p) => p.signature) ?? rig.pedals[0]
}

/** Monogram for the character-select badge. Two letters, initials of the name. */
export function initialsFor(rig: Rig): string {
  return rig.name
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w[0] ?? ""))
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/**
 * A stable colour per rig, spread evenly around the wheel.
 *
 * Derived from the index rather than stored on the entry, so adding a rig
 * re-spaces the whole set instead of gradually clustering as hand-picked hues
 * accumulate. Same construction the old icons.ts used, kept because it worked.
 */
const HUE_BY_SLUG = new Map<string, string>(
  RIGS.map((rig, i) => [rig.slug, `hsl(${Math.round((i * 360) / RIGS.length)}, 66%, 56%)`]),
)

export function hueFor(rig: Rig): string {
  return HUE_BY_SLUG.get(rig.slug) ?? "hsl(28, 66%, 56%)"
}

export const DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s"] as const
export type Decade = (typeof DECADES)[number]

export function rigsByDecade(decade: string): Rig[] {
  return RIGS.filter((r) => r.decade === decade)
}

/**
 * Effect families with a rig count, for the "by sound" nav column.
 *
 * Grouped coarser than EffectType: a visitor browsing by sound thinks "fuzz"
 * and "echo", not "drive" and "delay", and splitting pitch out from
 * modulation would leave two columns of one entry each. Only families that
 * actually have rigs behind them are returned, so the menu can never offer a
 * filter that lands on an empty page.
 */
const EFFECT_FAMILIES: { slug: string; label: string; types: EffectType[] }[] = [
  { slug: "drive", label: "Fuzz and drive", types: ["drive"] },
  { slug: "wah", label: "Wah and filter", types: ["filter"] },
  { slug: "modulation", label: "Phaser and chorus", types: ["modulation"] },
  { slug: "delay", label: "Delay and echo", types: ["delay"] },
  { slug: "pitch", label: "Octave and pitch", types: ["pitch"] },
  { slug: "reverb", label: "Reverb", types: ["reverb"] },
  { slug: "compressor", label: "Compression", types: ["compressor", "eq"] },
]

export function rigsByEffectFamily(): { slug: string; label: string; count: number }[] {
  return EFFECT_FAMILIES.map((family) => ({
    slug: family.slug,
    label: family.label,
    count: RIGS.filter((rig) => rig.pedals.some((p) => family.types.includes(p.type))).length,
  })).filter((f) => f.count > 0)
}

export function rigsWithEffectFamily(familySlug: string): Rig[] {
  const family = EFFECT_FAMILIES.find((f) => f.slug === familySlug)
  if (!family) return []
  return RIGS.filter((rig) => rig.pedals.some((p) => family.types.includes(p.type)))
}

/**
 * THE REVERSE INDEX, and the reason this feature exists at all.
 *
 * Every other pedalboard planner treats a pedal as a product. Here a pedal
 * carries the records it was played on, so the gear page for a Big Muff can
 * say "Comfortably Numb, Cherub Rock, Seven Nation Army" rather than only
 * "$89 at three stores". That is the thing a shopper actually wants to know
 * and the thing a price-comparison site is otherwise structurally unable to
 * tell them.
 *
 * Keyed on a normalised brand and model so a catalogue row reading
 * "Electro-Harmonix Big Muff Pi (USA Reissue)" still finds the Gilmour and
 * Corgan entries. See matchNormalised below for how loose that match is
 * allowed to get, and why it is not looser.
 */
export type RigCredit = {
  rig: Rig
  pedal: RigPedal
  /** The records that rig is documented on, newest first. */
  records: RigRecord[]
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * A catalogue title matches a rig pedal when the brand matches and the model
 * is a substring of the title (or vice versa).
 *
 * Both directions are needed and neither alone is enough: a listing titled
 * "Ibanez TS9 Tube Screamer Overdrive Reissue" contains the model "TS9 Tube
 * Screamer", while a listing simply titled "Big Muff" is contained BY the
 * model "Big Muff Pi". Requiring the brand on top of that is what keeps
 * "Rat" from matching a rattlesnake-finish strap and "Blender" from matching
 * a kitchen appliance in a mis-categorised feed row.
 *
 * The three-character floor is the same instinct as normalizeMpn() rejecting
 * placeholders in the resolver: a two-character token matches half the
 * catalogue and a bad match here attaches a famous record to the wrong pedal,
 * which is worse than showing no credit at all.
 */
function matchesPedal(pedal: RigPedal, brand: string, model: string): boolean {
  const pedalBrand = normalise(pedal.brand)
  const listingBrand = normalise(brand)
  if (!pedalBrand || !listingBrand) return false

  const brandMatches =
    pedalBrand === listingBrand ||
    pedalBrand.startsWith(`${listingBrand} `) ||
    listingBrand.startsWith(`${pedalBrand} `)
  if (!brandMatches) return false

  const pedalModel = normalise(pedal.model)
  const listingModel = normalise(model)
  if (pedalModel.length < 3 || listingModel.length < 3) return false

  return pedalModel.includes(listingModel) || listingModel.includes(pedalModel)
}

/** Every documented use of this piece of gear, for the gear detail page. */
export function creditsForGear(brand: string, model: string): RigCredit[] {
  const credits: RigCredit[] = []
  for (const rig of RIGS) {
    for (const pedal of rig.pedals) {
      if (!matchesPedal(pedal, brand, model)) continue
      credits.push({
        rig,
        pedal,
        records: [...rig.records].sort((a, b) => b.year - a.year),
      })
    }
  }
  return credits
}

/** Flattened record list across every rig, newest first. Drives the "by record" view. */
export type RecordEntry = { rig: Rig; record: RigRecord }

export function allRecords(): RecordEntry[] {
  return RIGS.flatMap((rig) => rig.records.map((record) => ({ rig, record }))).sort(
    (a, b) => b.record.year - a.record.year,
  )
}

/** Total distinct tracks, for the index page's stat row. */
export function rigStats(): { rigs: number; records: number; tracks: number; pedals: number } {
  const pedals = new Set<string>()
  let records = 0
  let tracks = 0
  for (const rig of RIGS) {
    records += rig.records.length
    for (const record of rig.records) tracks += record.tracks.length
    for (const pedal of rig.pedals) pedals.add(`${normalise(pedal.brand)} ${normalise(pedal.model)}`)
  }
  return { rigs: RIGS.length, records, tracks, pedals: pedals.size }
}

/**
 * The rig as chain items, in the order it should be built.
 *
 * Sorted into conventional order rather than kept in the order the dataset
 * lists them, because the dataset lists the signature pedal first (which is
 * the right editorial choice and the wrong signal-chain one). The builder
 * re-analyses whatever it is handed anyway, so this only decides what the
 * shopper sees before they touch anything.
 */
export function rigChainOrder(rig: Rig): RigPedal[] {
  return [...rig.pedals].sort((a, b) => EFFECTS[a.type].rank - EFFECTS[b.type].rank)
}
