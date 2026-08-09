import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestPinevilleMusicFeed } from "@/lib/ingestion/pinevillemusic-cj"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Pineville Music catalogue refresh from the CJ Affiliate product feed.
 * No-ops with a clear reason when CJ_PINEVILLEMUSIC_FEED_URL is unset.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestPinevilleMusicFeed()
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: "pinevillemusic-feed", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
