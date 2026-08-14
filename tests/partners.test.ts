import { describe, expect, it } from "vitest"
import {
  bannerPartner,
  partnerDestination,
  partnerFromSlug,
  partnerLinkStatus,
  PARTNERS,
  type PartnerProfile,
} from "@/lib/partners"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"
import { isImpactTrackingUrl } from "@/lib/affiliate/impact"
import { SOURCES } from "@/lib/db/schema"
import { STORES } from "@/lib/stores"

/**
 * The two focus-page partners.
 *
 * These tests are about the promises the pages make rather than about the copy
 * on them. Two of those promises are the whole reason this shape exists:
 *
 *   1. THEY ARE NOT IN THE CATALOGUE. Software and a distribution subscription
 *      have no condition, no stock and no second seller, so a market price over
 *      them would be a number with nothing behind it, and section 8 is
 *      unambiguous that inventing one is the error this site cannot afford. A
 *      partner leaking into SOURCES or STORES would put it in search results,
 *      the medians and the store index at once.
 *   2. AN UNTRACKED LINK BEATS A WRONG ONE. Every network here follows the rule
 *      that an unrecognised or half-built tracker produces no affiliate link
 *      rather than a broken one, because routing a shopper through something
 *      that credits nobody is worse than a clean direct link.
 */

function withLink(partner: PartnerProfile, trackedLink: string): PartnerProfile {
  return { ...partner, trackedLink }
}

describe("partners are not catalogue sources", () => {
  it("keeps every partner out of the SOURCES union", () => {
    for (const partner of PARTNERS) {
      expect(SOURCES as readonly string[]).not.toContain(partner.slug)
      // Also not under a source-shaped spelling of the same name.
      expect(SOURCES as readonly string[]).not.toContain(partner.slug.replace(/-/g, ""))
    }
  })

  it("keeps every partner out of the store index", () => {
    for (const partner of PARTNERS) {
      expect(STORES.some((store) => store.slug === partner.slug)).toBe(false)
      expect(STORES.some((store) => store.name === partner.name)).toBe(false)
    }
  })

  /** The page says why out loud, so a shopper is not left wondering. */
  it("says on the page why it carries no price comparison", () => {
    for (const partner of PARTNERS) {
      expect(partner.whyNotListed.length).toBeGreaterThan(40)
    }
  })
})

describe("partnerDestination", () => {
  const martinic = partnerFromSlug("martinic-audio") as PartnerProfile

  it("uses a configured Impact tracking link and reports it as tracked", () => {
    const link = "https://martinic.pxf.io/c/7529144/1234/5678"
    expect(isImpactTrackingUrl(link)).toBe(true)

    const destination = partnerDestination(withLink(martinic, link))
    expect(destination.url).toBe(link)
    expect(destination.tracked).toBe(true)
  })

  /**
   * A pasted link that is not on an Impact host is a mistake, not a shortcut.
   * Using it anyway would send real traffic through something we cannot
   * account for, which is exactly what the CJ and Awin readers refuse to do.
   */
  it("ignores a configured link that is not an Impact tracking host", () => {
    const destination = partnerDestination(withLink(martinic, "https://bit.ly/some-link"))
    expect(destination.url).toBe(martinic.homepage)
    expect(destination.tracked).toBe(false)
  })

  it("ignores a merchant's own plain URL pasted into the tracked slot", () => {
    const destination = partnerDestination(withLink(martinic, "https://www.martinic.com/products"))
    expect(destination.tracked).toBe(false)
    expect(destination.url).toBe(martinic.homepage)
  })

  it("falls back to the merchant's own site, untracked, when nothing is set", () => {
    const destination = partnerDestination(withLink(martinic, ""))
    expect(destination.url).toBe(martinic.homepage)
    expect(destination.tracked).toBe(false)
  })

  it("only ever produces a destination /go will actually follow", () => {
    for (const partner of PARTNERS) {
      // As configured in this environment, whatever that is.
      expect(isAllowedDestination(partnerDestination(partner).url)).toBe(true)
      // And with no link set, which is the default state.
      expect(isAllowedDestination(partnerDestination(withLink(partner, "")).url)).toBe(true)
    }
  })

  /**
   * Not a hypothetical. The destination comes from configuration rather than a
   * feed, but /go treats both the same way for the same reason: a bad value
   * must not turn our own domain into a redirect service for someone else's
   * phishing link.
   */
  it("refuses an off-allowlist link even when it looks tracked", () => {
    const destination = partnerDestination(withLink(martinic, "https://evil.example/c/1/2/3"))
    expect(destination.tracked).toBe(false)
    expect(isAllowedDestination(destination.url)).toBe(true)
  })
})

describe("partnerLinkStatus", () => {
  /**
   * The point of the readout: the three states have to be distinguishable, and
   * the middle one is why it exists. A link that is set but rejected earns
   * nothing while every visible symptom says the page works.
   */
  it("names a variable and a verdict for every partner", () => {
    const statuses = partnerLinkStatus()
    expect(statuses).toHaveLength(PARTNERS.length)
    for (const status of statuses) {
      expect(status.envVar).toMatch(/^IMPACT_[A-Z]+_LINK$/)
      expect(status.verdict.length).toBeGreaterThan(30)
      // A resolved host either way: the fallback is the merchant's own site.
      expect(status.host).toBeTruthy()
    }
  })

  it("reports unset as not earning, and says where to get the link", () => {
    for (const status of partnerLinkStatus()) {
      if (status.configured) continue
      expect(status.tracked).toBe(false)
      expect(status.verdict).toContain(status.envVar)
    }
  })

  /** Every partner needs a real variable name, not the unmapped placeholder. */
  it("maps every partner slug to a known env var", () => {
    for (const status of partnerLinkStatus()) {
      expect(status.envVar).not.toBe("(unmapped)")
    }
  })
})

describe("banners", () => {
  /**
   * DistroKid was the one asked for. Martinic deliberately has none: one
   * labelled placement is a product decision, and a second one nobody asked
   * for is how a site with no ads becomes a site with ads.
   */
  it("is configured for DistroKid and nothing else", () => {
    expect(bannerPartner("distrokid")).toBeTruthy()
    expect(bannerPartner("martinic-audio")).toBeNull()
    expect(PARTNERS.filter((p) => p.banner).length).toBe(1)
  })

  it("returns null for a partner that does not exist, rather than throwing", () => {
    expect(bannerPartner("guitar-center")).toBeNull()
  })
})

describe("house style", () => {
  /** Section 17: no em dashes anywhere in copy. */
  it("uses no em dashes in any partner copy", () => {
    const copy = PARTNERS.flatMap((p) => [
      p.tagline,
      p.kind,
      p.whyNotListed,
      ...p.intro,
      ...p.highlights.flatMap((h) => [h.title, h.body]),
      ...p.facts.flatMap((f) => [f.label, f.value]),
      ...(p.banner ? [p.banner.headline, p.banner.body, p.banner.cta] : []),
    ])
    for (const line of copy) {
      expect(line).not.toMatch(/[—–]/)
    }
  })

  /**
   * Prices go stale, and the footer's promise is that a price shown is a price
   * you can get. A subscription fee quoted in our copy is one we cannot keep
   * current, so the pages point at the merchant's own page for it instead.
   */
  it("quotes no price in partner copy", () => {
    const copy = PARTNERS.flatMap((p) => [...p.intro, ...p.highlights.map((h) => h.body)])
    for (const line of copy) {
      expect(line).not.toMatch(/\$\d|\d+\s?(?:USD|GBP|EUR)\b/)
    }
  })
})
