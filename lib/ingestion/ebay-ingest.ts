import { env } from "@/lib/env"
import { resolveEbayAffiliateUrl } from "@/lib/affiliate/ebay"
import {
  buildItemFeedUrl,
  buildItemSnapshotUrl,
  EbayFeedError,
  feedDateStamp,
  normalizeToListing,
  snapshotHourStamp,
  streamFeedItems,
  type EbayItem,
  type FeedFetchOptions,
} from "./ebay-feed"
import {
  expirePastEndDate,
  finishRun,
  resolveAndReprice,
  startRun,
  upsertListings,
  type UpsertStats,
} from "./upsert"
import { guardEbayCall, withBackoff } from "./rate-limit"
import type { NewMarketplaceListing } from "@/lib/db/schema"

/**
 * eBay ingestion jobs.
 *
 * Three schedules, matching the three shapes the Feed API offers:
 *   - bootstrap, weekly:  ALL_ACTIVE, the full active catalogue for a category.
 *   - daily:              NEWLY_LISTED for a given date.
 *   - snapshot, hourly:   items that changed in one hour, which is how price
 *                         moves and sold/ended items reach us.
 *
 * All three are safe to re-run: the upsert is keyed on (source, external_id).
 */

/** Rows buffered before a flush. Keeps memory flat on a multi-GB bootstrap file. */
const FLUSH_EVERY = 2000

export type IngestOutcome = {
  status: "ok" | "skipped" | "failed"
  reason?: string
  categories: string[]
  stats: UpsertStats
  resolved: number
  expired: number
  error?: string
}

function emptyOutcome(status: IngestOutcome["status"], reason?: string): IngestOutcome {
  return {
    status,
    reason,
    categories: [],
    stats: { seen: 0, inserted: 0, updated: 0, skipped: 0, priceChanges: 0, touchedGearIds: [] },
    resolved: 0,
    expired: 0,
  }
}

function mergeStats(into: UpsertStats, from: UpsertStats): void {
  into.seen += from.seen
  into.inserted += from.inserted
  into.updated += from.updated
  into.skipped += from.skipped
  into.priceChanges += from.priceChanges
  into.touchedGearIds.push(...from.touchedGearIds)
}

/**
 * Map a feed Item to a listing row, attaching an affiliate URL.
 *
 * The feed's own itemAffiliateWebUrl is preferred; a built EPN link is the
 * fallback for rows that arrive without one, which is what happens whenever the
 * feed was pulled without affiliate context.
 */
function toListingRow(item: EbayItem): NewMarketplaceListing | null {
  const row = normalizeToListing(item)
  if (!row) return null
  row.affiliateUrl = resolveEbayAffiliateUrl(row.affiliateUrl ?? null, row.rawUrl, {
    customId: row.externalId,
  })
  return row
}

/**
 * Stream one feed URL into the database.
 *
 * Buffered rather than row-at-a-time: a per-row INSERT over a bootstrap feed
 * would be tens of thousands of round trips, and buffering the whole file would
 * not fit in memory. FLUSH_EVERY is the compromise.
 */
async function ingestFeedUrl(url: string, opts: FeedFetchOptions = {}): Promise<UpsertStats> {
  const total: UpsertStats = {
    seen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    priceChanges: 0,
    touchedGearIds: [],
  }
  let buffer: NewMarketplaceListing[] = []

  const flush = async () => {
    if (buffer.length === 0) return
    mergeStats(total, await upsertListings(buffer))
    buffer = []
  }

  for await (const item of streamFeedItems(url, opts)) {
    const row = toListingRow(item)
    if (!row) {
      total.seen += 1
      total.skipped += 1
      continue
    }
    buffer.push(row)
    if (buffer.length >= FLUSH_EVERY) await flush()
  }
  await flush()

  return total
}

/** One guarded, retrying call against a feed URL. */
async function ingestGuarded(url: string, opts: FeedFetchOptions = {}): Promise<UpsertStats> {
  const budget = await guardEbayCall()
  if (!budget.allowed) {
    throw new Error(
      `eBay daily call budget exhausted (${budget.used}/${budget.limit}). Ingestion will resume after the UTC day rolls over.`,
    )
  }
  return withBackoff(() => ingestFeedUrl(url, opts), {
    attempts: 5,
    baseDelayMs: 2000,
    onRetry: (attempt, delayMs, error) => {
      const status = error instanceof EbayFeedError ? error.status : "?"
      console.warn(`[ebay] retry ${attempt} after ${delayMs}ms (status ${status})`)
    },
  })
}

/** Shared guard for every eBay job: skip loudly rather than crashing a cron. */
function preflight(): string | null {
  if (!env.ebay.isConfigured) {
    return "EBAY_OAUTH_TOKEN is not set. eBay ingestion is gated on EPN approval; skipping."
  }
  if (env.ebay.categoryIds.length === 0) {
    return "EBAY_CATEGORY_IDS is empty; nothing to ingest."
  }
  /*
   * CONFIGURED BUT STILL POINTED AT SANDBOX, which is a state worth shouting
   * about now that these jobs run on a schedule rather than by hand.
   *
   * It is NOT a skip: sandbox is a legitimate place to exercise the parser, and
   * blocking it would make the feed untestable before EPN approval lands. It is
   * a warning because the failure it produces is silent in the worst way. A
   * token is set, so the job runs; the base URL still defaults to sandbox, so
   * it pulls a catalogue nobody can buy from; and the run reports "ok" with
   * almost nothing in it. From the outside that is indistinguishable from a
   * quiet market, which is the exact confusion CLAUDE.md section 10 says the
   * freshness column exists to prevent.
   *
   * /api/health reports the same thing as `ebay: "sandbox"`, but health is
   * something you go and look at. This lands in the logs of the job itself.
   */
  if (env.ebay.isSandbox) {
    console.warn(
      "[ebay] EBAY_OAUTH_TOKEN is set but EBAY_FEED_BASE_URL is still the SANDBOX default. " +
        "This run will pull sandbox data and report ok with nothing usable in it. " +
        "Set EBAY_FEED_BASE_URL per environment once a production keyset is approved.",
    )
  }
  return null
}

