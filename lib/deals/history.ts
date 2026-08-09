import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

/**
 * Observed price history for a piece of gear.
 *
 * This is OUR OWN observation record, not a marketplace analytics feed: each
 * point is the median asking price across the listings we had on file that day.
 * Saying so matters, because a median of asking prices is not the same as a
 * sold price, and the chart caption on the detail page says exactly that.
 */

export type PricePoint = {
  /** ISO date, day resolution. */
  date: string
  medianCents: number
  listingCount: number
}

/**
 * Daily median asking price for one canonical gear.
 *
 * `percentile_cont(0.5)` rather than avg() for the same reason the deal engine
 * uses a median: one collector-priced outlier should not bend the curve.
 */
export async function priceHistoryFor(
  canonicalGearId: string,
  days = 180,
): Promise<PricePoint[]> {
  const result = await db.execute<{ day: string; median: number; count: number }>(sql`
    SELECT
      date_trunc('day', observed_at)::date::text AS day,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cents)::int AS median,
      COUNT(DISTINCT listing_id)::int AS count
    FROM listing_price_history
    WHERE canonical_gear_id = ${canonicalGearId}
      AND observed_at >= NOW() - ${`${days} days`}::interval
      AND price_cents > 0
    GROUP BY 1
    ORDER BY 1 ASC
  `)

  return result.rows.map((r) => ({
    date: r.day,
    medianCents: Number(r.median),
    listingCount: Number(r.count),
  }))
}

/** All live listings for one canonical gear, cheapest first. */
export async function listingsForGear(canonicalGearId: string) {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      id, source, external_id, title, price_cents, currency, condition,
      primary_image_url, is_local_pickup, is_shippable, is_deal, deal_margin,
      listing_status, listed_at, canonical_gear_id
    FROM marketplace_listings
    WHERE canonical_gear_id = ${canonicalGearId}
      AND listing_status = 'active'
    ORDER BY price_cents ASC
    LIMIT 200
  `)
  return result.rows
}
