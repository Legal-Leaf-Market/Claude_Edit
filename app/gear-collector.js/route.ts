import { NextResponse, type NextRequest } from "next/server"
import { collectorSource } from "@/lib/capture/collector"

export const dynamic = "force-dynamic"

/**
 * The collector, served as JavaScript.
 *
 * GENERATED RATHER THAN COMMITTED, and that is the one thing deliberately not
 * copied from the sister site's version of this tool. Theirs is a committed
 * 180KB file beside the typed source it duplicates, which is section 7's
 * "never fork the logic" waiting to happen: the readable copy gets the fix and
 * the committed one does not. Building it per request from
 * lib/capture/extract.ts means the loader bookmarklet, the self-contained
 * bookmarklet the install page assembles, and the console paste are all the
 * same program by construction.
 *
 * PUBLIC ON PURPOSE, AND IT CARRIES NOTHING. This has to be fetchable from a
 * merchant's page by a bookmarklet, so it cannot sit behind the passcode. It
 * holds no credential: the admin token is typed into the panel on the shop
 * page, used for one request, and never stored. Reading this file tells you
 * how the tool works and nothing else, which is the same posture as any other
 * client-side script on the site.
 *
 * NOT CACHED, because a bookmarklet is kept for months and a stale collector is
 * the hardest kind of bug to see: it does not throw, it just reads fewer
 * products off a page that has since changed.
 */
export async function GET(request: NextRequest) {
  const { source, build } = collectorSource(request.nextUrl.origin)

  return new NextResponse(source, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      /*
       * Read cross-origin by design: the install page fetches it to build the
       * self-contained bookmarklet, and that page can be on either domain.
       */
      "access-control-allow-origin": "*",
      "x-collector-build": build,
    },
  })
}
