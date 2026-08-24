import { NextResponse, type NextRequest } from "next/server"
import { requireCronAuth } from "@/lib/cron-auth"
import {
  STOREFRONT_MERCHANTS,
  ingestStorefront,
  storefrontMerchant,
} from "@/lib/ingestion/storefront-merchants"
import { syncSearchIndex } from "@/lib/search/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Catalogue refresh for any independent storefront:
 * /api/cron/ingest-storefront/folkcraft.
 *
 * ONE ROUTE, NOT TWELVE, for the same reason /api/cron/ingest-impact/[merchant]
 * is one route and not eight. Every one of the twelve files this replaces held
 * the same four lines with one identifier changed, and the copy that gets
 * missed is always the one that quietly stops ingesting.
 *
 * A PAUSED STORE STILL ANSWERS HERE, and that is deliberate. Pausing is a
 * scheduling decision (the row's `schedule` is null and vercel.json has no
 * entry), not a capability one, so a person can still run a paused store by
 * hand to see what it would ingest. The response says it is unscheduled and
 * why, so nobody reads a manual run as the store being live again.
 *
 * Fails closed on CRON_SECRET like every other cron route: unset is 503, wrong
 * bearer is 401.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ source: string }> }) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const { source } = await context.params
  const merchant = storefrontMerchant(source)
  if (!merchant) {
    return NextResponse.json(
      {
        error: `Unknown storefront "${source}".`,
        known: STOREFRONT_MERCHANTS.map((m) => m.source),
      },
      { status: 404 },
    )
  }

  const outcome = await ingestStorefront(merchant)
  const indexed = outcome.status === "ok" ? await syncSearchIndex() : { skipped: true }

  return NextResponse.json(
    {
      job: `${merchant.source}-${merchant.platform}`,
      merchant: merchant.label,
      scheduled: merchant.schedule !== null,
      ...(merchant.pausedReason ? { pausedReason: merchant.pausedReason } : {}),
      ...outcome,
      indexed,
    },
    { status: outcome.status === "failed" ? 500 : 200 },
  )
}
