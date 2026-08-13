import { describe, expect, it, vi, afterEach } from "vitest"
import { fetchCatalog, formatMarketPrice, gearAvailProductUrl, GEAR_AVAIL_URL } from "@/lib/catalog"
import { PEDALS } from "@/lib/pedals"

/**
 * The catalogue layer.
 *
 * The point of most of these is house rule 2: nothing throws. This site has to
 * survive the sister site being down, slow, or shipping a response shape it
 * has never seen, and degrade to the guide it already was.
 */

const okBody = (pedals: unknown[], minSample = 3) =>
  new Response(JSON.stringify({ ok: true, minSample, pedals }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchCatalog", () => {
  it("parses a well formed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okBody([
          {
            slug: "boss-ds-1",
            brand: "Boss",
            model: "DS-1 Distortion",
            imageUrl: null,
            marketPriceCents: 4500,
            sampleSize: 12,
            listingCount: 4,
            type: "drive",
          },
        ]),
      ),
    )
    const result = await fetchCatalog()
    expect(result.error).toBeNull()
    expect(result.pedals).toHaveLength(1)
    expect(result.pedals[0].marketPriceCents).toBe(4500)
  })

  it("returns an empty catalogue with a reason when the sister site errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 503 })))
    const result = await fetchCatalog()
    expect(result.pedals).toEqual([])
    expect(result.error).toContain("503")
  })

  it("surfaces the upstream reason so a schema bug does not read as an outage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, error: 'column l.is_active does not exist' }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )
    const result = await fetchCatalog()
    expect(result.error).toContain("503")
    expect(result.error).toContain("does not exist")
  })

  it("does not throw when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")))
    const result = await fetchCatalog()
    expect(result.pedals).toEqual([])
    expect(result.error).toBe("ECONNREFUSED")
  })

  it("does not throw on an unexpected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, wrong: [] }), { status: 200 }),
      ),
    )
    const result = await fetchCatalog()
    expect(result.pedals).toEqual([])
    expect(result.error).toBe("Unexpected response shape")
  })

  it("drops malformed rows rather than blanking the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okBody([
          { slug: "good", brand: "Boss", model: "DS-1" },
          { brand: "no slug", model: "dropped" },
          null,
          "nonsense",
        ]),
      ),
    )
    const result = await fetchCatalog()
    expect(result.pedals.map((p) => p.slug)).toEqual(["good"])
    expect(result.error).toBeNull()
  })
})

describe("formatMarketPrice", () => {
  it("withholds rather than printing a zero or a null", () => {
    expect(formatMarketPrice(null)).toBeNull()
    expect(formatMarketPrice(0)).toBeNull()
    expect(formatMarketPrice(Number.NaN)).toBeNull()
  })

  it("prints whole dollars, because an average is not accurate to the cent", () => {
    expect(formatMarketPrice(4567)).toBe("$46")
  })
})

describe("the guide stays clean", () => {
  /**
   * The reason the catalogue is a separate layer. CLAUDE.md section 2a lifted
   * the site-wide no-price rule, but the circuit dataset keeps it: an entry
   * that says a pedal sounds thin has to have nothing riding on it.
   */
  it("has no price or merchant field on any circuit entry", () => {
    for (const pedal of PEDALS) {
      const keys = Object.keys(pedal as Record<string, unknown>)
      for (const banned of ["price", "priceCents", "marketPrice", "merchant", "listing", "buyUrl"]) {
        expect(keys).not.toContain(banned)
      }
    }
  })
})

describe("outbound links", () => {
  it("points at the sister site, where the click accounting lives", () => {
    expect(gearAvailProductUrl("boss-ds-1")).toBe(`${GEAR_AVAIL_URL}/gear/boss-ds-1`)
  })
})
