import { sql } from "drizzle-orm"
import { NextRequest } from "next/server"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { GET } from "@/app/api/catalog/pedals/route"
import {
  countLiveModels,
  headlinePrice,
  liveModels,
  toLiveModel,
  type LiveModel,
} from "@/lib/catalog/live-models"
import { closeDb, db } from "@/lib/db"
import { canonicalGear, marketplaceListings } from "@/lib/db/schema"
import { MIN_SAMPLE_SIZE } from "@/lib/deals/pricing"

/**
 * The one definition of what a category actually has in stock.
 *
 * The bug these pin: /used/effects-pedals joins canonical gear to ACTIVE
 * listings, and the endpoint that publishes the pedal slice to stompbox.world
 * did not. So the sister site could open on pedals whose listings had all
 * ended, ranked above pedals you could buy, because it ordered by price sample
 * size and that sample deliberately counts listings that ended inside the last
 * ninety days. Both surfaces read this module now.
 */

async function truncate() {
  await db.execute(
    sql`TRUNCATE listing_price_history, marketplace_listings, canonical_gear RESTART IDENTITY CASCADE`,
  )
}

const PEDALS = "Effects Pedals"

async function gear(overrides: {
  brand: string
  model: string
  slug: string
  category?: string
  avgUsedPriceCents?: number | null
  priceSampleSize?: number
  avgNewPriceCents?: number | null
  newPriceSampleSize?: number
}): Promise<string> {
  const [row] = await db
    .insert(canonicalGear)
    .values({ category: PEDALS, ...overrides })
    .returning({ id: canonicalGear.id })
  return row.id
}

let counter = 0

