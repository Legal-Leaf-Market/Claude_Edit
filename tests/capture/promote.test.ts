import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { marketplaceListings, productCaptures } from "@/lib/db/schema"
import {
  PROMOTION_RULES,
  capturedExternalId,
  clearPromotedListings,
  promoteCaptures,
  promotionRule,
} from "@/lib/capture/promote"
import { SOURCES } from "@/lib/db/schema"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"
import type { CaptureResult } from "@/lib/capture/extract"

/**
 * PUBLISHING A CAPTURE IS THE STEP THAT CAN ACTUALLY GO WRONG.
 *
 * Everything upstream reads pages and files them away. This one puts rows in
 * front of shoppers, feeds the medians that decide which listings get a deal
 * badge, and hands `/go` destinations to follow. So the tests below are mostly
 * about what promotion REFUSES to do.
 */

async function truncate() {
  await db.execute(sql`TRUNCATE marketplace_listings, canonical_gear, product_captures CASCADE`)
}

function capture(products: Partial<CaptureResult["products"][number]>[]): CaptureResult {
  return {
    capturedAt: new Date().toISOString(),
    pageUrl: "https://www.andertons.co.uk/guitars",
    pageTitle: "Guitars",
    origin: "https://www.andertons.co.uk",
    platform: null,
    products: products.map((p) => ({
      via: "dom",
      title: "A pedal",
      brand: null,
      priceText: null,
      priceCents: 9900,
      currency: null,
      sku: null,
      gtin: null,
      mpn: null,
      availability: null,
      url: "https://www.andertons.co.uk/product/a-pedal",
      imageUrl: null,
      raw: {},
      ...p,
    })),
    coverage: { claimedTotal: null, nextPageUrl: null, pageLinks: [], looksLazyLoaded: false, notes: [] },
    bySource: { dom: products.length },
    diagnostics: {
      anchors: products.length,
      priceNodes: products.length,
      cardsResolved: products.length,
      rejectedMultiPrice: 0,
      rejectedNoProductSignal: 0,
      rejectedNoAnchor: 0,
      rejectedDuplicate: 0,
      jsonLdBlocks: 0,
      jsonLdTypes: [],
      unresolvedSamples: [],
      resolvedSamples: [],
      defences: [],
      challenged: false,
    },
  }
}

async function store(payload: CaptureResult, merchantKey = "andertons", capturedAt = new Date()) {
  await db.insert(productCaptures).values({
    merchantKey,
    origin: payload.origin,
    pageUrl: payload.pageUrl,
    pageTitle: payload.pageTitle,
    platform: null,
    build: "test",
    productCount: payload.products.length,
    claimedTotal: null,
    payload,
    capturedAt,
  })
}

beforeEach(truncate)
afterAll(truncate)

