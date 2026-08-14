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
 *   - NEW AND USED ARE MEASURED SEPARATELY, and a listing is only ever judged
 *     against the median of its own condition class. See below.
 *
 * WHY THE CONDITION SPLIT EXISTS. One blended median across every listing was
 * fine while the catalogue was small independent sellers with mixed stock. It
 * breaks the moment a large new-retail feed lands: Andertons is roughly 27,000
 * products, and Gear4music, zZounds, Full Compass and Pineville Music all
 * default an empty condition to "New". New retail prices sit well above used
 * ones, so the blend rises, and then every ordinary used listing measures far
 * below that inflated "market" and earns a below-market badge it has not
 * earned. The failure is silent, sitewide, and in the worst possible direction:
 * inventing bargains is the one error a price comparison site cannot afford.
 */

/**
 * Below this many observations we refuse to state a market price.
 *
 * Applied PER CONDITION CLASS, not to the combined count. Gear with forty new
 * listings and two used ones publishes a new median and no used one, and flags
 * no deals on those two used listings. That is stricter than before and
 * deliberately so: two used prices were never a used market, and the forty new
 * ones are not evidence about what the used one is worth.
 */
export const MIN_SAMPLE_SIZE = 5

/** A listing is a deal when it is at least this far under the rolling median. */
export const DEAL_THRESHOLD = 0.2

/** How far back an ended listing still informs the market price. */
export const PRICE_WINDOW_DAYS = 90

/* -------------------------------------------------------------------------- */
/*  Condition classes                                                         */
/* -------------------------------------------------------------------------- */

export type ConditionClass = "new" | "used"

/**
 * Which market a listing belongs to.
 *
 * Two classes rather than a faithful taxonomy of every condition string the
 * feeds emit, because two is what the comparison needs: is this priced like
 * new retail, or like second-hand?
 *
 * WHERE THE AMBIGUOUS ONES GO, and why. "Open box", "New other (see details)"
 * and "Seller refurbished" are retail-channel goods that typically sell ten to
 * twenty percent under new, where genuinely used gear sits thirty to fifty
 * percent under. They are much nearer the new market than the used one, so they
 * are classed new.
 *
 * The risk is asymmetric, which settles it independently of that estimate.
 * Misfiling an open-box item as new nudges the new median down slightly and, at
 * worst, correctly badges it as cheaper than new. Misfiling it as used drags
 * the USED median up, and a lifted used median is what turns ordinary
 * second-hand prices into bargains that do not exist. When unsure, err towards
 * new: it is the direction that cannot invent a deal.
 *
 * A null condition is the one exception and stays used. The new-inventory feeds
 * all set the field explicitly, so a blank one is overwhelmingly a private
 * seller on a peer marketplace who did not fill it in.
 *
 * Kept in step with the SQL predicate below; the two must agree or the medians
 * and the deal flags would be computed over different populations, and there is
 * a test walking real condition strings through both.
 */
const NEW_CONDITION_JS = /(^\s*(brand\s+)?new\b)|(open[-\s]?box)|(refurb)/i

export function conditionClass(condition: string | null | undefined): ConditionClass {
  if (!condition) return "used"
  return NEW_CONDITION_JS.test(condition) ? "new" : "used"
}

/**
 * The SQL half of conditionClass(), as a POSIX regex.
 *
 * Must stay identical in meaning to the TypeScript above. The medians are
 * computed in JS from a fetched sample while the deal flags are set by a single
 * UPDATE in the database, so a divergence would flag listings against a median
 * built from a different population. There is a test that walks a list of real
 * condition strings through both and asserts they agree.
 *
 * `\M` is the end-of-word anchor in Postgres regexes, matching the `\b` in the
 * JS version, so "New" and "New other" classify alike but "Newark" does not.
 */
export const IS_NEW_CONDITION_REGEX =
  "(^[[:space:]]*(brand[[:space:]]+)?new\\M)|(open[-[:space:]]?box)|(refurb)"

const IS_NEW_SQL = sql`(${marketplaceListings.condition} IS NOT NULL AND ${marketplaceListings.condition} ~* ${IS_NEW_CONDITION_REGEX})`

/**
 * The market median matching a listing's OWN condition class, for the search
 * projections.
 *
 * This is what a card's struck-through "was" price is drawn from, so it has to
 * be the same median the deal was judged against. Selecting avg_used_price_cents
 * unconditionally (as both backends used to) would print the used median beside
 * a new listing badged against the new one: a number that is not wrong so much
 * as about a different thing entirely.
 *
 * ALIAS CONTRACT: assumes the listings table is aliased `l` and canonical_gear
 * is aliased `g`, which both search backends do. It is a raw fragment rather
 * than a drizzle column reference precisely so it can drop into those hand
 * written projections.
 */
export const LISTING_MARKET_PRICE_SQL = sql`CASE WHEN l.condition ~* ${IS_NEW_CONDITION_REGEX} THEN g.avg_new_price_cents ELSE g.avg_used_price_cents END`

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

/** One condition class's measured market. */
export type ClassMarket = {
  medianCents: number | null
  sampleSize: number
}

export type MarketPrice = {
  gearId: string
  used: ClassMarket
  new: ClassMarket
}

