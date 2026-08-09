import { describe, expect, it } from "vitest"
import { buildCheckoutPlan, type CartLine } from "@/lib/cart/checkout"
import type { StoreCartConfig } from "@/lib/cart/stores"

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    listingId: "11111111-1111-1111-1111-111111111111",
    qty: 1,
    rawUrl: "https://folkcraft.com/products/dulcimer",
    affiliateUrl: "https://folkcraft.com/products/dulcimer?ref=gearavail",
    platformVariantId: "53828776263993",
    ...overrides,
  }
}

describe("buildCheckoutPlan / shopify", () => {
  const config: StoreCartConfig = {
    platform: "shopify",
    baseUrl: "https://folkcraft.com",
    refParam: "ref",
    refCode: "gearavail",
  }

  it("fills the whole cart into one permalink, in variantId:qty pairs", () => {
    const plan = buildCheckoutPlan(config, [
      line({ platformVariantId: "111", qty: 2 }),
      line({ listingId: "22222222-2222-2222-2222-222222222222", platformVariantId: "222", qty: 1 }),
    ])
    expect(plan.filledCount).toBe(2)
    expect(plan.leftoverCount).toBe(0)
    const url = new URL(plan.url)
    expect(url.pathname).toBe("/cart/111:2,222:1")
    expect(url.searchParams.get("ref")).toBe("gearavail")
    expect(url.searchParams.get("return_to")).toBe("/checkout")
  })

  it("never emits an empty ref param when no code is configured", () => {
    const plan = buildCheckoutPlan({ ...config, refCode: undefined }, [line()])
    expect(new URL(plan.url).searchParams.has("ref")).toBe(false)
  })

  it("falls back to the plain cart page when nothing has a variant id", () => {
    const plan = buildCheckoutPlan(config, [line({ platformVariantId: null })])
    expect(plan.filledCount).toBe(0)
    expect(plan.leftoverCount).toBe(1)
    expect(new URL(plan.url).pathname).toBe("/cart")
  })
})

describe("buildCheckoutPlan / woocommerce", () => {
  const config: StoreCartConfig = {
    platform: "woocommerce",
    baseUrl: "https://squaver.in",
    cartPath: "/cart/",
    refParam: "ref",
    refCode: "gearavail",
  }

  it("fills only the first item, since add-to-cart takes one line per URL", () => {
    const plan = buildCheckoutPlan(config, [
      line({ platformVariantId: "2301", qty: 3 }),
      line({ listingId: "22222222-2222-2222-2222-222222222222", platformVariantId: "2302", qty: 1 }),
    ])
    expect(plan.filledCount).toBe(1)
    expect(plan.leftoverCount).toBe(1)
    const url = new URL(plan.url)
    expect(url.searchParams.get("add-to-cart")).toBe("2301")
    expect(url.searchParams.get("quantity")).toBe("3")
  })

  it("respects a non-default cart path", () => {
    const plan = buildCheckoutPlan({ ...config, cartPath: "/store/" }, [line({ platformVariantId: "9" })])
    expect(new URL(plan.url).pathname).toBe("/store/")
  })

  it("falls back to the item's own link when it has no platform id", () => {
    const plan = buildCheckoutPlan(config, [line({ platformVariantId: null })])
    expect(plan.filledCount).toBe(0)
    expect(plan.url).toBe(line().affiliateUrl)
  })
})

describe("buildCheckoutPlan / none", () => {
  const config: StoreCartConfig = { platform: "none", baseUrl: "" }

  it("hands over the first item's affiliate link, preferring it over the raw one", () => {
    const plan = buildCheckoutPlan(config, [line(), line({ listingId: "22222222-2222-2222-2222-222222222222" })])
    expect(plan.url).toBe(line().affiliateUrl)
    expect(plan.filledCount).toBe(1)
    expect(plan.leftoverCount).toBe(1)
  })

  it("falls back to rawUrl when there is no affiliate link", () => {
    const plan = buildCheckoutPlan(config, [line({ affiliateUrl: null })])
    expect(plan.url).toBe(line().rawUrl)
  })
})
