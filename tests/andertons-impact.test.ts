import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bindColumns,
  ImpactSchemaError,
  normalizeAndertonsRow,
  parseAndertonsFeed,
  toCents,
  UNBOUND_BY_POLICY,
} from "@/lib/ingestion/andertons-impact"
import { detectDelimiter } from "@/lib/ingestion/csv"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"

/**
 * Anderton's Impact catalogue parser.
 *
 * The whole design of this module is a bet that the column names are NOT
 * knowable in advance. Anderton's catalogue is literally named "Custom AMC
 * Feed", and Impact mandates only three fields (item id, name, link URL) while
 * letting each brand name and choose the rest. So these tests are mostly about
 * two behaviours:
 *
 *   1. that binding by header name survives plausible spellings, and
 *   2. that a header it CANNOT resolve fails loudly instead of quietly
 *      producing rows with missing or shifted values.
 *
 * The second matters more. Section 3 of CLAUDE.md records why the eBay parser
 * binds by name and never by position: a positional parser silently shifts
 * every value the day a column is added, and looks fine until someone notices
 * the prices are wrong.
 *
 * No test touches the network. The FTP transport is the only part of the module
 * that does, and it is injectable for exactly that reason.
 */

/** Impact's documented spelling, as a baseline. */
const CANONICAL_HEADER =
  "Catalog Item Id,Name,Url,Description,Current Price,Original Price,Currency,Manufacturer,Image Url,Category,Gtin,Mpn,Stock Availability"

const CANONICAL_ROW =
  '"AND-12345","Victory V4 The Kraken Preamp Pedal","https://andertonsmusiccompany.pxf.io/c/7529144/43829/13053?u=https%3A%2F%2Fwww.andertons.co.uk%2Fvictory-v4-kraken","A valve preamp in a pedal.","£349.00","£399.00","GBP","Victory","https://img.andertons.co.uk/v4.jpg","Effects Pedals","5060293321478","V4KRAKEN","In Stock"'

function feed(header: string, ...rows: string[]): string {
  return [header, ...rows].join("\n")
}

/**
 * The header row off the real catalogue, saved verbatim on 11 Aug 2026.
 *
 * Everything above this line tests the design in the abstract. This tests it
 * against the actual file, which is the only thing that settles whether the
 * alias table is right. It is the header row only: no product rows, no prices,
 * and nothing resembling a credential.
 */
const REAL_HEADER = readFileSync(
  new URL("./fixtures/andertons-impact-headers.tsv", import.meta.url),
  "utf8",
).split(/\r?\n/)[0]

describe("the real Anderton's header row", () => {
  const headers = REAL_HEADER.split("\t")

  it("is tab separated, and the delimiter sniffer says so", () => {
    // Impact's docs call these "CSV" catalogues. This one is not comma
    // separated at all, which is precisely why the delimiter is detected
    // rather than assumed.
    expect(detectDelimiter(REAL_HEADER)).toBe("\t")
    expect(headers).toHaveLength(40)
  })

  it("resolves every mandatory column, so the parser runs at all", () => {
    const bound = bindColumns(headers)
    expect(bound.itemId).toBe("Sku")
    expect(bound.name).toBe("Name")
    expect(bound.url).toBe("Url")
  })

  /**
   * The one miss the real header row caught. "Manufacturer Name" is not
   * "Manufacturer", and before this alias existed all 27,052 rows would have
   * ingested with a null brand, which silently disables the brand scoping that
   * tiers 1c and 2 of the resolver depend on.
   */
  it("binds the brand column, which is spelled Manufacturer Name", () => {
    expect(bindColumns(headers).manufacturer).toBe("Manufacturer Name")
  })

  it("binds Anderton's own untracked product URL beside Impact's tracked one", () => {
    const bound = bindColumns(headers)
    expect(bound.originalUrl).toBe("Original Url")
    expect(bound.url).toBe("Url")
    expect(bound.url).not.toBe(bound.originalUrl)
  })

  it("prefers the category path over the leaf name, since both are present", () => {
    expect(headers).toContain("Category Path")
    expect(headers).toContain("Category Name")
    expect(bindColumns(headers).category).toBe("Category Path")
  })

  /**
   * Not a gap in the alias table: this catalogue genuinely has no MPN column.
   * Pinned so that a future feed which adds one is a visible test failure
   * rather than an unnoticed improvement, and so nobody "fixes" the null by
   * pointing mpn at Sku, which is a retailer stock number and not a part
   * number that names a product across merchants.
   */
  it("has no MPN column, so that field binds to null rather than to Sku", () => {
    expect(headers.some((h) => /^mpn$|part number/i.test(h))).toBe(false)
    expect(bindColumns(headers).mpn).toBeNull()
  })

  /**
   * The sharpest rule in CLAUDE.md, made testable.
   *
   * This feed states the commission on every single row. The ingester must not
   * know: a parser aware of per-row payout is one .filter() from dropping the
   * 1% rows, which is ranking by commission performed at the row level.
   */
  it("carries per-row commission columns, and binds none of them", () => {
    for (const column of UNBOUND_BY_POLICY) {
      expect(headers).toContain(column)
    }

    const bound = bindColumns(headers)
    const boundHeaders = Object.values(bound).filter((h): h is string => h !== null)
    for (const forbidden of UNBOUND_BY_POLICY) {
      expect(boundHeaders).not.toContain(forbidden)
    }
    expect(boundHeaders.some((h) => /commission/i.test(h))).toBe(false)
  })
})

