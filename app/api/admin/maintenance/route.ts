import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { refreshAllDeals } from "@/lib/deals/pricing"
import { pruneAlertMatches } from "@/lib/alerts/evaluate"
import { resolveUnmatchedListings } from "@/lib/canonical/resolve"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Run the nightly housekeeping on demand, from a browser.
 *
 * WHY THIS EXISTS ALONGSIDE /api/cron/refresh-deals, which does the same work.
 * The cron route authenticates with a bearer token, which is right for a
 * scheduler and useless to a person: you cannot set an Authorization header by
 * typing a URL into a browser, so triggering it means a terminal and a copy of
 * CRON_SECRET.
 *
 * That gap stopped mattering in theory and started mattering in practice.
 * Migration 0006 deliberately clears every market price and deal flag, so the
 * site shows no prices at all until this work runs, and the cron entry that
 * was supposed to run it nightly turned out not to be registered with Vercel
 * at all. A button behind the admin passcode is the difference between "the
 * prices come back when someone opens a terminal" and "the prices come back".
 *
 * SECURITY. Same gate as the rest of /admin: an HMAC session cookie issued
 * against ADMIN_PASSCODE. It is POST only, so nothing can trigger it by
 * embedding an image or following a link, and it fails closed exactly like
 * the cron guard does. It reads and writes our own tables only, and spends no
 * third-party call budget: no feed is fetched and no mail is sent, which is
 * what makes it safe to expose to a click at all.
 */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const startedAt = Date.now()

  const resolved = await resolveUnmatchedListings()
  const deals = await refreshAllDeals()
  const prunedAlerts = await pruneAlertMatches()
  const indexed = await syncSearchIndex({ full: true })

  return NextResponse.json({
    job: "refresh-deals",
    ranFrom: "admin",
    seconds: Math.round((Date.now() - startedAt) / 100) / 10,
    resolved,
    deals,
    prunedAlerts,
    indexed,
  })
}
