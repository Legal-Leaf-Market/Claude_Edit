import type { ShopifyIngestOutcome } from "./shopify-storefront"
import { ingestShopifyStore } from "./shopify-storefront"
import { ingestWooCommerceStore } from "./woocommerce-storefront"
import { storefrontMerchant, type StorefrontMerchant } from "@/lib/storefronts"

/**
 * RUNNING a storefront, as opposed to describing one.
 *
 * The rows live in lib/storefronts.ts, deliberately free of any ingestion
 * import, because lib/utils.ts reads them for `sourceLabel()` and lib/utils.ts
 * ships to the browser. This module is the half that touches the readers, and
 * nothing client-side imports it.
 */

export * from "@/lib/storefronts"

/**
 * Run one store's ingest, whichever platform it is on.
 *
 * The platform switch is the ONLY thing that differs between two rows here, so
 * it is the only branch: everything downstream (the upsert, the run
 * bookkeeping, the resolver, expiry) is already shared by the two readers.
 */
export async function ingestStorefront(
  merchant: StorefrontMerchant,
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome> {
  const { refParam, refCode } = merchant.referral()

  if (!refCode) {
    /*
     * A warning, not a skip, and the distinction is section 17. An
     * unmonetised store is still a store a shopper can buy from, so it
     * ingests; the only consequence is a null affiliate_url and /go falling
     * back to the merchant's own page.
     */
    console.warn(
      `[${merchant.source}] no referral code configured; listings will store a null affiliate_url ` +
        `and /go will fall back to the raw URL. Ingesting anyway: payout is not why a merchant is listed.`,
    )
  }

  const config = {
    source: merchant.source,
    baseUrl: merchant.baseUrl,
    currency: merchant.currency,
    locationCountry: merchant.locationCountry,
    refParam,
    refCode,
  }

  return merchant.platform === "woocommerce"
    ? ingestWooCommerceStore(config, fetchImpl)
    : ingestShopifyStore(config, fetchImpl)
}

/** Ingest by source name. Returns null for a source that is not a storefront. */
export async function ingestStorefrontBySource(
  source: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyIngestOutcome | null> {
  const merchant = storefrontMerchant(source)
  if (!merchant) return null
  return ingestStorefront(merchant, fetchImpl)
}
