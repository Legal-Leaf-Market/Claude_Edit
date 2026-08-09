import type { Product } from "@/lib/products"
import { discountedPrice, discountPercent, DISCOUNT_CODE } from "@/lib/products"

// A saved watchlist snapshot as it lives in the DB (price/availability frozen at
// save time). Kept minimal + framework-free so this module stays server-safe.
export type SavedSnapshot = {
  productId: string
  title: string
  strainName: string
  storeName: string
  url: string
  imageUrl: string
  price: number
  inStock: boolean
}

export type WatchAlertKind = "drop" | "restock"

export type WatchAlert = {
  kind: WatchAlertKind
  title: string
  strainName: string
  storeName: string
  url: string
  imageUrl: string
  savedPrice: number
  currentPrice: number
  delta: number // negative for a drop
  // Rich card data so the email can mirror the on-site product card.
  category: string
  cannabinoid: string
  potencyPct: number | null
  ppgDisplay: string
  discountPercent: number // e.g. 10 or 20
  discountedPrice: number // current price after the store's code
  discountCode: string
  // Direct link that pre-loads this item into the store's cart with the code
  // applied (i.e. straight to checkout). Falls back to the product url.
  checkoutUrl: string
}

// Current best available price + stock for a live product. Mirrors the exact
// derivation used in the watchlist drawer so email alerts and the on-screen
// badges never disagree.
export function currentPriceOf(product: Product): { price: number; inStock: boolean } {
  const avail = product.variants.filter((v) => v.available)
  const price = avail.length ? Math.min(...avail.map((v) => v.price)) : product.price
  return { price, inStock: !product.isSoldOut && avail.length > 0 }
}

// Compare every saved snapshot against the live catalog and return only the
// "wins" worth emailing about: price drops and restocks.
// Build a Shopify/Woo checkout URL that pre-loads this product's cheapest
// in-stock variant with the discount applied. Mirrors buildStoreCheckoutUrl but
// works from a single Product (server-safe, no cart state). Falls back to the
// product page url when a cart permalink can't be built.
function checkoutUrlFor(product: Product, fallbackUrl: string): string {
  const avail = product.variants.filter((v) => v.available)
  const cheapest = avail.length
    ? avail.reduce((a, b) => (b.price < a.price ? b : a))
    : product.variants[0]
  const base = (product.cartBaseUrl || "").replace(/\/+$/, "")
  if (!base) return fallbackUrl || product.link

  if (product.storeType === "shopify") {
    if (cheapest?.variantId) {
      return `${base}/cart/${cheapest.variantId}:1?discount=${encodeURIComponent(DISCOUNT_CODE)}&channel=online_store`
    }
    return `${base}/discount/${encodeURIComponent(DISCOUNT_CODE)}`
  }
  const id = cheapest?.variantId || product.nativeId || ""
  const coupon = `coupon_code=${encodeURIComponent(DISCOUNT_CODE)}`
  return id ? `${base}/cart/?add-to-cart=${id}&${coupon}` : `${base}/cart/?${coupon}`
}

export function computeAlerts(saved: SavedSnapshot[], products: Product[]): WatchAlert[] {
  const byId = new Map<string, Product>()
  for (const p of products) byId.set(p.id, p)

  const alerts: WatchAlert[] = []
  for (const s of saved) {
    const product = byId.get(s.productId)
    if (!product) continue
    const current = currentPriceOf(product)

    // Shared rich-card fields, derived once per matched product.
    const enrich = (kind: WatchAlertKind, currentPrice: number, delta: number): WatchAlert => ({
      kind,
      title: product.title || s.title,
      strainName: product.strainName || s.strainName,
      storeName: s.storeName,
      url: s.url || product.link,
      imageUrl: product.imageUrl || s.imageUrl,
      savedPrice: s.price,
      currentPrice,
      delta,
      category: product.category || "",
      cannabinoid: product.cannabinoid || "",
      potencyPct: product.potencyPct ?? null,
      ppgDisplay: product.ppgDisplay || "",
      discountPercent: discountPercent(s.storeName),
      discountedPrice: discountedPrice(s.storeName, currentPrice),
      discountCode: DISCOUNT_CODE,
      checkoutUrl: checkoutUrlFor(product, s.url),
    })

    // Restock beats price: coming back in stock is the headline event.
    if (!s.inStock && current.inStock) {
      alerts.push(enrich("restock", current.price, current.price - s.price))
      continue
    }

    // Only alert on price drops for items that are (still) in stock.
    if (current.inStock) {
      const delta = current.price - s.price
      if (delta <= -0.01) {
        alerts.push(enrich("drop", current.price, delta))
      }
    }
  }
  return alerts
}
