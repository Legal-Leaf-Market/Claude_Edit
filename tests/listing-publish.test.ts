import { readFileSync } from "node:fs"
import path from "node:path"
import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { closeDb, db } from "@/lib/db"
import { listingDrafts, listingPublications, type ListingDraft } from "@/lib/db/schema"
import { readinessFor } from "@/lib/listing/readiness"

/**
 * Two failures here cost real money and nothing else does:
 *
 *   Pushing twice puts two listings of ONE physical pedal on one marketplace.
 *   Selling on one channel and leaving the other live oversells it.
 *
 * Everything below is about those two.
 */

const reverbPublish = vi.fn(async () => ({
  ok: true as const, externalId: "rvb-1", externalUrl: "https://reverb.com/item/x",
}))
const reverbEnd = vi.fn(async () => ({ ok: true as const, externalId: "rvb-1", externalUrl: null }))
const ebayPublish = vi.fn(async () => ({
  ok: true as const, externalId: "offer-1", externalUrl: "https://www.ebay.com/itm/1",
}))
const ebayEnd = vi.fn(async () => ({ ok: true as const, externalId: "offer-1", externalUrl: null }))

vi.mock("@/lib/listing/channels/reverb", () => ({
  publishToReverb: (...a: unknown[]) => reverbPublish(...(a as [])),
  endOnReverb: (...a: unknown[]) => reverbEnd(...(a as [])),
}))
vi.mock("@/lib/listing/channels/ebay", () => ({
  publishToEbay: (...a: unknown[]) => ebayPublish(...(a as [])),
  endOnEbay: (...a: unknown[]) => ebayEnd(...(a as [])),
}))

const { publishDraft, endEverywhereExcept } = await import("@/lib/listing/publish")

async function truncate() {
  await db.execute(sql`TRUNCATE listing_publications, listing_drafts RESTART IDENTITY CASCADE`)
}

/** A unit that every channel would accept. */
async function seedDraft(overrides: Record<string, unknown> = {}): Promise<ListingDraft> {
  const rows = await db
    .insert(listingDrafts)
    .values({
      sku: "GA-0001",
      title: "Boss DS-1 Distortion",
      brand: "Boss",
      model: "DS-1",
      description: "A clean example, tested and working.",
      condition: "Excellent",
      photos: ["https://example.test/1.jpg"],
      priceCents: 6_500,
      costCents: 3_000,
      shippingCents: 900,
      channelMeta: {
        reverb: { categoryUuid: "cat-uuid", conditionUuid: "cond-uuid" },
        ebay: {
          categoryId: "41430",
          conditionId: "3000",
          merchantLocationKey: "home",
          fulfillmentPolicyId: "f1",
          paymentPolicyId: "p1",
          returnPolicyId: "r1",
        },
      },
      ...overrides,
    } as typeof listingDrafts.$inferInsert)
    .returning()
  return rows[0]
}

beforeEach(async () => {
  await truncate()
  reverbPublish.mockClear()
  reverbEnd.mockClear()
  ebayPublish.mockClear()
  ebayEnd.mockClear()
})

describe("pushing a unit to a channel", () => {
  it("publishes once and records where it went", async () => {
    const draft = await seedDraft()
    const outcome = await publishDraft(draft, "reverb")
    expect(outcome.status).toBe("published")
    expect(reverbPublish).toHaveBeenCalledTimes(1)

    const [pub] = await db.select().from(listingPublications)
    expect(pub.state).toBe("published")
    expect(pub.externalId).toBe("rvb-1")
    expect(pub.externalUrl).toContain("reverb.com")
  })

  it("REFUSES A SECOND PUSH, which is the expensive mistake", async () => {
    // Two listings of one physical pedal on one marketplace. The button is
    // disabled in the UI as well, but a disabled button is not a guarantee.
    const draft = await seedDraft()
    await publishDraft(draft, "reverb")
    const again = await publishDraft(draft, "reverb")

    expect(again.status).toBe("already")
    expect(reverbPublish).toHaveBeenCalledTimes(1)
    const all = await db.select().from(listingPublications)
    expect(all).toHaveLength(1)
  })

  it("keeps the two channels independent", async () => {
    const draft = await seedDraft()
    await publishDraft(draft, "reverb")
    await publishDraft(draft, "ebay")
    const all = await db.select().from(listingPublications)
    expect(all.map((p) => p.channel).sort()).toEqual(["ebay", "reverb"])
  })

  it("moves the draft to listed once it is live anywhere", async () => {
    const draft = await seedDraft()
    expect(draft.status).toBe("draft")
    await publishDraft(draft, "reverb")
    const [after] = await db.select().from(listingDrafts)
    expect(after.status).toBe("listed")
  })

  it("refuses before sending when the channel would reject it", async () => {
    // Our words, before the request, rather than eBay's error code after it.
    const draft = await seedDraft({ priceCents: null, photos: [] })
    const outcome = await publishDraft(draft, "ebay")
    expect(outcome.status).toBe("not-ready")
    expect(ebayPublish).not.toHaveBeenCalled()
    if (outcome.status === "not-ready") {
      expect(outcome.missing).toContain("a price")
      expect(outcome.missing).toContain("at least one photo")
    }
  })

  it("records a failure with its reason instead of losing it", async () => {
    reverbPublish.mockResolvedValueOnce({ ok: false, reason: "Reverb answered 422" } as never)
    const draft = await seedDraft()
    const outcome = await publishDraft(draft, "reverb")
    expect(outcome.status).toBe("failed")
    const [pub] = await db.select().from(listingPublications)
    expect(pub.state).toBe("failed")
    expect(pub.error).toContain("422")
  })

  it("lets a failed push be retried", async () => {
    reverbPublish.mockResolvedValueOnce({ ok: false, reason: "network" } as never)
    const draft = await seedDraft()
    await publishDraft(draft, "reverb")
    const retry = await publishDraft(draft, "reverb")
    expect(retry.status).toBe("published")
  })
})

