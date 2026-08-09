import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * Jamstik (jamstik.com), a manufacturer of MIDI/smart guitars, direct on
 * Shopify. Same basis as Folkcraft/Acoustic Guitar: their own /agents.md
 * publishes the "Read-Only Browsing" no-auth /products.json path, and the
 * publisher (us) is directly signed up in Jamstik's own GoAffPro program
 * rather than inferred from a bulk merchant directory.
 */

export async function ingestJamstikFeed(fetchImpl: typeof fetch = fetch): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.jamstik.refCode) {
    console.warn(
      "[jamstik] GOAFFPRO_JAMSTIK_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "jamstik",
      baseUrl: "https://www.jamstik.com",
      refParam: env.goaffpro.jamstik.refParam,
      refCode: env.goaffpro.jamstik.refCode,
    },
    fetchImpl,
  )
}
