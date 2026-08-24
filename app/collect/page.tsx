import type { Metadata } from "next"
import { CollectClient } from "@/components/capture/collect-client"

export const dynamic = "force-dynamic"

/**
 * /collect: the install page for the capture collector.
 *
 * WHY A PAGE AND NOT JUST THE SCRIPT. A bookmarklet has to be DRAGGED to a
 * bookmarks bar, which means it needs a real anchor whose href is the
 * `javascript:` URL. It cannot be typed by hand and the person using it cannot
 * build it. This page also has to answer the two questions that otherwise stop
 * the workflow dead: which merchant key goes with which site, and whether what
 * you captured actually landed.
 *
 * It is ALSO the relay tab. A shop whose `connect-src` forbids posting to us
 * can still be navigated away from, so the collector opens this page with
 * ?receive=1 and hands the capture over by postMessage; from here the POST is
 * same-origin and there is nothing left to refuse. That is why the client
 * component below has two completely different shapes.
 *
 * NO TOKEN ON THIS PAGE, EVER. The passcode is typed into the collector's own
 * panel, in the tab where the capture happens, and used for one request.
 * Putting it here would put it in a page anybody can load.
 *
 * noindex: this is an operator tool, not a shopper page. It is also absent
 * from the sitemap, which only ever lists routes it explicitly builds.
 */
export const metadata: Metadata = {
  title: "Collector",
  description: "Operator tool: capture a merchant's catalogue from your own browser.",
  robots: { index: false, follow: false },
}

export default function CollectPage() {
  return <CollectClient />
}
