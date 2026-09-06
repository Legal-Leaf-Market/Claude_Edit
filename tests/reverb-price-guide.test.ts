import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * The price guide is the one place the Reverb API is asked about gear that is
 * not ours, so what keeps it inside section 2 is a boundary rather than an
 * intention. These assert the boundary.
 */

const RAW = readFileSync(path.join(process.cwd(), "lib", "reverb", "price-guide.ts"), "utf8")
const COMPS = readFileSync(path.join(process.cwd(), "lib", "outreach", "comps.ts"), "utf8")
const ENV = readFileSync(path.join(process.cwd(), "lib", "env.ts"), "utf8")

describe("the price guide reader", () => {
  it("is off unless somebody switched it on", () => {
    // The decision belongs to the owner and has to be withdrawable in one
    // environment variable, without a deploy.
    expect(ENV).toMatch(/priceGuide:\s*bool\("REVERB_PRICE_GUIDE",\s*false\)/)
    expect(RAW).toMatch(/env\.reverbShop\.priceGuide/)
    expect(RAW).toMatch(/REVERB_PRICE_GUIDE is not set/)
  })

  it("needs its own switch AND the shop token, not either one", () => {
    expect(ENV).toMatch(/hasPriceGuide/)
    expect(RAW).toMatch(/REVERB_SHOP_TOKEN is not set/)
  })

  it("touches no database at all", () => {
    // This is the property that keeps it apart from ingestion, and it is
    // structural: the module cannot write because it cannot reach a table.
    expect(RAW).not.toMatch(/@\/lib\/db/)
    expect(RAW).not.toMatch(/drizzle/)
    expect(RAW).not.toMatch(/marketplaceListings|canonicalGear/)
    expect(RAW).not.toMatch(/\.insert\(|\.update\(|\.delete\(/)
  })

  it("never quotes a failing response body back", () => {
    // A body can echo the request, and the request carries the bearer token.
    expect(RAW).toMatch(/res\.status/)
    expect(RAW).not.toMatch(/await res\.text\(\)/)
  })

  it("binds money by named alternatives rather than one guess", () => {
    // The shop reader shipped a wrong price field once by guessing. A price
    // bound wrong here becomes an offer made to a real person.
    expect(RAW).toMatch(/price_low/)
    expect(RAW).toMatch(/price_high/)
    expect(RAW).toMatch(/amount_cents/)
  })

  it("is only ever imported by the admin-gated comps lookup", () => {
    // If a second importer appears, this is the test that should fail first.
    // Matched on the import statement rather than the mention, since the
    // module is named in prose in more than one place on purpose.
    const root = process.cwd()
    const importers: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next" || entry === ".git") continue
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.tsx?$/.test(entry) || full.endsWith("price-guide.ts")) continue
        const text = readFileSync(full, "utf8")
        if (/from\s+["'](@\/lib\/reverb\/price-guide|\.\/price-guide)["']/.test(text)) {
          importers.push(path.relative(root, full))
        }
      }
    }
    for (const dir of ["app", "lib", "components", "scripts"]) walk(path.join(root, dir))
    expect(importers.sort()).toEqual(["lib/outreach/comps.ts"])
  })
})

describe("where the price guide ranks", () => {
  it("sits below our own sales and above the catalogue's asking prices", () => {
    const ourSales = COMPS.indexOf('source: "our-sales"')
    const guide = COMPS.indexOf('source: "price-guide"')
    const catalogue = COMPS.indexOf('source: "catalogue-used"')
    expect(ourSales).toBeGreaterThan(-1)
    expect(guide).toBeGreaterThan(ourSales)
    expect(catalogue).toBeGreaterThan(guide)
  })

  it("still refuses everything it cannot support", () => {
    // Adding a source must not have added a way around the floor.
    expect(COMPS).toMatch(/MIN_SAMPLE_SIZE/)
    expect(COMPS).toMatch(/Price it by hand/)
  })
})
