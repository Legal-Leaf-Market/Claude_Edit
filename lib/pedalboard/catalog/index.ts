import { ENCLOSURES } from "./enclosures"
import { PEDALS } from "./pedals"
import type { Dimensions, PedalSpec } from "./types"
import type { EffectType } from "@/lib/pedalboard/chain"

export * from "./types"
export { ENCLOSURES, ENCLOSURES_BY_SIZE, ENCLOSURE_LIST } from "./enclosures"
export { PEDALS, PEDALS_SORTED, pedalById } from "./pedals"
export { BOARDS, BOARDS_BY_SIZE, boardById, DEFAULT_BOARD_ID } from "./boards"
export {
  SUPPLIES,
  SUPPLIES_BY_CAPACITY,
  supplyById,
  supplyOutputCount,
  supplyTotalMa,
} from "./supplies"

/**
 * Matching an ingested listing to a physical spec.
 *
 * The two catalogues are joined by brand and model text, because that is the
 * only thing they share: `canonical_gear` comes from partner feeds and carries
 * no dimensions, and this catalogue is hand-authored and carries no listing
 * ids. A feed row saying "Boss DS-1 Distortion Pedal" has to find the spec
 * filed as "DS-1 Distortion".
 *
 * MATCHING IS DELIBERATELY CONSERVATIVE, and it is the same bias the entity
 * resolver takes in CLAUDE.md section 4: under-match rather than over-match. A
 * pedal with no spec is drawn at a neutral default size and clearly labelled
 * as an estimate, which is a small inaccuracy. A pedal matched to the WRONG
 * spec is laid out at the wrong size and powered against the wrong current
 * draw, which is a confident lie, and confident lies are what this whole
 * catalogue exists to avoid.
 *
 * So: brand must match, and the model has to contain the catalogue model or
 * one of its aliases as a whole token run. No fuzzy distance, no scoring.
 */

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Brand synonyms seen in real feed data. */
const BRAND_ALIASES: Record<string, string> = {
  "electro harmonix": "electro harmonix",
  ehx: "electro harmonix",
  "boss roland": "boss",
  "jim dunlop": "dunlop",
  "dunlop manufacturing": "dunlop",
  "mxr dunlop": "mxr",
  "jhs": "jhs pedals",
  "pro co": "proco",
  "walrus": "walrus audio",
  "earthquaker": "earthquaker devices",
  "chase bliss": "chase bliss audio",
  "tc": "tc electronic",
  "universal audio uafx": "universal audio",
}

function normaliseBrand(brand: string): string {
  const n = normalise(brand)
  return BRAND_ALIASES[n] ?? n
}

type Indexed = { spec: PedalSpec; brand: string; needles: string[] }

const INDEX: Indexed[] = PEDALS.map((spec) => ({
  spec,
  brand: normaliseBrand(spec.brand),
  needles: [spec.model, ...(spec.aliases ?? [])].map(normalise).sort((a, b) => b.length - a.length),
}))

/**
 * Find the physical spec for a listing, or null.
 *
 * Longest needle first, so "Big Muff Pi" wins over a hypothetical "Big Muff"
 * rather than whichever happened to be declared first.
 */
export function findPedalSpec(brand: string, model: string): PedalSpec | null {
  const haystack = normalise(`${brand} ${model}`)
  const wantedBrand = normaliseBrand(brand)

  const candidates = INDEX.filter((entry) => entry.brand === wantedBrand)
  let best: { spec: PedalSpec; length: number } | null = null

  for (const entry of candidates) {
    for (const needle of entry.needles) {
      if (!needle) continue
      if (haystack.includes(needle) && (!best || needle.length > best.length)) {
        best = { spec: entry.spec, length: needle.length }
      }
    }
  }

  return best?.spec ?? null
}

/**
 * A footprint for a pedal we have no spec for.
 *
 * A 1590B is the single most common enclosure in existence and the honest
 * middle: a mini pedal drawn at 1590B looks slightly too big, a Big Muff
 * slightly too small, and neither is misleading enough to plan around badly.
 * Marked `estimate` so every surface can say so.
 */
export function fallbackDimensions(): Dimensions {
  return { ...ENCLOSURES["1590B"].dims, source: "estimate" }
}

/**
 * Everything the planner needs about one pedal, spec'd or not.
 *
 * `matched` is what the UI keys off to say "estimated size" rather than
 * pretending the number is a measurement.
 */
export function resolvePedal(
  brand: string,
  model: string,
  type: EffectType,
): { spec: PedalSpec | null; dims: Dimensions; matched: boolean; treadle: boolean } {
  const spec = findPedalSpec(brand, model)
  if (spec) return { spec, dims: spec.dims, matched: true, treadle: spec.treadle ?? false }

  // A wah or a volume pedal is a treadle even when we have no spec for it, and
  // getting that wrong wastes a big chunk of board.
  const treadle = type === "filter" || type === "volume"
    ? /wah|volume|expression|treadle/i.test(`${brand} ${model}`)
    : false

  return { spec: null, dims: fallbackDimensions(), matched: false, treadle }
}
