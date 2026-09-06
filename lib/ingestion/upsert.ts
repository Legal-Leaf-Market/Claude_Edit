import { and, eq, inArray, lt, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  ingestRuns,
  listingPriceHistory,
  marketplaceListings,
  type NewMarketplaceListing,
} from "@/lib/db/schema"
import { resolveCanonicalGear } from "@/lib/canonical/resolve"
import { refreshDealsForGear } from "@/lib/deals/pricing"

/**
 * Persistence for ingested listings.
 *
 * Every path through here is idempotent on (source, external_id). Feeds
 * overlap by design (a daily NEWLY_LISTED pull and the hourly snapshot will
 * both carry the same item), and a re-run after a failure must be a no-op
 * rather than a duplicate.
 */

export type UpsertStats = {
  seen: number
  inserted: number
  updated: number
  skipped: number
  priceChanges: number
  touchedGearIds: string[]
}

function emptyStats(): UpsertStats {
  return { seen: 0, inserted: 0, updated: 0, skipped: 0, priceChanges: 0, touchedGearIds: [] }
}

/** Rows per INSERT. Large enough to amortise round trips, small enough to stay under parameter limits. */
const BATCH_SIZE = 250

/**
 * Upsert a batch of listings.
 *
 * The returning clause tells us which rows were new (xmax = 0 is the Postgres
 * idiom for "this tuple was inserted, not updated by this statement") and what
 * the price was before the write, which is how price history stays free of
 * no-change rows.
 */
export async function upsertListings(rows: NewMarketplaceListing[]): Promise<UpsertStats> {
  const stats = emptyStats()
  if (rows.length === 0) return stats

  // Deduplicate inside the batch. Postgres rejects an ON CONFLICT statement
  // that tries to update the same target row twice in one command, and feeds do
  // occasionally repeat an item within a single file.
  const byKey = new Map<string, NewMarketplaceListing>()
  for (const row of rows) {
    stats.seen += 1
    if (!row.externalId || !row.source) {
      stats.skipped += 1
      continue
    }
    byKey.set(`${row.source}::${row.externalId}`, row)
  }
  const deduped = [...byKey.values()]

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE)

    const result = await db
      .insert(marketplaceListings)
      .values(batch)
      .onConflictDoUpdate({
        target: [marketplaceListings.source, marketplaceListings.externalId],
        set: {
          title: sql`excluded.title`,
          priceCents: sql`excluded.price_cents`,
          currency: sql`excluded.currency`,
          condition: sql`excluded.condition`,
          brand: sql`excluded.brand`,
          gtin: sql`excluded.gtin`,
          epid: sql`excluded.epid`,
          mpn: sql`excluded.mpn`,
          locationCountry: sql`excluded.location_country`,
          locationZip: sql`excluded.location_zip`,
          isLocalPickup: sql`excluded.is_local_pickup`,
          isShippable: sql`excluded.is_shippable`,
          rawUrl: sql`excluded.raw_url`,
          // Never overwrite a stored affiliate URL with a null: a later feed
          // pulled without affiliate context would otherwise silently strip our
          // monetisation off every row it touched.
          affiliateUrl: sql`COALESCE(excluded.affiliate_url, ${marketplaceListings.affiliateUrl})`,
          primaryImageUrl: sql`COALESCE(excluded.primary_image_url, ${marketplaceListings.primaryImageUrl})`,
          platformVariantId: sql`excluded.platform_variant_id`,
          // Same COALESCE reasoning as affiliate_url above: a re-pull from a
          // feed that dropped its category column would otherwise erase the
          // category off every row it touched, and the gear would quietly fall
          // back to whatever its title parses as.
          feedCategory: sql`COALESCE(excluded.feed_category, ${marketplaceListings.feedCategory})`,
          listingStatus: sql`excluded.listing_status`,
          listedAt: sql`COALESCE(excluded.listed_at, ${marketplaceListings.listedAt})`,
          endsAt: sql`COALESCE(excluded.ends_at, ${marketplaceListings.endsAt})`,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: marketplaceListings.id,
        source: marketplaceListings.source,
        priceCents: marketplaceListings.priceCents,
        listingStatus: marketplaceListings.listingStatus,
        canonicalGearId: marketplaceListings.canonicalGearId,
        wasInserted: sql<boolean>`(xmax = 0)`,
      })

    for (const row of result) {
      if (row.wasInserted) stats.inserted += 1
      else stats.updated += 1
      if (row.canonicalGearId) stats.touchedGearIds.push(row.canonicalGearId)
    }

    // Price history: one row per listing per observed price change. Written
    // after the upsert so it records the value that actually landed.
    stats.priceChanges += await recordPriceHistory(
      result.map((r) => ({
        listingId: r.id,
        canonicalGearId: r.canonicalGearId,
        source: r.source,
        priceCents: r.priceCents,
        listingStatus: r.listingStatus,
      })),
    )
  }

  return stats
}

type PriceObservation = {
  listingId: string
  canonicalGearId: string | null
  source: string
  priceCents: number
  listingStatus: string
}

/**
 * Append price observations, but only where the price or status actually moved.
 *
 * The hourly snapshot touches most of the catalogue every run; without this
 * filter the history table would grow by the size of the catalogue per hour and
 * the price chart would be a flat line drawn a thousand times.
 */
