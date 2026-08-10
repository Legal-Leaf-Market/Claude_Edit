import { gzipSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { createCsvRecordSplitter, parseCsv, parseCsvRows } from "@/lib/ingestion/csv"
import { isZoroTrackedProductUrl } from "@/lib/affiliate/zoro"
import {
  classifyZoroRow,
  isHardwareHomograph,
  isMusicCategory,
  normalizeZoroRow,
  parseZoroFeed,
  streamZoroFeedText,
} from "@/lib/ingestion/zoro-linkconnector"

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const LC_HEADER =
  "ProductID,Title,Description,Price,URL,ImageURL,UPC,EAN,Brand,Manufacturer,Model,Condition,Currency,InStock,Categories,Link"

function lcRow(overrides: Partial<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    ProductID: "G812180812",
    Title: "Accent Acoustic Folk Guitar CS-6",
    Description: "Full size acoustic folk guitar, spruce top",
    Price: "129.99",
    URL: "https://www.zoro.com/accent-acoustic-folk-guitar-cs-6/i/G812180812/",
    ImageURL: "https://www.zoro.com/static/cms/product/large/G812180812.jpg",
    UPC: "086000000123",
    EAN: "",
    Brand: "Accent",
    Manufacturer: "Accent",
    Model: "CS-6",
    Condition: "",
    Currency: "USD",
    InStock: "1",
    Categories: "Musical Instruments > Stringed Instruments > Acoustic Folk Guitars",
    Link: "https://www.zoro.com/accent-acoustic-folk-guitar-cs-6/i/G812180812/?lc_pid=169324-118",
  }
  const merged = { ...base, ...overrides }
  return LC_HEADER.split(",")
    .map((h) => `"${(merged[h] ?? "").replace(/"/g, '""')}"`)
    .join(",")
}

function record(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return parseCsv(`${LC_HEADER}\n${lcRow(overrides)}\n`)[0]
}

/* -------------------------------------------------------------------------- */
/*  The category filter, which is what makes this source usable at all        */
/* -------------------------------------------------------------------------- */

describe("isMusicCategory", () => {
  it("accepts the branches Zoro actually files instruments under", () => {
    expect(isMusicCategory("Musical Instruments > Stringed Instruments")).toBe(true)
    expect(isMusicCategory("Musical Instruments > Instrument Accessories")).toBe(true)
    expect(isMusicCategory("Percussion Instruments > Drum Accessories & Parts")).toBe(true)
    expect(isMusicCategory("Woodwind Instruments > Clarinets")).toBe(true)
  })

  it("rejects the industrial catalogue, which is nearly all of the feed", () => {
    expect(isMusicCategory("Hardware > Hinges > Piano Hinges")).toBe(false)
    expect(isMusicCategory("Material Handling > Drums & Drum Handling")).toBe(false)
    expect(isMusicCategory("Pipe, Tubing, Hose & Fittings > Brass Fittings")).toBe(false)
    expect(isMusicCategory("Office Furniture > Keyboard Drawers")).toBe(false)
  })

  it("fails CLOSED on a blank category rather than guessing from the title", () => {
    // On a 3.5M row industrial feed an unclassifiable row is far more likely to
    // be a mop than a mandolin, and the title homographs make guessing worse
    // than dropping. Costing ourselves one accessory is the cheaper error.
    expect(isMusicCategory("")).toBe(false)
    expect(isMusicCategory("   ")).toBe(false)
  })

  it("will not admit a bare 'drum' or 'brass', which are core MRO stock", () => {
    expect(isMusicCategory("Material Handling > Drums")).toBe(false)
    expect(isMusicCategory("Fittings > Brass")).toBe(false)
    // Qualified with an instrument word, both are genuinely musical.
    expect(isMusicCategory("Drum Sets & Drum Kits")).toBe(true)
    expect(isMusicCategory("Brass Instruments > Trumpets")).toBe(true)
  })
})

