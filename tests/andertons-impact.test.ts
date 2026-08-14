import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  bindColumns,
  sliceRows,
  ImpactSchemaError,
  normalizeAndertonsRow,
  normalizeRecords,
  parseAndertonsFeed,
  toCents,
  UNBOUND_BY_POLICY,
} from "@/lib/ingestion/andertons-impact"
/*
 * The API transport lives in the shared reader now: it stopped being
 * Anderton's-specific the moment Impact went from one merchant to eight, and
 * these behaviours are the same for every one of them.
 */
import {
  explainImpactStatus,
  fetchImpactApiPage,
  fetchImpactApiRange,
  IMPACT_PAGING_CEILING,
} from "@/lib/ingestion/impact-catalogue"
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

describe("slicing the catalogue", () => {
  /**
   * The 300 second ceiling made all-or-nothing a coin flip on 27,052 rows.
   * Slicing works only because the upsert is idempotent and keyed on
   * (source, external_id) and the feed is a full snapshot, so slice N always
   * means the same rows however many times it is asked for.
   *
   * Tested as a pure function: the windowing is the part that can be wrong,
   * and it needs neither a database nor an FTP server to prove.
   */
  const rows = Array.from({ length: 7 }, (_, i) => `row${i}`)

  it("takes the whole feed when no window is given", () => {
    const { slice, done } = sliceRows(rows)
    expect(slice).toHaveLength(7)
    expect(done).toBe(true)
  })

  it("takes only the requested window, and says there is more to come", () => {
    const { slice, offset, done } = sliceRows(rows, { offset: 0, limit: 3 })
    expect(slice).toEqual(["row0", "row1", "row2"])
    expect(offset).toBe(0)
    expect(done).toBe(false)
  })

  it("resumes from an offset and reports done on the last slice", () => {
    const middle = sliceRows(rows, { offset: 3, limit: 3 })
    expect(middle.slice).toEqual(["row3", "row4", "row5"])
    expect(middle.done).toBe(false)

    const last = sliceRows(rows, { offset: 6, limit: 3 })
    expect(last.slice).toEqual(["row6"])
    expect(last.done).toBe(true)
  })

  /**
   * `done` gates expiring rows the feed no longer lists. An offset past the
   * end must therefore report done rather than false, or a caller looping to
   * completion never finishes and never expires anything.
   */
  it("treats an offset past the end as done with nothing to write", () => {
    const past = sliceRows(rows, { offset: 99, limit: 10 })
    expect(past.slice).toEqual([])
    expect(past.done).toBe(true)
  })

  it("ignores a nonsense window rather than writing nothing", () => {
    expect(sliceRows(rows, { offset: -5 }).slice).toHaveLength(7)
    expect(sliceRows(rows, { limit: 0 }).slice).toHaveLength(7)
  })

  it("never loses a row when a caller walks the whole feed in slices", () => {
    const seen: string[] = []
    let offset = 0
    for (let guard = 0; guard < 20; guard++) {
      const { slice, done } = sliceRows(rows, { offset, limit: 2 })
      seen.push(...slice)
      if (done) break
      offset += slice.length
    }
    expect(seen).toEqual(rows)
  })
})

/* -------------------------------------------------------------------------- */
/*  The REST API transport                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Impact's partner catalogue API, the second way into the same normaliser.
 *
 * The point of these is that the API path must not become a second, subtly
 * different parser. Everything below the transport is shared, so what is worth
 * pinning is the seam: that JSON items reach the SAME bindings as feed rows,
 * and that the things which are genuinely different about JSON (omitted null
 * fields, an envelope around the collection) are handled rather than assumed
 * away.
 */
