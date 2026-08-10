import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

/**
 * Data layer for the "build your pedalboard" tool (/pedalboard).
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
    SELECT slug, brand, model, image_url, avg_used_price_cents, price_sample_size
    FROM canonical_gear
    WHERE category = ${PEDAL_CATEGORY}
      ${trimmed ? sql`AND (brand ILIKE ${pattern} OR model ILIKE ${pattern} OR (brand || ' ' || model) ILIKE ${pattern})` : sql``}
    ORDER BY price_sample_size DESC, brand ASC, model ASC
    LIMIT ${limit}
  `)

  return result.rows.map((r) => ({
    slug: r.slug,
    brand: r.brand,
    model: r.model,
    imageUrl: r.image_url,
    marketPriceCents: r.avg_used_price_cents,
    sampleSize: r.price_sample_size,
  }))
}

export type PedalSourceAvailability = {
  source: string
  cheapestNewCents: number | null
  cheapestUsedCents: number | null
  count: number
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
    count: number
  }>(sql`
    SELECT
      g.slug, g.brand, g.model, g.image_url, g.avg_used_price_cents, g.price_sample_size,
      l.source,
      MIN(l.price_cents) FILTER (WHERE l.condition ILIKE 'new') AS cheapest_new_cents,
      MIN(l.price_cents) FILTER (WHERE l.condition IS NULL OR l.condition NOT ILIKE 'new') AS cheapest_used_cents,
      COUNT(l.id)::int AS count
    FROM canonical_gear g
    LEFT JOIN marketplace_listings l
      ON l.canonical_gear_id = g.id AND l.listing_status = 'active'
    WHERE g.slug IN ${slugs} AND g.category = ${PEDAL_CATEGORY}
    GROUP BY g.slug, g.brand, g.model, g.image_url, g.avg_used_price_cents, g.price_sample_size, l.source
  `)

  const bySlug = new Map<string, PedalBoardEntry>()
  for (const row of result.rows) {
    let entry = bySlug.get(row.slug)
    if (!entry) {
      entry = {
        slug: row.slug,
        brand: row.brand,
        model: row.model,
        imageUrl: row.image_url,
        marketPriceCents: row.avg_used_price_cents,
        sampleSize: row.price_sample_size,
        bySource: [],
      }
      bySlug.set(row.slug, entry)
    }
    if (row.source) {
      entry.bySource.push({
        source: row.source,
        cheapestNewCents: row.cheapest_new_cents,
        cheapestUsedCents: row.cheapest_used_cents,
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
