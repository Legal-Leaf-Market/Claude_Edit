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
