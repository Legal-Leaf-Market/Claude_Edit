import { fetchShopListings } from "@/lib/reverb/shop"
import { isAdmin } from "@/lib/admin/gate"

/**
 * OUR OWN SHOP'S LISTINGS, AS PUBLIC JSON.
 *
 * A route rather than a server component, and that is the whole design.
 * `tests/stompbox/boundary.test.ts` exists because the guide used to hold no
 * credentials by physics and now holds none only by rule, so the token stays
 * out of `app/stompbox` entirely: it lives here, and the page fetches this.
 *
 * WHAT GOES OUT IS ONLY WHAT THE SHOP ALREADY SHOWS THE PUBLIC. Title, price,
 * condition, photo and the link to the listing on Reverb, which is where we
 * want the shopper to end up anyway. Nothing about inventory, cost, margin or
 * the account, and no field the API returns that we do not explicitly name.
 */
/**
 * TWO MINUTES, NOT FIFTEEN.
 *
 * The first version cached for 15 minutes and a listing added in that window
 * simply was not there, which reads as the feed being broken rather than as a
 * cache doing its job. A shop with nine items is not a load problem, and the
 * cost of being wrong about what is in stock is higher than the cost of a
 * request.
 *
 * `?fresh=` bypasses it outright: the CDN keys on the whole URL, so a unique
 * value is a guaranteed repull for somebody who has just listed something and
 * wants to see it now.
 */
export const revalidate = 120

export async function GET(request: Request) {
  const result = await fetchShopListings()

  /*
   * `?debug=1`, BEHIND THE PASSCODE.
   *
   * The live asking prices totalled $631 and this route reported $400, which
   * is a shop advertising numbers it is not asking. That is worse than a
   * missing section: it is a wrong number a shopper can act on.
   *
   * So rather than binding a second field on a hunch, this returns every
   * price-shaped key on a real row and lets the answer come from the data.
   * Admin only, because a raw listing object is more than the public JSON
   * deliberately publishes.
   */
  if (new URL(request.url).searchParams.get("debug") === "1") {
    if (!(await isAdmin())) return new Response("Not found", { status: 404 })
    const raw = result.ok ? (result.raw ?? {}) : {}
    const priceish = Object.fromEntries(
      Object.entries(raw).filter(([key]) => /price|amount|offer|sale|discount/i.test(key)),
    )

    /*
     * THE FIELD WAS NEVER THE PROBLEM. Reverb returns `price`, `buyer_price`
     * and `seller_price` and all three agree, with no original-price field
     * anywhere in the response. So a shop total that disagrees with the
     * owner's own figure is a disagreement about WHICH LISTINGS came back,
     * not about what each one costs.
     *
     * Hence the roll-up: count, total, and every row's price. Whatever is
     * missing shows up as a name that is not in this list, which is a thing
     * somebody can look at and recognise in a second.
     */
    const listings = result.ok ? result.listings : []
    const cents = (p: string | null) => {
      const n = Number(String(p ?? "").replace(/[^\d.]/g, ""))
      return Number.isFinite(n) ? n : 0
    }
    const total = listings.reduce((sum, row) => sum + cents(row.price), 0)

    return Response.json(
      {
        count: listings.length,
        total: "$" + total.toLocaleString("en-US"),
        prices: listings.map((row) => ({ title: row.title, price: row.price })),
        source: result.ok ? result.source : null,
        keys: Object.keys(raw).sort(),
        priceish,
      },
      { headers: { "cache-control": "private, no-store" } },
    )
  }

  if (!result.ok) {
    /* 200 with an empty list, not an error status. The caller is a decorative
       section on a page that must not break when a feed is unconfigured, and
       a 500 here would turn "no shop section today" into a red page. */
    return Response.json(
      { listings: [], configured: false },
      { headers: { "cache-control": "public, s-maxage=60" } },
    )
  }

  return Response.json(
    /* `source` names the endpoint that answered. Three candidates ship
       because this could not be checked against the live API from the machine
       it was written on, and this is how the other two get retired on
       evidence rather than on somebody's guess about which one it was. */
    { listings: result.listings, configured: true, source: result.source },
    { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } },
  )
}
