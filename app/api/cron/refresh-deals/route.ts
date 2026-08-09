import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { refreshAllDeals } from "@/lib/deals/pricing"
import { pruneAlertMatches } from "@/lib/alerts/evaluate"
import { resolveUnmatchedListings } from "@/lib/canonical/resolve"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Nightly housekeeping.
 *
 * The per-ingest path only reprices the gear it touched, which is right for
 * latency but means an instrument whose listings all expired never gets its
 * market price revisited. This walks everything, resolves whatever the
 * incremental pass left unmatched, and prunes old alert records.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const resolved = await resolveUnmatchedListings()
  const deals = await refreshAllDeals()
  const prunedAlerts = await pruneAlertMatches()
  const indexed = await syncSearchIndex({ full: true })

  return NextResponse.json({
    job: "refresh-deals",
    resolved,
    deals,
    prunedAlerts,
    indexed,
  })
}
