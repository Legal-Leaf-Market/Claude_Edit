import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { outboundClicks } from "@/lib/db/schema"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"
import { partnerDestination, partnerFromSlug } from "@/lib/partners"

/**
 * The outbound gateway for focus-page partners.
 *
 * /go/[listingId] is the path for anything with a listing behind it. These two
 * partners have no listings by design (lib/partners.ts explains why software
 * and services stay out of the catalogue), so they need a route that takes a
 * slug instead of a row id. Everything else is deliberately identical to the
 * listing gateway, because the rules are not about listings, they are about
 * sending someone off this site:
 *
 *   - the click is recorded BEFORE the redirect, and a logging failure never
 *     blocks it. A click we cannot bill for is a rounding error; a shopper who
 *     cannot reach the destination is the product failing at the one moment
 *     that matters;
 *   - the destination is checked against the same allowlist, so a bad paste in
 *     configuration cannot turn this into an open redirect that launders a
 *     phishing link through our domain;
 *   - 302 and no-store, since the destination changes the moment a tracked link
 *     is configured and a cached permanent redirect would pin shoppers to the
 *     untracked one forever.
 *
 * The click row carries listing_id NULL and the partner slug as its source,
 * which is what tells partner traffic apart from marketplace traffic later: a
 * null listing id cannot happen on the other route.
 */

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const partner = partnerFromSlug(slug)
  if (!partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 })
  }

  const { url, tracked } = partnerDestination(partner)
  if (!isAllowedDestination(url)) {
    console.error(`[go/partner] refusing to redirect ${partner.slug} to ${url}`)
    return NextResponse.json({ error: "Destination not permitted" }, { status: 502 })
  }

  try {
    await db.insert(outboundClicks).values({
      listingId: null,
      canonicalGearId: null,
      source: partner.slug.slice(0, 20),
      wasAffiliate: tracked,
      priceCents: null,
      referrer: request.headers.get("referer")?.slice(0, 500) ?? null,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
  } catch (error) {
    console.error(
      `[go/partner] click logging failed for ${partner.slug}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}
