import { env } from "@/lib/env"
import { pruneInactive, syncToTypesense, type SyncResult } from "./typesense"

/**
 * Keep the search index in step with Postgres.
 *
 * Called at the end of every ingest job. When Typesense is not configured this
 * is a no-op, because the Postgres backend reads the source of truth directly
 * and has nothing to sync.
 *
 * The incremental window is deliberately generous. Syncing exactly since the
 * last run would drop any row written while the previous sync was mid-flight;
 * an overlap re-indexes a few documents that did not change, which costs
 * nothing because the write is an upsert.
 */
const INCREMENTAL_OVERLAP_MINUTES = 90

export async function syncSearchIndex(
  options: { full?: boolean } = {},
): Promise<SyncResult & { pruned?: number }> {
  if (!env.typesense.isConfigured) {
    return { indexed: 0, batches: 0, skipped: true, reason: "Typesense is not configured" }
  }

  const since = options.full
    ? null
    : new Date(Date.now() - INCREMENTAL_OVERLAP_MINUTES * 60_000)

  const result = await syncToTypesense({ since })

  // Sold and expired listings must leave the index, or search keeps offering
  // gear that is already gone.
  const pruned = await pruneInactive().catch((error) => {
    console.error(
      `[search] prune failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return 0
  })

  return { ...result, pruned }
}