describe("it sold somewhere", () => {
  it("ends every other channel and leaves the one it sold on", async () => {
    const draft = await seedDraft()
    await publishDraft(draft, "reverb")
    await publishDraft(draft, "ebay")

    const result = await endEverywhereExcept(draft.id, "ebay")

    expect(reverbEnd).toHaveBeenCalledTimes(1)
    expect(ebayEnd).not.toHaveBeenCalled()
    expect(result.ended).toEqual([{ channel: "reverb", ok: true }])

    const rows = await db.select().from(listingPublications)
    expect(rows.find((r) => r.channel === "reverb")!.state).toBe("ended")
    expect(rows.find((r) => r.channel === "ebay")!.state).toBe("published")
  })

  it("marks the unit sold", async () => {
    const draft = await seedDraft()
    await publishDraft(draft, "reverb")
    await endEverywhereExcept(draft.id, "reverb")
    const [after] = await db.select().from(listingDrafts)
    expect(after.status).toBe("sold")
  })

  it("LEAVES A FAILED TAKEDOWN MARKED LIVE, because it still is", async () => {
    // The dangerous version of this records it as ended anyway and the tool
    // then says everything is fine while the listing is still buyable.
    reverbEnd.mockResolvedValueOnce({ ok: false, reason: "Reverb answered 500" } as never)
    const draft = await seedDraft()
    await publishDraft(draft, "reverb")
    await publishDraft(draft, "ebay")

    const result = await endEverywhereExcept(draft.id, "ebay")

    expect(result.ended[0].ok).toBe(false)
    const rows = await db.select().from(listingPublications)
    const reverbRow = rows.find((r) => r.channel === "reverb")!
    expect(reverbRow.state).toBe("published")
    expect(reverbRow.error).toContain("500")
  })
})

describe("readiness", () => {
  it("names what each channel is still missing, in our own words", async () => {
    const draft = await seedDraft({ channelMeta: {}, brand: null })
    const reverb = readinessFor(draft, "reverb")
    const ebay = readinessFor(draft, "ebay")
    expect(reverb.ready).toBe(false)
    expect(ebay.ready).toBe(false)
    expect(reverb.missing.join(" ")).toContain("Reverb category")
    expect(ebay.missing.join(" ")).toContain("eBay category id")
    // The three business policies are the ones eBay reports worst.
    expect(ebay.missing.join(" ")).toContain("payment policy")
    expect(ebay.missing.join(" ")).toContain("return policy")
  })

  it("passes a complete unit", async () => {
    const draft = await seedDraft()
    expect(readinessFor(draft, "reverb").ready).toBe(true)
    expect(readinessFor(draft, "ebay").ready).toBe(true)
  })
})

describe("our own stock stays out of the aggregator", () => {
  const FILES = [
    "lib/listing/publish.ts",
    "lib/listing/channels/reverb.ts",
    "lib/listing/channels/ebay.ts",
  ]

  it("never writes a marketplace listing, a canonical row or a median", () => {
    // Section 24's first guarantee. Our units inside the median would mean
    // setting a price and also computing the market price that judges it.
    for (const file of FILES) {
      const raw = readFileSync(path.join(process.cwd(), file), "utf8")
      expect(raw, `${file} reaches the catalogue`).not.toMatch(/marketplaceListings|canonicalGear/)
      expect(raw, `${file} reprices`).not.toMatch(/recomputeMarketPrice|resolveAndReprice|upsertListings/)
    }
  })

  it("keeps the selling credentials apart from the buy feed's", () => {
    // A token minted for one will not work on the other, and the failure reads
    // like a bad credential rather than a wrong scope.
    const ebay = readFileSync(path.join(process.cwd(), "lib/listing/channels/ebay.ts"), "utf8")
    expect(ebay).toMatch(/env\.ebaySell/)
    expect(ebay).not.toMatch(/env\.ebay\./)
  })

  it("defaults eBay selling to the sandbox", () => {
    const envRaw = readFileSync(path.join(process.cwd(), "lib/env.ts"), "utf8")
    expect(envRaw).toMatch(/EBAY_SELL_API_ORIGIN", EBAY_SANDBOX_ORIGIN/)
  })

  it("never sends our cost to a marketplace", () => {
    for (const file of ["lib/listing/channels/reverb.ts", "lib/listing/channels/ebay.ts"]) {
      const raw = readFileSync(path.join(process.cwd(), file), "utf8")
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
      expect(code, `${file} sends cost`).not.toMatch(/costCents|offerFloorCents/)
    }
  })
})

afterAll(async () => {
  await closeDb()
})