describe("bindColumns", () => {
  it("binds Impact's own documented spellings", () => {
    const bound = bindColumns(CANONICAL_HEADER.split(","))
    expect(bound.itemId).toBe("Catalog Item Id")
    expect(bound.name).toBe("Name")
    expect(bound.url).toBe("Url")
    expect(bound.currentPrice).toBe("Current Price")
    expect(bound.gtin).toBe("Gtin")
  })

  /**
   * The point of the alias table. A brand-configured feed will not use
   * Impact's spellings, and adapting must not require rewriting the parser.
   */
  it("binds plausible custom spellings a brand might use instead", () => {
    const bound = bindColumns([
      "SKU",
      "Product Name",
      "Link URL",
      "Sale Price",
      "Brand",
      "Image URL",
      "EAN",
      "Manufacturer Part Number",
      "Availability",
    ])
    expect(bound.itemId).toBe("SKU")
    expect(bound.name).toBe("Product Name")
    expect(bound.url).toBe("Link URL")
    expect(bound.currentPrice).toBe("Sale Price")
    expect(bound.manufacturer).toBe("Brand")
    expect(bound.gtin).toBe("EAN")
    expect(bound.mpn).toBe("Manufacturer Part Number")
    expect(bound.stock).toBe("Availability")
  })

  it("is insensitive to case, spacing and separators", () => {
    const bound = bindColumns(["catalog_item_id", "  NAME  ", "product-url"])
    expect(bound.itemId).toBe("catalog_item_id")
    expect(bound.name).toBe("  NAME  ")
    expect(bound.url).toBe("product-url")
  })

  it("leaves an unmatched optional column null rather than guessing", () => {
    const bound = bindColumns(["Catalog Item Id", "Name", "Url"])
    expect(bound.description).toBeNull()
    expect(bound.gtin).toBeNull()
    expect(bound.mpn).toBeNull()
  })

  /**
   * THE important one. A mandatory column we cannot find must stop the run and
   * name what it actually saw, so the fix is a one-line alias addition rather
   * than an investigation.
   */
  it("throws naming the missing column AND the headers actually present", () => {
    let error: unknown
    try {
      bindColumns(["Item Reference", "Product Title", "Deep Link"])
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ImpactSchemaError)
    const message = (error as Error).message
    expect(message).toContain("itemId")
    expect(message).toContain("name")
    expect(message).toContain("url")
    // The headers it did see, so the alias can be added without a second look.
    expect(message).toContain("Item Reference")
    expect(message).toContain("Product Title")
    expect(message).toContain("FIELD_ALIASES")
  })

  it("does not fail when only optional columns are missing", () => {
    expect(() => bindColumns(["SKU", "Name", "Url"])).not.toThrow()
  })
})