async function recordPriceHistory(observations: PriceObservation[]): Promise<number> {
  if (observations.length === 0) return 0

  const ids = observations.map((o) => o.listingId)
  const latest = await db
    .select({
      listingId: listingPriceHistory.listingId,
      priceCents: listingPriceHistory.priceCents,
      listingStatus: listingPriceHistory.listingStatus,
      observedAt: listingPriceHistory.observedAt,
    })
    .from(listingPriceHistory)
    .where(
      sql`${listingPriceHistory.listingId} IN ${ids} AND ${listingPriceHistory.observedAt} = (
            SELECT MAX(h2.observed_at) FROM listing_price_history h2
            WHERE h2.listing_id = ${listingPriceHistory.listingId}
          )`,
    )

  const lastByListing = new Map(latest.map((l) => [l.listingId, l]))

  const toInsert = observations.filter((o) => {
    const last = lastByListing.get(o.listingId)
    if (!last) return true
    return last.priceCents !== o.priceCents || last.listingStatus !== o.listingStatus
  })

  if (toInsert.length === 0) return 0

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    await db.insert(listingPriceHistory).values(
      toInsert.slice(i, i + BATCH_SIZE).map((o) => ({
        listingId: o.listingId,
        canonicalGearId: o.canonicalGearId,
        source: o.source,
        priceCents: o.priceCents,
        listingStatus: o.listingStatus,
      })),
    )
  }
  return toInsert.length
}

/**
 * Resolve, then reprice. Called once at the end of an ingest run rather than
 * per row, so a batch of 40,000 new listings costs one resolution pass and one
 * repricing pass over the gear it actually touched.
 */
export async function resolveAndReprice(stats: UpsertStats): Promise<{
  resolved: number
  gearUpdated: number
}> {
  const unresolved = await db
    .select({
      id: marketplaceListings.id,
      title: marketplaceListings.title,
      brand: marketplaceListings.brand,
      gtin: marketplaceListings.gtin,
      epid: marketplaceListings.epid,
      mpn: marketplaceListings.mpn,
      primaryImageUrl: marketplaceListings.primaryImageUrl,
      feedCategory: marketplaceListings.feedCategory,
    })
    .from(marketplaceListings)
    .where(sql`${marketplaceListings.canonicalGearId} IS NULL`)
    .limit(20_000)

  const touched = new Set(stats.touchedGearIds)
  let resolved = 0

  for (const row of unresolved) {
    const result = await resolveCanonicalGear(row)
    if (!result) continue
    await db
      .update(marketplaceListings)
      .set({
        canonicalGearId: result.gearId,
        matchTier: result.tier,
        matchScore: result.score,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, row.id))
    touched.add(result.gearId)
    resolved += 1
  }

  const { gearUpdated } = await refreshDealsForGear([...touched])
  return { resolved, gearUpdated }
}

/* -------------------------------------------------------------------------- */
/*  Status reconciliation                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Mark listings ended.
 *
 * The snapshot feed reports items that changed, including ones that sold or
 * were pulled. Anything whose end date has passed is expired regardless of what
 * the feed said, which covers the case where we simply missed a snapshot hour.
 */
export async function expirePastEndDate(source: string): Promise<number> {
  const rows = await db
    .update(marketplaceListings)
    .set({ listingStatus: "expired", isDeal: false, updatedAt: new Date() })
    .where(
      and(
        eq(marketplaceListings.source, source),
        eq(marketplaceListings.listingStatus, "active"),
        sql`${marketplaceListings.endsAt} IS NOT NULL`,
        lt(marketplaceListings.endsAt, new Date()),
      ),
    )
    .returning({ id: marketplaceListings.id })
  return rows.length
}

/** Explicitly mark a set of external ids as sold or ended. */
export async function markStatus(
  source: string,
  externalIds: string[],
  status: "sold" | "expired",
): Promise<number> {
  if (externalIds.length === 0) return 0
  let total = 0
  for (let i = 0; i < externalIds.length; i += BATCH_SIZE) {
    const rows = await db
      .update(marketplaceListings)
      .set({ listingStatus: status, isDeal: false, updatedAt: new Date() })
      .where(
        and(
          eq(marketplaceListings.source, source),
          inArray(marketplaceListings.externalId, externalIds.slice(i, i + BATCH_SIZE)),
        ),
      )
      .returning({ id: marketplaceListings.id })
    total += rows.length
  }
  return total
}

/* -------------------------------------------------------------------------- */
/*  Run bookkeeping                                                           */
/* -------------------------------------------------------------------------- */

export type RunHandle = { id: string; startedAt: number }

export async function startRun(source: string, jobKind: string): Promise<RunHandle> {
  const rows = await db
    .insert(ingestRuns)
    .values({ source, jobKind, status: "running" })
    .returning({ id: ingestRuns.id })
  return { id: rows[0].id, startedAt: Date.now() }
}

export async function finishRun(
  handle: RunHandle,
  outcome: {
    status: "ok" | "failed" | "skipped"
    rowsSeen?: number
    rowsUpserted?: number
    rowsSkipped?: number
    bytesDownloaded?: number
    error?: string
    detail?: unknown
  },
): Promise<void> {
  await db
    .update(ingestRuns)
    .set({
      status: outcome.status,
      rowsSeen: outcome.rowsSeen ?? 0,
      rowsUpserted: outcome.rowsUpserted ?? 0,
      rowsSkipped: outcome.rowsSkipped ?? 0,
      bytesDownloaded: outcome.bytesDownloaded ?? 0,
      durationMs: Date.now() - handle.startedAt,
      error: outcome.error ?? null,
      detail: (outcome.detail ?? null) as never,
      finishedAt: new Date(),
    })
    .where(eq(ingestRuns.id, handle.id))
}
