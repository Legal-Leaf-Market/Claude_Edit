import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestSquaverFeed } from "@/lib/ingestion/squaver-woocommerce"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Squaver catalogue refresh from WooCommerce's public Store API. */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestSquaverFeed()
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: "squaver-woocommerce", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
