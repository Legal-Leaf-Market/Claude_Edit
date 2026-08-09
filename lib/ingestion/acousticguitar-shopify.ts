import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * The Acoustic Guitar store (store.acousticguitar.com), the retail arm tied
 * to Acoustic Guitar magazine, on Shopify. Same basis as Folkcraft: confirmed
 * enrolled via the GoAffPro merchant directory, and their own /agents.md
 * publishes the same "Read-Only Browsing" no-auth /products.json path.
 */

export async function ingestAcousticGuitarFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.acousticGuitar.refCode) {
    console.warn(
      "[acousticguitar] GOAFFPRO_ACOUSTICGUITAR_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "acousticguitar",
      baseUrl: "https://store.acousticguitar.com",
      refParam: env.goaffpro.acousticGuitar.refParam,
      refCode: env.goaffpro.acousticGuitar.refCode,
    },
    fetchImpl,
  )
}