describe("toCents", () => {
  it("reads prices with symbols and separators", () => {
    expect(toCents("£349.00")).toBe(34_900)
    expect(toCents("349.00")).toBe(34_900)
    expect(toCents("1,299.99")).toBe(129_999)
    expect(toCents("£ 1 299.99")).toBe(129_999)
  })

  /**
   * A 0.00 in a retail feed means "price withheld", not "free". Storing it
   * would put a zero-price listing at the top of every cheapest-first search.
   */
  it("rejects zero, negative and unparseable prices", () => {
    expect(toCents("0.00")).toBeNull()
    expect(toCents("£0")).toBeNull()
    expect(toCents("-5.00")).toBeNull()
    expect(toCents("POA")).toBeNull()
    expect(toCents("")).toBeNull()
  })
})

describe("normalizeAndertonsRow", () => {
  const columns = bindColumns(CANONICAL_HEADER.split(","))

  function rowFrom(text: string) {
    const { rows } = parseAndertonsFeed(feed(CANONICAL_HEADER, text))
    return rows[0]
  }

  it("maps a full row", () => {
    const row = rowFrom(CANONICAL_ROW)
    expect(row.source).toBe("andertons")
    expect(row.externalId).toBe("AND-12345")
    expect(row.title).toContain("Victory V4")
    expect(row.priceCents).toBe(34_900)
    expect(row.brand).toBe("Victory")
    expect(row.gtin).toBe("5060293321478")
    expect(row.mpn).toBe("V4KRAKEN")
    expect(row.listingStatus).toBe("active")
  })

  /**
   * Anderton's trades only in the UK. A USD default (right for the CJ
   * retailers) would mislabel all 27,052 rows and make every cross-source
   * price comparison against them nonsense.
   */
  it("defaults the currency to GBP, not USD", () => {
    const header = "Catalog Item Id,Name,Url,Current Price"
    const { rows } = parseAndertonsFeed(
      feed(header, '"A1","A pedal","https://www.andertons.co.uk/x","99.00"'),
    )
    expect(rows[0].currency).toBe("GBP")
    expect(rows[0].locationCountry).toBe("GB")
  })

  it("honours an explicit currency column when the feed has one", () => {
    const { rows } = parseAndertonsFeed(feed(CANONICAL_HEADER, CANONICAL_ROW))
    expect(rows[0].currency).toBe("GBP")
  })

  /** A retailer, not a peer marketplace: a blank condition is new stock. */
  it("treats a missing condition as New", () => {
    expect(rowFrom(CANONICAL_ROW).condition).toBe("New")
  })

  /**
   * Same rule as CJ and Awin. An unrecognised host produces NO affiliate link
   * rather than a half-built one: routing a shopper through a tracker that
   * credits nobody is worse than a clean direct link.
   */
  it("trusts an Impact tracking URL as the affiliate link", () => {
    const row = rowFrom(CANONICAL_ROW)
    expect(row.affiliateUrl).toContain("andertonsmusiccompany.pxf.io")
    expect(isAllowedDestination(row.affiliateUrl as string)).toBe(true)
  })

  it("stores no affiliate link when the only URL is untracked", () => {
    const header = "Catalog Item Id,Name,Url,Current Price"
    const { rows } = parseAndertonsFeed(
      feed(header, '"A1","A pedal","https://www.andertons.co.uk/some-pedal","99.00"'),
    )
    expect(rows[0].affiliateUrl).toBeNull()
    expect(rows[0].rawUrl).toBe("https://www.andertons.co.uk/some-pedal")
    // Still followable: the merchant's own domain is on the allowlist.
    expect(isAllowedDestination(rows[0].rawUrl)).toBe(true)
  })

  it("uses the merchant URL as raw and the tracked one as affiliate when both exist", () => {
    const header = "Catalog Item Id,Name,Url,Original Url,Current Price"
    const { rows } = parseAndertonsFeed(
      feed(
        header,
        '"A1","A pedal","https://andertonsmusiccompany.pxf.io/c/1/2/3","https://www.andertons.co.uk/a-pedal","99.00"',
      ),
    )
    expect(rows[0].rawUrl).toBe("https://www.andertons.co.uk/a-pedal")
    expect(rows[0].affiliateUrl).toBe("https://andertonsmusiccompany.pxf.io/c/1/2/3")
  })

  it("falls back to the original price when the current one is unusable", () => {
    const header = "Catalog Item Id,Name,Url,Current Price,Original Price"
    const { rows } = parseAndertonsFeed(
      feed(header, '"A1","A pedal","https://www.andertons.co.uk/x","POA","249.00"'),
    )
    expect(rows[0].priceCents).toBe(24_900)
  })

  it("marks out-of-stock rows expired rather than dropping them", () => {
    const outOfStock = CANONICAL_ROW.replace('"In Stock"', '"Out of Stock"')
    expect(rowFrom(outOfStock).listingStatus).toBe("expired")
  })

  it("skips a row missing any of the three mandatory values", () => {
    const columnsOnly = bindColumns(CANONICAL_HEADER.split(","))
    expect(
      normalizeAndertonsRow({ "Catalog Item Id": "", Name: "x", Url: "https://a.co" }, columnsOnly),
    ).toBeNull()
    expect(
      normalizeAndertonsRow({ "Catalog Item Id": "1", Name: "", Url: "https://a.co" }, columnsOnly),
    ).toBeNull()
    expect(
      normalizeAndertonsRow({ "Catalog Item Id": "1", Name: "x", Url: "" }, columnsOnly),
    ).toBeNull()
  })

  it("skips a row with no usable price rather than storing zero", () => {
    const header = "Catalog Item Id,Name,Url,Current Price"
    const { rows, skipped } = parseAndertonsFeed(
      feed(header, '"A1","A pedal","https://www.andertons.co.uk/x","0.00"'),
    )
    expect(rows).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  it("does not let column bindings leak between fields", () => {
    // description and name are distinct even though both are free text.
    const row = rowFrom(CANONICAL_ROW)
    expect(row.title).not.toBe(row.description)
    expect(row.description).toBe("A valve preamp in a pedal.")
  })
})

describe("parseAndertonsFeed", () => {
  it("handles pipe-delimited files, which Impact also emits", () => {
    const header = "Catalog Item Id|Name|Url|Current Price"
    const { rows } = parseAndertonsFeed(
      feed(header, "A1|A pedal|https://www.andertons.co.uk/x|99.00"),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].priceCents).toBe(9_900)
  })

  /**
   * Descriptions in a real retail feed contain commas, quotes and newlines.
   * A split(",") parser looks fine on a fixture and shreds every third row of
   * the real file, which is why lib/ingestion/csv.ts is a state machine.
   */
  it("survives commas and quotes inside a quoted description", () => {
    const header = "Catalog Item Id,Name,Url,Description,Current Price"
    const { rows } = parseAndertonsFeed(
      feed(
        header,
        '"A1","A pedal","https://www.andertons.co.uk/x","Warm, rich, and ""vintage"" voiced","99.00"',
      ),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].description).toBe('Warm, rich, and "vintage" voiced')
    expect(rows[0].priceCents).toBe(9_900)
  })

  it("reports what it skipped rather than silently dropping rows", () => {
    const header = "Catalog Item Id,Name,Url,Current Price"
    const { rows, seen, skipped } = parseAndertonsFeed(
      feed(
        header,
        '"A1","Good","https://www.andertons.co.uk/a","10.00"',
        '"","No id","https://www.andertons.co.uk/b","10.00"',
        '"A3","No price","https://www.andertons.co.uk/c","POA"',
      ),
    )
    expect(seen).toBe(3)
    expect(rows).toHaveLength(1)
    expect(skipped).toBe(2)
  })

  it("throws on an empty document rather than reporting a successful zero-row run", () => {
    expect(() => parseAndertonsFeed("")).toThrow(ImpactSchemaError)
  })

  it("surfaces the bound columns, so a schema change shows up in the run record", () => {
    const { columns } = parseAndertonsFeed(feed(CANONICAL_HEADER, CANONICAL_ROW))
    expect(columns.itemId).toBe("Catalog Item Id")
    expect(columns.currentPrice).toBe("Current Price")
  })
})
