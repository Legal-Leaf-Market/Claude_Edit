import { describe, expect, it } from "vitest"
import { buildAwinDeepLink, isReverbProductUrl, reverbAffiliateUrl } from "@/lib/affiliate/awin"

/**
 * Note the house rule these tests obey: never GET an awin1.com/cread.php URL.
 * Every request registers a real click and pollutes conversion reporting with
 * our own traffic. Everything below asserts on the string only.
 */

const PUB = "3004653"
const MID = "67144"

describe("buildAwinDeepLink", () => {
  it("builds a cread link with the destination percent encoded in ued", () => {
    const link = buildAwinDeepLink("https://reverb.com/item/12345-fender-strat", {
      publisherId: PUB,
      merchantId: MID,
    })
    expect(link).toBe(
      "https://www.awin1.com/cread.php?awinmid=67144&awinaffid=3004653" +
        "&ued=https%3A%2F%2Freverb.com%2Fitem%2F12345-fender-strat",
    )
  })

  it("encodes a destination that already carries its own query string", () => {
    const destination = "https://reverb.com/item/9?utm_source=x&a=b"
    const link = buildAwinDeepLink(destination, { publisherId: PUB, merchantId: MID })

    // The destination's own & must be encoded inside ued, or Awin reads "a=b"
    // as one of its own parameters and the redirect drops it.
    expect(link).toContain("%26a%3Db")
    expect(link).not.toContain("?utm_source=x&a=b")

    // The invariant that actually matters: decoding ued once returns the
    // destination intact, so the shopper lands where the card promised.
    expect(new URL(link!).searchParams.get("ued")).toBe(destination)
    expect(new URL(link!).searchParams.get("awinaffid")).toBe(PUB)
  })

  it("round-trips a destination containing characters that need escaping", () => {
    // URL normalisation turns the space into %20 before we encode, so ued
    // carries %2520. Decoding once yields the normalised URL, which is correct.
    const link = buildAwinDeepLink("https://reverb.com/item/9?q=fender strat", {
      publisherId: PUB,
      merchantId: MID,
    })
    expect(new URL(link!).searchParams.get("ued")).toBe(
      "https://reverb.com/item/9?q=fender%20strat",
    )
  })

  it("includes clickref when supplied, truncated to 100 chars", () => {
    const link = buildAwinDeepLink("https://reverb.com/item/1", {
      publisherId: PUB,
      merchantId: MID,
      clickRef: "x".repeat(150),
    })
    const clickref = new URL(link!).searchParams.get("clickref")!
    expect(clickref).toHaveLength(100)
  })

  // Both ids are passed explicitly as empty rather than omitted: omitting them
  // falls back to the environment, so an env-configured dev box would make
  // these pass or fail depending on the machine.
  it("returns null when the publisher id is missing", () => {
    expect(
      buildAwinDeepLink("https://reverb.com/item/1", { publisherId: "", merchantId: MID }),
    ).toBeNull()
  })

  it("returns null when the merchant id is missing", () => {
    // An unapproved or absent mid routes the shopper through a tracker that
    // credits nobody, which is worse than a clean direct link.
    expect(
      buildAwinDeepLink("https://reverb.com/item/1", { publisherId: PUB, merchantId: "" }),
    ).toBeNull()
  })

  it("returns null for a value that is not a URL", () => {
    expect(buildAwinDeepLink("not a url", { publisherId: PUB, merchantId: MID })).toBeNull()
  })
})

describe("isReverbProductUrl", () => {
  it("accepts reverb.com and its subdomains", () => {
    expect(isReverbProductUrl("https://reverb.com/item/1")).toBe(true)
    expect(isReverbProductUrl("https://www.reverb.com/item/1")).toBe(true)
  })

  it("rejects lookalike hosts", () => {
    // A naive `includes("reverb.com")` check passes both of these.
    expect(isReverbProductUrl("https://reverb.com.evil.example/item/1")).toBe(false)
    expect(isReverbProductUrl("https://notreverb.com/item/1")).toBe(false)
  })

  it("rejects non-http schemes", () => {
    expect(isReverbProductUrl("javascript:alert(1)")).toBe(false)
  })
})

describe("reverbAffiliateUrl", () => {
  it("wraps a Reverb URL", () => {
    const link = reverbAffiliateUrl("https://reverb.com/item/42", {
      publisherId: PUB,
      merchantId: MID,
    })
    expect(link).toContain("awin1.com/cread.php")
  })

  it("refuses to wrap a non-Reverb destination", () => {
    expect(
      reverbAffiliateUrl("https://example.com/item/42", { publisherId: PUB, merchantId: MID }),
    ).toBeNull()
  })
})
