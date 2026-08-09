import { gzipSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { parseCsv } from "@/lib/ingestion/csv"
import { fetchZzoundsFeedText, normalizeZzoundsRow, parseZzoundsFeed } from "@/lib/ingestion/zzounds-cj"

const CJ_HEADER = "SKU,NAME,DESCRIPTION,PRICE,BUY_URL,IMAGE_URL,UPC,MPN,MANUFACTURER_NAME,IN_STOCK,CATEGORY"

function cjRow(overrides: Partial<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    SKU: "zz-4001",
    NAME: "Fender American Professional II Stratocaster",
    DESCRIPTION: "Brand new, factory sealed",
    PRICE: "1699.99",
    BUY_URL: "https://www.anrdoezrs.net/click-1234567-8901234",
    IMAGE_URL: "https://media.zzounds.com/media/product/4001.jpg",
    UPC: "885978512399",
    MPN: "0113900723",
    MANUFACTURER_NAME: "Fender",
    IN_STOCK: "1",
    CATEGORY: "Electric Guitars",
  }
  const merged = { ...base, ...overrides }
  return CJ_HEADER.split(",")
    .map((h) => `"${(merged[h] ?? "").replace(/"/g, '""')}"`)
    .join(",")
}

function record(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return parseCsv(`${CJ_HEADER}\n${cjRow(overrides)}\n`)[0]
}

describe("normalizeZzoundsRow", () => {
  it("maps a well formed feed row onto a listing insert", () => {
    const row = normalizeZzoundsRow(record())!
    expect(row.source).toBe("zzounds")
    expect(row.externalId).toBe("zz-4001")
    expect(row.priceCents).toBe(169_999)
    expect(row.brand).toBe("Fender")
    expect(row.gtin).toBe("885978512399")
    expect(row.mpn).toBe("0113900723")
    expect(row.listingStatus).toBe("active")
  })

  it("defaults condition to New, since zZounds is primarily new retail inventory", () => {
    expect(normalizeZzoundsRow(record())!.condition).toBe("New")
  })

  it("trusts BUY_URL as the affiliate link only when it is a CJ tracking domain", () => {
    const tracked = normalizeZzoundsRow(record())!
    expect(tracked.affiliateUrl).toContain("anrdoezrs.net")
    expect(tracked.rawUrl).toBe(tracked.affiliateUrl)

    const untracked = normalizeZzoundsRow(
      record({ BUY_URL: "https://www.zzounds.com/item/4001-fender-strat" }),
    )!
    expect(untracked.affiliateUrl).toBeNull()
    expect(untracked.rawUrl).toContain("zzounds.com")
  })

  it("never borrows an EPID, which is an eBay concept", () => {
    expect(normalizeZzoundsRow(record())!.epid).toBeNull()
  })

  it("treats an absent stock column as active rather than dropping the catalogue", () => {
    expect(normalizeZzoundsRow(record({ IN_STOCK: "" }))!.listingStatus).toBe("active")
    expect(normalizeZzoundsRow(record({ IN_STOCK: "0" }))!.listingStatus).toBe("expired")
  })

  it("drops rows with no id, no price or no BUY_URL", () => {
    expect(normalizeZzoundsRow(record({ SKU: "" }))).toBeNull()
    expect(normalizeZzoundsRow(record({ PRICE: "0" }))).toBeNull()
    expect(normalizeZzoundsRow(record({ BUY_URL: "" }))).toBeNull()
  })
})

describe("parseZzoundsFeed", () => {
  it("parses a multi-row feed and counts what it skipped", () => {
    const text = [CJ_HEADER, cjRow({ SKU: "a" }), cjRow({ SKU: "b" }), cjRow({ SKU: "" })].join("\n")
    const { rows, seen, skipped } = parseZzoundsFeed(text)
    expect(seen).toBe(3)
    expect(rows).toHaveLength(2)
    expect(skipped).toBe(1)
  })
})

describe("fetchZzoundsFeedText", () => {
  it("transparently gunzips a feed served gzipped", async () => {
    const plain = `${CJ_HEADER}\n${cjRow()}\n`
    const impl: typeof fetch = async () => new Response(gzipSync(Buffer.from(plain)), { status: 200 })
    const text = await fetchZzoundsFeedText("https://example.test/feed", impl)
    expect(text).toBe(plain)
  })

  it("throws with the status attached so backoff can decide to retry", async () => {
    const impl: typeof fetch = async () => new Response("nope", { status: 503 })
    await expect(fetchZzoundsFeedText("https://example.test/feed", impl)).rejects.toThrow(/503/)
  })
})
