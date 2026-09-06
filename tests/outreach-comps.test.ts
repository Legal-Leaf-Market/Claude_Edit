import { readFileSync } from "node:fs"
import path from "node:path"
import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { closeDb, db } from "@/lib/db"
import { canonicalGear, marketplaceListings } from "@/lib/db/schema"
import { MIN_SAMPLE_SIZE } from "@/lib/deals/pricing"
import { pullComps } from "@/lib/outreach/comps"
import { upsertListings } from "@/lib/ingestion/upsert"
import { resolveAndReprice } from "@/lib/ingestion/upsert"
import type { NewMarketplaceListing } from "@/lib/db/schema"

/**
 * The comps lookup is where a number becomes an offer to a real person, so
 * every assertion here is about refusing to produce one that is not backed.
 */

vi.mock("@/lib/reverb/orders", () => ({
  fetchSoldOrders: vi.fn(async () => ({ ok: false as const, reason: "not configured in tests" })),
}))

async function truncate() {
  await db.execute(
    sql`TRUNCATE listing_price_history, marketplace_listings, canonical_gear RESTART IDENTITY CASCADE`,
  )
}

function listing(overrides: Partial<NewMarketplaceListing> = {}): NewMarketplaceListing {
  return {
    source: "reverb",
    externalId: `ext-${Math.random().toString(36).slice(2)}`,
    title: "Boss DS-1 Distortion",
    priceCents: 5_000,
    currency: "USD",
    condition: "Excellent",
    brand: "Boss",
    mpn: "DS-1",
    rawUrl: "https://reverb.com/item/x",
    listingStatus: "active",
    feedCategory: "Effects and Pedals / Distortion",
    ...overrides,
  }
}

/** n used listings of one pedal, priced around `cents`. */
async function seedPedal(count: number, cents: number, condition = "Excellent") {
  await upsertListings(
    Array.from({ length: count }, (_, i) =>
      listing({
        externalId: `ds1-${condition}-${i}`,
        priceCents: cents + i * 100,
        condition,
      }),
    ),
  )
  await resolveAndReprice({
    seen: 0, inserted: 0, updated: 0, skipped: 0, priceChanges: 0, touchedGearIds: [],
  })
}

beforeEach(truncate)

describe("pullComps", () => {
  it("suggests the used median once the sample clears the floor", async () => {
    await seedPedal(MIN_SAMPLE_SIZE + 1, 6_000)
    const { comps } = await pullComps([{ brand: "Boss", model: "DS-1" }])
    expect(comps).toHaveLength(1)
    expect(comps[0].matchedAs).toContain("DS-1")
    expect(comps[0].used.sampleSize).toBeGreaterThanOrEqual(MIN_SAMPLE_SIZE)
    expect(comps[0].suggestedCents).not.toBeNull()
    expect(comps[0].source).toBe("catalogue-used")
  })

  it("refuses a suggestion below the floor, and says how short it was", async () => {
    // The same rule the public site follows: no market price under
    // MIN_SAMPLE_SIZE. Here it decides what somebody is offered for their gear.
    await seedPedal(MIN_SAMPLE_SIZE - 2, 6_000)
    const { comps } = await pullComps([{ brand: "Boss", model: "DS-1" }])
    expect(comps[0].matchedAs).toContain("DS-1")
    expect(comps[0].suggestedCents).toBeNull()
    expect(comps[0].source).toBe("none")
    expect(comps[0].basis).toMatch(/under the floor of 5|Price it by hand/)
  })

  it("never suggests from the new median", async () => {
    // New retail sits well above used, so a used buy offer computed off it is
    // inflated on every row, in the direction that costs us money.
    await seedPedal(MIN_SAMPLE_SIZE + 3, 12_000, "Brand New")
    const { comps } = await pullComps([{ brand: "Boss", model: "DS-1" }])
    expect(comps[0].fresh.sampleSize).toBeGreaterThanOrEqual(MIN_SAMPLE_SIZE)
    expect(comps[0].fresh.medianCents).not.toBeNull()
    expect(comps[0].suggestedCents).toBeNull()
    expect(comps[0].basis).toContain("new stock")
  })

  it("reports an unmatched name rather than guessing at it", async () => {
    const { comps } = await pullComps([{ brand: "Klon", model: "Centaur" }])
    expect(comps[0].matchedAs).toBeNull()
    expect(comps[0].suggestedCents).toBeNull()
    expect(comps[0].basis).toContain("Price it by hand")
  })

  it("returns one comp per row, in the order sent", async () => {
    // The client fills state.lot[i] from comps[i]. A dropped or reordered row
    // would put one pedal's price on another pedal, silently.
    await seedPedal(MIN_SAMPLE_SIZE + 1, 6_000)
    const rows = [
      { brand: "Klon", model: "Centaur" },
      { brand: "Boss", model: "DS-1" },
      { brand: "", model: "" },
    ]
    const { comps } = await pullComps(rows)
    expect(comps).toHaveLength(3)
    expect(comps.map((c) => c.brand)).toEqual(["Klon", "Boss", ""])
    expect(comps[1].matchedAs).toContain("DS-1")
    expect(comps[2].matchedAs).toBeNull()
  })

  it("reports the live spread, which is what a cluster looks like", async () => {
    await seedPedal(MIN_SAMPLE_SIZE + 1, 6_000)
    const { comps } = await pullComps([{ brand: "Boss", model: "DS-1" }])
    expect(comps[0].live.count).toBeGreaterThan(0)
    expect(comps[0].live.lowCents).not.toBeNull()
    expect(comps[0].live.highCents!).toBeGreaterThanOrEqual(comps[0].live.lowCents!)
  })

  it("still answers when our own Reverb sales cannot be read", async () => {
    // The order history is a bonus, never a requirement: an unset token must
    // leave the catalogue half of this working.
    await seedPedal(MIN_SAMPLE_SIZE + 1, 6_000)
    const { comps, salesNote } = await pullComps([{ brand: "Boss", model: "DS-1" }])
    expect(comps[0].suggestedCents).not.toBeNull()
    expect(salesNote).toContain("not readable")
  })

  it("matches a row whose brand the listing parser never recognised", async () => {
    // The parser's brand list is pedal brands, so an amp or a keyboard in the
    // lot arrives with the whole name in the model column and an empty brand.
    // Reporting "no catalogue match" there would be a miss on the most
    // valuable row in the lot, and it would look like an answer.
    await seedPedal(MIN_SAMPLE_SIZE + 1, 6_000)
    const { comps } = await pullComps([{ brand: "", model: "Boss DS-1" }])
    expect(comps[0].matchedAs).toContain("DS-1")
    expect(comps[0].suggestedCents).not.toBeNull()
  })

  it("takes no rows without falling over", async () => {
    const { comps } = await pullComps([])
    expect(comps).toEqual([])
  })
})

