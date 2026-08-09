import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * Eason Music Store (easonmusicstore.com), direct on Shopify. Same basis as
 * every other small-seller source: their /agents.md publishes the
 * "Read-Only Browsing" no-auth /products.json path, and the publisher is
 * approved in Eason Music Store's own GoAffPro program with a real referral
 * link.
 */

export async function ingestEasonMusicStoreFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.easonMusicStore.refCode) {
    console.warn(
      "[easonmusicstore] GOAFFPRO_EASONMUSICSTORE_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "easonmusicstore",
      baseUrl: "https://www.easonmusicstore.com",
      refParam: env.goaffpro.easonMusicStore.refParam,
      refCode: env.goaffpro.easonMusicStore.refCode,
    },
    fetchImpl,
  )
}
