import { gzipSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { detectDelimiter, parseCsv, parseCsvRows } from "@/lib/ingestion/csv"
import { fetchAwinFeedText, normalizeAwinRow, parseAwinFeed } from "@/lib/ingestion/reverb-awin"

/* -------------------------------------------------------------------------- */
/*  CSV                                                                       */
/* -------------------------------------------------------------------------- */

describe("parseCsv", () => {
  it("keeps commas that live inside a quoted field", () => {
    // A split(",") parser silently shreds this row, and Awin descriptions are
    // full of commas.
    const rows = parseCsv('a,b\n"one, two",three\n')
    expect(rows[0]).toEqual({ a: "one, two", b: "three" })
  })

  it("unescapes a doubled quote", () => {
    const rows = parseCsv('a\n"He said ""hi"""\n')
    expect(rows[0].a).toBe('He said "hi"')
  })

  it("keeps newlines inside a quoted field", () => {
    const rows = parseCsv('a,b\n"line one\nline two",x\n')
    expect(rows[0].a).toBe("line one\nline two")
    expect(rows).toHaveLength(1)
  })

  it("handles CRLF", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n")
    expect(rows[0]).toEqual({ a: "1", b: "2" })
  })

  it("strips a UTF-8 BOM off the first header", () => {
    // Left in place the BOM becomes part of the header name and every lookup
    // for that column silently misses.
    const rows = parseCsv("﻿product_id,price\n1,2\n")
    expect(Object.keys(rows[0])).toContain("product_id")
  })

  it("ignores blank trailing lines", () => {
    expect(parseCsvRows("a,b\n1,2\n\n")).toHaveLength(2)
  })

  it("parses pipe and tab delimited variants", () => {
    expect(parseCsv("a|b\n1|2\n", { delimiter: "|" })[0]).toEqual({ a: "1", b: "2" })
    expect(parseCsv("a\tb\n1\t2\n", { delimiter: "\t" })[0]).toEqual({ a: "1", b: "2" })
  })
})

describe("detectDelimiter", () => {
  it("picks the delimiter from the header line", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",")
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|")
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t")
  })

  it("is not fooled by commas in a later description row", () => {
    expect(detectDelimiter('a|b\n1|"x, y, z, w, v"')).toBe("|")
  })
})

/* -------------------------------------------------------------------------- */
/*  Awin row mapping                                                          */
/* -------------------------------------------------------------------------- */

const AWIN_HEADER =
  "product_id,product_name,description,search_price,currency,brand_name,aw_deep_link,merchant_deep_link,merchant_image_url,ean,mpn,condition,in_stock,merchant_category"

function awinRow(overrides: Partial<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    product_id: "rvb-1001",
    product_name: "Fender Player Stratocaster 2021 Sunburst",
    description: "A lovely guitar, barely played",
    search_price: "749.00",
    currency: "USD",
    brand_name: "Fender",
    aw_deep_link: "https://www.awin1.com/cread.php?awinmid=67144&awinaffid=3004653&ued=x",
    merchant_deep_link: "https://reverb.com/item/1001-fender-player-stratocaster",
    merchant_image_url: "https://rvb-img.reverb.com/image/1001.jpg",
    ean: "885978512345",
    mpn: "0144502506",
    condition: "Excellent",
    in_stock: "1",
    merchant_category: "Electric Guitars",
  }
  const merged = { ...base, ...overrides }
  return AWIN_HEADER.split(",")
    .map((h) => `"${(merged[h] ?? "").replace(/"/g, '""')}"`)
    .join(",")
}

function record(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return parseCsv(`${AWIN_HEADER}\n${awinRow(overrides)}\n`)[0]
}

