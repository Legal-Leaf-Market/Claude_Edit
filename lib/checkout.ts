import { DISCOUNT_CODE } from "@/lib/products"
import type { CartItem } from "@/lib/use-cart"

/**
 * Build a store checkout URL that pre-loads the given cart items into the
 * destination store's own cart and applies the Legal-Leaf discount code.
 *
 * - Shopify: uses the cart permalink `/cart/{variantId}:{qty},...?discount=CODE`
 *   which adds every item and auto-applies the discount through to checkout.
 * - WooCommerce: uses the `add-to-cart` query on the cart page (best-effort for
 *   multiple items); the discount is copied to the clipboard as a fallback.
 */
export function buildStoreCheckoutUrl(items: CartItem[]): string | null {
  if (!items.length) return null
  const { storeType, cartBaseUrl } = items[0]
  const base = cartBaseUrl.replace(/\/+$/, "")

  if (storeType === "shopify") {
    const pairs = items
      .filter((i) => i.variantId)
      .map((i) => `${i.variantId}:${Math.max(1, i.qty)}`)
      .join(",")
    if (!pairs) return `${base}/discount/${encodeURIComponent(DISCOUNT_CODE)}`
    return `${base}/cart/${pairs}?discount=${encodeURIComponent(DISCOUNT_CODE)}&channel=online_store`
  }

  // WooCommerce best-effort multi add-to-cart with coupon pre-applied.
  // The discount is also copied to the clipboard by the caller as a reliable
  // fallback, since not every Woo store honors coupon-by-URL.
  const ids = items
    .map((i) => i.variantId || i.productId)
    .filter(Boolean)
    .join(",")
  const coupon = `coupon_code=${encodeURIComponent(DISCOUNT_CODE)}`
  const url = ids ? `${base}/cart/?add-to-cart=${ids}&${coupon}` : `${base}/cart/?${coupon}`
  return url
}

/**
 * Open a checkout URL respecting the preview iframe: if we are embedded, open a
 * new tab so the store loads outside the sandbox; otherwise navigate normally.
 */
export function openCheckoutUrl(url: string): void {
  if (typeof window === "undefined") return
  if (window.self !== window.top) {
    window.open(url, "_blank", "noopener,noreferrer")
  } else {
    window.location.href = url
  }
}
