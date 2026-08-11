import { describe, expect, it } from "vitest"
import {
  excludedSourcesFor,
  excludedStoreNamesFor,
  normalizeRegion,
  REGION_COOKIE,
  regionFromHeaders,
  shipsToLabel,
  storeShipsTo,
} from "@/lib/regions"
import { STORES } from "@/lib/stores"

/**
 * Regional serviceability.
 *
 * Anderton's ships only within the UK and has by far the largest catalogue
 * here (27,052 products), so getting this wrong is not a cosmetic error: it
 * either shows an Ohio shopper a wall of Guildford prices they can never pay,
 * or it silently denies a British shopper the biggest catalogue on the site.
 *
 * The tests below pin both failure directions, and in particular pin that an
 * UNKNOWN region shows everything. Geo-IP is a guess (VPNs, carrier routing, a
 * missing header in development), and hiding on a bad guess is the worse of
 * the two mistakes.
 */

function headers(values: Record<string, string>) {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  }
}

describe("normalizeRegion", () => {
  it("accepts a two-letter code in any case", () => {
    expect(normalizeRegion("gb")).toBe("GB")
    expect(normalizeRegion("GB")).toBe("GB")
    expect(normalizeRegion("  us  ")).toBe("US")
  })

  it("treats anything else as unknown rather than guessing", () => {
    expect(normalizeRegion("GBR")).toBeNull()
    expect(normalizeRegion("U")).toBeNull()
    expect(normalizeRegion("")).toBeNull()
    expect(normalizeRegion(null)).toBeNull()
    expect(normalizeRegion(undefined)).toBeNull()
    // A crafted cookie must not become a filter value.
    expect(normalizeRegion("GB' OR 1=1--")).toBeNull()
  })
})

describe("storeShipsTo", () => {
  it("lets a UK shopper see Anderton's", () => {
    expect(storeShipsTo("andertons", "GB")).toBe(true)
  })

  it("keeps Anderton's away from shoppers it will not deliver to", () => {
    expect(storeShipsTo("andertons", "US")).toBe(false)
    expect(storeShipsTo("andertons", "DE")).toBe(false)
    expect(storeShipsTo("andertons", "AU")).toBe(false)
  })

  /**
   * The important default. Unknown region shows everything, because hiding the
   * largest catalogue on the site from a British shopper whose VPN exited in
   * Amsterdam is worse than showing a clearly labelled listing.
   */
  it("shows everything when the region is unknown", () => {
    expect(storeShipsTo("andertons", null)).toBe(true)
  })

  it("treats an unrestricted store as shipping anywhere", () => {
    expect(storeShipsTo("eartguitar", "US")).toBe(true)
    expect(storeShipsTo("eartguitar", "GB")).toBe(true)
    expect(storeShipsTo("jacksonaudio", "JP")).toBe(true)
  })

  it("does not invent a restriction for a source it has never heard of", () => {
    expect(storeShipsTo("some-future-store", "US")).toBe(true)
  })
})

describe("excludedSourcesFor", () => {
  it("excludes nothing for a UK shopper", () => {
    expect(excludedSourcesFor("GB")).toEqual([])
  })

  it("excludes Anderton's for a US shopper", () => {
    expect(excludedSourcesFor("US")).toEqual(["andertons"])
  })

  /**
   * An empty array, not a list of everything. The search layer adds no filter
   * at all in that case, rather than one that always passes.
   */
  it("excludes nothing when the region is unknown", () => {
    expect(excludedSourcesFor(null)).toEqual([])
  })

  it("only ever excludes stores that actually declared a restriction", () => {
    const restricted = STORES.filter((s) => s.shipsTo?.length).map((s) => s.source)
    for (const source of excludedSourcesFor("US")) {
      expect(restricted).toContain(source)
    }
  })
})

describe("the shopper-facing copy", () => {
  it("names the stores being hidden, so nothing disappears silently", () => {
    expect(excludedStoreNamesFor("US")).toEqual(["Andertons Music Company"])
    expect(excludedStoreNamesFor("GB")).toEqual([])
    expect(excludedStoreNamesFor(null)).toEqual([])
  })

  it("phrases the restriction the way a shopper would say it", () => {
    expect(shipsToLabel("andertons")).toBe("UK only")
  })

  it("has nothing to say about an unrestricted store", () => {
    expect(shipsToLabel("eartguitar")).toBeNull()
  })
})

describe("regionFromHeaders", () => {
  it("reads Vercel's geo header", () => {
    expect(regionFromHeaders(headers({ "x-vercel-ip-country": "GB" }))).toBe("GB")
  })

  it("reads Cloudflare's geo header", () => {
    expect(regionFromHeaders(headers({ "cf-ipcountry": "US" }))).toBe("US")
  })

  it("is unknown when no host provides a geo header", () => {
    expect(regionFromHeaders(headers({}))).toBeNull()
  })

  /**
   * A shopper who has told us where they are knows better than an IP lookup.
   * This matters for the British expat and the VPN user, who are exactly the
   * people a geo guess gets wrong.
   */
  it("lets an explicit cookie choice beat the geo guess", () => {
    const result = regionFromHeaders(
      headers({ cookie: `${REGION_COOKIE}=GB`, "x-vercel-ip-country": "US" }),
    )
    expect(result).toBe("GB")
  })

  it("treats an explicit ALL as a real choice to see everything", () => {
    const result = regionFromHeaders(
      headers({ cookie: `${REGION_COOKIE}=ALL`, "x-vercel-ip-country": "US" }),
    )
    expect(result).toBeNull()
    expect(excludedSourcesFor(result)).toEqual([])
  })

  it("falls back to the geo header when the cookie is malformed", () => {
    const result = regionFromHeaders(
      headers({ cookie: `${REGION_COOKIE}=nonsense`, "x-vercel-ip-country": "US" }),
    )
    expect(result).toBe("US")
  })

  it("finds the cookie among others rather than only at the start", () => {
    const result = regionFromHeaders(
      headers({ cookie: `session=abc; ${REGION_COOKIE}=GB; theme=dark` }),
    )
    expect(result).toBe("GB")
  })

  it("does not match a cookie whose name merely ends with ours", () => {
    const result = regionFromHeaders(headers({ cookie: `not_${REGION_COOKIE}=US` }))
    expect(result).toBeNull()
  })
})
