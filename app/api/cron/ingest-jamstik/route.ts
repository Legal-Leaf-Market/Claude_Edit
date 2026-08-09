import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestJamstikFeed } from "@/lib/ingestion/jamstik-shopify"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Jamstik catalogue refresh from their public Shopify storefront JSON. */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestJamstikFeed()
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: "jamstik-shopify", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
