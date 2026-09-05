import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * AN ORDER IS A TRANSACTION WITH A PERSON ON THE OTHER END OF IT.
 *
 * The listings reader publishes a public projection because a listing is
 * already public. An order is not: it carries a buyer, an address and a
 * payment, and none of that is any of this site's business. So the rules here
 * are stricter than shop.ts's, and they are asserted rather than intended.
 */

const RAW = readFileSync(path.join(process.cwd(), "lib", "reverb", "orders.ts"), "utf8")
/* Assert on CODE, not on prose. */
const SOURCE = RAW.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ")
const ROUTE = readFileSync(
  path.join(process.cwd(), "app", "api", "reverb", "orders", "route.ts"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, " ")

describe("no buyer ever comes out of this", () => {
  it("normalises money and a listing id, and nothing about a person", () => {
    for (const field of ["buyer", "address", "email", "phone", "payment", "name"]) {
      expect(SOURCE, `${field} must not be normalised out of an order`).not.toMatch(
        new RegExp(`\\b${field}\\w*\\s*:`, "i"),
      )
    }
  })

  it("is admin gated with no public half", () => {
    expect(ROUTE).toMatch(/isAdmin\(\)/)
    expect(ROUTE).toMatch(/status: 404/)
    /* Never cached by a shared cache: this is one account's private trading. */
    expect(ROUTE).toMatch(/private, no-store/)
    expect(ROUTE).not.toMatch(/s-maxage/)
  })
})

describe("it writes nothing and reaches no catalogue", () => {
  it("holds no database import and no upsert", () => {
    expect(SOURCE).not.toMatch(/from ["']@\/lib\/db/)
    expect(SOURCE).not.toMatch(/marketplace_listings|marketplaceListings/)
    expect(SOURCE).not.toMatch(/upsert|\binsert\b/i)
  })
})

describe("the token stays server side", () => {
  it("is never echoed into a failure", () => {
    expect(SOURCE).toMatch(/failures\.push/)
    expect(SOURCE).not.toMatch(/failures\.push\([^)]*token/)
    expect(SOURCE).not.toMatch(/NEXT_PUBLIC/)
  })
})

describe("money is read in cents and never guessed at", () => {
  it("prefers amount_cents over parsing a display string", () => {
    expect(SOURCE).toMatch(/amount_cents/)
  })

  it("tries named alternatives rather than one key", () => {
    /* Reverb's order payload has changed shape over the years, and the wrong
       single key reads as a sale of nothing rather than as a missing field. */
    expect(SOURCE).toMatch(/amount_product/)
    expect(SOURCE).toMatch(/pick\(raw, \[/)
  })

  it("derives a discount only when the listed price is actually higher", () => {
    expect(SOURCE).toMatch(/listed > sold \? listed - sold : null/)
  })
})

describe("the page tells 'not connected' apart from 'nothing sold'", () => {
  it("says which, rather than showing an empty table for both", () => {
    /* An empty sold table under a heading reads as a month with no sales,
       which is a very different thing from an endpoint nobody has bound. */
    const page = readFileSync(
      path.join(process.cwd(), "app", "admin", "inventory", "page.tsx"),
      "utf8",
    )
    expect(page).toContain("The orders endpoint has not answered yet")
    expect(page).toContain("Nothing sold yet.")
  })
})
