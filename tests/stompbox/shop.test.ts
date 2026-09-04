import { describe, expect, it } from "vitest"
import { SHOP_HTML as HTML } from "@/app/stompbox/shop/document"

/**
 * A SHOP PAGE HAS THREE STATES AND ONLY ONE OF THEM IS "HERE IS THE STOCK".
 * Sold out and unreachable are both real, both common, and both render as a
 * blank grid under a heading unless somebody writes them.
 */
describe("every state is written", () => {
  it("says so plainly when nothing is listed", () => {
    expect(HTML).toContain("Nothing in the shop right now")
  })

  it("points at Reverb when the feed cannot be reached", () => {
    expect(HTML).toContain("The shop is not loading")
    expect(HTML).toContain("reverb.com/shop/deans-boutique-505")
  })

  it("never leaves a broken image glyph in a card", () => {
    /* A dead photo link reads as a broken shop. An honest placeholder does
       not. */
    expect(HTML).toContain('ph.textContent = "No photo"')
  })
})

describe("it claims nothing the page does not do", () => {
  it("emits no product or offer markup", () => {
    /* Section 25: markup is a claim the page makes. Reverb takes the order,
       not us, so Offer nodes here would overstate what this page is. */
    expect(HTML).not.toMatch(/application\/ld\+json/)
    expect(HTML).not.toMatch(/"@type":\s*"(Product|Offer)"/)
  })

  it("carries no rating or review vocabulary", () => {
    expect(HTML).not.toMatch(/aggregateRating|ratingValue|reviewCount/)
  })
})

describe("the document survived being embedded", () => {
  it("is a whole page, opened and closed", () => {
    expect(HTML.startsWith("<!doctype html>")).toBe(true)
    expect(HTML.trimEnd().endsWith("</html>")).toBe(true)
  })

  it("has balanced script and style tags", () => {
    expect((HTML.match(/<script/g) ?? []).length).toBe((HTML.match(/<\/script>/g) ?? []).length)
    expect((HTML.match(/<style/g) ?? []).length).toBe((HTML.match(/<\/style>/g) ?? []).length)
  })

  it("sends sellers on to the quote page", () => {
    expect(HTML).toContain('href="/buymyboard"')
  })

  it("has no em dash in anything the reader is shown", () => {
    const body = HTML.replace(/<script[\s\S]*?<\/script>/g, "")
    expect(body).not.toContain("\u2014")
  })
})
