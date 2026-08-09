import { gzipSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { parseCsv } from "@/lib/ingestion/csv"
import {
  fetchLinkConnectorFeedText,
  normalizeLinkConnectorRow,
  parseLinkConnectorFeed,
} from "@/lib/ingestion/sweetwater-linkconnector"

/* -------------------------------------------------------------------------- */
/*  LinkConnector row mapping                                                 */
/* -------------------------------------------------------------------------- */

// Real LinkConnector datafeed column names (their documented 50-column
// format), not guesses: ProductID, Title, Description, Price, URL, ImageURL,
// UPC, EAN, Brand, Manufacturer, Model, Condition, Currency, InStock, Link.
const LC_HEADER =
  "ProductID,Title,Description,Price,URL,ImageURL,UPC,EAN,Brand,Manufacturer,Model,Condition,Currency,InStock,Link"

function lcRow(overrides: Partial<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    ProductID: "sw-2001",
    Title: "Fender Player Stratocaster 2022 Sunburst",
    Description: "Gear Exchange listing, minor pick wear",
    Price: "699.00",
    URL: "https://www.sweetwater.com/used/listings/2001-fender-player-strat",
    ImageURL: "https://media.sweetwater.com/image/2001.jpg",
    UPC: "885978512345",
    EAN: "",
    Brand: "Fender",
    Manufacturer: "Fender",
    Model: "0144502506",
    Condition: "Excellent",
    Currency: "USD",
    InStock: "1",
    Link: "https://www.sweetwater.com/used/listings/2001-fender-player-strat?utm_source=linkconnector",
  }
  const merged = { ...base, ...overrides }
  return LC_HEADER.split(",")
    .map((h) => `"${(merged[h] ?? "").replace(/"/g, '""')}"`)
    .join(",")
}

function record(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return parseCsv(`${LC_HEADER}\n${lcRow(overrides)}\n`)[0]
}

describe("normalizeLinkConnectorRow", () => {
  it("maps a well formed feed row onto a listing insert", () => {
    const row = normalizeLinkConnectorRow(record())!
    expect(row.source).toBe("sweetwater")
    expect(row.externalId).toBe("sw-2001")
    expect(row.priceCents).toBe(69_900)
    expect(row.brand).toBe("Fender")
    expect(row.gtin).toBe("885978512345")
    expect(row.mpn).toBe("0144502506")
    expect(row.condition).toBe("Excellent")
    expect(row.listingStatus).toBe("active")
    expect(row.rawUrl).toContain("sweetwater.com")
  })

  it("trusts the feed's Link column only when it resolves to a Sweetwater host", () => {
    const row = normalizeLinkConnectorRow(record())!
    expect(row.affiliateUrl).toContain("sweetwater.com")
  })

  it("drops the affiliate link rather than trusting an unrecognised host", () => {
    // A misparsed column or an unverified network redirect domain must never
    // become a stored destination we would later redirect shoppers through.
    const row = normalizeLinkConnectorRow(
      record({ Link: "https://not-a-real-tracking-domain.example/click?x=1" }),
    )!
    expect(row.affiliateUrl).toBeNull()
    // The plain merchant URL still works as the fallback destination.
    expect(row.rawUrl).toContain("sweetwater.com")
  })

  it("falls back to Manufacturer when Brand is blank", () => {
    const row = normalizeLinkConnectorRow(record({ Brand: "" }))!
    expect(row.brand).toBe("Fender")
  })

  it("never borrows an EPID, which is an eBay concept", () => {
    expect(normalizeLinkConnectorRow(record())!.epid).toBeNull()
  })

  it("normalises Sweetwater condition names onto the shared vocabulary", () => {
    expect(normalizeLinkConnectorRow(record({ Condition: "Very Good" }))!.condition).toBe("Very good")
    expect(normalizeLinkConnectorRow(record({ Condition: "Mint" }))!.condition).toBe("Mint")
    expect(normalizeLinkConnectorRow(record({ Condition: "Refurbished" }))!.condition).toBe("Refurbished")
  })

  it("treats an absent stock column as active rather than dropping the catalogue", () => {
    expect(normalizeLinkConnectorRow(record({ InStock: "" }))!.listingStatus).toBe("active")
    expect(normalizeLinkConnectorRow(record({ InStock: "0" }))!.listingStatus).toBe("expired")
  })

  it("drops rows with no id, no price or no URL", () => {
    expect(normalizeLinkConnectorRow(record({ ProductID: "" }))).toBeNull()
    expect(normalizeLinkConnectorRow(record({ Price: "0" }))).toBeNull()
    expect(normalizeLinkConnectorRow(record({ URL: "" }))).toBeNull()
  })

  it("reads mixed-case headers, which vary by feed export", () => {
    const mixed = parseCsv(
      "productid,title,price,url\n" +
        '"x1","Gibson SG","1299.00","https://www.sweetwater.com/used/listings/x1"\n',
    )[0]
    const row = normalizeLinkConnectorRow(mixed)!
    expect(row.externalId).toBe("x1")
    expect(row.priceCents).toBe(129_900)
  })
})

describe("parseLinkConnectorFeed", () => {
  it("parses a multi-row feed and counts what it skipped", () => {
    const text = [LC_HEADER, lcRow({ ProductID: "a" }), lcRow({ ProductID: "b" }), lcRow({ ProductID: "" })].join(
      "\n",
    )
    const { rows, seen, skipped } = parseLinkConnectorFeed(text)
    expect(seen).toBe(3)
    expect(rows).toHaveLength(2)
    expect(skipped).toBe(1)
  })
})

describe("fetchLinkConnectorFeedText", () => {
  it("transparently gunzips a feed served gzipped", async () => {
    const plain = `${LC_HEADER}\n${lcRow()}\n`
    const impl: typeof fetch = async () => new Response(gzipSync(Buffer.from(plain)), { status: 200 })
    const text = await fetchLinkConnectorFeedText("https://example.test/feed", impl)
    expect(text).toBe(plain)
  })

  it("passes plain text through untouched", async () => {
    const plain = `${LC_HEADER}\n${lcRow()}\n`
    const impl: typeof fetch = async () => new Response(plain, { status: 200 })
    expect(await fetchLinkConnectorFeedText("https://example.test/feed", impl)).toBe(plain)
  })

  it("throws with the status attached so backoff can decide to retry", async () => {
    const impl: typeof fetch = async () => new Response("nope", { status: 503 })
    await expect(fetchLinkConnectorFeedText("https://example.test/feed", impl)).rejects.toThrow(/503/)
  })
})