describe("isHardwareHomograph", () => {
  it("catches the hardware whose names read musical", () => {
    // Every one of these is a real Zoro SKU family.
    expect(isHardwareHomograph("Zoro Select Piano Hinge, Steel, Full Surface Mounting")).toBe(true)
    expect(isHardwareHomograph("Jobsite Piano Box")).toBe(true)
    expect(isHardwareHomograph("Keyboard Drawer, Under Desk")).toBe(true)
    expect(isHardwareHomograph("Key Blanks, Brass, PK10")).toBe(true)
    expect(isHardwareHomograph("55 gal Steel Drum, Open Head")).toBe(true)
    expect(isHardwareHomograph("Drum Dolly, 1000 lb Capacity")).toBe(true)
    expect(isHardwareHomograph("Brass Fitting, 1/2 in Pipe Size")).toBe(true)
  })

  it("leaves real instruments and accessories alone", () => {
    expect(isHardwareHomograph("Accent Acoustic Folk Guitar CS-6")).toBe(false)
    expect(isHardwareHomograph('16" Crash Cymbal, Brass')).toBe(false)
    expect(isHardwareHomograph("Drum Sticks, Hickory, 5A, PK2")).toBe(false)
    expect(isHardwareHomograph("Snare Drum Head, Coated, 14 in")).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/*  Row mapping                                                               */
/* -------------------------------------------------------------------------- */

describe("classifyZoroRow", () => {
  it("maps a music row onto a listing insert", () => {
    const row = normalizeZoroRow(record())!
    expect(row.source).toBe("zoro")
    expect(row.externalId).toBe("G812180812")
    expect(row.priceCents).toBe(12_999)
    expect(row.brand).toBe("Accent")
    expect(row.gtin).toBe("086000000123")
    expect(row.mpn).toBe("CS-6")
    expect(row.listingStatus).toBe("active")
    expect(row.rawUrl).toContain("zoro.com")
    expect(row.locationCountry).toBe("US")
  })

  it("defaults an empty condition to New, not Unspecified", () => {
    // Zoro has no used or consignment channel, same as the CJ retailers.
    expect(normalizeZoroRow(record({ Condition: "" }))!.condition).toBe("New")
    expect(normalizeZoroRow(record({ Condition: "Refurbished" }))!.condition).toBe("Refurbished")
  })

  it("keeps the feed link only when it carries lc_pid, the only paid form", () => {
    expect(normalizeZoroRow(record())!.affiliateUrl).toContain("lc_pid=")
  })

  it("stores NO affiliate link for an untracked zoro.com URL", () => {
    // The campaign terms are explicit that only lc_pid links are paid, so a
    // bare merchant URL is not an unattributed link, it is an unpaid one.
    // Section 5: a tracker that credits nobody is worse than a clean direct
    // link, so this must be null rather than "close enough".
    const row = normalizeZoroRow(
      record({ Link: "https://www.zoro.com/accent-acoustic-folk-guitar-cs-6/i/G812180812/" }),
    )!
    expect(row.affiliateUrl).toBeNull()
    expect(row.rawUrl).toContain("zoro.com")
  })

  it("rejects an lc_pid on some other host, and an empty lc_pid", () => {
    expect(isZoroTrackedProductUrl("https://not-zoro.example/p/1?lc_pid=169324")).toBe(false)
    expect(isZoroTrackedProductUrl("https://www.zoro.com/i/G1/?lc_pid=")).toBe(false)
    expect(isZoroTrackedProductUrl("https://www.zoro.com/i/G1/?LC_PID=169324")).toBe(true)
  })

  it("separates a malformed row from a merely off-category one", () => {
    // These mean opposite things operationally: malformed climbing is a feed or
    // parser fault, off-category is the filter doing its job.
    expect(classifyZoroRow(record({ ProductID: "" }))).toEqual({
      kind: "rejected",
      reason: "malformed",
    })
    expect(classifyZoroRow(record({ Price: "0" }))).toEqual({
      kind: "rejected",
      reason: "malformed",
    })
    expect(classifyZoroRow(record({ URL: "" }))).toEqual({
      kind: "rejected",
      reason: "malformed",
    })
    expect(
      classifyZoroRow(record({ Categories: "Hardware > Hinges", Title: "Piano Hinge, Steel" })),
    ).toEqual({ kind: "rejected", reason: "off-category" })
  })

  it("drops a homograph even when the category column would have let it in", () => {
    // Defence in depth for loose category assignment on the merchant's side.
    const row = classifyZoroRow(
      record({
        Categories: "Musical Instruments",
        Title: "Zoro Select Piano Hinge, Steel, 72 in Leaf H",
      }),
    )
    expect(row).toEqual({ kind: "rejected", reason: "off-category" })
  })
})

/* -------------------------------------------------------------------------- */
/*  Whole-feed parse and the tally that makes the filter auditable            */
/* -------------------------------------------------------------------------- */

describe("parseZoroFeed", () => {
  it("keeps the music rows and counts what it dropped and why", () => {
    const text = [
      LC_HEADER,
      lcRow({ ProductID: "a" }),
      lcRow({ ProductID: "b", Categories: "Hardware > Hinges", Title: "Piano Hinge" }),
      lcRow({ ProductID: "c", Categories: "" }),
      lcRow({ ProductID: "" }),
      lcRow({ ProductID: "d", Categories: "Percussion Instruments > Drum Accessories" }),
    ].join("\n")

    const { rows, tally } = parseZoroFeed(text)
    expect(tally.seen).toBe(5)
    expect(tally.kept).toBe(2)
    expect(tally.offCategory).toBe(2)
    expect(tally.malformed).toBe(1)
    expect(rows.map((r) => r.externalId)).toEqual(["a", "d"])
  })
})

/* -------------------------------------------------------------------------- */
/*  Streaming: the reason this module exists in its own file                  */
/* -------------------------------------------------------------------------- */

describe("createCsvRecordSplitter", () => {
  it("keeps a quoted newline inside one record", () => {
    const splitter = createCsvRecordSplitter()
    const records = [
      ...splitter.push('a,"line one\nline two",c\nd,e,f\n'),
      ...splitter.flush(),
    ]
    expect(records).toHaveLength(2)
    expect(parseCsvRows(records[0])[0]).toEqual(["a", "line one\nline two", "c"])
  })

  it("treats an inch mark in an UNQUOTED field as a literal", () => {
    // '16" Crash Cymbal' is exactly the shape that breaks a naive quote toggle:
    // it would open a phantom quoted field and swallow every following newline.
    const splitter = createCsvRecordSplitter()
    const records = [...splitter.push('1,16" Crash Cymbal,ok\n2,next row,ok\n'), ...splitter.flush()]
    expect(records).toHaveLength(2)
    expect(parseCsvRows(records[1])[0]).toEqual(["2", "next row", "ok"])
  })

  it("handles a doubled quote inside a quoted field", () => {
    const splitter = createCsvRecordSplitter()
    const records = [...splitter.push('1,"a ""quoted"" word",z\n'), ...splitter.flush()]
    expect(parseCsvRows(records[0])[0]).toEqual(["1", 'a "quoted" word', "z"])
  })

  it("gives the same records fed one character at a time as in one push", () => {
    // Same guarantee the eBay feed test pins by chunking a fixture one byte at
    // a time: chunk boundaries must be invisible to the parse.
    const text = `${LC_HEADER}\n${lcRow({ ProductID: "a" })}\n${lcRow({ ProductID: "b" })}\n`
    const whole = createCsvRecordSplitter()
    const expected = [...whole.push(text), ...whole.flush()]

    const drip = createCsvRecordSplitter()
    const actual: string[] = []
    for (const char of text) actual.push(...drip.push(char))
    actual.push(...drip.flush())

    expect(actual).toEqual(expected)
    expect(actual).toHaveLength(3)
  })

  it("drops an unterminated quoted field rather than emitting a shifted row", () => {
    const splitter = createCsvRecordSplitter()
    splitter.push('1,"truncated download')
    expect(splitter.flush()).toEqual([])
  })
})

function streamingResponse(bytes: Buffer, chunkSize: number): Response {
  let offset = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close()
        return
      }
      controller.enqueue(new Uint8Array(bytes.subarray(offset, offset + chunkSize)))
      offset += chunkSize
    },
  })
  return new Response(stream, { status: 200 })
}

