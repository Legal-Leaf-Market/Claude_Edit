import { and, eq, gte, inArray, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { canonicalGear, marketplaceListings } from "@/lib/db/schema"

/**
 * Market pricing and deal detection.
 *
 * The claim "great deal" is the most load-bearing thing this site says, so the
 * maths behind it is deliberately boring and defensive:
 *
 *   - MEDIAN, not mean. One mispriced $12,000 "vintage" Strat listed by an
 *     optimist would drag a mean high enough to make every ordinary listing
 *     look like a bargain. The median shrugs that off.
 *   - A minimum sample size. Two listings are not a market. Below the floor we
 *     publish no market price and flag no deals, rather than inventing one.
 *   - Recently ended listings count. Restricting to active listings alone
 *     biases the sample towards overpriced gear, because the well priced items
 *     are precisely the ones that already sold.
 */

/** Below this many observations we refuse to state a market price. */
export const MIN_SAMPLE_SIZE = 5

/** A listing is a deal when it is at least this far under the rolling median. */
export const DEAL_THRESHOLD = 0.2

/** How far back an ended listing still informs the market price. */
export const PRICE_WINDOW_DAYS = 90

/* -------------------------------------------------------------------------- */
/*  Pure maths                                                                */
/* -------------------------------------------------------------------------- */

/** Median of a numeric sample. Returns null for an empty sample. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

/**
 * How far under market a price sits, as a fraction. 0.25 means 25% below.
 * Negative means above market. Null when there is no market price to compare to.
 */
export function dealMargin(priceCents: number, marketCents: number | null): number | null {
  if (marketCents == null || marketCents <= 0) return null
  if (!Number.isFinite(priceCents) || priceCents <= 0) return null
  return (marketCents - priceCents) / marketCents
}

/**
 * The deal test, expressed exactly as the spec states it:
 * price < 0.8 * market, i.e. more than 20% below the rolling median.
 */
export function isDeal(
  priceCents: number,
  marketCents: number | null,
  sampleSize: number,
  threshold = DEAL_THRESHOLD,
): boolean {
  if (sampleSize < MIN_SAMPLE_SIZE) return false
  const margin = dealMargin(priceCents, marketCents)
  if (margin == null) return false
  return margin > threshold
}

/**
 * Trim the extremes before taking the median.
 *
 * Used gear listings include obvious junk at both ends: "for parts" bodies at
 * $1 and aspirational collector prices at 10x. Dropping the outer decile on
 * each side stabilises the median once a sample is large enough to afford it.
 */
export function trimOutliers(values: number[], fraction = 0.1): number[] {
  if (values.length < 10) return values
  const sorted = [...values].sort((a, b) => a - b)
  const cut = Math.floor(sorted.length * fraction)
  return sorted.slice(cut, sorted.length - cut)
}

/* -------------------------------------------------------------------------- */
/*  Database-backed recomputation                                             */
/* -------------------------------------------------------------------------- */

export type MarketPrice = {
  gearId: string
  medianCents: number | null
  sampleSize: number
}

/** Prices that inform the market for one piece of gear. */
async function priceSample(gearId: string): Promise<number[]> {
  const cutoff = new Date(Date.now() - PRICE_WINDOW_DAYS * 86_400_000)
  const rows = await db
    .select({ priceCents: marketplaceListings.priceCents })
    .from(marketplaceListings)
    .where(
      and(
        eq(marketplaceListings.canonicalGearId, gearId),
        // Active listings, plus anything that ended inside the window. Expired
        // and sold both carry price signal; only stale rows are excluded.
        or(
          eq(marketplaceListings.listingStatus, "active"),
          gte(marketplaceListings.updatedAt, cutoff),
        ),
        sql`${marketplaceListings.priceCents} > 0`,
      ),
    )
  return rows.map((r) => r.priceCents)
}

/** Recompute and persist the market price for one piece of gear. */
export async function recomputeMarketPrice(gearId: string): Promise<MarketPrice> {
  const sample = await priceSample(gearId)
  const sampleSize = sample.length
  const trimmed = trimOutliers(sample)
  const medianCents = sampleSize >= MIN_SAMPLE_SIZE ? median(trimmed) : null

  await db
    .update(canonicalGear)
    .set({
      avgUsedPriceCents: medianCents,
      priceSampleSize: sampleSize,
      priceUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(canonicalGear.id, gearId))

  return { gearId, medianCents, sampleSize }
}

/**
 * Re-flag every listing for one piece of gear against its current market price.
 * Runs as a single UPDATE so a popular model does not turn into hundreds of
 * round trips.
 */
export async function reflagDeals(market: MarketPrice): Promise<number> {
  const { gearId, medianCents, sampleSize } = market

  if (medianCents == null || sampleSize < MIN_SAMPLE_SIZE) {
    // Not enough evidence: withdraw any deal badge we previously showed.
    const cleared = await db
      .update(marketplaceListings)
      .set({ isDeal: false, dealMargin: null, updatedAt: new Date() })
      .where(eq(marketplaceListings.canonicalGearId, gearId))
      .returning({ id: marketplaceListings.id })
    return cleared.length
  }

  const updated = await db
    .update(marketplaceListings)
    .set({
      dealMargin: sql`(${medianCents}::real - ${marketplaceListings.priceCents}::real) / ${medianCents}::real`,
      isDeal: sql`${marketplaceListings.priceCents} < ${Math.round(medianCents * (1 - DEAL_THRESHOLD))}
                  AND ${marketplaceListings.listingStatus} = 'active'`,
      updatedAt: new Date(),
    })
    .where(eq(marketplaceListings.canonicalGearId, gearId))
    .returning({ id: marketplaceListings.id })

  return updated.length
}

/** Recompute market price and deal flags for a set of gear ids. */
export async function refreshDealsForGear(gearIds: string[]): Promise<{
  gearUpdated: number
  listingsUpdated: number
}> {
  const unique = [...new Set(gearIds)].filter(Boolean)
  let listingsUpdated = 0
  for (const gearId of unique) {
    const market = await recomputeMarketPrice(gearId)
    listingsUpdated += await reflagDeals(market)
  }
  return { gearUpdated: unique.length, listingsUpdated }
}

/**
 * Refresh every piece of gear that has listings. Used by the nightly job; the
 * per-ingest path uses refreshDealsForGear with just the gear it touched.
 */
export async function refreshAllDeals(batchSize = 500): Promise<{
  gearUpdated: number
  listingsUpdated: number
}> {
  let offset = 0
  let gearUpdated = 0
  let listingsUpdated = 0

  for (;;) {
    const batch = await db
      .selectDistinct({ id: marketplaceListings.canonicalGearId })
      .from(marketplaceListings)
      .where(sql`${marketplaceListings.canonicalGearId} IS NOT NULL`)
      .limit(batchSize)
      .offset(offset)

    const ids = batch.map((b) => b.id).filter((id): id is string => Boolean(id))
    if (ids.length === 0) break

    const result = await refreshDealsForGear(ids)
    gearUpdated += result.gearUpdated
    listingsUpdated += result.listingsUpdated
    offset += batchSize
  }

  return { gearUpdated, listingsUpdated }
}

/** Market prices for many gear ids at once, for list rendering. */
export async function marketPricesFor(gearIds: string[]): Promise<Map<string, MarketPrice>> {
  const unique = [...new Set(gearIds)].filter(Boolean)
  if (unique.length === 0) return new Map()

  const rows = await db
    .select({
      id: canonicalGear.id,
      avgUsedPriceCents: canonicalGear.avgUsedPriceCents,
      priceSampleSize: canonicalGear.priceSampleSize,
    })
    .from(canonicalGear)
    .where(inArray(canonicalGear.id, unique))

  return new Map(
    rows.map((r) => [
      r.id,
      { gearId: r.id, medianCents: r.avgUsedPriceCents, sampleSize: r.priceSampleSize },
    ]),
  )
}
