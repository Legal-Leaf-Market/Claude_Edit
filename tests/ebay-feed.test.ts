import { gzipSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import {
  buildItemFeedUrl,
  buildItemSnapshotUrl,
  downloadFeedChunks,
  EbayFeedError,
  feedDateStamp,
  gunzipChunks,
  normalizeCondition,
  normalizeToListing,
  parseContentRange,
  parseFeedPrice,
  parseTsvRows,
  snapshotHourStamp,
  streamFeedItems,
  toEbayItem,
} from "@/lib/ingestion/ebay-feed"

const SANDBOX = "https://api.sandbox.ebay.com/buy/feed/v1_beta"

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const HEADER = [
  "itemId",
  "title",
  "condition",
  "conditionId",
  "price",
  "brand",
  "inferredBrand",
  "mpn",
  "epid",
  "gtin",
  "defaultImageUrl",
  "itemWebUrl",
  "itemAffiliateWebUrl",
  "itemLocationCountry",
  "itemCreationDate",
  "itemEndDate",
  "buyingOptions",
].join("\t")

function row(cells: Partial<Record<string, string>>): string {
  const defaults: Record<string, string> = {
    itemId: "v1|1234|0",
    title: "Fender Player Stratocaster Electric Guitar",
    condition: "Used",
    conditionId: "3000",
    price: "749.99",
    brand: "Fender",
    inferredBrand: "",
    mpn: "0144502506",
    epid: "240012345",
    gtin: "885978512345",
    defaultImageUrl: "https://i.ebayimg.com/images/g/abc/s-l500.jpg",
    itemWebUrl: "https://www.ebay.com/itm/1234",
    itemAffiliateWebUrl: "",
    itemLocationCountry: "US",
    itemCreationDate: "2026-08-01T10:00:00.000Z",
    itemEndDate: "2026-09-01T10:00:00.000Z",
    buyingOptions: "FIXED_PRICE",
  }
  const merged = { ...defaults, ...cells }
  return HEADER.split("\t")
    .map((h) => merged[h] ?? "")
    .join("\t")
}

function feedFile(rows: string[]): Buffer {
  return gzipSync(Buffer.from([HEADER, ...rows].join("\n") + "\n", "utf-8"))
}

async function* asChunks(buffer: Buffer, size: number): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < buffer.length; i += size) {
    yield new Uint8Array(buffer.subarray(i, i + size))
  }
}

/* -------------------------------------------------------------------------- */
/*  URL construction                                                          */
/* -------------------------------------------------------------------------- */

describe("feed URLs", () => {
  it("builds a NEWLY_LISTED item feed URL with the date", () => {
    const url = new URL(
      buildItemFeedUrl({ categoryId: "619", feedScope: "NEWLY_LISTED", date: "20260809" }, SANDBOX),
    )
    expect(url.pathname).toBe("/buy/feed/v1_beta/item")
    expect(url.searchParams.get("category_id")).toBe("619")
    expect(url.searchParams.get("feed_scope")).toBe("NEWLY_LISTED")
    expect(url.searchParams.get("date")).toBe("20260809")
  })

  it("omits date for ALL_ACTIVE, which ignores it", () => {
    const url = new URL(buildItemFeedUrl({ categoryId: "619", feedScope: "ALL_ACTIVE" }, SANDBOX))
    expect(url.searchParams.has("date")).toBe(false)
  })

  it("refuses NEWLY_LISTED without a date rather than sending a request that will 400", () => {
    expect(() => buildItemFeedUrl({ categoryId: "619", feedScope: "NEWLY_LISTED" }, SANDBOX)).toThrow(
      /requires a date/i,
    )
  })

  it("builds a snapshot URL", () => {
    const url = new URL(
      buildItemSnapshotUrl({ categoryId: "619", snapshotDate: "2026-08-09T13:00:00.000Z" }, SANDBOX),
    )
    expect(url.pathname).toBe("/buy/feed/v1_beta/item_snapshot")
    expect(url.searchParams.get("snapshot_date")).toBe("2026-08-09T13:00:00.000Z")
  })
})

