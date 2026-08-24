import { describe, expect, it } from "vitest"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"
import { CAPTURE_TARGETS, captureTarget } from "@/lib/capture/targets"
import { PROMOTION_RULES } from "@/lib/capture/promote"
import { collectorSource } from "@/lib/capture/collector"

/**
 * THE LIST THE TOOL ACTIVELY POINTS AT.
 *
 * Nothing stops an operator running the bookmarklet anywhere; what this list
 * decides is which merchants the install page sends them to, and that is worth
 * being deliberate about. A row here should be a merchant somebody has already
 * decided about, on the record.
 */

describe("who the collector points at", () => {
  it("only lists merchants we hold something with", () => {
    /*
     * Every target must have a promotion rule, which is where the basis for
     * publishing that merchant's catalogue is written down. Guitar Center is
     * absent from both, for the same reason, and adding it to one without the
     * other should fail rather than quietly half-work.
     */
    const promotable = new Set(PROMOTION_RULES.map((rule) => rule.merchantKey))
    for (const target of CAPTURE_TARGETS) {
      expect(
        promotable.has(target.merchantKey),
        `${target.merchantKey} is a capture target with no promotion rule behind it`,
      ).toBe(true)
    }
  })

  it("says on every row what we actually hold", () => {
    for (const target of CAPTURE_TARGETS) {
      expect(target.basis.length, target.merchantKey).toBeGreaterThan(20)
    }
  })

  it("points at category pages rather than homepages", () => {
    /*
     * A crawl walks the pagination of wherever it is pointed, and a homepage is
     * the one page on a retailer's site guaranteed to have no paginated grid.
     */
    for (const target of CAPTURE_TARGETS) {
      expect(target.entries.length, target.merchantKey).toBeGreaterThan(0)
      for (const entry of target.entries) {
        const path = new URL(entry.url).pathname
        expect(path, `${target.merchantKey}: ${entry.url} is a homepage`).not.toBe("/")
      }
    }
  })

  it("keeps every entry on the merchant's own host, and on the outbound allowlist", () => {
    /*
     * Both halves matter. An entry on some other host would send the operator
     * to capture a third party under this merchant's key, and a host missing
     * from the allowlist means every product crawled there is dropped at
     * promotion time with nothing on the page explaining why.
     */
    for (const target of CAPTURE_TARGETS) {
      const home = new URL(target.homeUrl).hostname.replace(/^www\./, "")
      for (const entry of target.entries) {
        expect(new URL(entry.url).hostname, `${target.merchantKey}: ${entry.url}`).toContain(home)
        expect(isAllowedDestination(entry.url), `${target.merchantKey}: ${entry.url}`).toBe(true)
      }
    }
  })

  it("looks a target up by key", () => {
    expect(captureTarget("andertons")?.label).toBe("Andertons Music Co.")
    expect(captureTarget("guitarcenter")).toBeNull()
  })
})

describe("the crawl the collector performs", () => {
  const { source } = collectorSource("https://gearavail.com")

  it("walks pages one at a time with a pause, never in parallel", () => {
    /*
     * A crawl that hammers a merchant we hold an affiliate agreement with is a
     * good way to lose the agreement, and nothing here is urgent enough to be
     * worth that. Serial with a delay, and the delay is deliberately not
     * exposed in the panel: the one setting somebody reaches for under
     * impatience is the one that should not move.
     */
    expect(source).toContain("CRAWL_DELAY_MS")
    expect(source).toMatch(/CRAWL_DELAY_MS\s*=\s*\d{3,}/)
    expect(source, "a crawl must not fan out").not.toContain("Promise.all")
  })

  it("stops when a page adds nothing new", () => {
    /*
     * THE STOP CONDITION THAT MATTERS MOST. Pagination run past its last page
     * commonly serves page one again rather than a 404, so without this the
     * crawl walks to the cap re-reading one grid and reports a confident,
     * wrong total.
     */
    expect(source).toContain("emptyStreak")
    expect(source).toContain("added nothing new")
  })

  it("has a page cap and a stop button", () => {
    expect(source).toContain("ga-max")
    expect(source).toContain("stopRequested")
  })

  it("fetches same-origin, which is the whole reason this works", () => {
    /*
     * The bookmarklet is executing on the merchant's own origin, so their page
     * two is an ordinary same-origin request carrying the session the operator
     * already has. No CORS, no proxy.
     */
    expect(source).toContain('credentials: "same-origin"')
    expect(source).toContain("DOMParser")
  })

  it("runs the one shared extractor against each fetched page", () => {
    /* Not a second, simpler parser for crawled pages. Section 7. */
    expect(source).toContain("CAPTURE(doc, url)")
  })

  it("merges every walked page into one payload, deduplicated", () => {
    expect(source).toContain("pagesWalked")
    expect(source).toContain("function total()")
  })
})