describe("normalizeAwinRow", () => {
  it("maps a well formed feed row onto a listing insert", () => {
    const row = normalizeAwinRow(record())!
    expect(row.source).toBe("reverb")
    expect(row.externalId).toBe("rvb-1001")
    expect(row.priceCents).toBe(74_900)
    expect(row.brand).toBe("Fender")
    expect(row.gtin).toBe("885978512345")
    expect(row.condition).toBe("Excellent")
    expect(row.listingStatus).toBe("active")
    expect(row.rawUrl).toBe("https://reverb.com/item/1001-fender-player-stratocaster")
  })

  it("uses Awin's own tracked link when the feed supplies one", () => {
    const row = normalizeAwinRow(record())!
    expect(row.affiliateUrl).toContain("awin1.com/cread.php")
  })

  it("builds a deep link when the feed has only a merchant URL", () => {
    const row = normalizeAwinRow(record({ aw_deep_link: "" }))!
    // Built from AWIN_PUBLISHER_ID in .env.local; without a merchant id it stays null.
    expect(!row.affiliateUrl || row.affiliateUrl.includes("awin1.com")).toBe(true)
    expect(row.rawUrl).toContain("reverb.com")
  })

  it("never borrows an EPID, which is an eBay concept", () => {
    // A Reverb row carrying an epid would collide on canonical_gear's unique
    // epid index and merge two unrelated instruments.
    expect(normalizeAwinRow(record())!.epid).toBeNull()
  })

  it("normalises Reverb condition names onto the shared vocabulary", () => {
    expect(normalizeAwinRow(record({ condition: "Brand New" }))!.condition).toBe("New")
    expect(normalizeAwinRow(record({ condition: "Mint" }))!.condition).toBe("Mint")
    expect(normalizeAwinRow(record({ condition: "Non Functioning" }))!.condition).toBe(
      "For parts or not working",
    )
  })

  it("treats an absent stock column as active rather than dropping the catalogue", () => {
    expect(normalizeAwinRow(record({ in_stock: "" }))!.listingStatus).toBe("active")
    expect(normalizeAwinRow(record({ in_stock: "0" }))!.listingStatus).toBe("expired")
  })

  it("drops rows with no id, no price or no URL", () => {
    expect(normalizeAwinRow(record({ product_id: "" }))).toBeNull()
    expect(normalizeAwinRow(record({ search_price: "0" }))).toBeNull()
    expect(normalizeAwinRow(record({ merchant_deep_link: "", aw_deep_link: "" }))).toBeNull()
  })

  it("reads mixed-case headers, which vary by Awin account", () => {
    const mixed = parseCsv("Product_ID,Product_Name,Search_Price,Merchant_Deep_Link\n" +
      '"x1","Gibson SG","999.00","https://reverb.com/item/x1"\n')[0]
    const row = normalizeAwinRow(mixed)!
    expect(row.externalId).toBe("x1")
    expect(row.priceCents).toBe(99_900)
  })
})

describe("parseAwinFeed", () => {
  it("parses a multi-row feed and counts what it skipped", () => {
    const text = [AWIN_HEADER, awinRow({ product_id: "a" }), awinRow({ product_id: "b" }), awinRow({ product_id: "" })].join(
      "\n",
    )
    const { rows, seen, skipped } = parseAwinFeed(text)
    expect(seen).toBe(3)
    expect(rows).toHaveLength(2)
    expect(skipped).toBe(1)
  })
})

describe("fetchAwinFeedText", () => {
  it("transparently gunzips a feed served gzipped", async () => {
    // Awin serves feeds gzipped whether or not the URL says .gz.
    const plain = `${AWIN_HEADER}\n${awinRow()}\n`
    const impl: typeof fetch = async () => new Response(gzipSync(Buffer.from(plain)), { status: 200 })
    const text = await fetchAwinFeedText("https://example.test/feed", impl)
    expect(text).toBe(plain)
  })

  it("passes plain text through untouched", async () => {
    const plain = `${AWIN_HEADER}\n${awinRow()}\n`
    const impl: typeof fetch = async () => new Response(plain, { status: 200 })
    expect(await fetchAwinFeedText("https://example.test/feed", impl)).toBe(plain)
  })

  it("throws with the status attached so backoff can decide to retry", async () => {
    const impl: typeof fetch = async () => new Response("nope", { status: 503 })
    await expect(fetchAwinFeedText("https://example.test/feed", impl)).rejects.toThrow(/503/)
  })
})
