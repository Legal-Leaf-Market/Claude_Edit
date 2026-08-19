import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  fetchCatalog,
  formatMarketPrice,
  gearAvailPedalsUrl,
  gearAvailProductUrl,
  marketPriceLabel,
  GEAR_AVAIL_URL,
} from "@/lib/stompbox/catalog"
import { PEDALS } from "@/lib/stompbox/pedals"

/**
 * The catalogue layer.
 *
 * THIS SUITE USED TO MOCK `fetch`, and the change is the whole point of the
 * merge. The guide read the pedal shelf from `/api/catalog/pedals` on another
 * deployment, so most of what was tested here was defensive parsing of a wire
 * format: a malformed row, an unexpected shape, a 503 with a reason in the
 * body, a network refusal. None of those failure modes exist any more, and
 * keeping tests for them would be pinning a transport that was deleted.
 *
 * What survives is what was never about the transport: nothing throws, the
 * sample floor is the real one, the headline says which market it measures,
 * and the projection withholds what partner terms say it must.
 */

const liveModels = vi.hoisted(() => vi.fn())
const countLiveModels = vi.hoisted(() => vi.fn())

vi.mock("@/lib/catalog/live-models", async (importOriginal) => ({
  /*
   * The real `headlinePrice` is kept rather than stubbed. It is the used-first
   * rule (section 8) and a fake would let this suite agree with itself about
   * which median gets published while the site did something else.
   */
  ...(await importOriginal<typeof import("@/lib/catalog/live-models")>()),
  liveModels,
  countLiveModels,
}))

/** A row shaped like `liveModels()` returns, with only the interesting bits named. */
const model = (over: Record<string, unknown> = {}) => ({
  slug: "boss-ds-1",
  brand: "Boss",
  model: "DS-1 Distortion",
  category: "Effects Pedals",
  imageUrl: null,
  listingCount: 4,
  cheapestCents: 3900,
  usedPriceCents: 4500,
  usedSampleSize: 12,
  newPriceCents: null,
  newSampleSize: 0,
  ...over,
})

beforeEach(() => {
  liveModels.mockReset()
  countLiveModels.mockReset()
  liveModels.mockResolvedValue([model()])
  countLiveModels.mockResolvedValue(1)
})

describe("fetchCatalog", () => {
  it("projects a live model onto a catalogue row", async () => {
    const result = await fetchCatalog()
    expect(result.error).toBeNull()
    expect(result.pedals).toHaveLength(1)
    expect(result.pedals[0].marketPriceCents).toBe(4500)
    expect(result.pedals[0].marketPriceClass).toBe("used")
    expect(result.pedals[0].listingCount).toBe(4)
  })

  it("keeps the market price labelled with the market it measures", async () => {
    /*
     * New and used are measured separately and the headline falls back to the
     * new median for gear only new retailers stock. Printing that under the
     * words "typical used" would be the guide stating something its source
     * does not.
     */
    liveModels.mockResolvedValue([
      model({
        slug: "strymon-timeline",
        brand: "Strymon",
        model: "Timeline",
        usedPriceCents: null,
        usedSampleSize: 0,
        newPriceCents: 44900,
        newSampleSize: 40,
      }),
    ])
    const result = await fetchCatalog()
    expect(result.pedals[0].marketPriceClass).toBe("new")
    expect(marketPriceLabel(result.pedals[0].marketPriceClass)).toBe("typical new")
  })

  it("publishes no price, and no label, when neither class clears the floor", async () => {
    // Section 8: a median from too small a sample is a guess dressed up as a
    // measurement, and the card prints the reason instead.
    liveModels.mockResolvedValue([
      model({ usedPriceCents: null, usedSampleSize: 2, newPriceCents: null, newSampleSize: 1 }),
    ])
    const result = await fetchCatalog()
    expect(result.pedals[0].marketPriceCents).toBeNull()
    expect(result.pedals[0].marketPriceClass).toBeNull()
    expect(marketPriceLabel(result.pedals[0].marketPriceClass)).toBeNull()
  })

  it("NEVER republishes a per-listing price, a merchant or a deep link", async () => {
    /*
     * THE RULE THE MERGE DOES NOT RELAX, and the one most likely to be
     * undone by accident now that this is a function call rather than an HTTP
     * boundary. `liveModels()` computes `cheapestCents` because Gear Avail's
     * own pages print it; partner terms restrict redistributing feed rows, and
     * stompbox.world is still a second domain, so the projection drops it. A
     * spread of the model into the row would silently reintroduce it, which is
     * exactly why this asserts on the KEYS rather than on one field.
     */
    const result = await fetchCatalog()
    const keys = Object.keys(result.pedals[0])
    for (const banned of ["cheapestCents", "merchant", "store", "affiliateUrl", "rawUrl", "url"]) {
      expect(keys).not.toContain(banned)
    }
  })

  it("reads the shelf size and the page it came from", async () => {
    countLiveModels.mockResolvedValue(412)
    const result = await fetchCatalog()
    expect(result.total).toBe(412)
    expect(result.browsePath).toBe("/used/effects-pedals")
  })

  it("never reports a total smaller than the rows in hand", async () => {
    // Otherwise the page prints "showing 2 of 0", which reads as a bug in the
    // one place this site is meant to be plain about what it is showing.
    liveModels.mockResolvedValue([model({ slug: "a" }), model({ slug: "b" })])
    countLiveModels.mockResolvedValue(0)
    const result = await fetchCatalog()
    expect(result.total).toBe(2)
  })

  it("publishes the real sample floor rather than a number typed in here", async () => {
    // It read 3 for a while and the page printed that number in a sentence
    // explaining its own honesty policy, which was the guide stating a rule
    // the aggregator does not follow. It is MIN_SAMPLE_SIZE, and that is 5.
    const result = await fetchCatalog()
    expect(result.minSample).toBe(5)
  })

  it("degrades to the guide with a reason when the query fails", async () => {
    // House rule 2: nothing throws. A query that no longer matches the schema
    // is now the likeliest cause, and the page says so rather than 500ing.
    liveModels.mockRejectedValue(new Error('column l.is_active does not exist'))
    const result = await fetchCatalog()
    expect(result.pedals).toEqual([])
    expect(result.error).toContain("does not exist")
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

  it("sends the overflow to the page the catalogue is a slice of", () => {
    expect(gearAvailPedalsUrl()).toBe(`${GEAR_AVAIL_URL}/used/effects-pedals`)
  })
})

describe("marketPriceLabel", () => {
  it("names the market, and says nothing when there is no price", () => {
    expect(marketPriceLabel("used")).toBe("typical used")
    expect(marketPriceLabel("new")).toBe("typical new")
    expect(marketPriceLabel(null)).toBeNull()
  })
})
