import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * Go Kalimba (gokalimba.com), direct on Shopify. Same basis as every other
 * small-seller source: their /agents.md publishes the "Read-Only Browsing"
 * no-auth /products.json path, and the publisher is approved in Go
 * Kalimba's own GoAffPro program with a real referral link.
 */

export async function ingestGoKalimbaFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.goKalimba.refCode) {
    console.warn(
      "[gokalimba] GOAFFPRO_GOKALIMBA_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "gokalimba",
      baseUrl: "https://www.gokalimba.com",
      refParam: env.goaffpro.goKalimba.refParam,
      refCode: env.goaffpro.goKalimba.refCode,
    },
    fetchImpl,
  )
}
