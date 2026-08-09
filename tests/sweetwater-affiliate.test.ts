import { describe, expect, it } from "vitest"
import { isSweetwaterProductUrl } from "@/lib/affiliate/sweetwater"

describe("isSweetwaterProductUrl", () => {
  it("accepts sweetwater.com and its subdomains", () => {
    expect(isSweetwaterProductUrl("https://www.sweetwater.com/used/listings/1")).toBe(true)
    expect(isSweetwaterProductUrl("https://media.sweetwater.com/image/1.jpg")).toBe(true)
  })

  it("rejects an unrecognised host, including a lookalike domain", () => {
    expect(isSweetwaterProductUrl("https://sweetwater.com.evil.example/x")).toBe(false)
    expect(isSweetwaterProductUrl("https://not-sweetwater.com/x")).toBe(false)
  })

  it("rejects a non-http(s) scheme and a malformed URL", () => {
    expect(isSweetwaterProductUrl("javascript:alert(1)")).toBe(false)
    expect(isSweetwaterProductUrl("not a url")).toBe(false)
  })
})
