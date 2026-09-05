import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { OUTREACH_DATA } from "@/lib/outreach/data"

/**
 * THIS REPOSITORY IS PUBLIC.
 *
 * The source export carried 103 real people: names, Facebook profile links,
 * and free-text descriptions where phone numbers and addresses turn up.
 * Password protecting the page and publishing the repository are different
 * acts, and a gate in front of a route does nothing about a file anybody can
 * read on github.com.
 *
 * So the scrubbing is asserted, not intended. If a future export is dropped in
 * without going through the same step, this fails.
 */
const RAW = readFileSync(path.join(process.cwd(), "lib", "outreach", "data.ts"), "utf8")
/* Assert on DATA, not on the comment that explains the rule. */
const DATA = RAW.slice(RAW.indexOf("export const OUTREACH_DATA"))

describe("no personal data is committed", () => {
  it("carries no seller name or profile link", () => {
    expect(DATA).not.toMatch(/seller_name|seller_profile/)
    expect(DATA).not.toMatch(/marketplace\/profile/)
  })

  it("carries no free-text descriptions", () => {
    /* The pedal matching happens before the data lands here, so the raw text
       is not needed at runtime and is the likeliest place for a phone number
       or an address to hide. */
    for (const row of OUTREACH_DATA.rows) {
      expect(Object.keys(row)).not.toContain("description")
    }
  })

  it("has no phone number or email in any title", () => {
    for (const row of OUTREACH_DATA.rows) {
      expect(row.t, `phone-shaped text in: ${row.t}`).not.toMatch(/\+?\d[\d().\- ]{8,}\d/)
      expect(row.t, `email in: ${row.t}`).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
    }
  })

  it("keeps only the fields the page actually reads", () => {
    const allowed = new Set(["t", "ask", "real", "book", "named", "nP", "loc", "days", "photos", "url"])
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
