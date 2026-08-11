import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { inferEffectType, type EffectType } from "@/lib/pedalboard/chain"

/**
 * Data layer for the rig builder (/pedalboard).
 *
 * Deliberately scoped to canonical_gear rather than raw listings: the board
 * places one instrument per slot, and a slot showing "3 listings, 2 stores"
 * is the whole point of the feature, so the aggregation happens here rather
 * than being re-derived in a client component on every render.
 */

const PEDAL_CATEGORY = "Effects Pedals"

export type PedalSummary = {
  slug: string
  brand: string
  model: string
  imageUrl: string | null
  marketPriceCents: number | null
  sampleSize: number
  /** Guessed from the name. The shopper can override it on the board. */
  type: EffectType
}

/**
 * Autocomplete search, scoped to pedals only. An empty query returns the
 * most-listed pedals instead of nothing, so the search box has something to
 * suggest before a shopper has typed anything (and so the board is never a
 * blank page with no way in).
 */
export async function searchPedals(q: string, limit = 8): Promise<PedalSummary[]> {
  const trimmed = q.trim()
  const pattern = `%${trimmed}%`

  const result = await db.execute<{
    slug: string
    brand: string
    model: string
    image_url: string | null
    avg_used_price_cents: number | null
    price_sample_size: number
  }>(sql`
    SELECT slug, brand, model, image_url,
           COALESCE(avg_used_price_cents, avg_new_price_cents) AS avg_used_price_cents,
           price_sample_size
    FROM canonical_gear
    WHERE category = ${PEDAL_CATEGORY}
      ${trimmed ? sql`AND (brand ILIKE ${pattern} OR model ILIKE ${pattern} OR (brand || ' ' || model) ILIKE ${pattern})` : sql``}
    ORDER BY price_sample_size DESC, brand ASC, model ASC
    LIMIT ${limit}
  `)

  return result.rows.map(toSummary)
}

function toSummary(r: {
  slug: string
  brand: string
  model: string
  image_url: string | null
  avg_used_price_cents: number | null
  price_sample_size: number
}): PedalSummary {
  return {
    slug: r.slug,
    brand: r.brand,
    model: r.model,
    imageUrl: r.image_url,
    marketPriceCents: r.avg_used_price_cents,
    sampleSize: r.price_sample_size,
    type: inferEffectType(r.brand, r.model, PEDAL_CATEGORY),
  }
}

export type PedalSourceAvailability = {
  source: string
  cheapestNewCents: number | null
  cheapestUsedCents: number | null
  count: number
  /** Cheapest live listing's id, so a slot can link straight at /go without a second query. */
  cheapestListingId: string | null
}

export type PedalBoardEntry = PedalSummary & {
  bySource: PedalSourceAvailability[]
}

/**
 * Full detail for a set of pedals already placed on the board: gear info plus
 * live per-store availability, split new vs used so a shopper can see at a
 * glance whether a store has it new, used, or not at all.
 *
 * Returns entries in the SAME ORDER as the input slugs (the chain order the
 * shopper built), since `slug IN (...)` does not preserve it and the board is
 * exactly the thing that must not silently reorder itself.
 */
