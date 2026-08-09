import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeDb, db } from "@/lib/db"
import { canonicalGear, marketplaceListings } from "@/lib/db/schema"
import {
  FUZZY_MATCH_THRESHOLD,
  findFuzzyCandidate,
  normalizeGtin,
  resolveCanonicalGear,
} from "@/lib/canonical/resolve"
import { upsertListings } from "@/lib/ingestion/upsert"
import { isDeal, recomputeMarketPrice, reflagDeals } from "@/lib/deals/pricing"
import type { NewMarketplaceListing } from "@/lib/db/schema"

/**
 * Integration tests against a real Postgres.
 *
 * These deliberately do not mock the database: the whole point of the fuzzy
 * tier is pg_trgm's `similarity()`, and a mocked version of it would test
 * nothing. Tables are truncated between cases.
 */

async function truncate() {
  await db.execute(
    sql`TRUNCATE listing_price_history, marketplace_listings, canonical_gear RESTART IDENTITY CASCADE`,
  )
}

function listing(overrides: Partial<NewMarketplaceListing> = {}): NewMarketplaceListing {
  return {
    source: "ebay",
    externalId: `ext-${Math.random().toString(36).slice(2)}`,
    title: "Fender Player Stratocaster Electric Guitar",
    priceCents: 74_999,
    currency: "USD",
    condition: "Used",
    brand: "Fender",
    rawUrl: "https://www.ebay.com/itm/1",
    listingStatus: "active",
    ...overrides,
  }
}

beforeEach(truncate)
afterAll(async () => {
  await truncate()
  await closeDb()
})

/* -------------------------------------------------------------------------- */
/*  GTIN normalisation                                                        */
/* -------------------------------------------------------------------------- */

