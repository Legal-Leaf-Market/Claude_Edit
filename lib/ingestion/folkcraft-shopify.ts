import { env } from "@/lib/env"
import { ingestShopifyStore, type ShopifyIngestOutcome } from "./shopify-storefront"

/**
 * Folkcraft Instruments, a small independent mountain dulcimer maker/retailer
 * on Shopify. Confirmed enrolled in an affiliate program via the GoAffPro
 * merchant directory. Their own /agents.md publishes a "Read-Only Browsing
 * (No Authentication Required)" section naming /products.json as the
 * sanctioned path for agents reading catalogue data without transacting,
 * which is the whole of what this does.
 *
 * GOAFFPRO_FOLKCRAFT_REF_PARAM / GOAFFPRO_FOLKCRAFT_REF_CODE are this
 * publisher's actual GoAffPro referral parameter and code for Folkcraft's
 * program specifically. Catalogue ingestion works without them; an
 * unconfigured referral code just means every listing's affiliate_url stays
 * null, same "no half-built link" rule as every other source.
 */

export async function ingestFolkcraftFeed(fetchImpl: typeof fetch = fetch): Promise<ShopifyIngestOutcome> {
  if (!env.goaffpro.folkcraft.refCode) {
    console.warn(
      "[folkcraft] GOAFFPRO_FOLKCRAFT_REF_CODE is unset; listings will store a null affiliate_url and /go will fall back to the raw URL.",
    )
  }
  return ingestShopifyStore(
    {
      source: "folkcraft",
      baseUrl: "https://folkcraft.com",
      refParam: env.goaffpro.folkcraft.refParam,
      refCode: env.goaffpro.folkcraft.refCode,
    },
    fetchImpl,
  )
}
