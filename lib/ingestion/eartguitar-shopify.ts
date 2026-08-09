import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * EART Guitar (eartguitar.com), a guitar manufacturer direct on Shopify. Same
 * basis as every other small-seller source: their /agents.md publishes the
 * "Read-Only Browsing" no-auth /products.json path, and the publisher is
 * approved in EART's own GoAffPro program with a real referral link
 * (ref=<code>). Their assigned referral code is an auto-generated GoAffPro
 * value rather than a chosen vanity code like the other stores', so only the
 * parameter name defaults; the code itself is still required from env.
 */

export async function ingestEartGuitarFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.eartGuitar.refCode) {
    console.warn(
      "[eartguitar] GOAFFPRO_EARTGUITAR_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "eartguitar",
      baseUrl: "https://eartguitar.com",
      refParam: env.goaffpro.eartGuitar.refParam,
      refCode: env.goaffpro.eartGuitar.refCode,
    },
    fetchImpl,
  )
}
