import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * OUR OWN SHOP IS NOT THE CATALOGUE, AND THE DISTANCE IS STRUCTURAL.
 *
 * Section 2 bans the Reverb API for building the catalogue and section 24
 * bans our own stock from the median that judges deals. This module sits on
 * the right side of both, and these assert it by reading the source rather
 * than by trusting the intention, which is the same technique
 * tests/impact-merchants.test.ts uses for the word "commission".
 */

const RAW = readFileSync(path.join(process.cwd(), "lib", "reverb", "shop.ts"), "utf8")

/* Assert on CODE, not on prose. The first version of this file failed on its
   own explanatory comments, which is a false positive that teaches people to
   loosen the assertion rather than fix the code. */
const SOURCE = RAW.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ")

describe("the shop reader cannot become an ingester", () => {
  it("never imports the database, the schema or the upsert path", () => {
    expect(SOURCE).not.toMatch(/from ["']@\/lib\/db/)
    expect(SOURCE).not.toMatch(/marketplace_listings|marketplaceListings/)
    expect(SOURCE).not.toMatch(/from ["']@\/lib\/ingestion/)
    expect(SOURCE).not.toMatch(/upsert/i)
  })

  it("writes nothing at all", () => {
    /* A read-only module has no insert, update or delete in it. If one ever
       appears, this is the shape of the mistake that put our own price inside
       the median we compute against it. */
    expect(SOURCE).not.toMatch(/\binsert\b|\bdelete\b|\bupdate\(/i)
  })
})

describe("the token never leaves the server", () => {
  it("is not echoed into a failure message", async () => {
    /* Failures record the path and the status and nothing else, because a
       body can quote the request back and the request carries the bearer. */
    expect(SOURCE).toMatch(/failures\.push/)
    expect(SOURCE).not.toMatch(/failures\.push\([^)]*token/)
    expect(SOURCE).not.toMatch(/console\.(log|error|warn)\([^)]*token/)
  })

  it("is not in any NEXT_PUBLIC variable", () => {
    expect(SOURCE).not.toMatch(/NEXT_PUBLIC/)
  })
})

describe("what the route publishes", () => {
  it("names every field it sends rather than spreading the API's response", async () => {
    /* A spread would silently republish whatever Reverb adds next, which is
       the same failure mode the stompbox projection test guards against. */
    expect(SOURCE).not.toMatch(/\.\.\.raw|\.\.\.listing|\.\.\.row/)
    for (const field of ["id", "title", "condition", "price", "currency", "photo", "url"]) {
      expect(SOURCE).toContain(`${field}:`)
    }
  })

  it("drops a row with no link or no title rather than half rendering it", () => {
    expect(SOURCE).toMatch(/if \(!url \|\| !title\) return null/)
  })
})

describe("cost is ours and never leaves the building", () => {
  it("is projected out of the published shape", () => {
    /* The route used to return the reader's rows straight through, which was
       fine while the two shapes were the same object and would have quietly
       published our margin the moment they were not. */
    const route = readFileSync(
      path.join(process.cwd(), "app", "api", "reverb", "shop", "route.ts"),
      "utf8",
    )
    expect(route).toMatch(/\.map\(toPublic\)/)
    expect(route).not.toMatch(/listings: result\.listings,/)
  })

  it("is absent from the public type", () => {
    /* PublicListing is a Pick, so a new private field cannot join it by
       accident: it has to be named to be published. */
    expect(SOURCE).toMatch(/export type PublicListing = Pick<[\s\S]{0,200}?>/)
    const pick = SOURCE.slice(SOURCE.indexOf("export type PublicListing"))
      .slice(0, 260)
    expect(pick).not.toMatch(/costCents/)
  })

  it("does arithmetic in cents rather than parsing display text", () => {
    /* A total built by parsing "$1,234.56" back out is a rounding bug waiting
       for the first four figure pedal. */
    expect(SOURCE).toMatch(/amount_cents/)
  })
})

describe("unset is a supported state", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("reports it rather than throwing", async () => {
    vi.stubEnv("REVERB_SHOP_TOKEN", "")
    vi.resetModules()
    const { fetchShopListings } = await import("@/lib/reverb/shop")
    const result = await fetchShopListings()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/not set/)
  })
})