/* -------------------------------------------------------------------------- */
/*  Jobs                                                                      */
/* -------------------------------------------------------------------------- */

export async function ingestEbayDaily(
  date = feedDateStamp(),
  opts: FeedFetchOptions = {},
): Promise<IngestOutcome> {
  const skip = preflight()
  if (skip) {
    console.warn(`[ebay:daily] ${skip}`)
    return emptyOutcome("skipped", skip)
  }

  const run = await startRun("ebay", "ebay-daily")
  const outcome = emptyOutcome("ok")
  outcome.categories = [...env.ebay.categoryIds]

  try {
    for (const categoryId of env.ebay.categoryIds) {
      const url = buildItemFeedUrl({ categoryId, feedScope: "NEWLY_LISTED", date })
      mergeStats(outcome.stats, await ingestGuarded(url, opts))
    }
    const { resolved } = await resolveAndReprice(outcome.stats)
    outcome.resolved = resolved
    outcome.expired = await expirePastEndDate("ebay")

    await finishRun(run, {
      status: "ok",
      rowsSeen: outcome.stats.seen,
      rowsUpserted: outcome.stats.inserted + outcome.stats.updated,
      rowsSkipped: outcome.stats.skipped,
      detail: { date, categories: outcome.categories, resolved, expired: outcome.expired },
    })
    return outcome
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[ebay:daily] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message, rowsSeen: outcome.stats.seen })
    return { ...outcome, status: "failed", error: message }
  }
}

/**
 * Hourly reconciliation.
 *
 * The snapshot feed carries items that changed in a given hour, which is where
 * price drops and sold items come from. eBay lags roughly two hours generating
 * these files, so asking for the current hour reliably 404s; snapshotHourStamp
 * defaults three hours back.
 */
export async function ingestEbaySnapshot(
  snapshotDate = snapshotHourStamp(),
  opts: FeedFetchOptions = {},
): Promise<IngestOutcome> {
  const skip = preflight()
  if (skip) {
    console.warn(`[ebay:snapshot] ${skip}`)
    return emptyOutcome("skipped", skip)
  }

  const run = await startRun("ebay", "ebay-snapshot")
  const outcome = emptyOutcome("ok")
  outcome.categories = [...env.ebay.categoryIds]

  try {
    for (const categoryId of env.ebay.categoryIds) {
      const url = buildItemSnapshotUrl({ categoryId, snapshotDate })
      mergeStats(outcome.stats, await ingestGuarded(url, opts))
    }
    const { resolved } = await resolveAndReprice(outcome.stats)
    outcome.resolved = resolved
    outcome.expired = await expirePastEndDate("ebay")

    await finishRun(run, {
      status: "ok",
      rowsSeen: outcome.stats.seen,
      rowsUpserted: outcome.stats.inserted + outcome.stats.updated,
      rowsSkipped: outcome.stats.skipped,
      detail: {
        snapshotDate,
        categories: outcome.categories,
        resolved,
        expired: outcome.expired,
        priceChanges: outcome.stats.priceChanges,
      },
    })
    return outcome
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[ebay:snapshot] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message, rowsSeen: outcome.stats.seen })
    return { ...outcome, status: "failed", error: message }
  }
}

/** Weekly ALL_ACTIVE bootstrap. Large; run it off-peak. */
export async function ingestEbayBootstrap(opts: FeedFetchOptions = {}): Promise<IngestOutcome> {
  const skip = preflight()
  if (skip) {
    console.warn(`[ebay:bootstrap] ${skip}`)
    return emptyOutcome("skipped", skip)
  }

  const run = await startRun("ebay", "ebay-bootstrap")
  const outcome = emptyOutcome("ok")
  outcome.categories = [...env.ebay.categoryIds]

  try {
    for (const categoryId of env.ebay.categoryIds) {
      // date is deliberately omitted: ALL_ACTIVE ignores it.
      const url = buildItemFeedUrl({ categoryId, feedScope: "ALL_ACTIVE" })
      mergeStats(outcome.stats, await ingestGuarded(url, opts))
    }
    const { resolved } = await resolveAndReprice(outcome.stats)
    outcome.resolved = resolved
    outcome.expired = await expirePastEndDate("ebay")

    await finishRun(run, {
      status: "ok",
      rowsSeen: outcome.stats.seen,
      rowsUpserted: outcome.stats.inserted + outcome.stats.updated,
      rowsSkipped: outcome.stats.skipped,
      detail: { categories: outcome.categories, resolved, expired: outcome.expired },
    })
    return outcome
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[ebay:bootstrap] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message, rowsSeen: outcome.stats.seen })
    return { ...outcome, status: "failed", error: message }
  }
}
