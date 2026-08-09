import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * Pures Music (puresmusic.com), direct on Shopify. Same basis as every other
 * small-seller source: their /agents.md publishes the "Read-Only Browsing"
 * no-auth /products.json path, and the publisher is approved in Pures
 * Music's own GoAffPro program with a real referral link.
 *
 * Their catalogue mixes genuine instruments (kalimbas, ocarinas, lyre harps,
 * handpans) with sound-healing accessories marketed for meditation/chakra
 * use (crystal singing bowls, tuning forks) rather than as instruments. This
 * ingests the whole catalogue like every other Shopify source with no
 * category filtering; it is a product-mix note, not a compliance concern.
 */

export async function ingestPuresMusicFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.puresMusic.refCode) {
    console.warn(
      "[puresmusic] GOAFFPRO_PURESMUSIC_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "puresmusic",
      baseUrl: "https://www.puresmusic.com",
      refParam: env.goaffpro.puresMusic.refParam,
      refCode: env.goaffpro.puresMusic.refCode,
    },
    fetchImpl,
  )
}
