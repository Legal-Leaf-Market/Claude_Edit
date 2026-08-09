import { describe, expect, it } from "vitest"
import {
  fetchShopifyProducts,
  normalizeShopifyProduct,
  stripShopifyHtml,
  type ShopifyStoreConfig,
} from "@/lib/ingestion/shopify-storefront"

const CONFIG: ShopifyStoreConfig = {
  source: "folkcraft",
  baseUrl: "https://folkcraft.com",
}

function product(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 10275172647225,
    title: "Deluxe Folkcraft Logo Rigid Dulcimer Case",
    handle: "deluxe-rigid-dulcimer-case-tan",
    body_html: "<p>Protect your instrument in <b>style</b>.&nbsp;Fits most models.</p>",
    vendor: "Folkcraft",
    product_type: "Cases & Bags",
    images: [{ src: "https://media.folkcraft.com/case.jpg" }],
    variants: [
      {
        id: 53828776263993,
        title: "Default Title",
        sku: "90712265",
        price: "330.00",
        available: true,
      },
    ],
    ...overrides,
  }
}

describe("stripShopifyHtml", () => {
  it("strips tags and decodes common entities", () => {
    expect(stripShopifyHtml("<p>Hello &amp; welcome.&nbsp;Enjoy!</p>")).toBe("Hello & welcome. Enjoy!")
  })

  it("decodes numeric and hex entities", () => {
    expect(stripShopifyHtml("It&#8217;s here")).toBe("It’s here")
    expect(stripShopifyHtml("Caf&#x00e9;")).toBe("Café")
  })

  it("drops <script> and <style> CONTENT, not just the tags", () => {
    // Real data: sellers often embed a Shopify Buy Button widget here, which
    // is a <script> block containing a JS function body full of punctuation
    // that would otherwise read as garbled description text.
    const html =
      '<p>Great pedal.</p><script type="text/javascript">function f(){ return 1; }</script>' +
      "<style>.foo{color:red}</style><p>Ships fast.</p>"
    expect(stripShopifyHtml(html)).toBe("Great pedal. Ships fast.")
  })
})

describe("normalizeShopifyProduct", () => {
  it("maps a well formed product onto a listing insert", () => {
    const rows = normalizeShopifyProduct(product(), CONFIG)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.source).toBe("folkcraft")
    expect(row.externalId).toBe("10275172647225-53828776263993")
    expect(row.priceCents).toBe(33_000)
    expect(row.brand).toBe("Folkcraft")
    expect(row.mpn).toBe("90712265")
    expect(row.condition).toBe("New")
    expect(row.rawUrl).toBe("https://folkcraft.com/products/deluxe-rigid-dulcimer-case-tan")
    expect(row.description).toBe("Protect your instrument in style. Fits most models.")
  })

  it("produces one listing per variant, with the variant title appended", () => {
    const rows = normalizeShopifyProduct(
      product({
        variants: [
          { id: 1, title: "Small", sku: "sku-s", price: "100.00", available: true },
          { id: 2, title: "Large", sku: "sku-l", price: "120.00", available: false },
        ],
      }),
      CONFIG,
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].title).toContain("- Small")
    expect(rows[0].listingStatus).toBe("active")
    expect(rows[1].title).toContain("- Large")
    expect(rows[1].listingStatus).toBe("expired")
  })

  it("returns no affiliate_url when no referral code is configured", () => {
    const rows = normalizeShopifyProduct(product(), CONFIG)
    expect(rows[0].affiliateUrl).toBeNull()
  })

  it("builds an affiliate_url by appending the referral param to the raw URL", () => {
    const rows = normalizeShopifyProduct(product(), {
      ...CONFIG,
      refParam: "ref",
      refCode: "musictime123",
    })
    expect(rows[0].affiliateUrl).toBe(
      "https://folkcraft.com/products/deluxe-rigid-dulcimer-case-tan?ref=musictime123",
    )
  })

  it("skips a product with no handle or no title", () => {
    expect(normalizeShopifyProduct(product({ handle: "" }), CONFIG)).toHaveLength(0)
    expect(normalizeShopifyProduct(product({ title: "" }), CONFIG)).toHaveLength(0)
  })

  it("skips a variant with no usable price, without dropping the others", () => {
    const rows = normalizeShopifyProduct(
      product({
        variants: [
          { id: 1, title: "Small", price: "0.00", available: true },
          { id: 2, title: "Large", price: "120.00", available: true },
        ],
      }),
      CONFIG,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toContain("- Large")
  })
})

describe("fetchShopifyProducts", () => {
  it("paginates until a page returns fewer than the page size", async () => {
    const pages = [
      Array.from({ length: 250 }, (_, i) => product({ id: i, handle: `p-${i}` })),
      Array.from({ length: 3 }, (_, i) => product({ id: 250 + i, handle: `p-${250 + i}` })),
    ]
    let call = 0
    const impl: typeof fetch = async () => {
      const body = { products: pages[call] ?? [] }
      call += 1
      return new Response(JSON.stringify(body), { status: 200 })
    }
    const { rows, seen } = await fetchShopifyProducts(CONFIG, impl)
    expect(seen).toBe(253)
    expect(rows).toHaveLength(253)
    expect(call).toBe(2)
  })

  it("stops immediately when the first page is empty", async () => {
    const impl: typeof fetch = async () => new Response(JSON.stringify({ products: [] }), { status: 200 })
    const { rows, seen } = await fetchShopifyProducts(CONFIG, impl)
    expect(rows).toHaveLength(0)
    expect(seen).toBe(0)
  })

  it("throws with the status attached on a non-ok response", async () => {
    const impl: typeof fetch = async () => new Response("nope", { status: 503 })
    await expect(fetchShopifyProducts(CONFIG, impl)).rejects.toThrow(/503/)
  })
})
