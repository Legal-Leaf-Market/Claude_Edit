import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestReverbFeed } from "@/lib/ingestion/reverb-awin"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Reverb catalogue refresh from the Awin product datafeed.
 * No-ops with a clear reason when AWIN_REVERB_FEED_URL is unset, which is the
 * expected state until Reverb's publisher feed is confirmed.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestReverbFeed()
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: "reverb-feed", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
