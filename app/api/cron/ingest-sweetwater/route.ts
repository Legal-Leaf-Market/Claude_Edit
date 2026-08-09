import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestSweetwaterFeed } from "@/lib/ingestion/sweetwater-linkconnector"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Sweetwater catalogue refresh from the LinkConnector product datafeed.
 * No-ops with a clear reason when LINKCONNECTOR_SWEETWATER_FEED_URL is unset,
 * which is the expected state until a real feed is confirmed to exist.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestSweetwaterFeed()
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: "sweetwater-feed", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
