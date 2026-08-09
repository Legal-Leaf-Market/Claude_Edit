import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestEbaySnapshot } from "@/lib/ingestion/ebay-ingest"
import { evaluateAlerts } from "@/lib/alerts/evaluate"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Hourly reconciliation: price changes and sold or ended listings.
 *
 * Alerts are evaluated here rather than on their own schedule, because this is
 * the job that surfaces price drops. Evaluating on an independent timer would
 * just mean alerts fire on stale data.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const outcome = await ingestEbaySnapshot()
  const indexed = await syncSearchIndex()
  const alerts = await evaluateAlerts()

  return NextResponse.json(
    { job: "ebay-snapshot", ...outcome, indexed, alerts },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
