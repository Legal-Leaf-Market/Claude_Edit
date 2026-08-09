import { inArray } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { marketplaceListings, outboundClicks, SOURCES } from "@/lib/db/schema"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"
import { buildCheckoutPlan, type CartLine } from "@/lib/cart/checkout"
import { storeCartConfig } from "@/lib/cart/stores"

export const dynamic = "force-dynamic"

const MAX_ITEMS = 50

const bodySchema = z.object({
  source: z.enum(SOURCES),
  items: z
    .array(
      z.object({
        listingId: z.string().uuid(),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(MAX_ITEMS),
})

/**
 * Builds one store's checkout URL for a group of cart lines and hands the
 * shopper straight to it, the same "one merchant at a time" model every
 * multi-store aggregator in this family uses (see lib/cart/checkout.ts).
 *
 * The cart itself lives entirely client-side (localStorage); this route only
 * ever sees the listing ids and quantities for ONE store's group at a time,
 * looks up the real rawUrl/affiliateUrl/platformVariantId server-side (never
 * trusting the client for those), and logs one outboundClicks row per item
 * actually included in the URL, the same click-logging discipline /go uses.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const { source, items } = parsed.data

  const ids = items.map((i) => i.listingId)
  const rows = await db
    .select({
      id: marketplaceListings.id,
      canonicalGearId: marketplaceListings.canonicalGearId,
      rawUrl: marketplaceListings.rawUrl,
      affiliateUrl: marketplaceListings.affiliateUrl,
      platformVariantId: marketplaceListings.platformVariantId,
      priceCents: marketplaceListings.priceCents,
    })
    .from(marketplaceListings)
    .where(inArray(marketplaceListings.id, ids))

  const bySource = new Map(rows.map((r) => [r.id, r]))
  const qtyById = new Map(items.map((i) => [i.listingId, i.qty]))

  const lines: CartLine[] = []
  for (const id of ids) {
    const row = bySource.get(id)
    if (!row) continue
    lines.push({
      listingId: row.id,
      qty: qtyById.get(id) ?? 1,
      rawUrl: row.rawUrl,
      affiliateUrl: row.affiliateUrl,
      platformVariantId: row.platformVariantId,
    })
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "None of those listings were found" }, { status: 404 })
  }

  const config = storeCartConfig(source)
  const plan = buildCheckoutPlan(config, lines)

  if (!isAllowedDestination(plan.url)) {
    console.error(`[cart/checkout] refusing to send shopper to ${plan.url}`)
    return NextResponse.json({ error: "Destination not permitted" }, { status: 502 })
  }

  // Log a click for every line that actually made it into the URL. Best
  // effort: a shopper who cannot reach checkout is the real failure, not a
  // missed analytics row.
  try {
    const filled = lines.slice(0, plan.filledCount)
    if (filled.length > 0) {
      await db.insert(outboundClicks).values(
        filled.map((line) => {
          const row = bySource.get(line.listingId)!
          return {
            listingId: line.listingId,
            canonicalGearId: row.canonicalGearId,
            source,
            wasAffiliate: Boolean(row.affiliateUrl),
            priceCents: row.priceCents,
            referrer: request.headers.get("referer")?.slice(0, 500) ?? null,
            userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          }
        }),
      )
    }
  } catch (error) {
    console.error(
      `[cart/checkout] click logging failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return NextResponse.json({
    url: plan.url,
    filledCount: plan.filledCount,
    leftoverCount: plan.leftoverCount,
  })
}
