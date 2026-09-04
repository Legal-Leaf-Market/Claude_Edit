import { SHOP_HTML } from "./document"

/**
 * stompbox.world/shop
 *
 * Dean's Boutique, as a page rather than as JSON.
 *
 * WHY THIS EXISTS. `/api/reverb/shop` is the data, and reading it in a
 * browser gets you a wall of JSON, which is the endpoint working correctly
 * and is not a storefront. The listings had one rendered home, a strip at the
 * bottom of `/buymyboard`, and none of its own. This is the page you send
 * somebody when they ask what you have.
 *
 * THE LISTINGS ARE FETCHED, NOT SERVER RENDERED, and that is the boundary
 * doing its job rather than an oversight. The token lives in the API route;
 * putting the reader in the guide's own tree would be the first credential in
 * there since the merge. The cost is that the grid is not in the initial HTML,
 * which matters less here than almost anywhere: these items are canonical on
 * Reverb, and we would rather they ranked there than compete with our own
 * listings.
 *
 * NO PRODUCT MARKUP, DELIBERATELY. Section 25's rule is that markup is a claim
 * the page itself makes. We do not take the order for any of these: Reverb
 * does. Emitting Offer nodes here would tell a crawler we sell something we
 * hand off, which is the same class of overstatement as an offer with no
 * listing behind it.
 *
 * THREE STATES, ALL WRITTEN. Stock, sold out, and unreachable. The last two
 * say what a reader can do instead, and both point at the Reverb shop.
 */
export const dynamic = "force-static"

export function GET() {
  return new Response(SHOP_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  })
}