afterAll(async () => {
  await closeDb()
})

/* -------------------------------------------------------------------------- */
/*  The route around it                                                       */
/* -------------------------------------------------------------------------- */

describe("the comps route", () => {
  const ROUTE = readFileSync(
    path.join(process.cwd(), "app", "api", "admin", "outreach", "comps", "route.ts"),
    "utf8",
  )

  it("is behind the admin passcode", () => {
    // The response carries what we paid and what we made. That is the one
    // figure on this site that is nobody else's business.
    expect(ROUTE).toMatch(/isAdmin\(\)/)
    expect(ROUTE).toMatch(/status: 401/)
  })

  it("is never cached by anything in front of it", () => {
    expect(ROUTE).toMatch(/private, no-store/)
    expect(ROUTE).not.toMatch(/s-maxage/)
  })

  it("is POST only, so a lot never lands in a URL or a log", () => {
    expect(ROUTE).toMatch(/export async function POST/)
    expect(ROUTE).not.toMatch(/export async function GET/)
  })

  it("caps how many rows one click can ask about", () => {
    expect(ROUTE).toMatch(/MAX_ROWS/)
  })

  it("returns a reason on failure, never the thrown object", () => {
    // A database error can quote the query back, and the query carries
    // whatever somebody pasted into the tool.
    expect(ROUTE).not.toMatch(/error:\s*String\(error\)/)
    expect(ROUTE).not.toMatch(/message:\s*\(error as Error\)\.message/)
  })
})

/* -------------------------------------------------------------------------- */
/*  What must never leave the module                                          */
/* -------------------------------------------------------------------------- */

describe("the comps module", () => {
  const RAW = readFileSync(path.join(process.cwd(), "lib", "outreach", "comps.ts"), "utf8")

  it("writes nothing", () => {
    // It reads the catalogue and our own order history to inform an offer.
    // Nothing about that should ever put a row anywhere.
    expect(RAW).not.toMatch(/\.insert\(/)
    expect(RAW).not.toMatch(/\.update\(/)
    expect(RAW).not.toMatch(/\.delete\(/)
    expect(RAW).not.toMatch(/upsertListings/)
  })

  it("uses the site's own sample floor rather than a number typed here", () => {
    expect(RAW).toMatch(/MIN_SAMPLE_SIZE/)
  })
})
