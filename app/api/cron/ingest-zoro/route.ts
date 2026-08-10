import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestZoroFeed } from "@/lib/ingestion/zoro-linkconnector"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Zoro catalogue refresh from the LinkConnector product datafeed, filtered to
 * the musical-instrument branch. No-ops with a clear reason when
 * LINKCONNECTOR_ZORO_FEED_URL is unset.
 *
 * Deliberately NOT registered in vercel.json, unlike the small Shopify sellers.
 * Zoro publishes on the order of 3.5M rows, which will not reliably finish
 * inside a serverless timeout, so the BullMQ worker is the intended runner
 * (lib/queue/queues.ts, daily) exactly as it is for the eBay bootstrap feed.
 * This route exists so the job can still be triggered by hand and so the
 * cron surface stays uniform across sources.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestZoroFeed()
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: "zoro-feed", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
