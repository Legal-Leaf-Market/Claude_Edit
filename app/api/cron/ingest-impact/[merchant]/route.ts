import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import { ingestImpactCatalogue } from "@/lib/ingestion/impact-catalogue"
import { impactMerchant, IMPACT_MERCHANTS } from "@/lib/ingestion/impact-merchants"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Catalogue refresh for any Impact.com merchant: /api/cron/ingest-impact/fender.
 *
 * ONE ROUTE, NOT EIGHT. Every other source here has a route of its own because
 * every other source has a job of its own. These eight share a single job that
 * differs only by catalogue id, so eight files would have been eight copies of
 * the same four lines, and the copy that got missed would be the one that
 * quietly stopped ingesting.
 *
 * WHY THIS IS A CRON ROUTE WHEN ANDERTON'S IS NOT. Anderton's is pulled over
 * FTP, which wants a control connection and passive data ports; that job lives
 * on the BullMQ worker. This is ordinary paginated HTTPS, which a serverless
 * function does perfectly well, so a cron route is the natural trigger. Both
 * call the same shared implementation either way.
 *
 * PAGES PER CALL. Five pages of a thousand is enough for most catalogues in one
 * shot and cannot blow the 300 second ceiling on a large one. When a call ends
 * with `done: false` it names the page to resume from, and because the upsert
 * is idempotent and keyed on (source, external_id) an overlapping resume costs
 * nothing but time. The response carries `nextPage` so a caller (or the next
 * scheduled run) can pick it up.
 *
 * Fails closed on CRON_SECRET like every other cron route: unset is 503, wrong
 * bearer is 401.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ merchant: string }> },
) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const { merchant: key } = await context.params
  const merchant = impactMerchant(key)
  if (!merchant) {
    return NextResponse.json(
      {
        error: `Unknown Impact merchant "${key}".`,
        known: IMPACT_MERCHANTS.map((m) => m.key),
      },
      { status: 404 },
    )
  }

  const startPage = Number.parseInt(request.nextUrl.searchParams.get("startPage") ?? "", 10)
  const pages = Number.parseInt(request.nextUrl.searchParams.get("pages") ?? "", 10)

  const outcome = await ingestImpactCatalogue(merchant, {
    startPage: Number.isFinite(startPage) ? startPage : undefined,
    pages: Number.isFinite(pages) ? pages : undefined,
  })

  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    { job: `${merchant.key}-catalogue-api`, merchant: merchant.label, ...outcome, indexed },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
