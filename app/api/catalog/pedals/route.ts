import { NextResponse, type NextRequest } from "next/server"
import { countLiveModels, headlinePrice, liveModels } from "@/lib/catalog/live-models"
import { categoryFromSlug } from "@/lib/categories"
import { MIN_SAMPLE_SIZE } from "@/lib/deals/pricing"
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
 * THE DEFINITION IS /used/effects-pedals, NOT A SEPARATE QUERY. This route
 * used to run its own SELECT over canonical_gear, and the two answers drifted
 * exactly where you would expect: that page joins to ACTIVE listings, so a
 * model with nothing live in it is not on it, while this endpoint published
 * canonical rows whose listings had all ended and ranked them ABOVE models you
 * can actually buy, because it ordered by price sample size and that sample
 * deliberately counts listings that ended inside the last 90 days. The sister
 * site printed the result under "most listed first". Both now read
 * lib/catalog/live-models.ts, so the shelf here is the shelf there.
 *
 * SCOPE IS THE MODEL, NOT THE LISTING. A shopper comparing pedals wants one
 * row per pedal with a market price and a count of where to get it, not eleven
 * rows of the same Big Muff.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN: merchant names, deep links or
 * per-listing prices, the cheapest active asking price included. Those carry
 * partner terms that differ per feed, and re-publishing them from a second
 * domain is exactly the kind of quiet redistribution those terms restrict.
 * `liveModels()` computes the cheapest price because Gear Avail's own pages
 * print it; this projection drops it. A shopper who wants to buy is sent to
 * the Gear Avail product page, where the attribution and the click accounting
 * already work. The medians are our own aggregate, computed from listings we
 * ingested, and are ours to publish.
 *
 * A market price is only published when the sample is big enough to mean
 * something, and NEW AND USED ARE SEPARATE MARKETS (section 8). Both are sent,
 * each with its own sample, plus which one the headline number came from, so
 * the sister site can say "typical new" over a new median instead of labelling
 * it used. The old response coalesced the two and gated the result on the USED
 * sample size, which withheld the price of every new-only pedal.
 */

const PEDAL_SLUG = "effects-pedals"

/** Resolved through the same table /used/[category] uses, so they cannot drift. */
const PEDAL_CATEGORY = categoryFromSlug(PEDAL_SLUG) ?? "Effects Pedals"

const MAX_LIMIT = 200

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const q = (params.get("q") ?? "").trim()
  const limit = Math.min(Math.max(Number(params.get("limit")) || 60, 1), MAX_LIMIT)
  const offset = Math.max(Number(params.get("offset")) || 0, 0)
  const query = { category: PEDAL_CATEGORY, q: q || undefined }

  try {
    const [models, total] = await Promise.all([
      liveModels({ ...query, limit, offset }),
      countLiveModels(query),
    ])

    const pedals = models.map((model) => {
      const headline = headlinePrice(model)
      return {
        slug: model.slug,
        brand: model.brand,
        model: model.model,
        imageUrl: model.imageUrl,
        /* Kept under their original names: the two sites deploy
           independently, so a version of the sister site older than this
           change has to keep rendering against it. */
        marketPriceCents: headline.cents,
        sampleSize: headline.sampleSize,
        /* Which market the number above measures. Null when neither class
           cleared the floor, which is the case the sister site prints a
           reason for rather than a guess. */
        marketPriceClass: headline.basis,
        usedPriceCents: model.usedPriceCents,
        usedSampleSize: model.usedSampleSize,
        newPriceCents: model.newPriceCents,
        newSampleSize: model.newSampleSize,
        listingCount: model.listingCount,
        type: inferEffectType(model.brand, model.model, PEDAL_CATEGORY),
      }
    })

    return NextResponse.json(
      {
        ok: true,
        minSample: MIN_SAMPLE_SIZE,
        count: pedals.length,
        /* Every pedal with live stock, not just this page of them, so the
           sister site can say how much of the shelf it is showing. */
        total,
        /* The page these rows come from. Sent rather than assumed, so a route
           rename here does not leave a dead link on another domain. */
        browsePath: `/used/${PEDAL_SLUG}`,
        pedals,
      },
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
