import { describe, expect, it } from "vitest"
import { parseCsv } from "@/lib/ingestion/csv"
import { normalizeFullCompassRow, parseFullCompassFeed } from "@/lib/ingestion/fullcompass-cj"

const CJ_HEADER = "SKU,NAME,DESCRIPTION,PRICE,BUY_URL,IMAGE_URL,UPC,MPN,MANUFACTURER_NAME,IN_STOCK"

function cjRow(overrides: Partial<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    SKU: "fc-5001",
    NAME: "Shure SM7B Cardioid Dynamic Microphone",
    DESCRIPTION: "Studio vocal microphone",
    PRICE: "399.00",
    BUY_URL: "https://www.jdoqocy.com/click-2345678-9012345",
    IMAGE_URL: "https://media.fullcompass.com/media/product/5001.jpg",
    UPC: "042406353910",
    MPN: "SM7B",
    MANUFACTURER_NAME: "Shure",
    IN_STOCK: "1",
  }
  const merged = { ...base, ...overrides }
  return CJ_HEADER.split(",")
    .map((h) => `"${(merged[h] ?? "").replace(/"/g, '""')}"`)
    .join(",")
}

function record(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return parseCsv(`${CJ_HEADER}\n${cjRow(overrides)}\n`)[0]
}

describe("normalizeFullCompassRow", () => {
  it("maps a well formed feed row onto a listing insert", () => {
    const row = normalizeFullCompassRow(record())!
    expect(row.source).toBe("fullcompass")
    expect(row.externalId).toBe("fc-5001")
    expect(row.priceCents).toBe(39_900)
    expect(row.brand).toBe("Shure")
    expect(row.gtin).toBe("042406353910")
    expect(row.mpn).toBe("SM7B")
    expect(row.condition).toBe("New")
  })

  it("trusts BUY_URL as the affiliate link only when it is a CJ tracking domain", () => {
    expect(normalizeFullCompassRow(record())!.affiliateUrl).toContain("jdoqocy.com")
    expect(
      normalizeFullCompassRow(record({ BUY_URL: "https://www.fullcompass.com/item/5001" }))!.affiliateUrl,
    ).toBeNull()
  })

  it("drops rows with no id, no price or no BUY_URL", () => {
    expect(normalizeFullCompassRow(record({ SKU: "" }))).toBeNull()
    expect(normalizeFullCompassRow(record({ PRICE: "0" }))).toBeNull()
    expect(normalizeFullCompassRow(record({ BUY_URL: "" }))).toBeNull()
  })
})

describe("parseFullCompassFeed", () => {
  it("parses a multi-row feed and counts what it skipped", () => {
    const text = [CJ_HEADER, cjRow({ SKU: "a" }), cjRow({ SKU: "b" }), cjRow({ SKU: "" })].join("\n")
    const { rows, seen, skipped } = parseFullCompassFeed(text)
    expect(seen).toBe(3)
    expect(rows).toHaveLength(2)
    expect(skipped).toBe(1)
  })
})
