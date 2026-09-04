import { fetchShopListings } from "@/lib/reverb/shop"

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
export const revalidate = 900

export async function GET() {
  const result = await fetchShopListings()

  if (!result.ok) {
    /* 200 with an empty list, not an error status. The caller is a decorative
       section on a page that must not break when a feed is unconfigured, and
       a 500 here would turn "no shop section today" into a red page. */
    return Response.json(
      { listings: [], configured: false },
      { headers: { "cache-control": "public, s-maxage=300" } },
    )
  }

  return Response.json(
    /* `source` names the endpoint that answered. Three candidates ship
       because this could not be checked against the live API from the machine
       it was written on, and this is how the other two get retired on
       evidence rather than on somebody's guess about which one it was. */
    { listings: result.listings, configured: true, source: result.source },
    { headers: { "cache-control": "public, s-maxage=900, stale-while-revalidate=3600" } },
  )
}
