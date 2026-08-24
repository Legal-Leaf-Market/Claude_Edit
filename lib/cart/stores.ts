import { storefrontMerchant } from "@/lib/storefronts"
import type { Source } from "@/lib/db/schema"

/**
 * Per-store checkout capability, keyed by the same Source values used
 * throughout ingestion.
 *
 * 'shopify' stores support the cart permalink (/cart/{variantId}:{qty},...),
 * which can fill a MULTI-item cart in one URL. 'woocommerce' only takes one
 * line per URL (?add-to-cart={id}&quantity={n}); additional items in the same
 * store have to be added by hand once the shopper is there. 'none' covers
 * every source with no prefillable cart at all (the paused eBay/Reverb/CJ/
 * Awin feeds): checkout there is just the single affiliate/raw link, same as
 * clicking through /go directly.
 */
export type CartPlatform = "shopify" | "woocommerce" | "none"

export type StoreCartConfig = {
  platform: CartPlatform
  baseUrl: string
  /** WooCommerce only. Defaults to '/cart/', the platform default. */
  cartPath?: string
  refParam?: string
  refCode?: string
}

export function storeCartConfig(source: Source): StoreCartConfig {
  /*
   * READ THE REGISTRY, DO NOT RESTATE IT. This was a twelve-case switch whose
   * every arm repeated a base URL and a referral pair already written down in
   * lib/storefronts.ts. Two copies of a base URL is one typo away from a cart
   * permalink pointing at the wrong shop, and nothing would have failed: the
   * shopper would simply land somewhere that does not have their items.
   *
   * A source with no row here is not a bug. eBay, Reverb, Sweetwater,
   * Gear4music, the CJ trio and the Impact merchants have no cart this module
   * can prefill, so checkout for them is the single affiliate link, same as
   * clicking through /go.
   */
  const merchant = storefrontMerchant(source)
  if (!merchant) return { platform: "none", baseUrl: "" }

  return {
    platform: merchant.platform,
    baseUrl: merchant.baseUrl,
    ...(merchant.cartPath ? { cartPath: merchant.cartPath } : {}),
    ...merchant.referral(),
  }
}
