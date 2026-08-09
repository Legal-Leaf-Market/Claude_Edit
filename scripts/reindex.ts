import { closeDb } from "../lib/db"
import { env } from "../lib/env"
import { ensureCollection } from "../lib/search/typesense"
import { syncSearchIndex } from "../lib/search/sync"

/** Full Typesense rebuild. Safe to run any time: every write is an upsert. */
async function main() {
  if (!env.typesense.isConfigured) {
    console.log(
      "[reindex] Typesense is not configured. Search is served from Postgres, which needs no index.",
    )
    await closeDb()
    return
  }

  await ensureCollection()
  console.log(`[reindex] collection "${env.typesense.collection}" ready`)

  const result = await syncSearchIndex({ full: true })
  console.log(`[reindex] indexed ${result.indexed} documents in ${result.batches} batches`)
  if (result.pruned) console.log(`[reindex] pruned ${result.pruned} inactive documents`)

  await closeDb()
}

main().catch(async (error) => {
  console.error("[reindex] failed:", error)
  await closeDb()
  process.exit(1)
})