export async function pedalBoardDetails(slugs: string[]): Promise<PedalBoardEntry[]> {
  if (slugs.length === 0) return []

  const result = await db.execute<{
    slug: string
    brand: string
    model: string
    image_url: string | null
    avg_used_price_cents: number | null
    price_sample_size: number
    source: string | null
    cheapest_new_cents: number | null
    cheapest_used_cents: number | null
    cheapest_listing_id: string | null
    count: number
  }>(sql`
    SELECT
      g.slug, g.brand, g.model, g.image_url,
      COALESCE(g.avg_used_price_cents, g.avg_new_price_cents) AS avg_used_price_cents,
      g.price_sample_size,
      l.source,
      MIN(l.price_cents) FILTER (WHERE l.condition ILIKE 'new') AS cheapest_new_cents,
      MIN(l.price_cents) FILTER (WHERE l.condition IS NULL OR l.condition NOT ILIKE 'new') AS cheapest_used_cents,
      -- The id of the cheapest live listing at this store, so the slot's buy
      -- link goes through /go for the right row rather than guessing at one.
      (ARRAY_AGG(l.id ORDER BY l.price_cents ASC))[1]::text AS cheapest_listing_id,
      COUNT(l.id)::int AS count
    FROM canonical_gear g
    LEFT JOIN marketplace_listings l
      ON l.canonical_gear_id = g.id AND l.listing_status = 'active'
    WHERE g.slug IN ${slugs} AND g.category = ${PEDAL_CATEGORY}
    GROUP BY g.slug, g.brand, g.model, g.image_url, g.avg_used_price_cents, g.avg_new_price_cents, g.price_sample_size, l.source
  `)

  const bySlug = new Map<string, PedalBoardEntry>()
  for (const row of result.rows) {
    let entry = bySlug.get(row.slug)
    if (!entry) {
      entry = { ...toSummary(row), bySource: [] }
      bySlug.set(row.slug, entry)
    }
    if (row.source) {
      entry.bySource.push({
        source: row.source,
        cheapestNewCents: row.cheapest_new_cents,
        cheapestUsedCents: row.cheapest_used_cents,
        cheapestListingId: row.cheapest_listing_id,
        count: row.count,
      })
    }
  }

  // Cheapest-overall store first, so the best deal on this pedal is the one
  // a shopper sees without scanning the whole list.
  for (const entry of bySlug.values()) {
    entry.bySource.sort((a, b) => {
      const cheapestA = Math.min(a.cheapestNewCents ?? Infinity, a.cheapestUsedCents ?? Infinity)
      const cheapestB = Math.min(b.cheapestNewCents ?? Infinity, b.cheapestUsedCents ?? Infinity)
      return cheapestA - cheapestB
    })
  }

  return slugs.map((slug) => bySlug.get(slug)).filter((e): e is PedalBoardEntry => e != null)
}

/**
 * Match a documented rig's pedals against the live catalogue, in one query.
 *
 * Returns one entry per INPUT pedal, matched or not, and that is the important
 * part. The old builder could only place pedals it stocked, which meant every
 * famous rig was unbuildable: none of the feeds live today carry Ibanez, MXR,
 * EHX or Boss back catalogue, so "load Gilmour's board" produced an empty
 * board and a shrug. Now an unmatched pedal still becomes a real slot that
 * counts towards the chain analysis and the power estimate, and says plainly
 * that nobody we track has one. That is a more useful and more honest answer
 * than pretending the pedal is not part of the rig.
 *
 * The match is brand AND model, both loose, because a catalogue row reads
 * "Ibanez TS9 Tube Screamer Overdrive Reissue" where the rig says "Ibanez /
 * TS9 Tube Screamer". Scoping to the brand is what stops "Blender" matching a
 * kitchen appliance in a mis-categorised feed row, the same reasoning that
 * scopes MPN and fuzzy matching to the brand in the resolver.
 */
export type RigMatch = {
  brand: string
  model: string
  matched: PedalSummary | null
}

export async function matchPedalsByName(
  pedals: { brand: string; model: string }[],
): Promise<RigMatch[]> {
  if (pedals.length === 0) return []

  const conditions = pedals.map(
    (p) => sql`(g.brand ILIKE ${`%${p.brand}%`} AND g.model ILIKE ${`%${p.model}%`})`,
  )

  const result = await db.execute<{
    slug: string
    brand: string
    model: string
    image_url: string | null
    avg_used_price_cents: number | null
    price_sample_size: number
  }>(sql`
    SELECT g.slug, g.brand, g.model, g.image_url, g.avg_used_price_cents, g.price_sample_size
    FROM canonical_gear g
    WHERE g.category = ${PEDAL_CATEGORY}
      AND (${sql.join(conditions, sql` OR `)})
    ORDER BY g.price_sample_size DESC
  `)

  const candidates = result.rows.map(toSummary)

  return pedals.map((pedal) => {
    const brand = pedal.brand.toLowerCase()
    const model = pedal.model.toLowerCase()
    const matched =
      candidates.find(
        (c) =>
          c.brand.toLowerCase().includes(brand) &&
          (c.model.toLowerCase().includes(model) || model.includes(c.model.toLowerCase())),
      ) ?? null
    return { brand: pedal.brand, model: pedal.model, matched }
  })
}
