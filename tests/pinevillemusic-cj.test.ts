import { describe, expect, it } from "vitest"
import { parseCsv } from "@/lib/ingestion/csv"
import { normalizePinevilleMusicRow, parsePinevilleMusicFeed } from "@/lib/ingestion/pinevillemusic-cj"

const CJ_HEADER = "SKU,NAME,DESCRIPTION,PRICE,BUY_URL,IMAGE_URL,UPC,MPN,MANUFACTURER_NAME,IN_STOCK"

function cjRow(overrides: Partial<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    SKU: "pm-6001",
    NAME: "Yamaha P-225 Digital Piano",
    DESCRIPTION: "88-key weighted action",
    PRICE: "549.99",
    BUY_URL: "https://www.kqzyfj.com/click-3456789-0123456",
    IMAGE_URL: "https://media.pinevillemusic.com/media/product/6001.jpg",
    UPC: "086792962234",
    MPN: "P225B",
    MANUFACTURER_NAME: "Yamaha",
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

describe("normalizePinevilleMusicRow", () => {
  it("maps a well formed feed row onto a listing insert", () => {
    const row = normalizePinevilleMusicRow(record())!
    expect(row.source).toBe("pinevillemusic")
    expect(row.externalId).toBe("pm-6001")
    expect(row.priceCents).toBe(54_999)
    expect(row.brand).toBe("Yamaha")
    expect(row.gtin).toBe("086792962234")
    expect(row.condition).toBe("New")
  })

  it("trusts BUY_URL as the affiliate link only when it is a CJ tracking domain", () => {
    expect(normalizePinevilleMusicRow(record())!.affiliateUrl).toContain("kqzyfj.com")
    expect(
      normalizePinevilleMusicRow(record({ BUY_URL: "https://www.pinevillemusic.com/item/6001" }))!
        .affiliateUrl,
    ).toBeNull()
  })

  it("drops rows with no id, no price or no BUY_URL", () => {
    expect(normalizePinevilleMusicRow(record({ SKU: "" }))).toBeNull()
    expect(normalizePinevilleMusicRow(record({ PRICE: "0" }))).toBeNull()
    expect(normalizePinevilleMusicRow(record({ BUY_URL: "" }))).toBeNull()
  })
})

describe("parsePinevilleMusicFeed", () => {
  it("parses a multi-row feed and counts what it skipped", () => {
    const text = [CJ_HEADER, cjRow({ SKU: "a" }), cjRow({ SKU: "b" }), cjRow({ SKU: "" })].join("\n")
    const { rows, seen, skipped } = parsePinevilleMusicFeed(text)
    expect(seen).toBe(3)
    expect(rows).toHaveLength(2)
    expect(skipped).toBe(1)
  })
})
