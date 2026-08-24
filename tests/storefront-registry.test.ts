import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"
import { storeCartConfig } from "@/lib/cart/stores"
import { SOURCES } from "@/lib/db/schema"
import {
  STOREFRONT_MERCHANTS,
  isStorefrontSource,
  scheduledStorefrontMerchants,
  storefrontMerchant,
} from "@/lib/storefronts"
import { ingestStorefront } from "@/lib/ingestion/storefront-merchants"
import { sourceLabel } from "@/lib/utils"

/**
 * WHAT A MERCHANT ROW HAS TO BE TRUE ABOUT.
 *
 * There were twelve near-identical modules and a store threaded through
 * sixteen files. Every one of those sixteen was a chance to add a store and
 * forget a line, and the failures were all silent in the same way: the store
 * ingests, and then one thing about it is quietly wrong. A missing host on the
 * allowlist fails every /go for that shop closed, which reads as a broken shop
 * rather than a missing config line. A missing cron entry means the store is
 * simply never refreshed, and a stale price is the one thing section 17 says we
 * must not show.
 *
 * The registry removed most of those chances. These tests hold the rest.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url))

describe("every storefront row is complete", () => {
  it("finds the merchants, so an empty registry cannot pass silently", () => {
    expect(STOREFRONT_MERCHANTS.length).toBeGreaterThanOrEqual(12)
  })

  it("uses a source the schema actually knows", () => {
    for (const merchant of STOREFRONT_MERCHANTS) {
      expect(SOURCES, `${merchant.source} is not in SOURCES`).toContain(merchant.source)
    }
  })

  it("has a base URL that is an https origin with no trailing slash", () => {
    for (const merchant of STOREFRONT_MERCHANTS) {
      expect(merchant.baseUrl).toMatch(/^https:\/\/[^/]+$/)
    }
  })

  it("gives every source exactly one row", () => {
    const sources = STOREFRONT_MERCHANTS.map((m) => m.source)
    expect(new Set(sources).size).toBe(sources.length)
  })

  it("records why we are allowed to read it, and when somebody checked", () => {
    /*
     * The point of `permission` is that it is written down. A row whose note
     * is a placeholder is worse than no field at all, because it looks like
     * somebody checked.
     */
    for (const merchant of STOREFRONT_MERCHANTS) {
      expect(merchant.permission.checkedOn, merchant.source).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(merchant.permission.note.length, merchant.source).toBeGreaterThan(60)
    }
  })

  it("keeps `explicit-decision` to the one store it was decided for", () => {
    /*
     * Squaver has no agents.md and its WooCommerce Store API is open because
     * it backs the platform's own checkout blocks, which is the same shape
     * rejected for Guitar Center. The owner made that call for one store. A
     * second row on this basis has to be a deliberate edit to this list with
     * somebody's reasoning attached, not something that arrives by copying a
     * row.
     */
    const weak = STOREFRONT_MERCHANTS.filter((m) => m.permission.basis === "explicit-decision")
    expect(weak.map((m) => m.source)).toEqual(["squaver"])
  })

  it("says why a paused store is paused", () => {
    for (const merchant of STOREFRONT_MERCHANTS) {
      if (merchant.schedule === null) {
        expect(merchant.pausedReason, `${merchant.source} is paused with no reason`).toBeTruthy()
      }
    }
  })
})

describe("a storefront's host clears the outbound allowlist", () => {
  /*
   * DERIVED, so this is really a test of the derivation. It earns its keep
   * anyway: the old hand-written list had `acousticguitar.com` for a store
   * that actually lives on `store.acousticguitar.com`, and nothing would have
   * told you if the pattern had been wrong in the other direction.
   */
  it("allows a product URL at every merchant", () => {
    for (const merchant of STOREFRONT_MERCHANTS) {
      expect(
        isAllowedDestination(`${merchant.baseUrl}/products/some-pedal`),
        `${merchant.source}: /go would fail closed on its own listings`,
      ).toBe(true)
    }
  })

  it("still refuses a lookalike host that merely ends with the same text", () => {
    expect(isAllowedDestination("https://folkcraft.com.phish.example/products/x")).toBe(false)
    expect(isAllowedDestination("https://notfolkcraft.com/products/x")).toBe(false)
  })
})

