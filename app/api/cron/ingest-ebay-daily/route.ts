import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestEbayDaily } from "@/lib/ingestion/ebay-ingest"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Daily NEWLY_LISTED pull for every configured category. */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestEbayDaily()
  const indexed = await syncSearchIndex()

  return NextResponse.json(
    { job: "ebay-daily", ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
