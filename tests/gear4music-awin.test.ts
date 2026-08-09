import { gzipSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { parseCsv } from "@/lib/ingestion/csv"
import {
  fetchGear4MusicFeedText,
  normalizeGear4MusicRow,
  parseGear4MusicFeed,
} from "@/lib/ingestion/gear4music-awin"

const AWIN_HEADER =
  "product_id,product_name,description,search_price,currency,brand_name,aw_deep_link,merchant_deep_link,merchant_image_url,ean,mpn,condition,in_stock,merchant_category"

function g4mRow(overrides: Partial<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    product_id: "g4m-3001",
    product_name: "Squier Classic Vibe 70s Stratocaster",
    description: "New, boxed, full manufacturer warranty",
    search_price: "459.00",
    currency: "GBP",
    brand_name: "Squier",
    aw_deep_link: "https://www.awin1.com/cread.php?awinmid=1117&awinaffid=999999&ued=x",
    merchant_deep_link: "https://www.gear4music.com/Guitar-and-Bass/Squier-CV-70s-Strat/3001",
    merchant_image_url: "https://d1qtvw3jw2fcv7.cloudfront.net/media/g4m/3001.jpg",
    ean: "0885978512345",
    mpn: "0374030532",
    condition: "",
    in_stock: "1",
    merchant_category: "Electric Guitars",
  }
  const merged = { ...base, ...overrides }
  return AWIN_HEADER.split(",")
    .map((h) => `"${(merged[h] ?? "").replace(/"/g, '""')}"`)
    .join(",")
}

function record(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return parseCsv(`${AWIN_HEADER}\n${g4mRow(overrides)}\n`)[0]
}

describe("normalizeGear4MusicRow", () => {
  it("maps a well formed feed row onto a listing insert", () => {
    const row = normalizeGear4MusicRow(record())!
    expect(row.source).toBe("gear4music")
    expect(row.externalId).toBe("g4m-3001")
    expect(row.priceCents).toBe(45_900)
    expect(row.brand).toBe("Squier")
    expect(row.gtin).toBe("0885978512345")
    expect(row.listingStatus).toBe("active")
    expect(row.rawUrl).toContain("gear4music.com")
  })

  it("defaults an empty condition to New, unlike a peer marketplace", () => {
    // Gear4music is a retailer of primarily new stock; an empty condition
    // column here means new, not "unspecified" the way Reverb treats it.
    expect(normalizeGear4MusicRow(record())!.condition).toBe("New")
  })

  it("maps ex-demo and used conditions onto the shared vocabulary", () => {
    expect(normalizeGear4MusicRow(record({ condition: "Ex Demo" }))!.condition).toBe("Excellent")
    expect(normalizeGear4MusicRow(record({ condition: "B-Stock" }))!.condition).toBe("Refurbished")
    expect(normalizeGear4MusicRow(record({ condition: "Used" }))!.condition).toBe("Used")
  })

  it("uses Awin's own tracked link when the feed supplies one", () => {
    expect(normalizeGear4MusicRow(record())!.affiliateUrl).toContain("awin1.com/cread.php")
  })

  it("recognises Gear4music's regional storefronts as the same merchant", () => {
    const row = normalizeGear4MusicRow(
      record({
        aw_deep_link: "",
        merchant_deep_link: "https://www.gear4music.ie/Guitar-and-Bass/Squier-CV-70s-Strat/3001",
      }),
    )!
    expect(row.rawUrl).toContain("gear4music.ie")
    // Built from AWIN_PUBLISHER_ID/AWIN_GEAR4MUSIC_MERCHANT_ID in .env.local;
    // without them configured this stays null rather than a half-built link.
    expect(!row.affiliateUrl || row.affiliateUrl.includes("awin1.com")).toBe(true)
  })

  it("never borrows an EPID, which is an eBay concept", () => {
    expect(normalizeGear4MusicRow(record())!.epid).toBeNull()
  })

  it("treats an absent stock column as active rather than dropping the catalogue", () => {
    expect(normalizeGear4MusicRow(record({ in_stock: "" }))!.listingStatus).toBe("active")
    expect(normalizeGear4MusicRow(record({ in_stock: "0" }))!.listingStatus).toBe("expired")
  })

  it("drops rows with no id, no price or no URL", () => {
    expect(normalizeGear4MusicRow(record({ product_id: "" }))).toBeNull()
    expect(normalizeGear4MusicRow(record({ search_price: "0" }))).toBeNull()
    expect(normalizeGear4MusicRow(record({ merchant_deep_link: "", aw_deep_link: "" }))).toBeNull()
  })
})

describe("parseGear4MusicFeed", () => {
  it("parses a multi-row feed and counts what it skipped", () => {
    const text = [
      AWIN_HEADER,
      g4mRow({ product_id: "a" }),
      g4mRow({ product_id: "b" }),
      g4mRow({ product_id: "" }),
    ].join("\n")
    const { rows, seen, skipped } = parseGear4MusicFeed(text)
    expect(seen).toBe(3)
    expect(rows).toHaveLength(2)
    expect(skipped).toBe(1)
  })
})

describe("fetchGear4MusicFeedText", () => {
  it("transparently gunzips a feed served gzipped", async () => {
    const plain = `${AWIN_HEADER}\n${g4mRow()}\n`
    const impl: typeof fetch = async () => new Response(gzipSync(Buffer.from(plain)), { status: 200 })
    const text = await fetchGear4MusicFeedText("https://example.test/feed", impl)
    expect(text).toBe(plain)
  })

  it("throws with the status attached so backoff can decide to retry", async () => {
    const impl: typeof fetch = async () => new Response("nope", { status: 503 })
    await expect(fetchGear4MusicFeedText("https://example.test/feed", impl)).rejects.toThrow(/503/)
  })
})
