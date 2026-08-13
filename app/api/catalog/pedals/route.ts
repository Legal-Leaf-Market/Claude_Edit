import { sql } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { inferEffectType } from "@/lib/pedalboard/chain"

/**
 * The pedal slice of the catalogue, published for stompbox.world.
 *
 * WHY THIS EXISTS RATHER THAN A SHARED IMPORT. stompbox.world is a separate
 * Vercel project with no database and no credentials, and keeping it that way
 * is worth more than the convenience of a direct query: one copy of the
 * connection string, one place ingestion writes, one definition of what a
 * pedal is. The sister site reads this endpoint and renders it.
 *
 * SCOPE IS canonical_gear, NOT raw listings. A shopper comparing pedals wants
 * one row per pedal with a market price and a count of where to get it, not
 * eleven rows of the same Big Muff. The per-listing detail stays on Gear
 * Avail, which is where the outbound-click accounting lives.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN: merchant names, deep links or
 * per-listing prices. Those carry partner terms that differ per feed, and
 * re-publishing them from a second domain is exactly the kind of quiet
 * redistribution those terms restrict. A shopper who wants to buy is sent to
 * the Gear Avail product page, where the attribution and the click accounting
 * already work. `marketPriceCents` is our own aggregate, computed from
 * listings we ingested, and is ours to publish.
 *
 * A market price is only published when the sample is big enough to mean
 * something. Below MIN_SAMPLE it is null and the sister site says "not enough
 * listings to call it" rather than printing an average of two.
 */

const PEDAL_CATEGORY = "Effects Pedals"
const MIN_SAMPLE = 3
const MAX_LIMIT = 200

export const dynamic = "force-dynamic"

type Row = {
  slug: string
  brand: string
  model: string
  image_url: string | null
  market_cents: number | null
  price_sample_size: number
  listing_count: number
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const q = (params.get("q") ?? "").trim()
  const limit = Math.min(Math.max(Number(params.get("limit")) || 60, 1), MAX_LIMIT)
  const offset = Math.max(Number(params.get("offset")) || 0, 0)
  const pattern = `%${q}%`

  try {
    const result = await db.execute<Row>(sql`
      SELECT g.slug,
             g.brand,
             g.model,
             g.image_url,
             COALESCE(g.avg_used_price_cents, g.avg_new_price_cents) AS market_cents,
             g.price_sample_size,
             (SELECT COUNT(*)::int
                FROM marketplace_listings l
               WHERE l.canonical_gear_id = g.id
                 AND l.listing_status = 'active') AS listing_count
        FROM canonical_gear g
       WHERE g.category = ${PEDAL_CATEGORY}
         ${q ? sql`AND (g.brand ILIKE ${pattern} OR g.model ILIKE ${pattern} OR (g.brand || ' ' || g.model) ILIKE ${pattern})` : sql``}
       ORDER BY g.price_sample_size DESC, g.brand ASC, g.model ASC
       LIMIT ${limit} OFFSET ${offset}
    `)

    const pedals = result.rows.map((r) => ({
      slug: r.slug,
      brand: r.brand,
      model: r.model,
      imageUrl: r.image_url,
      /* withheld rather than guessed when the sample is thin */
      marketPriceCents: r.price_sample_size >= MIN_SAMPLE ? r.market_cents : null,
      sampleSize: r.price_sample_size,
      listingCount: r.listing_count,
      type: inferEffectType(r.brand, r.model, PEDAL_CATEGORY),
    }))

    return NextResponse.json(
      { ok: true, minSample: MIN_SAMPLE, count: pedals.length, pedals },
      {
        headers: {
          /* The sister site is statically built and revalidates. A short edge
             TTL with a long stale window means a cold render never waits on
             this and a deploy of either project cannot stampede it. */
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
          /* Read-only, no credentials, and the sister site is a different
             origin, so it needs this to fetch from the browser if it ever
             stops rendering on the server. */
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  } catch (error) {
    /* Never 500 a sister site's page. It renders its guide without the
       catalogue and says so. */
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "query failed", pedals: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
