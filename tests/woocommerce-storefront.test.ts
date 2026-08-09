import { describe, expect, it } from "vitest"
import {
  fetchWooCommerceProducts,
  normalizeWooCommerceProduct,
  stripWooCommerceHtml,
  type WooCommerceStoreConfig,
} from "@/lib/ingestion/woocommerce-storefront"

const CONFIG: WooCommerceStoreConfig = {
  source: "squaver",
  baseUrl: "https://squaver.in",
  locationCountry: "IN",
}

function product(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 2301,
    name: "Electric Guitar Strings Regular Light",
    sku: "SQ-GCB-11",
    permalink: "https://squaver.in/product/electric-guitar-strings-regular-light/",
    short_description: "<p>Vibrant, punchy <b>tone</b>.&nbsp;Fits most electrics.</p>",
    prices: { price: "44900", currency_code: "INR", currency_minor_unit: 2 },
    images: [{ src: "https://squaver.in/wp-content/uploads/strings.jpg" }],
    brands: [{ name: "Squaver" }],
    is_in_stock: true,
    is_purchasable: true,
    ...overrides,
  }
}

describe("stripWooCommerceHtml", () => {
  it("strips tags and decodes common entities", () => {
    expect(stripWooCommerceHtml("<p>Hello &amp; welcome.&nbsp;Enjoy!</p>")).toBe("Hello & welcome. Enjoy!")
  })

  it("drops <script> and <style> CONTENT, not just the tags", () => {
    const html = '<p>Great strings.</p><script>function f(){return 1}</script><p>Ships fast.</p>'
    expect(stripWooCommerceHtml(html)).toBe("Great strings. Ships fast.")
  })
})

describe("normalizeWooCommerceProduct", () => {
  it("maps a well formed product onto a listing insert", () => {
    const rows = normalizeWooCommerceProduct(product(), CONFIG)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.source).toBe("squaver")
    expect(row.externalId).toBe("2301")
    // "44900" at currency_minor_unit 2 is already in minor units (paise).
    expect(row.priceCents).toBe(44_900)
    expect(row.currency).toBe("INR")
    expect(row.brand).toBe("Squaver")
    expect(row.mpn).toBe("SQ-GCB-11")
    expect(row.condition).toBe("New")
    expect(row.platformVariantId).toBe("2301")
    expect(row.locationCountry).toBe("IN")
    expect(row.rawUrl).toBe("https://squaver.in/product/electric-guitar-strings-regular-light/")
    expect(row.description).toBe("Vibrant, punchy tone. Fits most electrics.")
  })

  it("returns no affiliate_url when no referral code is configured", () => {
    expect(normalizeWooCommerceProduct(product(), CONFIG)[0].affiliateUrl).toBeNull()
  })

  it("builds an affiliate_url by appending the referral param to the permalink", () => {
    const rows = normalizeWooCommerceProduct(product(), {
      ...CONFIG,
      refParam: "ref",
      refCode: "gearavail",
    })
    expect(rows[0].affiliateUrl).toBe(
      "https://squaver.in/product/electric-guitar-strings-regular-light/?ref=gearavail",
    )
  })

  it("marks a listing expired when out of stock or unpurchasable", () => {
    expect(normalizeWooCommerceProduct(product({ is_in_stock: false }), CONFIG)[0].listingStatus).toBe(
      "expired",
    )
    expect(
      normalizeWooCommerceProduct(product({ is_purchasable: false }), CONFIG)[0].listingStatus,
    ).toBe("expired")
  })

  it("skips a product with no permalink or no name", () => {
    expect(normalizeWooCommerceProduct(product({ permalink: undefined }), CONFIG)).toHaveLength(0)
    expect(normalizeWooCommerceProduct(product({ name: "" }), CONFIG)).toHaveLength(0)
  })

  it("skips a product with no usable price", () => {
    expect(normalizeWooCommerceProduct(product({ prices: {} }), CONFIG)).toHaveLength(0)
    expect(
      normalizeWooCommerceProduct(product({ prices: { price: "0" } }), CONFIG),
    ).toHaveLength(0)
  })

  it("rejects a currency with a minor unit other than 2 rather than mis-scaling it", () => {
    expect(
      normalizeWooCommerceProduct(
        product({ prices: { price: "1234", currency_code: "JPY", currency_minor_unit: 0 } }),
        CONFIG,
      ),
    ).toHaveLength(0)
  })
})

describe("fetchWooCommerceProducts", () => {
  it("paginates until a page returns fewer than the page size", async () => {
    const pages = [
      Array.from({ length: 100 }, (_, i) => product({ id: i, permalink: `https://squaver.in/product/p-${i}/` })),
      Array.from({ length: 3 }, (_, i) => product({ id: 100 + i, permalink: `https://squaver.in/product/p-${100 + i}/` })),
    ]
    let call = 0
    const impl: typeof fetch = async () => {
      const body = pages[call] ?? []
      call += 1
      return new Response(JSON.stringify(body), { status: 200 })
    }
    const { rows, seen } = await fetchWooCommerceProducts(CONFIG, impl)
    expect(seen).toBe(103)
    expect(rows).toHaveLength(103)
    expect(call).toBe(2)
  })

  it("stops immediately when the first page is empty", async () => {
    const impl: typeof fetch = async () => new Response(JSON.stringify([]), { status: 200 })
    const { rows, seen } = await fetchWooCommerceProducts(CONFIG, impl)
    expect(rows).toHaveLength(0)
    expect(seen).toBe(0)
  })

  it("throws with the status attached on a non-ok response", async () => {
    const impl: typeof fetch = async () => new Response("nope", { status: 503 })
    await expect(fetchWooCommerceProducts(CONFIG, impl)).rejects.toThrow(/503/)
  })
})
