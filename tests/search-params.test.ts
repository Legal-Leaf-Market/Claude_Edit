import { describe, expect, it } from "vitest"
import { paramsFromQuery, queryFromParams } from "@/lib/search"
import { normalizeParams, MAX_PER_PAGE, DEFAULT_PER_PAGE } from "@/lib/search/types"

describe("paramsFromQuery", () => {
  it("reads the common query shape", () => {
    const params = paramsFromQuery({
      q: " stratocaster ",
      brand: "Fender,Squier",
      category: "Electric Guitars",
      source: "ebay",
      min: "200",
      max: "1500.50",
      deals: "1",
      shipping: "local",
      sort: "price_desc",
      page: "3",
    })

    expect(params.q).toBe("stratocaster")
    expect(params.brands).toEqual(["Fender", "Squier"])
    expect(params.categories).toEqual(["Electric Guitars"])
    expect(params.sources).toEqual(["ebay"])
    expect(params.minPriceCents).toBe(20_000)
    expect(params.maxPriceCents).toBe(150_050)
    expect(params.dealsOnly).toBe(true)
    expect(params.shipping).toBe("local")
    expect(params.sort).toBe("price_desc")
    expect(params.page).toBe(3)
  })

  it("rejects a sort value that is not in the allowed set", () => {
    // A crafted URL must never reach the SQL builder with an unexpected value.
    const params = paramsFromQuery({ sort: "price_asc; DROP TABLE listings" })
    expect(params.sort).toBeUndefined()
  })

  it("rejects an unknown shipping value", () => {
    expect(paramsFromQuery({ shipping: "teleport" }).shipping).toBe("any")
  })

  it("ignores a negative or unparseable price", () => {
    const params = paramsFromQuery({ min: "-50", max: "abc" })
    expect(params.minPriceCents).toBeUndefined()
    expect(params.maxPriceCents).toBeUndefined()
  })

  it("falls back to page 1 on a nonsense page value", () => {
    expect(paramsFromQuery({ page: "0" }).page).toBe(1)
    expect(paramsFromQuery({ page: "-4" }).page).toBe(1)
    expect(paramsFromQuery({ page: "banana" }).page).toBe(1)
  })

  it("drops empty entries from a multi-select", () => {
    expect(paramsFromQuery({ brand: "Fender,,,Gibson," }).brands).toEqual(["Fender", "Gibson"])
    expect(paramsFromQuery({ brand: ",,," }).brands).toBeUndefined()
  })
})

describe("normalizeParams", () => {
  it("clamps perPage so a crafted URL cannot request the whole table", () => {
    expect(normalizeParams({ perPage: 10_000 }).perPage).toBe(MAX_PER_PAGE)
    expect(normalizeParams({ perPage: 0 }).perPage).toBe(1)
    expect(normalizeParams({}).perPage).toBe(DEFAULT_PER_PAGE)
  })

  it("defaults to relevance with a query and newest-first without one", () => {
    expect(normalizeParams({ q: "strat" }).sort).toBe("relevance")
    expect(normalizeParams({}).sort).toBe("newest")
  })
})

describe("queryFromParams", () => {
  it("round-trips through paramsFromQuery", () => {
    const original = {
      q: "les paul",
      brands: ["Gibson"],
      categories: ["Electric Guitars"],
      minPriceCents: 50_000,
      maxPriceCents: 300_000,
      dealsOnly: true,
      shipping: "shippable" as const,
      sort: "deal" as const,
      page: 2,
    }
    const roundTripped = paramsFromQuery(
      Object.fromEntries(new URLSearchParams(queryFromParams(original))),
    )

    expect(roundTripped.q).toBe(original.q)
    expect(roundTripped.brands).toEqual(original.brands)
    expect(roundTripped.minPriceCents).toBe(original.minPriceCents)
    expect(roundTripped.maxPriceCents).toBe(original.maxPriceCents)
    expect(roundTripped.dealsOnly).toBe(true)
    expect(roundTripped.shipping).toBe("shippable")
    expect(roundTripped.sort).toBe("deal")
    expect(roundTripped.page).toBe(2)
  })

  it("omits defaults so URLs stay short and cacheable", () => {
    expect(queryFromParams({})).toBe("")
    expect(queryFromParams({ page: 1 })).toBe("")
    expect(queryFromParams({ shipping: "any" })).toBe("")
  })
})

/**
 * The regional opt-out has to survive every URL this site builds.
 *
 * Both of these pin real defects caught in review on PR #26, and both came
 * from the same omission: `ships=all` was read straight off the query string
 * in the page rather than being a first-class SearchParam, so it never went
 * through queryFromParams. That meant paging to page two silently reverted a
 * shopper to geo filtering, and the "show anyway" link itself discarded the
 * search term and every active filter.
 */
describe("the ships=all opt-out round-trips", () => {
  it("is read off the query string", () => {
    expect(paramsFromQuery({ ships: "all" }).shipsAll).toBe(true)
  })

  it("is absent unless explicitly asked for", () => {
    expect(paramsFromQuery({}).shipsAll).toBe(false)
    expect(paramsFromQuery({ ships: "" }).shipsAll).toBe(false)
    expect(paramsFromQuery({ ships: "gb" }).shipsAll).toBe(false)
    expect(paramsFromQuery({ ships: "yes" }).shipsAll).toBe(false)
  })

  it("is serialised back out", () => {
    expect(queryFromParams({ shipsAll: true })).toContain("ships=all")
    expect(queryFromParams({ shipsAll: false })).not.toContain("ships")
    expect(queryFromParams({})).not.toContain("ships")
  })

  /**
   * The pagination bug. Every paging link is built by re-serialising params
   * with a new page, so if the opt-out is not carried there, page two quietly
   * hides the stores page one showed.
   */
  it("survives a page change, which is how pagination builds its links", () => {
    const params = paramsFromQuery({ q: "victory preamp", ships: "all", page: "1" })
    const nextPage = queryFromParams({ ...params, page: 2 })
    expect(nextPage).toContain("ships=all")
    expect(nextPage).toContain("q=victory+preamp")
    expect(nextPage).toContain("page=2")
  })

  /**
   * The "show anyway" bug. Turning the opt-out ON must preserve everything
   * the shopper had already narrowed down, or clicking it is a punishment.
   */
  it("keeps the search and every filter when the opt-out is switched on", () => {
    const params = paramsFromQuery({
      q: "tube screamer",
      brand: "Ibanez",
      category: "Effects Pedals",
      condition: "Used",
      min: "50",
      max: "200",
      deals: "1",
      sort: "price_asc",
    })

    const withOptOut = queryFromParams({ ...params, shipsAll: true, page: undefined })

    expect(withOptOut).toContain("ships=all")
    expect(withOptOut).toContain("q=tube+screamer")
    expect(withOptOut).toContain("brand=Ibanez")
    expect(withOptOut).toContain("category=Effects+Pedals")
    expect(withOptOut).toContain("condition=Used")
    expect(withOptOut).toContain("min=50")
    expect(withOptOut).toContain("max=200")
    expect(withOptOut).toContain("deals=1")
    expect(withOptOut).toContain("sort=price_asc")
  })

  it("makes a full round trip through both directions", () => {
    const original = paramsFromQuery({ q: "big muff", ships: "all", deals: "1" })
    const restored = paramsFromQuery(
      Object.fromEntries(new URLSearchParams(queryFromParams(original))),
    )
    expect(restored.shipsAll).toBe(true)
    expect(restored.q).toBe("big muff")
    expect(restored.dealsOnly).toBe(true)
  })
})
