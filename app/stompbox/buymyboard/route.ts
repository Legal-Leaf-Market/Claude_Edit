import { BUY_MY_BOARD_HTML } from "./document"

/**
 * stompbox.world/buymyboard
 *
 * A ROUTE HANDLER RATHER THAN A PAGE, because what is served is a whole HTML
 * document rather than a fragment for the guide's layout to wrap. A page here
 * would inherit `app/stompbox/layout.tsx`, which brings the guide's chrome, its
 * canonical tag and a second <html> element's worth of assumptions to a
 * document that already has all three of its own.
 *
 * The middleware rewrite is what puts it on the guide's domain:
 * `stompbox.world/buymyboard` becomes `/stompbox/buymyboard` before it gets
 * here, exactly as every other page on that domain does. It is reachable at
 * `gearavail.com/stompbox/buymyboard` too, which is the same mirror
 * arrangement the rest of the subtree has.
 *
 * NOINDEX, AND THAT IS NOT AN OVERSIGHT. This page carries the shop's own
 * margins and the scripts it sends sellers. Shareable and searchable are
 * different things, and only the first one is wanted: a link sent to somebody
 * opens fine, while a search for "sell my pedalboard" will never surface it.
 * The header below is the half that governs crawlers, and the document repeats
 * it in a meta tag for the standalone copy that is served without it.
 *
 * It is deliberately absent from `app/sitemap.ts`, which lists only routes it
 * explicitly builds, so nothing has to be removed there.
 */
export const dynamic = "force-static"

export function GET() {
  return new Response(BUY_MY_BOARD_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  })
}
