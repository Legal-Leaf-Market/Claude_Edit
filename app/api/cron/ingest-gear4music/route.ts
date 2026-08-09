import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestGear4MusicFeed } from "@/lib/ingestion/gear4music-awin"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Gear4music catalogue refresh from the Awin product datafeed.
 * No-ops with a clear reason when AWIN_GEAR4MUSIC_FEED_URL is unset.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestGear4MusicFeed()
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: "gear4music-feed", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
