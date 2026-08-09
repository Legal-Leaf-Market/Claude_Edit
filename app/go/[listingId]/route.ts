import { eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { marketplaceListings, outboundClicks } from "@/lib/db/schema"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"

/**
 * Outbound affiliate gateway.
 *
 * This is the ONLY path from Gear Avail to a marketplace. Cards never link to
 * raw_url directly, because this route is what records the click and picks the
 * monetised destination.
 *
 * Order matters: the click is recorded BEFORE the redirect, but a logging
 * failure must never block the shopper. A recorded click we cannot bill for is
 * a rounding error; a shopper who cannot reach the listing is the product
 * failing at the one moment it matters.
 */

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ listingId: string }> },
) {
  const { listingId } = await context.params

  // A malformed id is a 404, not a database round trip: the column is a uuid
  // and Postgres would raise a type error rather than return no rows.
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  const rows = await db
    .select({
      id: marketplaceListings.id,
      source: marketplaceListings.source,
      rawUrl: marketplaceListings.rawUrl,
      affiliateUrl: marketplaceListings.affiliateUrl,
      priceCents: marketplaceListings.priceCents,
      canonicalGearId: marketplaceListings.canonicalGearId,
    })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.id, listingId))
    .limit(1)

  const listing = rows[0]
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  const destination = listing.affiliateUrl ?? listing.rawUrl
  if (!isAllowedDestination(destination)) {
    console.error(`[go] refusing to redirect listing ${listing.id} to ${destination}`)
    return NextResponse.json({ error: "Destination not permitted" }, { status: 502 })
  }

  try {
    await db.insert(outboundClicks).values({
      listingId: listing.id,
      canonicalGearId: listing.canonicalGearId,
      source: listing.source,
      wasAffiliate: Boolean(listing.affiliateUrl),
      priceCents: listing.priceCents,
      referrer: request.headers.get("referer")?.slice(0, 500) ?? null,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
  } catch (error) {
    // Log and continue. Never fail the shopper's click over analytics.
    console.error(
      `[go] click logging failed for ${listing.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  // 302 rather than 301: the destination changes whenever affiliate context
  // changes, and a cached permanent redirect would pin shoppers to a stale URL.
  //
  // No Referrer-Policy is set here on purpose. next.config.mjs applies
  // strict-origin-when-cross-origin to every response, and a header set here
  // loses to it, so overriding would be a comment describing behaviour that
  // never ships. The global policy is also the one we want: it sends our origin
  // and not the path, so the marketplace sees the traffic came from Gear Avail,
  // which affiliate attribution wants, while the shopper's search query stays
  // on our side.
  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}
