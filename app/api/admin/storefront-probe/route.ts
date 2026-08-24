import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { probeStorefront } from "@/lib/ingestion/storefront-probe"
import { STOREFRONT_MERCHANTS } from "@/lib/storefronts"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Ask a candidate storefront whether it wants to be read.
 *
 * POST {"url": "https://someshop.com"} and optionally
 * {"platform": "shopify" | "woocommerce"}.
 *
 * WHY THIS IS A ROUTE AND NOT A SCRIPT. The check has to happen from somewhere
 * that can actually reach the store, and a development sandbox cannot: its
 * egress policy answers 403 to CONNECT for arbitrary hosts, so every candidate
 * looks identically unreachable from there. Running it in the deployed app is
 * the difference between a verdict and a guess.
 *
 * WHAT IT DOES NOT DO. It does not add anything, ingest anything, or approve
 * anything. It fetches three public documents and reports what they say. A
 * person reads the verdict and decides; if they decide yes, the findings go
 * into the new merchant row's `permission.note` so the basis for that row
 * outlives whoever added it.
 *
 * The one verdict that IS decisive is `refused`: a robots.txt disallowing the
 * catalogue path settles it against, whatever else the store returns.
 *
 * SECURITY. Behind the admin passcode, POST only. It takes a URL from the
 * caller and fetches it from our servers, which is a request forgery primitive
 * if it were open, and it is deliberately limited to GET-ing three fixed paths
 * off the origin rather than the URL as given.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  let body: { url?: string; platform?: "shopify" | "woocommerce" }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Send JSON: {"url": "https://someshop.com"}' }, { status: 400 })
  }

  const url = body.url?.trim()
  if (!url) {
    return NextResponse.json({ error: 'A "url" is required.' }, { status: 400 })
  }

  let result
  try {
    result = await probeStorefront(url, { platform: body.platform })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    )
  }

  /*
   * Saying so when we already read this store saves the most common wasted
   * probe, and more usefully catches the case where a store is already in the
   * registry on a basis that has since changed.
   */
  const existing = STOREFRONT_MERCHANTS.find((m) => {
    try {
      return new URL(m.baseUrl).hostname === new URL(result.baseUrl).hostname
    } catch {
      return false
    }
  })

  return NextResponse.json({
    ...result,
    alreadyIngested: existing
      ? {
          source: existing.source,
          label: existing.label,
          recordedBasis: existing.permission.basis,
          recordedOn: existing.permission.checkedOn,
          scheduled: existing.schedule !== null,
        }
      : null,
  })
}
