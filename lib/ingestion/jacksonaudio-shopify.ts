import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * Jackson Audio (jackson.audio), a manufacturer of guitar pedals, direct on
 * Shopify. Same basis as Folkcraft/Acoustic Guitar/Jamstik: their /agents.md
 * publishes the "Read-Only Browsing" no-auth /products.json path, and the
 * publisher is approved in Jackson Audio's own GoAffPro program with a real
 * referral link (ref=<code>), not inferred from a directory listing.
 */

export async function ingestJacksonAudioFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.jacksonAudio.refCode) {
    console.warn(
      "[jacksonaudio] GOAFFPRO_JACKSONAUDIO_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "jacksonaudio",
      baseUrl: "https://jackson.audio",
      refParam: env.goaffpro.jacksonAudio.refParam,
      refCode: env.goaffpro.jacksonAudio.refCode,
    },
    fetchImpl,
  )
}