describe("normalizeGtin", () => {
  it("collapses the three spellings of one barcode", () => {
    // UPC-12, EAN-13 with a leading zero, and a spreadsheet that ate the zero
    // are the same product and must land on the same canonical row.
    expect(normalizeGtin("885978512345")).toBe("885978512345")
    expect(normalizeGtin("0885978512345")).toBe("885978512345")
    expect(normalizeGtin("885-978-512345")).toBe("885978512345")
  })

  it("rejects values that cannot be a GTIN", () => {
    expect(normalizeGtin("123")).toBeNull()
    expect(normalizeGtin("")).toBeNull()
    expect(normalizeGtin(null)).toBeNull()
    expect(normalizeGtin("not a barcode")).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*  Tier 1                                                                    */
/* -------------------------------------------------------------------------- */

describe("Tier 1: deterministic identifiers", () => {
  it("creates gear from a GTIN and reuses it for a second listing", async () => {
    const first = await resolveCanonicalGear(
      listing({ gtin: "885978512345", title: "Fender Player Stratocaster" }),
    )
    expect(first?.tier).toBe("gtin")
    expect(first?.created).toBe(true)

    // A completely different title. The barcode is authoritative, so this must
    // still land on the same row rather than creating a duplicate.
    const second = await resolveCanonicalGear(
      listing({ gtin: "885978512345", title: "FENDER STRAT MIM sunburst LOOK" }),
    )
    expect(second?.tier).toBe("gtin")
    expect(second?.created).toBe(false)
    expect(second?.gearId).toBe(first?.gearId)

    const rows = await db.select().from(canonicalGear)
    expect(rows).toHaveLength(1)
  })

  it("matches on EPID when there is no GTIN", async () => {
    const first = await resolveCanonicalGear(listing({ epid: "240012345" }))
    expect(first?.tier).toBe("epid")

    const second = await resolveCanonicalGear(
      listing({ epid: "240012345", title: "Different words entirely Fender" }),
    )
    expect(second?.gearId).toBe(first?.gearId)
    expect(second?.tier).toBe("epid")
  })

  it("prefers GTIN over EPID when both are present", async () => {
    const result = await resolveCanonicalGear(listing({ gtin: "885978512345", epid: "240012345" }))
    expect(result?.tier).toBe("gtin")
  })

  it("backfills an EPID onto gear first seen with only a GTIN", async () => {
    const first = await resolveCanonicalGear(listing({ gtin: "885978512345" }))
    await resolveCanonicalGear(listing({ gtin: "885978512345", epid: "240099999" }))

    const [gear] = await db.select().from(canonicalGear)
    expect(gear.id).toBe(first?.gearId)
    expect(gear.epid).toBe("240099999")
  })

  it("marks Tier 1 rows as not needing review", async () => {
    await resolveCanonicalGear(listing({ gtin: "885978512345" }))
    const [gear] = await db.select().from(canonicalGear)
    expect(gear.needsReview).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/*  Tier 2                                                                    */
/* -------------------------------------------------------------------------- */

describe("Tier 2: brand-scoped fuzzy match", () => {
  it("matches a near-identical model within the same brand", async () => {
    await resolveCanonicalGear(
      listing({ gtin: "885978512345", title: "Fender Player Stratocaster" }),
    )

    // No identifiers at all, slightly different spelling.
    const result = await resolveCanonicalGear(
      listing({ title: "Fender Player Stratocaster HSS", gtin: null, epid: null }),
    )
    expect(result?.tier).toBe("fuzzy")
    expect(result?.score).toBeGreaterThanOrEqual(FUZZY_MATCH_THRESHOLD)

    const rows = await db.select().from(canonicalGear)
    expect(rows).toHaveLength(1)
  })

  it("refuses to match the same model name across different brands", async () => {
    // This is the case that makes an unscoped similarity search dangerous:
    // "Standard" under Gibson and "Standard" under Squier are different
    // instruments an order of magnitude apart in price.
    await resolveCanonicalGear(
      listing({ title: "Gibson Les Paul Standard", brand: "Gibson", gtin: "111111111111" }),
    )
    const candidate = await findFuzzyCandidate("Squier", "Les Paul Standard")
    expect(candidate).toBeNull()
  })

  it("does not match below the similarity threshold", async () => {
    await resolveCanonicalGear(listing({ title: "Fender Stratocaster", gtin: "885978512345" }))
    const candidate = await findFuzzyCandidate("Fender", "Jazzmaster")
    expect(candidate).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*  Tier 3                                                                    */
/* -------------------------------------------------------------------------- */

describe("Tier 3: provisional fallback", () => {
  it("creates a provisional row flagged for review", async () => {
    const result = await resolveCanonicalGear(
      listing({ title: "Ibanez Tube Screamer TS9", brand: "Ibanez", gtin: null, epid: null }),
    )
    expect(result?.tier).toBe("provisional")
    expect(result?.created).toBe(true)

    const [gear] = await db.select().from(canonicalGear)
    expect(gear.needsReview).toBe(true)
    expect(gear.brand).toBe("Ibanez")
  })

  it("returns null when there is no brand to name a row after", async () => {
    // An unbranded listing would otherwise create one junk canonical row per
    // title. Better to leave it unresolved and let search find it on its text.
    const result = await resolveCanonicalGear(
      listing({ title: "Handmade luthier special", brand: null, gtin: null, epid: null }),
    )
    expect(result).toBeNull()
  })

  it("gives colliding brand and model pairs distinct slugs", async () => {
    await resolveCanonicalGear(listing({ title: "Fender Stratocaster", gtin: "111111111111" }))
    // Same brand and model, but a different barcode means genuinely different gear.
    await resolveCanonicalGear(listing({ title: "Fender Stratocaster", gtin: "222222222222" }))

    const rows = await db.select().from(canonicalGear)
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map((r) => r.slug)).size).toBe(2)
  })
})

/* -------------------------------------------------------------------------- */
/*  Deal detection end to end                                                 */
/* -------------------------------------------------------------------------- */

describe("deal detection against real data", () => {
  it("flags only listings more than 20% under the rolling median", async () => {
    const gtin = "885978512345"
    // Six listings clustered around $1,000, plus one at $600.
    const prices = [95_000, 98_000, 100_000, 102_000, 105_000, 110_000, 60_000]
    const rows = prices.map((priceCents, i) =>
      listing({ externalId: `deal-${i}`, priceCents, gtin, title: "Fender Player Stratocaster" }),
    )

    const stats = await upsertListings(rows)
    expect(stats.inserted).toBe(7)

    // Resolve each listing onto the shared canonical row.
    const inserted = await db.select().from(marketplaceListings)
    let gearId = ""
    for (const row of inserted) {
      const result = await resolveCanonicalGear(row)
      gearId = result!.gearId
      await db
        .update(marketplaceListings)
        .set({ canonicalGearId: result!.gearId })
        .where(sql`${marketplaceListings.id} = ${row.id}`)
    }

    const market = await recomputeMarketPrice(gearId)
    expect(market.sampleSize).toBe(7)
    expect(market.medianCents).toBe(100_000)

    await reflagDeals(market)

    const flagged = await db
      .select({ price: marketplaceListings.priceCents, isDeal: marketplaceListings.isDeal })
      .from(marketplaceListings)

    const deals = flagged.filter((f) => f.isDeal).map((f) => f.price)
    expect(deals).toEqual([60_000])
    // 95,000 is only 5% under and must not be badged.
    expect(flagged.find((f) => f.price === 95_000)?.isDeal).toBe(false)
  })

  it("publishes no market price and no deals on a thin sample", async () => {
    const gtin = "885978512345"
    const rows = [95_000, 20_000].map((priceCents, i) =>
      listing({ externalId: `thin-${i}`, priceCents, gtin }),
    )
    await upsertListings(rows)

    const inserted = await db.select().from(marketplaceListings)
    let gearId = ""
    for (const row of inserted) {
      const result = await resolveCanonicalGear(row)
      gearId = result!.gearId
      await db
        .update(marketplaceListings)
        .set({ canonicalGearId: result!.gearId })
        .where(sql`${marketplaceListings.id} = ${row.id}`)
    }

    const market = await recomputeMarketPrice(gearId)
    expect(market.medianCents).toBeNull()
    await reflagDeals(market)

    const flagged = await db.select({ isDeal: marketplaceListings.isDeal }).from(marketplaceListings)
    expect(flagged.every((f) => !f.isDeal)).toBe(true)
    // And the pure predicate agrees.
    expect(isDeal(20_000, 95_000, 2)).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/*  Upsert idempotency                                                        */
/* -------------------------------------------------------------------------- */

describe("upsertListings", () => {
  it("is idempotent on (source, external_id)", async () => {
    const row = listing({ externalId: "stable-1", priceCents: 50_000 })
    const first = await upsertListings([row])
    expect(first.inserted).toBe(1)

    const second = await upsertListings([{ ...row, priceCents: 45_000 }])
    expect(second.inserted).toBe(0)
    expect(second.updated).toBe(1)

    const rows = await db.select().from(marketplaceListings)
    expect(rows).toHaveLength(1)
    expect(rows[0].priceCents).toBe(45_000)
  })

  it("records price history only when the price actually moves", async () => {
    const row = listing({ externalId: "hist-1", priceCents: 50_000 })
    const first = await upsertListings([row])
    expect(first.priceChanges).toBe(1)

    // Same price again: the hourly snapshot touches most of the catalogue, and
    // writing an unchanged row every hour would bloat the table and flat-line
    // the chart.
    const unchanged = await upsertListings([row])
    expect(unchanged.priceChanges).toBe(0)

    const changed = await upsertListings([{ ...row, priceCents: 40_000 }])
    expect(changed.priceChanges).toBe(1)
  })

  it("deduplicates repeated ids inside one batch", async () => {
    // Postgres rejects an ON CONFLICT statement that updates the same target
    // row twice in one command, and feeds do repeat items within a file.
    const stats = await upsertListings([
      listing({ externalId: "dupe", priceCents: 10_000 }),
      listing({ externalId: "dupe", priceCents: 12_000 }),
    ])
    expect(stats.seen).toBe(2)
    const rows = await db.select().from(marketplaceListings)
    expect(rows).toHaveLength(1)
    expect(rows[0].priceCents).toBe(12_000)
  })

  it("never overwrites a stored affiliate URL with null", async () => {
    // A later feed pulled without affiliate context would otherwise silently
    // strip monetisation off every row it touched.
    const withAffiliate = listing({
      externalId: "aff-1",
      affiliateUrl: "https://ebay.com/itm/1?campid=5338",
    })
    await upsertListings([withAffiliate])
    await upsertListings([{ ...withAffiliate, affiliateUrl: null }])

    const rows = await db.select().from(marketplaceListings)
    expect(rows[0].affiliateUrl).toBe("https://ebay.com/itm/1?campid=5338")
  })
})
