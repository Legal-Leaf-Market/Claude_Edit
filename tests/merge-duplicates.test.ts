import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeDb, db } from "@/lib/db"
import { canonicalGear, marketplaceListings } from "@/lib/db/schema"
import type { NewMarketplaceListing } from "@/lib/db/schema"
import { mergeDuplicateGear } from "@/lib/canonical/merge-duplicates"
import { resolveCanonicalGear } from "@/lib/canonical/resolve"

/**
 * The backfill that folds duplicate canonical rows together.
 *
 * The resolver fix stops these being made; this cleans up what the old path
 * already wrote. The tests that matter most are the ones where it REFUSES,
 * because this is the only code in the project that deletes a canonical row
 * and a bad merge takes two instruments' price histories with it.
 */

async function truncate() {
  await db.execute(
    sql`TRUNCATE outbound_clicks, listing_price_history, marketplace_listings, canonical_gear RESTART IDENTITY CASCADE`,
  )
}

let counter = 0

/** A canonical row, written directly, standing in for what the old path made. */
async function gear(overrides: {
  brand: string
  model: string
  slug?: string
  gtin?: string | null
  epid?: string | null
  mpn?: string | null
  imageUrl?: string | null
}): Promise<string> {
  counter += 1
  const [row] = await db
    .insert(canonicalGear)
    .values({
      category: "Effects Pedals",
      slug: overrides.slug ?? `slug-${counter}`,
      ...overrides,
    })
    .returning({ id: canonicalGear.id })
  return row.id
}

async function listing(gearId: string, overrides: Partial<NewMarketplaceListing> = {}) {
  counter += 1
  await db.insert(marketplaceListings).values({
    source: "jacksonaudio",
    externalId: `ext-${counter}`,
    title: "A pedal",
    priceCents: 19_900,
    currency: "USD",
    condition: "New",
    rawUrl: `https://example.test/${counter}`,
    listingStatus: "active",
    canonicalGearId: gearId,
    ...overrides,
  })
}

beforeEach(truncate)
afterAll(async () => {
  await truncate()
  await closeDb()
})

