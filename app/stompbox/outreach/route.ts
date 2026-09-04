import { OUTREACH_HTML } from "./document"

/**
 * stompbox.world/outreach
 *
 * The tool WE work from: paste a seller's Marketplace listing, price the lot,
 * and write the three messages that go to them. It used to live at
 * `/buymyboard`, which was the wrong way round: "buy my board" is what a
 * SELLER says, so that URL now serves the public quote page and this one
 * moved somewhere that describes itself.
 *
 * NOINDEX, AND THAT IS NOT AN OVERSIGHT. This page carries the shop's own
 * margins and the scripts it sends sellers. Shareable and searchable are
 * different things and only the first is wanted: a link sent to somebody
 * opens fine, while a search will never surface it. The header below governs
 * crawlers and the document repeats it in a meta tag for the standalone copy,
 * which is served without headers.
 *
 * Deliberately absent from `app/sitemap.ts`, which lists only routes it
 * explicitly builds, so nothing has to be removed there.
 */
export const dynamic = "force-static"

export function GET() {
  return new Response(OUTREACH_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  })
}
