import { sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db"
import { headlineMarket, MIN_SAMPLE_SIZE, type ConditionClass } from "@/lib/deals/pricing"

/**
 * One definition of "what is actually for sale in a category, model by model".
 *
 * WHY THIS EXISTS. Two places ask that question and they were answering it
 * differently. `/used/[category]` (the page a shopper lands on) joins
 * canonical_gear to ACTIVE listings, so a model with nothing live in it is
 * simply not on the page. `/api/catalog/pedals` (the slice published to
 * stompbox.world) queried canonical_gear alone and ordered by price sample
 * size, so it happily published models whose listings had all ended, ranked
 * them above models you can actually buy, and did it under a heading that
 * said "most listed first". A canonical row outlives its listings by design:
 * the price sample deliberately counts listings that ended inside the last 90
 * days (lib/deals/pricing.ts), which is right for measuring a market and
 * wrong for stocking a shelf.
 *
 * So the join is the definition. No active listing, no row, on either surface.
 * That is section 7's "never fork the logic" applied to a query rather than to
 * a job: there is one answer to what is in stock, and both readers get it.
 *
 * SCOPE IS THE MODEL, NOT THE LISTING. One row per piece of canonical gear
 * with a count of where to get it, not eleven rows of the same Big Muff. The
 * per-listing detail (merchant, deep link, asking price) stays on Gear Avail,
 * where the outbound-click accounting and the partner attribution live.
 *
 * NO REGION FILTER HERE, DELIBERATELY. Section 15 hides stores that cannot
 * ship to a given shopper, and that is a per-request decision made from a geo
 * guess or a cookie. This function has neither, and its callers are a
 * revalidated page and a cached endpoint, so it answers for an UNKNOWN region,
 * which section 15 already defines as "show everything". A caller that knows
 * the shopper's region filters listings itself, the way /search does.
 */

/** One canonical model with live stock behind it. */
export type LiveModel = {
  slug: string
  brand: string
  model: string
  category: string
  imageUrl: string | null
  /** Active listings right now. Always at least 1: that is what makes it live. */
  listingCount: number
  /**
   * Cheapest active asking price. A per-listing number, so it is fine on Gear
   * Avail's own pages and is deliberately NOT republished to the sister site.
   */
  cheapestCents: number | null
  /** Rolling median of used listings, null until the used sample alone clears the floor. */
  usedPriceCents: number | null
  usedSampleSize: number
  /** The same pair for new listings. Measured separately: section 8. */
  newPriceCents: number | null
  newSampleSize: number
}

/** The one market price to print when only one number fits, and which market it is. */
export type HeadlinePrice = {
  cents: number | null
  sampleSize: number
  basis: ConditionClass | null
}

type Row = {
  slug: string
  brand: string
  model: string
  category: string
  image_url: string | null
  listing_count: number
  cheapest_cents: number | null
  avg_used_price_cents: number | null
  price_sample_size: number
  avg_new_price_cents: number | null
  new_price_sample_size: number
}

function intOrZero(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function centsOrNull(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Row to model, with the sample floor applied a second time.
 *
 * recomputeMarketPrice() already writes null into the median column when its
 * class is under MIN_SAMPLE_SIZE, so this is belt and braces. It stays because
 * the alternative is trusting that every writer of those columns, now and
 * later, remembers the floor: the cost of the check is nothing and the cost of
 * publishing a median of two asking prices is the one error this site cannot
 * afford (section 8).
 */
export function toLiveModel(row: Row): LiveModel {
  const usedSampleSize = intOrZero(row.price_sample_size)
  const newSampleSize = intOrZero(row.new_price_sample_size)
  return {
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    category: row.category,
    imageUrl: row.image_url,
    listingCount: intOrZero(row.listing_count),
    cheapestCents: centsOrNull(row.cheapest_cents),
    usedPriceCents:
      usedSampleSize >= MIN_SAMPLE_SIZE ? centsOrNull(row.avg_used_price_cents) : null,
    usedSampleSize,
    newPriceCents: newSampleSize >= MIN_SAMPLE_SIZE ? centsOrNull(row.avg_new_price_cents) : null,
    newSampleSize,
  }
}

/**
 * The market price a shopper is shown when only one number fits.
 *
 * Delegates to headlineMarket() rather than restating "used first, new as a
 * fallback" in a second place. The endpoint that published this slice used to
 * restate it as COALESCE(avg_used, avg_new) gated on the USED sample size,
 * which withheld the price of every new-only model on the sister site while
 * Gear Avail's own gear page printed it.
 */
export function headlinePrice(model: LiveModel): HeadlinePrice {
  const { medianCents, sampleSize, basis } = headlineMarket({
    used: { medianCents: model.usedPriceCents, sampleSize: model.usedSampleSize },
    new: { medianCents: model.newPriceCents, sampleSize: model.newSampleSize },
  })
  return { cents: medianCents, sampleSize, basis }
}

export type LiveModelQuery = {
  /** Category label exactly as canonical_gear.category stores it. */
  category: string
  limit?: number
  offset?: number
  /** Free text over brand and model. Optional. */
  q?: string
}

function textFilter(q: string | undefined): SQL {
  const trimmed = q?.trim()
  if (!trimmed) return sql``
  const pattern = `%${trimmed}%`
  return sql`AND (g.brand ILIKE ${pattern}
                  OR g.model ILIKE ${pattern}
                  OR (g.brand || ' ' || g.model) ILIKE ${pattern})`
}

/**
 * Models in a category with at least one active listing, most listed first.
 *
 * ORDER IS LIVE LISTING COUNT, which is the order both callers claim to be in.
 * Ordering by price sample size instead reads almost the same on a healthy
 * catalogue and inverts on a stale one, because the sample counts listings
 * that have already ended.
 */
export async function liveModels({
  category,
  limit = 60,
  offset = 0,
  q,
}: LiveModelQuery): Promise<LiveModel[]> {
  const result = await db.execute<Row>(sql`
    SELECT g.slug,
           g.brand,
           g.model,
           g.category,
           g.image_url,
           COUNT(l.id)::int AS listing_count,
           MIN(l.price_cents) FILTER (WHERE l.price_cents > 0) AS cheapest_cents,
           g.avg_used_price_cents,
           g.price_sample_size,
           g.avg_new_price_cents,
           g.new_price_sample_size
      FROM canonical_gear g
      JOIN marketplace_listings l
        ON l.canonical_gear_id = g.id
       AND l.listing_status = 'active'
     WHERE g.category = ${category}
       ${textFilter(q)}
     GROUP BY g.id
     ORDER BY listing_count DESC, g.brand ASC, g.model ASC
     LIMIT ${limit} OFFSET ${offset}
  `)
  return result.rows.map(toLiveModel)
}

/** How many models the query above would return without its limit. */
export async function countLiveModels({ category, q }: LiveModelQuery): Promise<number> {
  const result = await db.execute<{ count: number }>(sql`
    SELECT COUNT(DISTINCT g.id)::int AS count
      FROM canonical_gear g
      JOIN marketplace_listings l
        ON l.canonical_gear_id = g.id
       AND l.listing_status = 'active'
     WHERE g.category = ${category}
       ${textFilter(q)}
  `)
  return intOrZero(result.rows[0]?.count)
}
