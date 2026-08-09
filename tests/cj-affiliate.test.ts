import { describe, expect, it } from "vitest"
import { isCjTrackingUrl } from "@/lib/affiliate/cj"

describe("isCjTrackingUrl", () => {
  it("accepts CJ's known tracking domains", () => {
    expect(isCjTrackingUrl("https://www.anrdoezrs.net/click-100-200")).toBe(true)
    expect(isCjTrackingUrl("https://www.jdoqocy.com/click-100-200")).toBe(true)
    expect(isCjTrackingUrl("https://www.kqzyfj.com/click-100-200")).toBe(true)
    expect(isCjTrackingUrl("https://www.tkqlhce.com/click-100-200")).toBe(true)
    expect(isCjTrackingUrl("https://www.qksrv.net/click-100-200")).toBe(true)
  })

  it("rejects a merchant's own untracked domain", () => {
    expect(isCjTrackingUrl("https://www.zzounds.com/item/12345")).toBe(false)
  })

  it("rejects a lookalike host", () => {
    expect(isCjTrackingUrl("https://anrdoezrs.net.evil.example/click-1")).toBe(false)
  })

  it("rejects a non-http scheme and a malformed URL", () => {
    expect(isCjTrackingUrl("javascript:alert(1)")).toBe(false)
    expect(isCjTrackingUrl("not a url")).toBe(false)
  })
})