describe("normalizeRecords, shared by both transports", () => {
  /**
   * Impact's own documented field names, which are what the API returns and
   * are NOT the names Anderton's chose for their FTP columns. Both are in the
   * alias table, and this is what proves the API half of it is real.
   */
  const API_ITEM = {
    CatalogItemId: "SKU-993",
    Name: "Strymon BigSky Reverb",
    Url: "https://andertonsmusiccompany.pxf.io/c/1/2/3?u=x",
    CurrentPrice: "429.00",
    Currency: "GBP",
    Manufacturer: "Strymon",
    Gtin: "0687180012345",
    Category: "Guitars > Pedals > Reverb",
    StockAvailability: "InStock",
    ImageUrl: "https://cdn.example/bigsky.jpg",
    OriginalUrl: "https://www.andertons.co.uk/strymon-bigsky",
  }

  it("binds Impact's API field names, not just Anderton's feed column names", () => {
    const { rows, skipped } = normalizeRecords([API_ITEM])
    expect(skipped).toBe(0)
    expect(rows[0]).toMatchObject({
      source: "andertons",
      externalId: "SKU-993",
      title: "Strymon BigSky Reverb",
      brand: "Strymon",
      gtin: "0687180012345",
      currency: "GBP",
      priceCents: 42900,
      listingStatus: "active",
    })
  })

  /**
   * The URL split has to behave identically on this path. An Impact tracking
   * host is the affiliate link and the merchant's own page is the raw URL;
   * getting this wrong on one transport only would make the same product
   * monetised or not depending on how it was ingested.
   */
  it("keeps the tracked and untracked URLs on the right fields", () => {
    const { rows } = normalizeRecords([API_ITEM])
    expect(rows[0].rawUrl).toBe("https://www.andertons.co.uk/strymon-bigsky")
    expect(rows[0].affiliateUrl).toBe(API_ITEM.Url)
  })

  /**
   * The difference that actually bites. A CSV header row names every column
   * whether or not a row fills it; a JSON API commonly omits null fields per
   * item. Binding off item one alone would lose a field just because the first
   * product happened not to carry it.
   */
  it("binds across a sample, so a field missing from the first item is still found", () => {
    const { rows } = normalizeRecords([
      { CatalogItemId: "a", Name: "No brand here", Url: "https://x.test/a", CurrentPrice: "10.00" },
      { ...API_ITEM, CatalogItemId: "b" },
    ])
    expect(rows).toHaveLength(2)
    // Item one genuinely has no Manufacturer; item two's binding still worked.
    expect(rows[0].brand).toBeNull()
    expect(rows[1].brand).toBe("Strymon")
  })

  /**
   * Same loud failure as the feed parser. A response whose mandatory fields
   * cannot be bound must name what it saw rather than yield zero rows, because
   * "no products found" and "the schema moved" look identical otherwise.
   */
  it("fails loudly, naming the fields it saw, when a mandatory one is missing", () => {
    expect(() => normalizeRecords([{ ProductRef: "x", Heading: "y", DeepLink: "z" }])).toThrow(
      ImpactSchemaError,
    )
    try {
      normalizeRecords([{ ProductRef: "x", Heading: "y", DeepLink: "z" }])
    } catch (error) {
      expect((error as Error).message).toMatch(/ProductRef|Heading|DeepLink/)
    }
  })

  it("refuses an empty response rather than reporting an empty catalogue", () => {
    expect(() => normalizeRecords([])).toThrow(ImpactSchemaError)
  })

  /**
   * Section 1 and the hard "do not" list, enforced on this path too. The FTP
   * feed carries per-row commission columns and the API may well carry the
   * same; binding them is one .filter() away from dropping the 1% rows, which
   * is ranking by payout performed at the row level.
   */
  it("never binds a commission field, whatever the transport calls it", () => {
    const { columns } = normalizeRecords([
      {
        ...API_ITEM,
        MinCommissionPercentage: "1",
        MaxCommissionPercentage: "4",
        CommissionCurrency: "GBP",
      },
    ])
    for (const header of Object.values(columns)) {
      expect(String(header ?? "")).not.toMatch(/commission/i)
    }
  })
})

/**
 * The HTTPS transport's failure behaviour.
 *
 * These exist because a live 400 could not be diagnosed from what the code
 * reported. The status was named and the response body, which is the only
 * thing that says WHICH parameter Impact objected to, was deliberately
 * discarded. Everything here pins the properties that make the next failure
 * self-explaining rather than a guessing game.
 */
