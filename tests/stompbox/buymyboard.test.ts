import { describe, expect, it } from "vitest"
import { BUY_MY_BOARD_HTML as HTML } from "@/app/stompbox/buymyboard/document"
import { OUTREACH_HTML as TOOL } from "@/app/stompbox/outreach/document"

/**
 * THE PUBLIC PAGE AND THE OUTREACH SCRIPT MUST QUOTE THE SAME DEAL.
 *
 * They did not, briefly: the public page offered 60% cash while the message a
 * seller received offered 65%, so anyone who got a message and then looked at
 * the site was shown a worse number on the site. Nothing failed, because
 * nothing was comparing them. This does.
 */
describe("one rate card, two pages", () => {
  it("quotes 65, 75 and 90 on the public page", () => {
    expect(HTML).toMatch(/cashPct:\s*0\.65/)
    expect(HTML).toMatch(/creditPct:\s*0\.75/)
    expect(HTML).toMatch(/consignPct:\s*0\.90/)
  })

  it("uses the same three rates the outreach script quotes", () => {
    for (const rate of ["0.65", "0.75", "0.90"]) {
      expect(TOOL, `the outreach script no longer quotes ${rate}`).toContain(rate)
    }
  })

  it("derives the store credit bump rather than stating one", () => {
    /* A hardcoded "20% more than cash" is how the number on the card and the
       number in the arithmetic quietly stop agreeing. */
    expect(HTML).toMatch(/OFFER\.creditPct \/ OFFER\.cashPct/)
  })

  it("keeps no minimum, as a recorded decision rather than an absence", () => {
    expect(HTML).toMatch(/minimum:\s*0/)
  })
})

describe("the served document survived being embedded", () => {
  it("is a whole page, opened and closed", () => {
    expect(HTML.startsWith("<!doctype html>")).toBe(true)
    expect(HTML.trimEnd().endsWith("</html>")).toBe(true)
  })

  it("has balanced script and style tags", () => {
    expect((HTML.match(/<script/g) ?? []).length).toBe((HTML.match(/<\/script>/g) ?? []).length)
    expect((HTML.match(/<style/g) ?? []).length).toBe((HTML.match(/<\/style>/g) ?? []).length)
  })

  it("still carries the controls the page is useless without", () => {
    for (const id of ["items", "addItem", "amtCash", "amtCredit", "amtConsign", "summary", "ctaSend"]) {
      expect(HTML, `#${id} is missing`).toContain(`id="${id}"`)
    }
  })
})

describe("it never quotes a number it does not have", () => {
  it("keeps the unpriced path, which excludes rather than zeroes", () => {
    /* 31 of the pedals in the table deliberately carry no book price, because
       a Big Muff is sixty dollars or nine hundred depending which one it is.
       Those must stay out of the total rather than counting as zero. */
    expect(HTML).toContain("price it by hand")
    expect(HTML).toMatch(/if \(value === null\) byHand \+= 1/)
  })

  it("says on the page that the figures are estimates", () => {
    expect(HTML).toContain("These are estimates.")
  })
})

describe("the call to action cannot point at nothing", () => {
  it("degrades to a copy action when no Messenger handle is set", () => {
    expect(HTML).toMatch(/if \(!MESSENGER\)/)
    expect(HTML).toContain("Copy my quote to send")
  })
})

describe("our own shop sits beside the quote, never inside it", () => {
  it("fails by disappearing rather than by erroring", () => {
    /* A page whose whole job is quoting somebody for their gear must not show
       an error because a decorative strip could not load, and the offline
       copy of this file has no API to call at all. */
    expect(HTML).toMatch(/\$\("shop"\)\.hidden = false/)
    expect(HTML).toMatch(/catch \(_\) \{ \/\* no shop section today/)
  })

  it("says the shop is our own stock, priced apart from the quote", () => {
    /* Our asking prices and a seller's estimate are two different numbers on
       one page. Saying so is what stops the grid reading as a comparison. */
    expect(HTML).toContain("This is our own stock")
    expect(HTML).toContain("priced independently of anything you were")
  })
})

describe("house style", () => {
  it("has no em dash in anything the reader is shown", () => {
    const body = HTML.replace(/<script[\s\S]*?<\/script>/g, "")
    expect(body).not.toContain("\u2014")
  })
})
