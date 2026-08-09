import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestEminenceDigitalFeed } from "@/lib/ingestion/eminencedigital-shopify"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Eminence Digital catalogue refresh from their public Shopify storefront JSON. */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestEminenceDigitalFeed()
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: "eminencedigital-shopify", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
