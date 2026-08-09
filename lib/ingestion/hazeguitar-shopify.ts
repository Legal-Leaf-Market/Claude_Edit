import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * Haze Guitar (hazeguitar.com.au), an Australian guitar retailer direct on
 * Shopify. Same basis as every other small-seller source: their /agents.md
 * publishes the "Read-Only Browsing" no-auth /products.json path, and the
 * publisher is approved in Haze Guitar's own GoAffPro program with a real
 * referral link (ref=<code>). The bare apex domain redirects to www, so
 * baseUrl uses www directly to avoid a needless redirect on every request.
 */

export async function ingestHazeGuitarFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.hazeGuitar.refCode) {
    console.warn(
      "[hazeguitar] GOAFFPRO_HAZEGUITAR_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "hazeguitar",
      baseUrl: "https://www.hazeguitar.com.au",
      currency: "AUD",
      locationCountry: "AU",
      refParam: env.goaffpro.hazeGuitar.refParam,
      refCode: env.goaffpro.hazeGuitar.refCode,
    },
    fetchImpl,
  )
}
