import { describe, expect, it } from "vitest"
import { isImpactTrackingUrl } from "@/lib/affiliate/impact"
import { isAllowedDestination } from "@/lib/affiliate/allowed-hosts"

/**
 * Impact.com link recognition, for the Andertons programme.
 *
 * NOTHING HERE FETCHES A LINK. Same rule as the Awin tests: every request to a
 * live affiliate tracking URL registers a real click and pollutes the
 * programme's conversion reporting with our own traffic. These assert on
 * strings and never follow one.
 *
 * The real Andertons vanity link is used as a fixture because it is the one
 * host we have actually seen rather than one written from memory, which is the
 * same reason lib/affiliate/impact.ts documents its domain list as verified
 * rather than assumed.
 */

const ANDERTONS_VANITY = "https://andertonsmusiccompany.pxf.io/7XKanr"

describe("isImpactTrackingUrl", () => {
  it("recognises Andertons' own vanity domain", () => {
    expect(isImpactTrackingUrl(ANDERTONS_VANITY)).toBe(true)
  })

  it("recognises the full deep-link shape Impact feeds carry", () => {
    // /c/<publisherId>/<campaignId>/<adId>, optionally with ?u= the destination.
    expect(
      isImpactTrackingUrl("https://andertonsmusiccompany.pxf.io/c/111111/222222/13053"),
    ).toBe(true)
    expect(
      isImpactTrackingUrl(
        "https://andertonsmusiccompany.pxf.io/c/111111/222222/13053?u=https%3A%2F%2Fwww.andertons.co.uk%2Fsome-pedal",
      ),
    ).toBe(true)
  })

  it("recognises the other vanity domains Impact assigns", () => {
    for (const host of ["semrush.sjv.io", "brand.7eer.net", "brand.evyy.net"]) {
      expect(isImpactTrackingUrl(`https://${host}/c/1/2/3`), host).toBe(true)
    }
  })

  /**
   * The whole point of host verification. A feed row whose tracked column has
   * been poisoned, or simply misparsed into the wrong field, must not be
   * trusted as an affiliate link just because it is a URL.
   */
  it("rejects a host that merely contains a tracking domain as a substring", () => {
    expect(isImpactTrackingUrl("https://pxf.io.evil.example.com/c/1/2/3")).toBe(false)
    expect(isImpactTrackingUrl("https://notpxf.io/c/1/2/3")).toBe(false)
    expect(isImpactTrackingUrl("https://sjv.io.attacker.test/")).toBe(false)
  })

  it("rejects the merchant's own untracked URL, which credits nobody", () => {
    expect(isImpactTrackingUrl("https://www.andertons.co.uk/some-pedal")).toBe(false)
  })

  it("rejects non-http schemes and unparseable input", () => {
    expect(isImpactTrackingUrl("javascript:alert(1)")).toBe(false)
    expect(isImpactTrackingUrl("data:text/html,hi")).toBe(false)
    expect(isImpactTrackingUrl("not a url")).toBe(false)
    expect(isImpactTrackingUrl("")).toBe(false)
  })
})

describe("the /go allowlist", () => {
  it("permits Impact tracking links, so a tracked destination is followable", () => {
    expect(isAllowedDestination(ANDERTONS_VANITY)).toBe(true)
    expect(isAllowedDestination("https://andertonsmusiccompany.pxf.io/c/1/2/3")).toBe(true)
  })

  it("permits Andertons' own storefront, for the untracked fallback", () => {
    expect(isAllowedDestination("https://www.andertons.co.uk/some-pedal")).toBe(true)
  })

  /**
   * The allowlist is defence in depth against a poisoned or misparsed feed row
   * turning /go into an open redirect, so widening it by one host must not
   * widen it by a family of lookalikes.
   */
  it("still refuses a lookalike host", () => {
    expect(isAllowedDestination("https://andertons.co.uk.evil.example.com/x")).toBe(false)
    expect(isAllowedDestination("https://pxf.io.evil.example.com/x")).toBe(false)
    expect(isAllowedDestination("https://evil.example.com/?u=andertons.co.uk")).toBe(false)
  })
})