async function collect(url: string, impl: typeof fetch): Promise<string> {
  let out = ""
  for await (const chunk of streamZoroFeedText(url, impl)) out += chunk
  return out
}

describe("streamZoroFeedText", () => {
  it("inflates a gzipped feed split across single-byte chunks", async () => {
    // One inflater has to keep its window across writes, so a gzip member cut
    // in half by a chunk boundary is invisible to it. Buffering the whole file
    // first is not an option at this feed's size.
    const plain = `${LC_HEADER}\n${lcRow()}\n`
    const gz = gzipSync(Buffer.from(plain))
    const impl: typeof fetch = async () => streamingResponse(gz, 1)
    expect(await collect("https://example.test/feed.gz", impl)).toBe(plain)
  })

  it("passes plain CSV through untouched", async () => {
    const plain = `${LC_HEADER}\n${lcRow()}\n`
    const impl: typeof fetch = async () => streamingResponse(Buffer.from(plain), 7)
    expect(await collect("https://example.test/feed.csv", impl)).toBe(plain)
  })

  it("throws with the status attached so backoff can decide to retry", async () => {
    const impl: typeof fetch = async () => new Response("nope", { status: 503 })
    await expect(collect("https://example.test/feed", impl)).rejects.toThrow(/503/)
  })

  it("parses a streamed gzipped feed end to end", async () => {
    const text = [
      LC_HEADER,
      lcRow({ ProductID: "a" }),
      lcRow({ ProductID: "b", Categories: "Hardware > Hinges", Title: "Piano Hinge" }),
      "",
    ].join("\n")
    const impl: typeof fetch = async () => streamingResponse(gzipSync(Buffer.from(text)), 3)
    const { rows, tally } = parseZoroFeed(await collect("https://example.test/feed.gz", impl))
    expect(tally.kept).toBe(1)
    expect(rows[0].externalId).toBe("a")
  })
})
