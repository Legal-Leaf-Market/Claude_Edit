import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeDb, db } from "@/lib/db"
import { canonicalGear, marketplaceListings } from "@/lib/db/schema"
import { pedalBoardDetails, searchPedals } from "@/lib/pedalboard/queries"
import type { NewCanonicalGear, NewMarketplaceListing } from "@/lib/db/schema"

/**
 * Integration tests against a real Postgres, same rationale as
 * tests/canonical.test.ts: the aggregation these queries do (grouping by
 * source, filtering to active listings, splitting new vs used) is exactly
 * the kind of thing a mocked database would test nothing real about.
 */

async function truncate() {
  await db.execute(
    sql`TRUNCATE listing_price_history, marketplace_listings, canonical_gear RESTART IDENTITY CASCADE`,
  )
}

function gear(overrides: Partial<NewCanonicalGear> = {}): NewCanonicalGear {
  return {
    brand: "Boss",
    model: "DS-1 Distortion",
    category: "Effects Pedals",
    slug: `pedal-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  }
}

function listingFor(
  canonicalGearId: string,
  overrides: Partial<NewMarketplaceListing> = {},
): NewMarketplaceListing {
  return {
    canonicalGearId,
    source: "ebay",
    externalId: `ext-${Math.random().toString(36).slice(2)}`,
    title: "A pedal",
    priceCents: 5000,
    currency: "USD",
    condition: "Used",
    rawUrl: "https://example.com/1",
    listingStatus: "active",
    ...overrides,
  }
}

beforeEach(truncate)
afterAll(async () => {
  await truncate()
  await closeDb()
})

describe("searchPedals", () => {
  it("is scoped to the Effects Pedals category, not gear that happens to match by name", async () => {
    await db.insert(canonicalGear).values([
      gear({ slug: "boss-ds-1", brand: "Boss", model: "DS-1 Distortion" }),
      gear({ slug: "boss-katana", brand: "Boss", model: "Katana Amp", category: "Amplifiers" }),
    ])

    const results = await searchPedals("boss")

    expect(results.map((r) => r.slug)).toEqual(["boss-ds-1"])
  })

  it("ranks by how many listings have actually been seen, most first", async () => {
    await db.insert(canonicalGear).values([
      gear({ slug: "quiet-pedal", brand: "Ibanez", model: "Tube Screamer", priceSampleSize: 2 }),
      gear({ slug: "popular-pedal", brand: "Ibanez", model: "Tube Screamer 2", priceSampleSize: 8 }),
    ])

    const results = await searchPedals("tube screamer")

    expect(results.map((r) => r.slug)).toEqual(["popular-pedal", "quiet-pedal"])
  })

  it("returns the most-listed pedals when the query is empty, rather than nothing", async () => {
    await db.insert(canonicalGear).values([
      gear({ slug: "a", priceSampleSize: 1 }),
      gear({ slug: "b", priceSampleSize: 9 }),
    ])

    const results = await searchPedals("")

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].slug).toBe("b")
  })
})

describe("pedalBoardDetails", () => {
  it("returns entries in the requested order, not database order", async () => {
    const [a, b] = await db
      .insert(canonicalGear)
      .values([gear({ slug: "pedal-a" }), gear({ slug: "pedal-b" })])
      .returning()

    const inRequestedOrder = await pedalBoardDetails([b.slug, a.slug])
    expect(inRequestedOrder.map((e) => e.slug)).toEqual(["pedal-b", "pedal-a"])

    const reversed = await pedalBoardDetails([a.slug, b.slug])
    expect(reversed.map((e) => e.slug)).toEqual(["pedal-a", "pedal-b"])
  })

  it("splits each store's cheapest price into new vs used, cheapest store first", async () => {
    const [pedal] = await db.insert(canonicalGear).values(gear({ slug: "split-pedal" })).returning()

    await db.insert(marketplaceListings).values([
      listingFor(pedal.id, { source: "ebay", condition: "Used", priceCents: 5000 }),
      listingFor(pedal.id, { source: "reverb", condition: "New", priceCents: 7000 }),
    ])

    const [entry] = await pedalBoardDetails(["split-pedal"])

    expect(entry.bySource).toEqual([
      { source: "ebay", cheapestNewCents: null, cheapestUsedCents: 5000, count: 1 },
      { source: "reverb", cheapestNewCents: 7000, cheapestUsedCents: null, count: 1 },
    ])
  })

  it("excludes sold and expired listings from availability", async () => {
    const [pedal] = await db.insert(canonicalGear).values(gear({ slug: "mixed-status" })).returning()

    await db.insert(marketplaceListings).values([
      listingFor(pedal.id, { source: "ebay", priceCents: 4000, listingStatus: "sold" }),
      listingFor(pedal.id, { source: "ebay", priceCents: 6000, listingStatus: "active" }),
    ])

    const [entry] = await pedalBoardDetails(["mixed-status"])

    expect(entry.bySource).toEqual([
      { source: "ebay", cheapestNewCents: null, cheapestUsedCents: 6000, count: 1 },
    ])
  })

  it("still returns the pedal itself, with an empty store list, when nobody has it in stock", async () => {
    await db.insert(canonicalGear).values(gear({ slug: "out-of-stock-pedal" }))

    const [entry] = await pedalBoardDetails(["out-of-stock-pedal"])

    expect(entry.slug).toBe("out-of-stock-pedal")
    expect(entry.bySource).toEqual([])
  })

  it("drops a slug that is not a pedal, rather than returning unrelated gear", async () => {
    await db.insert(canonicalGear).values(gear({ slug: "an-amp", category: "Amplifiers" }))

    const entries = await pedalBoardDetails(["an-amp"])

    expect(entries).toEqual([])
  })
})