describe("mergeDuplicateGear", () => {
  it("folds the Jackson rows the old resolver left behind", async () => {
    const ids: string[] = []
    for (const finish of ["black", "gold", "white", "red"]) {
      const id = await gear({
        brand: "Jackson",
        model: "1484 Twin Twelve Classic",
        slug: `jackson-1484-twin-twelve-classic-${finish}`,
        mpn: `JA-1484-${finish}`,
      })
      await listing(id)
      ids.push(id)
    }

    const report = await mergeDuplicateGear()
    expect(report.groups).toBe(1)
    expect(report.merged).toBe(3)
    expect(report.skipped).toBe(0)

    const rows = await db.select().from(canonicalGear)
    expect(rows).toHaveLength(1)
    // The oldest row survives, because its slug is the one already in search
    // results and on the sister site.
    expect(rows[0].id).toBe(ids[0])
  })

  it("carries every listing across rather than orphaning it", async () => {
    const keeper = await gear({ brand: "Jackson", model: "Asabi", slug: "a", mpn: "A1" })
    const loser = await gear({ brand: "Jackson", model: "Asabi", slug: "b", mpn: "B2" })
    await listing(keeper)
    await listing(loser)
    await listing(loser)

    await mergeDuplicateGear()

    const rows = await db.select().from(marketplaceListings)
    expect(rows).toHaveLength(3)
    for (const row of rows) expect(row.canonicalGearId).toBe(keeper)
  })

  it("takes an identifier the surviving row was missing", async () => {
    const keeper = await gear({ brand: "Jackson", model: "Asabi", slug: "a" })
    await gear({ brand: "Jackson", model: "Asabi", slug: "b", gtin: "885978512345" })

    await mergeDuplicateGear()

    const rows = await db.select().from(canonicalGear)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(keeper)
    expect(rows[0].gtin).toBe("885978512345")
  })

  it("REFUSES a group whose barcodes disagree", async () => {
    // The case that must never merge. Two GTINs is two products however alike
    // the names, and this is the only code here that deletes a canonical row.
    await gear({ brand: "Fender", model: "Player Stratocaster", slug: "a", gtin: "111111111111" })
    await gear({ brand: "Fender", model: "Player Stratocaster", slug: "b", gtin: "222222222222" })

    const report = await mergeDuplicateGear()
    expect(report.merged).toBe(0)
    expect(report.skipped).toBe(1)
    expect(await db.select().from(canonicalGear)).toHaveLength(2)
  })

  it("REFUSES a group whose eBay catalogue ids disagree", async () => {
    await gear({ brand: "Fender", model: "Player Stratocaster", slug: "a", epid: "111" })
    await gear({ brand: "Fender", model: "Player Stratocaster", slug: "b", epid: "222" })

    const report = await mergeDuplicateGear()
    expect(report.merged).toBe(0)
    expect(await db.select().from(canonicalGear)).toHaveLength(2)
  })

  it("never merges across brands, whatever the model says", async () => {
    await gear({ brand: "Gibson", model: "Les Paul Standard", slug: "a" })
    await gear({ brand: "Squier", model: "Les Paul Standard", slug: "b" })

    const report = await mergeDuplicateGear()
    expect(report.groups).toBe(0)
    expect(await db.select().from(canonicalGear)).toHaveLength(2)
  })

  it("does not merely resemble: near-miss names are left alone", async () => {
    // 0.82 similar on this database, and two different pedals.
    await gear({ brand: "Boss", model: "DS-1 Distortion", slug: "a" })
    await gear({ brand: "Boss", model: "DS-1X Distortion", slug: "b" })

    const report = await mergeDuplicateGear()
    expect(report.groups).toBe(0)
    expect(await db.select().from(canonicalGear)).toHaveLength(2)
  })

  it("writes nothing on a dry run, and says what it would do", async () => {
    await gear({ brand: "Jackson", model: "Asabi", slug: "a" })
    await gear({ brand: "Jackson", model: "Asabi", slug: "b" })

    const report = await mergeDuplicateGear({ dryRun: true })
    expect(report.dryRun).toBe(true)
    expect(report.merged).toBe(1)
    expect(report.detail.join(" ")).toContain("would merge")
    expect(await db.select().from(canonicalGear)).toHaveLength(2)
  })

  it("is idempotent, so a double click costs nothing", async () => {
    await gear({ brand: "Jackson", model: "Asabi", slug: "a" })
    await gear({ brand: "Jackson", model: "Asabi", slug: "b" })

    await mergeDuplicateGear()
    const second = await mergeDuplicateGear()
    expect(second.groups).toBe(0)
    expect(second.merged).toBe(0)
    expect(await db.select().from(canonicalGear)).toHaveLength(1)
  })

  it("ignores case and edge whitespace, the way the resolver does", async () => {
    await gear({ brand: "Jackson", model: "Asabi Overdrive", slug: "a" })
    await gear({ brand: "jackson", model: " asabi overdrive ", slug: "b" })

    const report = await mergeDuplicateGear()
    expect(report.merged).toBe(1)
    expect(await db.select().from(canonicalGear)).toHaveLength(1)
  })

  it("leaves a healthy catalogue completely alone", async () => {
    // Whatever else it does, it must be a no-op on a database with no
    // duplicates in it.
    for (let i = 0; i < 4; i += 1) {
      await resolveCanonicalGear({
        title: `Boss Pedal Number ${i}`,
        brand: "Boss",
        gtin: null,
        epid: null,
        mpn: null,
        primaryImageUrl: null,
      } as never)
    }
    const before = await db.select().from(canonicalGear)
    const report = await mergeDuplicateGear()
    expect(report.merged).toBe(0)
    expect(await db.select().from(canonicalGear)).toHaveLength(before.length)
  })
})
