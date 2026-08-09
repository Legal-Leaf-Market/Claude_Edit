import { env } from "@/lib/env"
import { ingestWooCommerceStore, type WooCommerceIngestOutcome } from "./woocommerce-storefront"

/**
 * Squaver Guitar (squaver.in), an Indian guitar/accessories retailer on
 * WordPress + WooCommerce, not Shopify. There is no agents.md and no
 * third-party-aggregation publication the way Shopify's platform-wide one
 * sanctions /products.json; the only public catalogue read is WooCommerce's
 * Store API (/wp-json/wc/store/v1/products), which is unauthenticated by
 * default because it backs WooCommerce's own cart/checkout blocks, not
 * because Squaver published it for this use. That is a materially weaker
 * compliance basis than every other small-seller source in this file. The
 * user was told this explicitly, including the Guitar Center comparison
 * (an interface built for a site's own frontend, not published for
 * third-party use), and chose to proceed anyway. Do not treat this module as
 * precedent for other WooCommerce stores without the same explicit call.
 *
 * The publisher is approved in Squaver's own GoAffPro program with a real
 * referral link (ref=<code>) appended directly to the merchant's own domain.
 */

export async function ingestSquaverFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<WooCommerceIngestOutcome> {
  if (!env.goaffpro.squaver.refCode) {
    console.warn(
      "[squaver] GOAFFPRO_SQUAVER_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestWooCommerceStore(
    {
      source: "squaver",
      baseUrl: "https://squaver.in",
      locationCountry: "IN",
      refParam: env.goaffpro.squaver.refParam,
      refCode: env.goaffpro.squaver.refCode,
    },
    fetchImpl,
  )
}
