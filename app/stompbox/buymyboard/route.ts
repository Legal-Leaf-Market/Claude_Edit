import { BUY_MY_BOARD_HTML } from "./document"

/**
 * stompbox.world/buymyboard
 *
 * The PUBLIC page: a seller prices their own gear and picks how they want
 * paid. The URL is the seller's own phrase, "buy my board", so it belongs to
 * the page a seller lands on rather than to the tool we work from. That tool
 * moved to `/outreach`, which reads like what it is.
 *
 * A ROUTE HANDLER RATHER THAN A PAGE. What is served is a whole HTML document
 * with its own head, stylesheet and script; a page would wrap it in the
 * guide's layout, chrome and canonical tag, all three of which it already has.
 *
 * INDEXED, UNLIKE `/outreach`. This one exists to be found by somebody typing
 * "sell my pedals", so it carries no robots header and is meant to rank. The
 * operator tool carries the shop's own margins and stays out of search.
 *
 * ONE RATE CARD ACROSS BOTH: 65 / 75 / 90, the same three the outreach script
 * quotes. They were briefly 60 / cash+20% / 80-85 here, which showed a seller
 * a worse number on the public page than the one they had been sent in a
 * message. `tests/stompbox/sell.test.ts` holds the two together now.
 */
export const dynamic = "force-static"

export function GET() {
  return new Response(BUY_MY_BOARD_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  })
}
