import type { StoreCartConfig } from "./stores"

/**
 * Checkout URL construction, one store group at a time.
 *
 * Modeled on the sister sites' pattern (Herbal Leaf / Nicotia Market): a
 * shopper can only ever check out with one merchant at a time, so "checkout"
 * means building the best URL that hands them to THAT store already holding
 * as much of the cart as the platform allows, not a unified multi-merchant
 * checkout (which does not exist anywhere in this space).
 *
 *   - Shopify: the /cart/{variantId}:{qty},... permalink fills the WHOLE
 *     group in one URL.
 *   - WooCommerce: ?add-to-cart={id}&quantity={n} takes exactly ONE line;
 *     anything past the first item has to be added by hand once there.
 *   - Everything else (paused eBay/Reverb/CJ/Awin sources): no URL scheme
 *     fills a basket at all, so "checkout" is just the first item's own
 *     link, the same destination /go would use.
 *
 * Never emits an empty query param (a bare `ref=` reads as explicit
 * de-attribution on some networks, worse than omitting it).
 */

export type CartLine = {
  listingId: string
  qty: number
  rawUrl: string
  affiliateUrl: string | null
  platformVariantId: string | null
}

export type CheckoutPlan = {
  url: string
  /** How many of the group's lines actually made it into the URL. */
  filledCount: number
  /** How many lines did not, and so need to be added by hand at the store. */
  leftoverCount: number
}

function addParams(url: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(url)
  for (const [key, value] of Object.entries(params)) {
    if (value) u.searchParams.set(key, value)
  }
  return u.toString()
}

export function buildCheckoutPlan(config: StoreCartConfig, lines: CartLine[]): CheckoutPlan {
  const refParam = config.refParam ?? "ref"

  if (config.platform === "shopify") {
    const parts = lines
      .filter((l) => l.platformVariantId)
      .map((l) => `${encodeURIComponent(l.platformVariantId!)}:${l.qty}`)

    if (parts.length > 0) {
      return {
        url: addParams(`${config.baseUrl}/cart/${parts.join(",")}`, {
          [refParam]: config.refCode,
          return_to: "/checkout",
        }),
        filledCount: parts.length,
        leftoverCount: lines.length - parts.length,
      }
    }
    // No usable variant id on anything in the group: the plain cart page is
    // still a better destination than nothing.
    return {
      url: addParams(`${config.baseUrl}/cart`, { [refParam]: config.refCode }),
      filledCount: 0,
      leftoverCount: lines.length,
    }
  }

  if (config.platform === "woocommerce") {
    const first = lines[0]
    const path = config.cartPath ?? "/cart/"
    if (first.platformVariantId) {
      return {
        url: addParams(`${config.baseUrl}${path}`, {
          "add-to-cart": first.platformVariantId,
          quantity: String(first.qty),
          [refParam]: config.refCode,
        }),
        filledCount: 1,
        leftoverCount: lines.length - 1,
      }
    }
    return { url: first.affiliateUrl ?? first.rawUrl, filledCount: 0, leftoverCount: lines.length }
  }

  // 'none': hand over the first item's own link. This is exactly what /go
  // would have redirected to for that one listing.
  const first = lines[0]
  return {
    url: first.affiliateUrl ?? first.rawUrl,
    filledCount: 1,
    leftoverCount: lines.length - 1,
  }
}
