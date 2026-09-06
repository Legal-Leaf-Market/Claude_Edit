import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { closeDb, db } from "@/lib/db"
import { listingDrafts, listingPublications } from "@/lib/db/schema"
import type { ShopListing } from "@/lib/reverb/shop"

/**
 * Importing the live shop is the one operation that can create a duplicate
 * listing of a pedal that is already for sale, so that is what this is about.
 */

const fetchShopListings = vi.fn()
vi.mock("@/lib/reverb/shop", () => ({
  fetchShopListings: (...a: unknown[]) => fetchShopListings(...(a as [])),
}))

const { importReverbShop, skuFor } = await import("@/lib/listing/import-reverb")

function shopListing(overrides: Partial<ShopListing> = {}): ShopListing {
  return {
    id: "12345",
    title: "Boss DS-1 Distortion",
    condition: "Excellent",
    price: "$65.00",
    priceCents: 6_500,
    currency: "USD",
    photo: "https://rvb.test/1.jpg",
    url: "https://reverb.com/item/12345-boss-ds-1",
    costCents: 3_000,
    state: "live",
    sku: null,
    description: "Clean example, tested.",
    make: "Boss",
    model: "DS-1",
    photos: ["https://rvb.test/1.jpg", "https://rvb.test/2.jpg"],
    year: "1994",
    finish: "Orange",
    offersEnabled: true,
    shippingCents: 900,
    ...overrides,
  }
}

async function truncate() {
  await db.execute(sql`TRUNCATE listing_publications, listing_drafts RESTART IDENTITY CASCADE`)
}

beforeEach(async () => {
  await truncate()
  fetchShopListings.mockReset()
})

describe("importing the live Reverb shop", () => {
  it("creates one master record per live listing, with the cost", async () => {
    fetchShopListings.mockResolvedValue({ ok: true, listings: [shopListing()], source: "/api/my/listings" })
    const result = await importReverbShop()

    expect(result).toMatchObject({ ok: true, created: 1, skipped: 0 })
    const [draft] = await db.select().from(listingDrafts)
    expect(draft.title).toBe("Boss DS-1 Distortion")
    expect(draft.brand).toBe("Boss")
    expect(draft.model).toBe("DS-1")
    expect(draft.priceCents).toBe(6_500)
    expect(draft.costCents).toBe(3_000)
    expect(draft.description).toContain("Clean example")
    expect(draft.photos).toEqual(["https://rvb.test/1.jpg", "https://rvb.test/2.jpg"])
    expect(draft.status).toBe("listed")
  })

  it("MARKS IT ALREADY LIVE ON REVERB, which is the whole point", async () => {
    // Without this the page would show a working "Push to Reverb" button for a
    // pedal that is already for sale there, and pressing it would list it twice.
    fetchShopListings.mockResolvedValue({ ok: true, listings: [shopListing()], source: "x" })
    await importReverbShop()

    const [pub] = await db.select().from(listingPublications)
    expect(pub.channel).toBe("reverb")
    expect(pub.state).toBe("published")
    expect(pub.externalId).toBe("12345")
    expect(pub.externalUrl).toBe("https://reverb.com/item/12345-boss-ds-1")
    expect(pub.publishedAt).toBeTruthy()
  })

  it("refuses to push an imported unit back to Reverb", async () => {
    // The guard and the import, working together, end to end.
    const { publishDraft } = await import("@/lib/listing/publish")
    fetchShopListings.mockResolvedValue({ ok: true, listings: [shopListing()], source: "x" })
    await importReverbShop()
    const [draft] = await db.select().from(listingDrafts)

    const outcome = await publishDraft(draft, "reverb")
    expect(outcome.status).toBe("already")
  })

  it("is safe to run twice", async () => {
    fetchShopListings.mockResolvedValue({ ok: true, listings: [shopListing()], source: "x" })
    await importReverbShop()
    const second = await importReverbShop()

    expect(second).toMatchObject({ ok: true, created: 0, skipped: 1 })
    expect(await db.select().from(listingDrafts)).toHaveLength(1)
    expect(await db.select().from(listingPublications)).toHaveLength(1)
  })

  it("does not overwrite an edit made here", async () => {
    // Reverb is downstream of the master record now. Refreshing fields on
    // every run would silently undo a description rewritten for eBay.
    fetchShopListings.mockResolvedValue({ ok: true, listings: [shopListing()], source: "x" })
    await importReverbShop()
    await db.update(listingDrafts).set({ description: "Rewritten by hand." })

    await importReverbShop()
    const [draft] = await db.select().from(listingDrafts)
    expect(draft.description).toBe("Rewritten by hand.")
  })

  it("uses Reverb's SKU when there is one, and a stable derived one when not", () => {
    expect(skuFor(shopListing({ sku: "GA-0042" }))).toBe("GA-0042")
    expect(skuFor(shopListing({ sku: null }))).toBe("RVB-12345")
  })

  it("recognises a unit already created by hand under the same SKU", async () => {
    await db.insert(listingDrafts).values({ sku: "RVB-12345", title: "Typed by hand" })
    fetchShopListings.mockResolvedValue({ ok: true, listings: [shopListing()], source: "x" })

    const result = await importReverbShop()
    expect(result).toMatchObject({ created: 0, skipped: 1 })
    expect(await db.select().from(listingDrafts)).toHaveLength(1)
  })

  it("keeps going when one listing cannot be written", async () => {
    // One bad row must not abandon the other eight.
    fetchShopListings.mockResolvedValue({
      ok: true,
      listings: [shopListing({ id: "1", sku: "DUP" }), shopListing({ id: "2", sku: "DUP" }), shopListing({ id: "3", sku: "OK" })],
      source: "x",
    })
    const result = await importReverbShop()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(2)
      expect(result.problems).toHaveLength(1)
    }
  })

  it("reports a shop that did not answer, rather than importing nothing quietly", async () => {
    fetchShopListings.mockResolvedValue({ ok: false, reason: "REVERB_SHOP_TOKEN is not set" })
    const result = await importReverbShop()
    expect(result).toEqual({ ok: false, reason: "REVERB_SHOP_TOKEN is not set" })
  })

  it("never puts our own stock in the catalogue", async () => {
    const { readFileSync } = await import("node:fs")
    const path = await import("node:path")
    const raw = readFileSync(path.join(process.cwd(), "lib/listing/import-reverb.ts"), "utf8")
    expect(raw).not.toMatch(/marketplaceListings|canonicalGear|upsertListings/)
  })
})

afterAll(async () => {
  await closeDb()
})