/**
 * The market price a SHOPPER is shown for this gear when only one number fits.
 *
 * Used wins when it exists, because this is a used-and-vintage-first site and
 * the used median is the number a visitor came for. New is the fallback, so
 * gear that only new retailers stock still shows something real rather than
 * "not enough data" beside forty live listings.
 *
 * Takes the two measurements rather than a whole MarketPrice, so a caller that
 * read the medians off canonical_gear can use it without inventing a gear id.
 * That matters more than it sounds: the endpoint publishing the pedal slice to
 * stompbox.world restated this rule as its own COALESCE and got it wrong, and a
 * rule stated twice is a rule that will disagree with itself eventually.
 */
export function headlineMarket(
  market: Pick<MarketPrice, "used" | "new">,
): ClassMarket & { basis: ConditionClass | null } {
  if (market.used.medianCents != null) return { ...market.used, basis: "used" }
  if (market.new.medianCents != null) return { ...market.new, basis: "new" }
  return { medianCents: null, sampleSize: market.used.sampleSize, basis: null }
}

/** Prices that inform the market for one piece of gear, split by condition class. */
async function priceSample(gearId: string): Promise<Record<ConditionClass, number[]>> {
  const cutoff = new Date(Date.now() - PRICE_WINDOW_DAYS * 86_400_000)
  const rows = await db
    .select({
      priceCents: marketplaceListings.priceCents,
      condition: marketplaceListings.condition,
    })
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

  const sample: Record<ConditionClass, number[]> = { new: [], used: [] }
  for (const row of rows) sample[conditionClass(row.condition)].push(row.priceCents)
  return sample
}

function measure(prices: number[]): ClassMarket {
  const sampleSize = prices.length
  return {
    sampleSize,
    medianCents: sampleSize >= MIN_SAMPLE_SIZE ? median(trimOutliers(prices)) : null,
  }
}

/** Recompute and persist both market prices for one piece of gear. */
export async function recomputeMarketPrice(gearId: string): Promise<MarketPrice> {
  const sample = await priceSample(gearId)
  const used = measure(sample.used)
  const fresh = measure(sample.new)

  await db
    .update(canonicalGear)
    .set({
      avgUsedPriceCents: used.medianCents,
      priceSampleSize: used.sampleSize,
      avgNewPriceCents: fresh.medianCents,
      newPriceSampleSize: fresh.sampleSize,
      priceUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(canonicalGear.id, gearId))

  return { gearId, used, new: fresh }
}

/**
 * Re-flag every listing for one piece of gear against its current market price.
 * Runs as a single UPDATE so a popular model does not turn into hundreds of
 * round trips.
 */
export async function reflagDeals(market: MarketPrice): Promise<number> {
  const { gearId } = market

  const usedMedian =
    market.used.sampleSize >= MIN_SAMPLE_SIZE ? market.used.medianCents : null
  const newMedian = market.new.sampleSize >= MIN_SAMPLE_SIZE ? market.new.medianCents : null

  if (usedMedian == null && newMedian == null) {
    // Not enough evidence in either class: withdraw any badge we previously
    // showed rather than leaving a stale one standing.
    const cleared = await db
      .update(marketplaceListings)
      .set({ isDeal: false, dealMargin: null, updatedAt: new Date() })
      .where(eq(marketplaceListings.canonicalGearId, gearId))
      .returning({ id: marketplaceListings.id })
    return cleared.length
  }

  /*
   * One UPDATE, branching per row on the row's own condition class, so a
   * popular model is still a single round trip rather than one per listing.
   *
   * A class with too small a sample yields NULL here rather than falling back
   * to the other class's median. That fallback is exactly the bug this change
   * removes: judging a used listing against a new-retail median is what
   * manufactures bargains that do not exist.
   */
  const marginFor = (m: number | null) =>
    m == null ? sql`NULL` : sql`(${m}::real - ${marketplaceListings.priceCents}::real) / ${m}::real`

  const dealFor = (m: number | null) =>
    m == null
      ? sql`false`
      : sql`(${marketplaceListings.priceCents} < ${Math.round(m * (1 - DEAL_THRESHOLD))}
             AND ${marketplaceListings.listingStatus} = 'active')`

  const updated = await db
    .update(marketplaceListings)
    .set({
      dealMargin: sql`CASE WHEN ${IS_NEW_SQL} THEN ${marginFor(newMedian)} ELSE ${marginFor(usedMedian)} END`,
      isDeal: sql`CASE WHEN ${IS_NEW_SQL} THEN ${dealFor(newMedian)} ELSE ${dealFor(usedMedian)} END`,
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
      avgNewPriceCents: canonicalGear.avgNewPriceCents,
      newPriceSampleSize: canonicalGear.newPriceSampleSize,
    })
    .from(canonicalGear)
    .where(inArray(canonicalGear.id, unique))

  return new Map(
    rows.map((r) => [
      r.id,
      {
        gearId: r.id,
        used: { medianCents: r.avgUsedPriceCents, sampleSize: r.priceSampleSize },
        new: { medianCents: r.avgNewPriceCents, sampleSize: r.newPriceSampleSize },
      },
    ]),
  )
}
