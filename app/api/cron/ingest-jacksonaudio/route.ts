import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestJacksonAudioFeed } from "@/lib/ingestion/jacksonaudio-shopify"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Jackson Audio catalogue refresh from their public Shopify storefront JSON. */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestJacksonAudioFeed()
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: "jacksonaudio-shopify", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