async function listing(
  gearId: string,
  overrides: { priceCents?: number; listingStatus?: string; condition?: string | null } = {},
) {
  counter += 1
  await db.insert(marketplaceListings).values({
    source: "ebay",
    externalId: `ext-${counter}`,
    title: "A pedal",
    priceCents: 9_900,
    currency: "USD",
    condition: "Used",
    rawUrl: `https://www.ebay.com/itm/${counter}`,
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

/* -------------------------------------------------------------------------- */
/*  Pure mapping                                                              */
/* -------------------------------------------------------------------------- */

function row(overrides: Partial<Parameters<typeof toLiveModel>[0]> = {}) {
  return {
    slug: "boss-ds-1",
    brand: "Boss",
    model: "DS-1",
    category: PEDALS,
    image_url: null,
    listing_count: 4,
    cheapest_cents: 4_000,
    avg_used_price_cents: 4_500,
    price_sample_size: MIN_SAMPLE_SIZE,
    avg_new_price_cents: null,
    new_price_sample_size: 0,
    ...overrides,
  }
}

describe("toLiveModel", () => {
  it("applies the sample floor to each condition class on its own", () => {
    // Forty new listings are not evidence about what the used one is worth,
    // and the reverse. A median under its own floor is dropped whatever the
    // other class knows.
    const model = toLiveModel(
      row({
        avg_used_price_cents: 4_500,
        price_sample_size: MIN_SAMPLE_SIZE - 1,
        avg_new_price_cents: 9_900,
        new_price_sample_size: MIN_SAMPLE_SIZE + 30,
      }),
    )
    expect(model.usedPriceCents).toBeNull()
    expect(model.newPriceCents).toBe(9_900)
  })

  it("treats a zero price as no price rather than as free", () => {
    const model = toLiveModel(row({ avg_used_price_cents: 0, cheapest_cents: 0 }))
    expect(model.usedPriceCents).toBeNull()
    expect(model.cheapestCents).toBeNull()
  })
})

describe("headlinePrice", () => {
  const base: LiveModel = {
    slug: "s",
    brand: "b",
    model: "m",
    category: PEDALS,
    imageUrl: null,
    listingCount: 3,
    cheapestCents: null,
    usedPriceCents: null,
    usedSampleSize: 0,
    newPriceCents: null,
    newSampleSize: 0,
  }

  it("prefers the used median on a used-first site", () => {
    const headline = headlinePrice({
      ...base,
      usedPriceCents: 4_500,
      usedSampleSize: 6,
      newPriceCents: 9_900,
      newSampleSize: 40,
    })
    expect(headline).toEqual({ cents: 4_500, sampleSize: 6, basis: "used" })
  })

  it("falls back to the new median rather than withholding a real number", () => {
    // The old endpoint gated on the USED sample size after coalescing, so a
    // pedal only new retailers stock showed no price at all on the sister
    // site while Gear Avail's own gear page printed one.
    const headline = headlinePrice({ ...base, newPriceCents: 9_900, newSampleSize: 40 })
    expect(headline).toEqual({ cents: 9_900, sampleSize: 40, basis: "new" })
  })

  it("reports no basis when neither class cleared the floor", () => {
    expect(headlinePrice(base).cents).toBeNull()
    expect(headlinePrice(base).basis).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*  The query                                                                 */
/* -------------------------------------------------------------------------- */

describe("liveModels", () => {
  it("leaves out gear whose listings have all ended", async () => {
    const live = await gear({ brand: "Boss", model: "DS-1", slug: "boss-ds-1" })
    const dead = await gear({
      brand: "Ibanez",
      model: "TS808",
      slug: "ibanez-ts808",
      // A fat price sample and nothing to buy: exactly the row that used to
      // sort to the top of the published catalogue.
      avgUsedPriceCents: 19_900,
      priceSampleSize: 40,
    })
    await listing(live)
    await listing(dead, { listingStatus: "ended" })
    await listing(dead, { listingStatus: "sold" })

    const models = await liveModels({ category: PEDALS })
    expect(models.map((m) => m.slug)).toEqual(["boss-ds-1"])
    expect(await countLiveModels({ category: PEDALS })).toBe(1)
  })

  it("orders by live listings, not by price sample size", async () => {
    const stocked = await gear({ brand: "Boss", model: "DS-1", slug: "boss-ds-1" })
    const thin = await gear({
      brand: "Ibanez",
      model: "TS808",
      slug: "ibanez-ts808",
      avgUsedPriceCents: 19_900,
      priceSampleSize: 90,
    })
    await listing(thin)
    for (let i = 0; i < 3; i += 1) await listing(stocked)

    const models = await liveModels({ category: PEDALS })
    expect(models.map((m) => m.slug)).toEqual(["boss-ds-1", "ibanez-ts808"])
    expect(models[0].listingCount).toBe(3)
  })

  it("counts models rather than listings", async () => {
    const id = await gear({ brand: "Boss", model: "DS-1", slug: "boss-ds-1" })
    for (let i = 0; i < 5; i += 1) await listing(id)
    expect(await countLiveModels({ category: PEDALS })).toBe(1)
  })

  it("stays inside its category", async () => {
    const pedal = await gear({ brand: "Boss", model: "DS-1", slug: "boss-ds-1" })
    const amp = await gear({
      brand: "Fender",
      model: "Twin Reverb",
      slug: "fender-twin-reverb",
      category: "Amplifiers",
    })
    await listing(pedal)
    await listing(amp)
    const models = await liveModels({ category: PEDALS })
    expect(models.map((m) => m.slug)).toEqual(["boss-ds-1"])
  })

  it("reports the cheapest live asking price and ignores a zero", async () => {
    const id = await gear({ brand: "Boss", model: "DS-1", slug: "boss-ds-1" })
    await listing(id, { priceCents: 12_000 })
    await listing(id, { priceCents: 7_500 })
    await listing(id, { priceCents: 0 })
    // The ended one is cheaper and must not be quoted: it is not for sale.
    await listing(id, { priceCents: 100, listingStatus: "ended" })

    const [model] = await liveModels({ category: PEDALS })
    expect(model.cheapestCents).toBe(7_500)
    expect(model.listingCount).toBe(3)
  })

  it("matches free text across brand and model", async () => {
    const boss = await gear({ brand: "Boss", model: "DS-1", slug: "boss-ds-1" })
    const ibanez = await gear({ brand: "Ibanez", model: "Tube Screamer", slug: "ibanez-ts" })
    await listing(boss)
    await listing(ibanez)

    expect((await liveModels({ category: PEDALS, q: "screamer" })).map((m) => m.slug)).toEqual([
      "ibanez-ts",
    ])
    expect((await liveModels({ category: PEDALS, q: "boss ds" })).map((m) => m.slug)).toEqual([
      "boss-ds-1",
    ])
    expect(await countLiveModels({ category: PEDALS, q: "screamer" })).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/*  The published slice                                                       */
/* -------------------------------------------------------------------------- */

async function getPedals(query = "") {
  const response = await GET(
    new NextRequest(`https://gearavail.test/api/catalog/pedals${query}`),
  )
  return { status: response.status, body: await response.json() }
}

describe("GET /api/catalog/pedals", () => {
  it("publishes the live shelf, its size, and where it came from", async () => {
    const stocked = await gear({
      brand: "Boss",
      model: "DS-1",
      slug: "boss-ds-1",
      avgUsedPriceCents: 4_500,
      priceSampleSize: MIN_SAMPLE_SIZE + 1,
    })
    const dead = await gear({
      brand: "Ibanez",
      model: "TS808",
      slug: "ibanez-ts808",
      avgUsedPriceCents: 19_900,
      priceSampleSize: 90,
    })
    await listing(stocked)
    await listing(dead, { listingStatus: "ended" })

    const { status, body } = await getPedals()
    expect(status).toBe(200)
    expect(body.minSample).toBe(MIN_SAMPLE_SIZE)
    expect(body.total).toBe(1)
    expect(body.browsePath).toBe("/used/effects-pedals")
    expect(body.pedals.map((p: { slug: string }) => p.slug)).toEqual(["boss-ds-1"])
  })

  it("says which market a price measures instead of blending the two", async () => {
    const used = await gear({
      brand: "Boss",
      model: "DS-1",
      slug: "boss-ds-1",
      avgUsedPriceCents: 4_500,
      priceSampleSize: MIN_SAMPLE_SIZE,
    })
    const newOnly = await gear({
      brand: "Strymon",
      model: "Timeline",
      slug: "strymon-timeline",
      avgNewPriceCents: 44_900,
      newPriceSampleSize: MIN_SAMPLE_SIZE + 10,
    })
    await listing(used)
    await listing(newOnly, { condition: "New" })

    const { body } = await getPedals()
    const bySlug = Object.fromEntries(
      body.pedals.map((p: { slug: string }) => [p.slug, p as Record<string, unknown>]),
    )
    expect(bySlug["boss-ds-1"].marketPriceClass).toBe("used")
    expect(bySlug["boss-ds-1"].marketPriceCents).toBe(4_500)
    // The case the old COALESCE-then-gate-on-used-sample query withheld.
    expect(bySlug["strymon-timeline"].marketPriceClass).toBe("new")
    expect(bySlug["strymon-timeline"].marketPriceCents).toBe(44_900)
  })

  it("withholds a median under the floor rather than printing a guess", async () => {
    const id = await gear({
      brand: "Boss",
      model: "DS-1",
      slug: "boss-ds-1",
      // Written straight into the column, as a well meaning backfill might.
      avgUsedPriceCents: 4_500,
      priceSampleSize: MIN_SAMPLE_SIZE - 1,
    })
    await listing(id)

    const { body } = await getPedals()
    expect(body.pedals[0].marketPriceCents).toBeNull()
    expect(body.pedals[0].marketPriceClass).toBeNull()
  })

  it("never republishes a per-listing price to the sister domain", async () => {
    // Merchant names, deep links and asking prices carry per-feed partner
    // terms. The medians are ours; the cheapest live asking price is not, so
    // liveModels() computes it for this site's own pages and the projection
    // drops it.
    const id = await gear({ brand: "Boss", model: "DS-1", slug: "boss-ds-1" })
    await listing(id, { priceCents: 7_500 })

    const { body } = await getPedals()
    const serialized = JSON.stringify(body.pedals[0])
    expect(serialized).not.toContain("cheapest")
    expect(serialized).not.toContain("7500")
    for (const banned of ["rawUrl", "affiliateUrl", "source", "merchant", "priceCents"]) {
      expect(Object.keys(body.pedals[0])).not.toContain(banned)
    }
  })

  it("honours limit and offset over the live shelf", async () => {
    for (const [brand, model, slug] of [
      ["Boss", "DS-1", "boss-ds-1"],
      ["Ibanez", "TS808", "ibanez-ts808"],
    ]) {
      const id = await gear({ brand, model, slug })
      await listing(id)
    }

    const first = await getPedals("?limit=1")
    expect(first.body.count).toBe(1)
    expect(first.body.total).toBe(2)
    const second = await getPedals("?limit=1&offset=1")
    expect(second.body.pedals[0].slug).not.toBe(first.body.pedals[0].slug)
  })
})
