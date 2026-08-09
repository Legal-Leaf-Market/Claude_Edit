import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * Play With Authority (playwithauthority.com), direct on Shopify. Same basis
 * as every other small-seller source: their /agents.md publishes the
 * "Read-Only Browsing" no-auth /products.json path. The GoAffPro application
 * is pending approval as of writing; wiring this in ahead of that is safe
 * because an unset referral code just means every listing's affiliate_url
 * stays null; the moment GOAFFPRO_PLAYWITHAUTHORITY_REF_CODE is set the same
 * code starts producing real affiliate links with no further changes needed.
 */

export async function ingestPlayWithAuthorityFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.playWithAuthority.refCode) {
    console.warn(
      "[playwithauthority] GOAFFPRO_PLAYWITHAUTHORITY_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "playwithauthority",
      baseUrl: "https://www.playwithauthority.com",
      refParam: env.goaffpro.playWithAuthority.refParam,
      refCode: env.goaffpro.playWithAuthority.refCode,
    },
    fetchImpl,
  )
}