describe("the schedule in the registry and the schedule Vercel runs", () => {
  const vercel = JSON.parse(readFileSync(new URL("vercel.json", `file://${ROOT}`), "utf-8")) as {
    crons: { path: string; schedule: string }[]
  }
  const cronFor = (source: string) =>
    vercel.crons.find((c) => c.path === `/api/cron/ingest-storefront/${source}`)

  it("gives every scheduled merchant a cron entry, at the pattern its row states", () => {
    /*
     * Two places holding one fact, which is exactly the drift this whole
     * refactor is about. They cannot be one place: vercel.json is read by
     * Vercel at deploy time and cannot call a function. So they are compared
     * instead.
     */
    for (const merchant of scheduledStorefrontMerchants()) {
      const cron = cronFor(merchant.source)
      expect(cron, `${merchant.source} is scheduled in the registry but has no cron entry`).toBeTruthy()
      expect(cron?.schedule, merchant.source).toBe(merchant.schedule)
    }
  })

  it("gives a paused merchant no cron entry", () => {
    for (const merchant of STOREFRONT_MERCHANTS) {
      if (merchant.schedule !== null) continue
      expect(
        cronFor(merchant.source),
        `${merchant.source} is paused but Vercel would still run it`,
      ).toBeUndefined()
    }
  })

  it("has no cron entry pointing at a storefront that is not in the registry", () => {
    const orphans = vercel.crons
      .filter((c) => c.path.startsWith("/api/cron/ingest-storefront/"))
      .map((c) => c.path.split("/").pop() as string)
      .filter((source) => !isStorefrontSource(source))
    expect(orphans).toEqual([])
  })
})

describe("what reads the registry instead of restating it", () => {
  it("labels a source from its row", () => {
    expect(sourceLabel("folkcraft")).toBe("Folkcraft Instruments")
    expect(sourceLabel("gokalimba")).toBe("Go Kalimba")
    /* Non-storefront sources keep their own labels. */
    expect(sourceLabel("ebay")).toBe("eBay")
    expect(sourceLabel("andertons")).toBe("Andertons Music Company")
  })

  it("builds a cart config from the same base URL the ingester uses", () => {
    /*
     * The failure this prevents is a shopper landing at a cart permalink on
     * the wrong shop, which throws nothing: the cart is simply empty.
     */
    for (const merchant of STOREFRONT_MERCHANTS) {
      const cart = storeCartConfig(merchant.source)
      expect(cart.platform, merchant.source).toBe(merchant.platform)
      expect(cart.baseUrl, merchant.source).toBe(merchant.baseUrl)
    }
  })

  it("reports no prefillable cart for a source that is not a storefront", () => {
    expect(storeCartConfig("ebay")).toEqual({ platform: "none", baseUrl: "" })
    expect(storeCartConfig("andertons")).toEqual({ platform: "none", baseUrl: "" })
  })

  it("carries a WooCommerce store's cart path and leaves Shopify's alone", () => {
    expect(storeCartConfig("squaver").cartPath).toBe("/cart/")
    expect(storeCartConfig("folkcraft").cartPath).toBeUndefined()
  })
})

describe("payout does not decide whether a store is read", () => {
  /*
   * THE RULE THIS HOLDS is section 17: "Whether a merchant pays us is not a
   * reason to delist them... payout is not an input to that decision."
   *
   * The old per-store modules each warned about a missing referral code and
   * then ingested anyway, which was right, but it was right twelve times over
   * and nothing held it there. One `return` added to the wrong copy would have
   * turned the catalogue into the subset of the world that pays us, and the
   * only visible symptom would have been a store quietly having no listings.
   */
  it("ingests a store with no referral code configured", async () => {
    const merchant = {
      ...STOREFRONT_MERCHANTS[0],
      source: "folkcraft" as const,
      referral: () => ({ refParam: undefined, refCode: undefined }),
    }

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ products: [] }), { status: 200 }))

    await ingestStorefront(merchant, fetchImpl as unknown as typeof fetch)

    expect(fetchImpl, "an unmonetised store was skipped rather than ingested").toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("null affiliate_url"))

    warn.mockRestore()
  })

  it("looks a merchant up by source, and returns null for anything else", () => {
    expect(storefrontMerchant("folkcraft")?.label).toBe("Folkcraft Instruments")
    expect(storefrontMerchant("ebay")).toBeNull()
    expect(isStorefrontSource("squaver")).toBe(true)
    expect(isStorefrontSource("fender")).toBe(false)
  })
})