describe("the rules table itself", () => {
  it("only names sources the schema already knows", () => {
    /*
     * Gate 2. A capture of some shop nobody has decided about has nowhere to
     * go, structurally, because SOURCES is edited by hand.
     */
    for (const rule of PROMOTION_RULES) {
      expect(SOURCES, `${rule.merchantKey} promotes to an unknown source`).toContain(rule.source)
    }
  })

  it("records who decided and why, on every rule", () => {
    for (const rule of PROMOTION_RULES) {
      expect(rule.decidedOn, rule.merchantKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(rule.note.length, rule.merchantKey).toBeGreaterThan(80)
    }
  })

  it("gives every rule a shelf life", () => {
    /*
     * A capture cannot learn that something sold. Without an expiry a promoted
     * row sits on the site forever getting quietly wronger, which is the one
     * thing section 17 says must not happen.
     */
    for (const rule of PROMOTION_RULES) {
      expect(rule.staleAfterDays, rule.merchantKey).toBeGreaterThan(0)
      expect(rule.staleAfterDays, rule.merchantKey).toBeLessThanOrEqual(90)
    }
  })

  it("refuses a merchant with no rule, and says what a rule is for", async () => {
    await expect(promoteCaptures("guitarcenter")).rejects.toThrow(
      /says nothing about the right to republish/,
    )
    expect(promotionRule("guitarcenter")).toBeNull()
  })
})

describe("what gets written, and what does not", () => {
  it("previews without writing anything", async () => {
    await store(capture([{ title: "Boss DS-1", priceCents: 5900 }]))

    const outcome = await promoteCaptures("andertons")

    expect(outcome.dryRun).toBe(true)
    expect(outcome.candidates).toBe(1)
    expect(outcome.written).toBe(0)
    expect(outcome.sample[0].title).toBe("Boss DS-1")

    const [row] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(marketplaceListings)
    expect(row.n).toBe(0)
  })

  it("writes listings when told to commit", async () => {
    await store(capture([{ title: "Boss DS-1", priceCents: 5900 }]))

    const outcome = await promoteCaptures("andertons", { dryRun: false })
    expect(outcome.written).toBe(1)

    const rows = await db.select().from(marketplaceListings)
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe("andertons")
    expect(rows[0].priceCents).toBe(5900)
    expect(rows[0].currency).toBe("GBP")
    expect(rows[0].locationCountry).toBe("GB")
    /* A retailer's stock, so New. Section 8's asymmetry. */
    expect(rows[0].condition).toBe("New")
  })

  it("stores a null affiliate_url, because an Impact deep link cannot be built", async () => {
    /*
     * The honest outcome, not an oversight. Impact wants
     * /c/<publisherId>/<campaignId>/<adId> and a captured page carries none of
     * it. Section 5: a tracker that credits nobody is worse than a clean
     * direct link, so `/go` sends the shopper to Anderton's own page and we
     * earn nothing until the feed is connected.
     */
    await store(capture([{ title: "Boss DS-1" }]))
    await promoteCaptures("andertons", { dryRun: false })

    const [row] = await db.select().from(marketplaceListings)
    expect(row.affiliateUrl).toBeNull()
    expect(row.rawUrl).toContain("andertons.co.uk")
  })

  it("skips a row whose price did not parse rather than guessing one", async () => {
    await store(capture([{ title: "Priced on request", priceCents: null }]))

    const outcome = await promoteCaptures("andertons", { dryRun: false })
    expect(outcome.skippedNoPrice).toBe(1)
    expect(outcome.written).toBe(0)
  })

  it("drops a link that is not on the outbound allowlist, and names the host", async () => {
    /*
     * A retailer's category page carries sponsored placements and partner
     * links in markup that looks exactly like a product card. Promoting one
     * would put a stranger's URL in our catalogue under this merchant's name,
     * where `/go` would then refuse it and the listing would never work.
     */
    await store(
      capture([
        { title: "Real product", url: "https://www.andertons.co.uk/product/real" },
        { title: "Sponsored", url: "https://ads.example.com/product/sponsored" },
      ]),
    )

    const outcome = await promoteCaptures("andertons", { dryRun: false })

    expect(outcome.skippedOffSite).toBe(1)
    expect(outcome.written).toBe(1)
    expect(outcome.warnings.join(" ")).toContain("ads.example.com")
  })

  it("keys on the URL path, so re-capturing updates rather than duplicates", async () => {
    await store(capture([{ title: "Boss DS-1", priceCents: 5900 }]))
    await promoteCaptures("andertons", { dryRun: false })

    /* The same page again, cheaper, with a tracking parameter on the link. */
    await db.execute(sql`TRUNCATE product_captures`)
    await store(
      capture([
        {
          title: "Boss DS-1",
          priceCents: 4900,
          url: "https://www.andertons.co.uk/product/a-pedal?utm_source=x&sid=99",
        },
      ]),
    )
    const second = await promoteCaptures("andertons", { dryRun: false })

    expect(second.written).toBe(1)
    const rows = await db.select().from(marketplaceListings)
    expect(rows, "a tracking parameter made it look like new inventory").toHaveLength(1)
    expect(rows[0].priceCents).toBe(4900)
  })

  it("prefixes external ids so captured rows can be told apart and swept", () => {
    const id = capturedExternalId("https://www.andertons.co.uk/product/a-pedal?ref=1")
    expect(id).toBe("cap-www.andertons.co.uk/product/a-pedal")
  })
})

describe("the shelf life", () => {
  it("sets endsAt from when the page was seen, not from now", async () => {
    /*
     * Measured from the capture so that re-promoting an old capture does not
     * silently make stale data look fresh.
     */
    const seenAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    await store(capture([{ title: "Boss DS-1" }]), "andertons", seenAt)

    await promoteCaptures("andertons", { dryRun: false })
    const [row] = await db.select().from(marketplaceListings)

    const rule = promotionRule("andertons")!
    const expected = seenAt.getTime() + rule.staleAfterDays * 24 * 60 * 60 * 1000
    expect(Math.abs(new Date(row.endsAt!).getTime() - expected)).toBeLessThan(60_000)
  })

  it("expires a capture that is already past its shelf life", async () => {
    const longAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
    await store(capture([{ title: "Boss DS-1" }]), "andertons", longAgo)

    const outcome = await promoteCaptures("andertons", { dryRun: false })

    expect(outcome.expired).toBe(1)
    const [row] = await db.select().from(marketplaceListings)
    expect(row.listingStatus).toBe("expired")
  })
})

describe("making way for the real feed", () => {
  it("retires captured rows without deleting the prices they recorded", async () => {
    /*
     * The intended sequence when a feed starts working. Feed rows key on the
     * merchant's own product id and captured rows on the URL, so the two never
     * collide and the same product would sit in the catalogue twice, counted
     * twice in that model's median.
     */
    await store(capture([{ title: "Boss DS-1" }]))
    await promoteCaptures("andertons", { dryRun: false })

    const cleared = await clearPromotedListings("andertons")
    expect(cleared).toBe(1)

    const rows = await db.select().from(marketplaceListings)
    expect(rows, "cleared should retire, not delete").toHaveLength(1)
    expect(rows[0].listingStatus).toBe("expired")
  })

  it("warns when the source already has a working feed", async () => {
    await store(capture([{ title: "Boss DS-1" }]))
    const outcome = await promoteCaptures("andertons", { feedIsLive: true })
    expect(outcome.warnings.join(" ")).toMatch(/strictly the worse path/)
  })
})

describe("every promotable merchant can actually be reached", () => {
  it("has its own storefront on the outbound allowlist", async () => {
    /*
     * A promoted row whose host fails the allowlist is a listing that looks
     * fine and 502s at `/go` for every shopper who clicks it. Cheap to assert
     * here, invisible until somebody tries to buy something.
     */
    const hosts: Record<string, string> = {
      andertons: "https://www.andertons.co.uk/product/x",
      zzounds: "https://www.zzounds.com/item--x",
      musiciansfriend: "https://www.musiciansfriend.com/product/x",
    }
    for (const rule of PROMOTION_RULES) {
      const probe = hosts[rule.merchantKey]
      expect(probe, `no allowlist probe written for ${rule.merchantKey}`).toBeTruthy()
      expect(isAllowedDestination(probe), `${rule.merchantKey} would fail closed at /go`).toBe(true)
    }
  })
})