describe("the Impact API transport", () => {
  const CONFIG = { accountSid: "SID", authToken: "TOKEN", catalogId: "30480" }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(handler: (url: URL, init: RequestInit) => Response) {
    const calls: URL[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string, init: RequestInit = {}) => {
        const url = input instanceof URL ? input : new URL(String(input))
        calls.push(url)
        return handler(url, init)
      }),
    )
    return calls
  }

  function page(records: unknown[], extra: Record<string, unknown> = {}) {
    return new Response(JSON.stringify({ "@page": "1", Items: records, ...extra }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  it("names an explicit API version on every request", async () => {
    const calls = stubFetch(() => page([{ CatalogItemId: "1" }]))
    await fetchImpactApiPage(CONFIG, 1, 100)
    expect(calls[0].searchParams.get("IrVersion")).toBeTruthy()
  })

  it("keeps credentials out of the URL, since the URL gets echoed to an admin", async () => {
    const calls = stubFetch(() => page([{ CatalogItemId: "1" }]))
    await fetchImpactApiPage(CONFIG, 1, 100)
    expect(calls[0].toString()).not.toContain("TOKEN")
    expect(calls[0].search).not.toContain("TOKEN")
  })

  /*
   * The whole point. A 400 that says only "400 Bad Request" is what stalled
   * this, so the server's own explanation has to reach the person reading it.
   */
  it("puts Impact's own words in the error, not just the status", async () => {
    stubFetch(() => new Response(JSON.stringify({ Message: "PageSize exceeds the maximum" }), { status: 400 }))
    await expect(fetchImpactApiPage(CONFIG, 1, 1000)).rejects.toThrow(/PageSize exceeds the maximum/)
  })

  it("flattens an HTML error body rather than refusing to show it", async () => {
    stubFetch(
      () =>
        new Response("<html><body><h1>Bad Request</h1><p>Unknown parameter</p></body></html>", {
          status: 400,
          headers: { "content-type": "text/html" },
        }),
    )
    const error = await fetchImpactApiPage(CONFIG, 1, 100).catch((e: Error) => e)
    expect(String(error)).toContain("Unknown parameter")
    expect(String(error)).not.toContain("<h1>")
  })

  it("explains a 400 by naming the candidate causes, not just the number", () => {
    const explained = explainImpactStatus(400, "30480")
    expect(explained).toMatch(/PageSize/i)
    expect(explained).toMatch(/20,000/)
  })

  it("distinguishes a rejected credential from an unreadable catalogue", () => {
    expect(explainImpactStatus(401, "30480")).toMatch(/AccountSid|AuthToken/)
    expect(explainImpactStatus(401, "30480")).toMatch(/not the FTP pair/i)
    expect(explainImpactStatus(404, "30480")).toContain("30480")
  })

  /*
   * Impact answers a request past the ceiling with a 400, so asking is a
   * wasted round trip that reports the wrong cause. Refusing locally names
   * the real limit instead.
   */
  it("refuses to request a page that starts past the paging ceiling", async () => {
    const calls = stubFetch(() => page([]))
    const firstUnreachable = Math.floor(IMPACT_PAGING_CEILING / 100) + 1
    await expect(fetchImpactApiPage(CONFIG, firstUnreachable, 100)).rejects.toThrow(/ceiling/i)
    expect(calls).toHaveLength(0)
  })

  it("still allows the last page that fits under the ceiling", async () => {
    const calls = stubFetch(() => page([{ CatalogItemId: "1" }]))
    await fetchImpactApiPage(CONFIG, IMPACT_PAGING_CEILING / 100, 100)
    expect(calls).toHaveLength(1)
  })

  /*
   * The dangerous one. A walk that stops at the ceiling has NOT seen the whole
   * catalogue, and `done` alone is what expiry keys off. Reporting a ceiling
   * stop as an ordinary end would expire every row past 20,000: on a 27,052
   * product catalogue that silently retires around 7,000 live listings.
   */
  it("reports a ceiling stop distinctly from reaching the end of the catalogue", async () => {
    // A catalogue bigger than the ceiling: 271 pages of 100, which is
    // Anderton's 27,052 products. The stub echoes the page it was asked for,
    // because a walk that cannot advance cannot reach the limit under test.
    stubFetch((url) =>
      page(
        Array.from({ length: 100 }, (_, i) => ({ CatalogItemId: String(i) })),
        { "@page": url.searchParams.get("Page") ?? "1", "@numpages": "271" },
      ),
    )

    const walk = await fetchImpactApiRange(CONFIG, IMPACT_PAGING_CEILING / 100, 5, 100)

    expect(walk.ceilingReached).toBe(true)
    expect(walk.nextPage).toBeNull()
  })

  it("does not claim a ceiling stop on an ordinary short read", async () => {
    stubFetch(() => page([{ CatalogItemId: "1" }], { "@numpages": "1" }))
    const walk = await fetchImpactApiRange(CONFIG, 1, 5, 100)
    expect(walk.ceilingReached).toBeUndefined()
    expect(walk.nextPage).toBeNull()
  })
})

/**
 * The answer the live API actually gave, on 11 Aug 2026.
 *
 * Every parameter variation was refused identically with
 * "The requested catalog has not been made available via API by the
 * Advertiser", while listing catalogues answered 200 with zero rows. So the
 * credentials are good, the catalogue id is right, and the channel is closed
 * by the brand.
 *
 * Pinned because the first version of the explainer offered a list of causes
 * that could not have been it, and sent a real debugging session after
 * PageSize. Reading the BODY rather than only the status is what separates
 * "we asked wrongly" from "you may not ask at all", and that distinction is
 * the difference between a code change and an email to the merchant.
 */
describe("an advertiser who has not enabled the API", () => {
  const MESSAGE = '{ "Status": "ERROR", "Message": "The requested catalog has not been made available via API by the Advertiser." }'

  it("says the request was fine and the brand has not switched it on", () => {
    const explained = explainImpactStatus(400, "30480", MESSAGE)
    expect(explained).toMatch(/advertiser/i)
    expect(explained).toMatch(/credentials|catalogue id/i)
  })

  /*
   * The point of the whole fix. Sending somebody to check PageSize when the
   * server has said "you are not allowed to read this" wastes the one clue
   * the response actually contained.
   */
  it("does not blame PageSize or the paging ceiling for it", () => {
    const explained = explainImpactStatus(400, "30480", MESSAGE)
    expect(explained).not.toMatch(/PageSize/i)
    expect(explained).not.toMatch(/20,000/)
  })

  it("still offers the parameter checklist for a 400 that says something else", () => {
    const explained = explainImpactStatus(400, "30480", '{"Message":"Invalid value for PageSize"}')
    expect(explained).toMatch(/PageSize/i)
  })

  /*
   * It must NOT name a fallback transport. This explainer is shared by all
   * eight Impact merchants and only Anderton's has an SFTP drop, so telling a
   * Fender or a Donner failure to "use the SFTP drop" would be pointing at
   * something that does not exist for them.
   */
  it("says the fix is not ours without inventing a transport the merchant lacks", () => {
    const explained = explainImpactStatus(400, "30480", MESSAGE)
    expect(explained).toMatch(/nothing here can change that/i)
    expect(explained).not.toMatch(/SFTP/i)
  })
})
