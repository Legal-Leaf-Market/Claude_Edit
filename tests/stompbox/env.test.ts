import { describe, expect, it } from "vitest"
import { _internals } from "@/lib/stompbox/env"

const { str, list, instagramPermalinks } = _internals

describe("str", () => {
  /**
   * The rule that earned itself on the sister project: a leading space pasted
   * into a dashboard field is invisible everywhere the value is printed, and
   * it sent DNS a hostname containing a space that failed as a lookup error
   * and read for a while like an outage.
   */
  it("trims, and treats a whitespace-only value as unset", () => {
    expect(str("  stompbox.world  ")).toBe("stompbox.world")
    expect(str("   ")).toBeUndefined()
    expect(str("")).toBeUndefined()
    expect(str(undefined)).toBeUndefined()
  })
})

describe("list", () => {
  it("splits on commas and newlines, trims, and drops blanks", () => {
    expect(list("a, b\nc,,  ,d ")).toEqual(["a", "b", "c", "d"])
    expect(list("   ")).toEqual([])
    expect(list(undefined)).toEqual([])
  })
})

describe("instagramPermalinks", () => {
  it("accepts real post, reel and tv permalinks", () => {
    const urls = [
      "https://www.instagram.com/p/ABC123/",
      "https://instagram.com/reel/XYZ789",
      "https://www.instagram.com/tv/DEF456/",
    ]
    expect(instagramPermalinks(urls.join(","))).toEqual(urls)
  })

  /*
   * The embed script is handed these verbatim, so anything that is not a real
   * permalink renders an empty grey box that looks like a broken site rather
   * than an unconfigured one. Dropping them degrades to the follow callout.
   */
  it("drops anything that is not an instagram permalink", () => {
    expect(instagramPermalinks("https://example.com/p/ABC/")).toEqual([])
    expect(instagramPermalinks("http://www.instagram.com/p/ABC/")).toEqual([])
    expect(instagramPermalinks("https://www.instagram.com/stompbox.world/")).toEqual([])
    expect(instagramPermalinks("not a url at all")).toEqual([])
  })
})
