import { NextResponse, type NextRequest } from "next/server"
import { isStompboxHost, STOMPBOX_PREFIX } from "@/lib/stompbox/host"

/**
 * TWO DOMAINS, ONE DEPLOYMENT.
 *
 * stompbox.world and gearavail.com are served by the same Next app. The guide
 * lives at `app/stompbox/*`, which is already the right URL on Gear Avail, so
 * the only rewriting needed is on the guide's own domain: its root has to map
 * onto that subtree without the prefix ever showing in the address bar.
 *
 *   stompbox.world/            ->  /stompbox
 *   stompbox.world/pedals/fuzz ->  /stompbox/pedals/fuzz
 *   gearavail.com/stompbox/... ->  untouched, it is already correct
 *
 * A REWRITE, NOT A REDIRECT. The URL the reader sees stays `stompbox.world/
 * pedals`. That is the whole point of the arrangement: the guide keeps its own
 * domain and its own identity, and Gear Avail carries the same pages as a
 * section, rather than one of the two being a redirect to the other.
 *
 * WHAT IS DELIBERATELY NOT REWRITTEN.
 *
 * `/robots.txt` and `/sitemap.xml` are Next metadata routes that only exist at
 * the root, and both are host-aware in their own files (`app/robots.ts`,
 * `app/sitemap.ts`). Rewriting them onto `/stompbox/robots.txt` would 404 the
 * two files a search engine asks for by fixed name before anything else.
 *
 * `/_next`, `/api` and static files are excluded by the matcher below rather
 * than here: an asset request rewritten into the page tree is a 404 for a
 * chunk the page has already been served referencing, which shows up as a
 * blank interactive island rather than as an error anybody can see.
 *
 * A REQUEST THAT IS ALREADY PREFIXED IS LEFT ALONE. `stompbox.world/stompbox/
 * pedals` rewrites to itself rather than to `/stompbox/stompbox/pedals`. It is
 * not a URL anything here links to, but it is one a crawler can reach by
 * following a copied link, and doubling the prefix turns that into a 404
 * instead of the page.
 */
export function middleware(request: NextRequest) {
  if (!isStompboxHost(request.headers.get("host"))) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (pathname === STOMPBOX_PREFIX || pathname.startsWith(`${STOMPBOX_PREFIX}/`)) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = pathname === "/" ? STOMPBOX_PREFIX : `${STOMPBOX_PREFIX}${pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  /*
   * Everything except Next's own assets, the API, and the two fixed-name
   * metadata files. Written as one negative lookahead because the matcher is
   * evaluated before the function runs, so anything excluded here costs
   * nothing at all rather than costing a function invocation that returns
   * `next()`.
   */
  matcher: ["/((?!_next/|api/|robots\\.txt$|sitemap\\.xml$|favicon\\.ico$).*)"],
}
