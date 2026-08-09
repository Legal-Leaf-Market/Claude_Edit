import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * Eminence Digital (eminence-digital.com), sells impulse response packs for
 * guitar/bass cab simulation direct on Shopify. Same basis as Folkcraft/
 * Jackson Audio: their /agents.md publishes the "Read-Only Browsing" no-auth
 * /products.json path, and the publisher is approved in Eminence Digital's
 * own GoAffPro program with a real referral link (ref=<code>).
 *
 * Every item here is a digital download, not a physical instrument: condition
 * and shipping fields carry no real meaning and these listings never have a
 * second source to compare a market price against. The user was flagged on
 * this mismatch explicitly and chose to include the store anyway, so this
 * ingests on the same shared Shopify pipeline as every physical-gear store
 * with no special-casing beyond that acknowledged limitation.
 */

export async function ingestEminenceDigitalFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.eminenceDigital.refCode) {
    console.warn(
      "[eminencedigital] GOAFFPRO_EMINENCEDIGITAL_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "eminencedigital",
      baseUrl: "https://eminence-digital.com",
      refParam: env.goaffpro.eminenceDigital.refParam,
      refCode: env.goaffpro.eminenceDigital.refCode,
    },
    fetchImpl,
  )
}
