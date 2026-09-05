import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { OUTREACH_DATA } from "@/lib/outreach/data"

/**
 * THIS REPOSITORY IS PUBLIC, AND WHAT IS IN IT WAS A DECISION.
 *
 * Seller names and Marketplace profile links are committed on purpose: the
 * point of the exercise is repeat business, and a seller you cannot reach
 * twice is a seller you meet cold every time. Every link is
 * marketplace-scoped rather than a personal timeline.
 *
 * The descriptions are still dropped, and that is not a contradiction. They
 * are not needed, because the pedal matching happens before the data lands
 * here, and they are the one field where a phone number or an address would
 * hide. This file was clean; the next export might not be.
 *
 * So the scrub is asserted rather than intended. If a future export is dropped
 * in without going through the same step, this fails.
 */
const RAW = readFileSync(path.join(process.cwd(), "lib", "outreach", "data.ts"), "utf8")
/* Assert on DATA, not on the comment that explains the rule. */
const DATA = RAW.slice(RAW.indexOf("export const OUTREACH_DATA"))

describe("no personal data is committed", () => {
  it("keeps profile links marketplace-scoped, never a personal timeline", () => {
    /* A Marketplace profile is a shop front. facebook.com/<username> is not,
       and would be a different thing to publish. */
    for (const row of OUTREACH_DATA.rows) {
      if (!row.profile) continue
      expect(row.profile, `not a marketplace profile: ${row.profile}`).toMatch(
        /^https:\/\/(www\.)?facebook\.com\/marketplace\/profile\/\d+\/?$/,
      )
    }
  })

  it("carries no free-text descriptions", () => {
    /* The pedal matching happens before the data lands here, so the raw text
       is not needed at runtime and is the likeliest place for a phone number
       or an address to hide. */
    for (const row of OUTREACH_DATA.rows) {
      expect(Object.keys(row)).not.toContain("description")
    }
  })

  it("has no phone number or email in any title or seller name", () => {
    for (const row of OUTREACH_DATA.rows) {
      for (const [field, value] of [["title", row.t], ["seller", row.seller]] as const) {
        expect(value, `phone-shaped text in ${field}: ${value}`).not.toMatch(
          /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
        )
        expect(value, `email in ${field}: ${value}`).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
      }
    }
  })

  it("keeps only the fields the page actually reads", () => {
    const allowed = new Set([
      "t", "seller", "profile", "ask", "real", "book",
      "named", "nP", "loc", "days", "photos", "url",
    ])
    for (const row of OUTREACH_DATA.rows) {
      for (const key of Object.keys(row)) {
        expect(allowed.has(key), `unexpected field "${key}" in the committed data`).toBe(true)
      }
    }
  })
})

describe("the page is gated", () => {
  it("redirects anybody without the passcode", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app", "admin", "outreach", "review", "page.tsx"),
      "utf8",
    )
    expect(page).toMatch(/if \(!\(await isAdmin\(\)\)\)/)
    expect(page).toMatch(/admin\/sign-in/)
  })
})

describe("the numbers are floors, and the page says which", () => {
  it("never counts a pedal it could not price", () => {
    for (const row of OUTREACH_DATA.rows) {
      expect(row.nP).toBeLessThanOrEqual(row.named.length)
      if (row.nP === 0) expect(row.book).toBe(0)
    }
  })

  it("states the missing outcome column rather than implying conversion", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app", "admin", "outreach", "review", "page.tsx"),
      "utf8",
    )
    expect(page).toContain("There is no outcome column")
  })
})