describe("date stamps", () => {
  it("formats the feed date as yyyyMMdd in UTC", () => {
    expect(feedDateStamp(new Date("2026-08-09T23:30:00.000Z"))).toBe("20260809")
  })

  it("floors the snapshot hour and steps back past eBay's generation lag", () => {
    // Asking for the current hour reliably 404s: files take roughly 2 hours.
    const stamp = snapshotHourStamp(new Date("2026-08-09T13:45:00.000Z"), 3)
    expect(stamp).toBe("2026-08-09T10:00:00.000Z")
  })
})

/* -------------------------------------------------------------------------- */
/*  Content-Range                                                             */
/* -------------------------------------------------------------------------- */

describe("parseContentRange", () => {
  it("reads start, end and total", () => {
    expect(parseContentRange("bytes 0-10485759/52428800")).toEqual({
      start: 0,
      end: 10485759,
      total: 52428800,
    })
  })

  it("handles an unknown total", () => {
    expect(parseContentRange("bytes 0-99/*")).toEqual({ start: 0, end: 99, total: null })
  })

  it("returns null for a missing or malformed header", () => {
    expect(parseContentRange(null)).toBeNull()
    expect(parseContentRange("garbage")).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*  Decompression across chunk boundaries                                     */
/* -------------------------------------------------------------------------- */

describe("gunzipChunks", () => {
  it("reassembles a gzip stream split at arbitrary byte boundaries", async () => {
    // This is the case the Range loop creates on every real download: the
    // boundary lands mid-DEFLATE-block, not on a tidy record edge.
    const file = feedFile([row({ itemId: "a" }), row({ itemId: "b" }), row({ itemId: "c" })])
    const rows: Record<string, string>[] = []
    for await (const parsed of parseTsvRows(gunzipChunks(asChunks(file, 7)))) {
      rows.push(parsed)
    }
    expect(rows.map((r) => r.itemId)).toEqual(["a", "b", "c"])
  })

  it("survives a single-byte chunking, the worst case for a streaming inflater", async () => {
    const file = feedFile([row({ itemId: "solo" })])
    const rows: Record<string, string>[] = []
    for await (const parsed of parseTsvRows(gunzipChunks(asChunks(file, 1)))) {
      rows.push(parsed)
    }
    expect(rows).toHaveLength(1)
    expect(rows[0].itemId).toBe("solo")
  })
})

/* -------------------------------------------------------------------------- */
/*  TSV parsing                                                               */
/* -------------------------------------------------------------------------- */

describe("parseTsvRows", () => {
  it("binds columns by header name, not position", async () => {
    // A feed with the columns in a different order must still parse correctly.
    // A positional parser silently mislabels every value here.
    const text = "title\titemId\tprice\nA Guitar\tv1|9|0\t100.00\n"
    const rows: Record<string, string>[] = []
    for await (const r of parseTsvRows(asChunks(Buffer.from(text), 5))) rows.push(r)
    expect(rows[0]).toEqual({ title: "A Guitar", itemId: "v1|9|0", price: "100.00" })
  })

  it("handles CRLF line endings without leaving \\r glued to the last cell", async () => {
    const text = "a\tb\r\n1\t2\r\n"
    const rows: Record<string, string>[] = []
    for await (const r of parseTsvRows(asChunks(Buffer.from(text), 3))) rows.push(r)
    expect(rows[0]).toEqual({ a: "1", b: "2" })
  })

  it("pads a short row rather than dropping it", async () => {
    const text = "a\tb\tc\n1\t2\n"
    const rows: Record<string, string>[] = []
    for await (const r of parseTsvRows(asChunks(Buffer.from(text), 4))) rows.push(r)
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" })
  })

  it("emits a final row that has no trailing newline", async () => {
    const text = "a\n1"
    const rows: Record<string, string>[] = []
    for await (const r of parseTsvRows(asChunks(Buffer.from(text), 1))) rows.push(r)
    expect(rows).toEqual([{ a: "1" }])
  })

  it("decodes multi-byte UTF-8 split across a chunk boundary", async () => {
    // "Røde" and "Höfner" are real brands; a naive per-chunk decode mangles them.
    const text = "brand\nHöfner\n"
    const buffer = Buffer.from(text, "utf-8")
    const rows: Record<string, string>[] = []
    for await (const r of parseTsvRows(asChunks(buffer, 1))) rows.push(r)
    expect(rows[0].brand).toBe("Höfner")
  })
})

/* -------------------------------------------------------------------------- */
/*  Field mapping                                                             */
/* -------------------------------------------------------------------------- */

describe("parseFeedPrice", () => {
  it("parses a bare decimal", () => {
    expect(parseFeedPrice("749.99")).toEqual({ value: 749.99, currency: "" })
  })

  it("parses a currency-prefixed amount", () => {
    expect(parseFeedPrice("USD749.99")).toEqual({ value: 749.99, currency: "USD" })
  })

  it("parses a currency-suffixed amount", () => {
    expect(parseFeedPrice("749.99 GBP")).toEqual({ value: 749.99, currency: "GBP" })
  })

  it("returns null for an unparseable value instead of NaN", () => {
    expect(parseFeedPrice("").value).toBeNull()
    expect(parseFeedPrice("call for price").value).toBeNull()
  })
})

describe("normalizeCondition", () => {
  it("prefers the numeric condition id over free text", () => {
    expect(normalizeCondition({ conditionId: "3000", condition: "whatever" })).toBe("Used")
    expect(normalizeCondition({ conditionId: "7000", condition: "" })).toBe(
      "For parts or not working",
    )
  })

  it("falls back to the text when the id is unknown", () => {
    expect(normalizeCondition({ conditionId: "9999", condition: "Vintage" })).toBe("Vintage")
    expect(normalizeCondition({ conditionId: "", condition: "" })).toBe("Unspecified")
  })
})

describe("normalizeToListing", () => {
  const parse = (cells: Partial<Record<string, string>> = {}) => {
    const values = row(cells).split("\t")
    const record = Object.fromEntries(HEADER.split("\t").map((h, i) => [h, values[i]]))
    return toEbayItem(record)
  }

  it("maps a well formed item onto a listing insert", () => {
    const listing = normalizeToListing(parse())!
    expect(listing.source).toBe("ebay")
    expect(listing.externalId).toBe("v1|1234|0")
    expect(listing.priceCents).toBe(74999)
    expect(listing.condition).toBe("Used")
    expect(listing.brand).toBe("Fender")
    expect(listing.gtin).toBe("885978512345")
    expect(listing.epid).toBe("240012345")
    expect(listing.isShippable).toBe(true)
    expect(listing.isLocalPickup).toBe(false)
    expect(listing.affiliateUrl).toBeNull()
  })

  it("carries itemAffiliateWebUrl through when the feed supplies one", () => {
    const listing = normalizeToListing(
      parse({ itemAffiliateWebUrl: "https://ebay.com/itm/1234?campid=5338" }),
    )!
    expect(listing.affiliateUrl).toBe("https://ebay.com/itm/1234?campid=5338")
  })

  it("prefers an explicit brand over eBay's inferred guess", () => {
    // inferredBrand is eBay's own reading of the title. Treating it as equal to
    // a seller-entered value would let a guess claim a unique catalogue key.
    const listing = normalizeToListing(parse({ brand: "Gibson", inferredBrand: "Epiphone" }))!
    expect(listing.brand).toBe("Gibson")
  })

  it("falls back to the inferred brand when there is no explicit one", () => {
    const listing = normalizeToListing(parse({ brand: "", inferredBrand: "Epiphone" }))!
    expect(listing.brand).toBe("Epiphone")
  })

  it("treats a classified ad as local pickup and not shippable", () => {
    const listing = normalizeToListing(parse({ buyingOptions: "CLASSIFIED_AD" }))!
    expect(listing.isLocalPickup).toBe(true)
    expect(listing.isShippable).toBe(false)
  })

  it("drops rows with no price, so the cheapest-first sort stays truthful", () => {
    expect(normalizeToListing(parse({ price: "" }))).toBeNull()
    expect(normalizeToListing(parse({ price: "0" }))).toBeNull()
  })

  it("drops rows with no id or no outbound URL", () => {
    expect(normalizeToListing(parse({ itemId: "" }))).toBeNull()
    expect(normalizeToListing(parse({ itemWebUrl: "" }))).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*  Chunked download                                                          */
/* -------------------------------------------------------------------------- */

describe("downloadFeedChunks", () => {
  function rangedFetch(file: Buffer, chunkSize: number) {
    const calls: string[] = []
    const impl: typeof fetch = async (_url, init) => {
      const range = (init?.headers as Record<string, string>).Range
      calls.push(range)
      const [start, end] = range.replace("bytes=", "").split("-").map(Number)
      const slice = file.subarray(start, Math.min(end + 1, file.length))
      return new Response(slice, {
        status: 206,
        headers: {
          "content-range": `bytes ${start}-${start + slice.length - 1}/${file.length}`,
        },
      })
    }
    return { impl, calls, chunkSize }
  }

  it("walks the file in sequential ranges and stops at the declared total", async () => {
    const file = feedFile([row({ itemId: "a" }), row({ itemId: "b" })])
    const { impl, calls } = rangedFetch(file, 32)

    const parts: Uint8Array[] = []
    for await (const chunk of downloadFeedChunks("https://x/item", {
      fetchImpl: impl,
      chunkBytes: 32,
      oauthToken: "t",
    })) {
      parts.push(chunk)
    }

    const total = Buffer.concat(parts)
    expect(total.length).toBe(file.length)
    expect(total.equals(file)).toBe(true)
    expect(calls[0]).toBe("bytes=0-31")
    expect(calls[1]).toBe("bytes=32-63")
  })

  it("accepts a 200 as the whole file and makes exactly one request", async () => {
    const file = feedFile([row({})])
    let calls = 0
    const impl: typeof fetch = async () => {
      calls += 1
      return new Response(file, { status: 200 })
    }
    const parts: Uint8Array[] = []
    for await (const chunk of downloadFeedChunks("https://x/item", { fetchImpl: impl })) {
      parts.push(chunk)
    }
    expect(calls).toBe(1)
    expect(Buffer.concat(parts).equals(file)).toBe(true)
  })

  it("sends the required headers on every request", async () => {
    let seen: Record<string, string> = {}
    const impl: typeof fetch = async (_u, init) => {
      seen = init?.headers as Record<string, string>
      return new Response(Buffer.alloc(0), { status: 200 })
    }
    for await (const _ of downloadFeedChunks("https://x/item", {
      fetchImpl: impl,
      oauthToken: "token-123",
      marketplaceId: "EBAY_US",
    })) {
      /* drain */
    }
    expect(seen.Accept).toBe("application/json,text/tab-separated-values")
    expect(seen["X-EBAY-C-MARKETPLACE-ID"]).toBe("EBAY_US")
    expect(seen.Range).toMatch(/^bytes=0-\d+$/)
    expect(seen.Authorization).toBe("Bearer token-123")
  })

  it("surfaces the JSON error body on a non-2xx, since errors are JSON and success is TSV", async () => {
    const impl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          errors: [{ errorId: 13022, message: "Bad range", longMessage: "The Range header is invalid." }],
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      )

    await expect(async () => {
      for await (const _ of downloadFeedChunks("https://x/item", { fetchImpl: impl })) {
        /* drain */
      }
    }).rejects.toThrowError(EbayFeedError)

    try {
      for await (const _ of downloadFeedChunks("https://x/item", { fetchImpl: impl })) {
        /* drain */
      }
    } catch (error) {
      const err = error as EbayFeedError
      expect(err.status).toBe(400)
      expect(err.message).toContain("The Range header is invalid.")
    }
  })
})

describe("streamFeedItems", () => {
  it("composes download, gunzip and parse into typed items", async () => {
    const file = feedFile([
      row({ itemId: "one", title: "Gibson Les Paul Standard", price: "2499.00" }),
      row({ itemId: "two", title: "Boss DS-1 Distortion", price: "45.00", brand: "Boss" }),
    ])
    // Deliberately small chunks so the composition is exercised across boundaries.
    const impl: typeof fetch = async (_u, init) => {
      const range = (init?.headers as Record<string, string>).Range
      const [start, end] = range.replace("bytes=", "").split("-").map(Number)
      const slice = file.subarray(start, Math.min(end + 1, file.length))
      return new Response(slice, {
        status: 206,
        headers: { "content-range": `bytes ${start}-${start + slice.length - 1}/${file.length}` },
      })
    }

    const items = []
    for await (const item of streamFeedItems("https://x/item", {
      fetchImpl: impl,
      chunkBytes: 16,
    })) {
      items.push(item)
    }

    expect(items).toHaveLength(2)
    expect(items[0].itemId).toBe("one")
    expect(items[0].title).toBe("Gibson Les Paul Standard")
    expect(items[1].priceValue).toBe(45)
  })
})
