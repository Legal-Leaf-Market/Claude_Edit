import { describe, expect, it } from "vitest"
import { OUTREACH_HTML as HTML } from "@/app/admin/outreach/document"

/**
 * THE DOCUMENT IS EMBEDDED IN A TEMPLATE LITERAL, AND THAT IS THE RISK.
 *
 * `app/admin/outreach/document.ts` holds a whole HTML page as one string,
 * escaped mechanically from the standalone file. A bad escape does not throw:
 * it truncates the document, or swallows a closing tag, or turns part of the
 * page's own JavaScript into an interpolation that silently evaluates to
 * nothing. The served page then renders as a blank panel or half a form, on a
 * live domain, with nothing in any log.
 *
 * So this asserts the SHAPE of what gets served rather than its content. None
 * of it is about the sales copy, which changes; all of it is about whether the
 * string still is a document.
 */
describe("the served document survived being embedded", () => {
  it("is a whole page, opened and closed", () => {
    expect(HTML.startsWith("<!doctype html>")).toBe(true)
    expect(HTML.trimEnd().endsWith("</html>")).toBe(true)
    expect(HTML).toContain("<head>")
    expect(HTML).toContain("</head>")
    expect(HTML).toContain("<body>")
  })

  it("has balanced script and style tags", () => {
    /* An unbalanced pair is exactly what a swallowed backtick produces, and
       the browser recovers from it by eating the rest of the page as text. */
    expect((HTML.match(/<script/g) ?? []).length).toBe((HTML.match(/<\/script>/g) ?? []).length)
    expect((HTML.match(/<style/g) ?? []).length).toBe((HTML.match(/<\/style>/g) ?? []).length)
  })

  it("still carries the parts the page is useless without", () => {
    for (const id of ["fPedal", "paste", "rows", "m1", "m2", "m3", "xVerified", "pick1", "pick2"]) {
      expect(HTML, `#${id} is missing from the served document`).toContain(`id="${id}"`)
    }
    expect(HTML).toContain("const NOTES = [")
    expect(HTML).toContain("function parseListing")
  })

  it("keeps the three tiers at the rates they are quoted at", () => {
    /* These percentages are an offer made to a stranger in writing. A silent
       edit to one of them is a different deal under the same name. */
    expect(HTML).toContain("0.60 * t.mv")
    expect(HTML).toContain("0.80 * t.mv * f")
    expect(HTML).toContain("0.90 * t.mv * f")
  })

  it("steps messages one and two through their versions rather than shuffling blind", () => {
    /* Ten openers and ten setups, and the owner needs to know which one he
       sent. Arrows plus a readout per message, and the readouts are in the
       served page. */
    for (const n of ["1", "2"]) {
      expect(HTML).toContain(`data-step="-1" data-for="${n}"`)
      expect(HTML).toContain(`data-step="1" data-for="${n}"`)
      expect(HTML).toMatch(new RegExp(`\\$\\("pick${n}"\\)\\.textContent`))
    }
  })

  it("asks not to be indexed", () => {
    /* Shareable and searchable are different things. The page carries the
       shop's own margins and the scripts it sends sellers, so the link should
       work when sent and never turn up in a search. The route sets the header
       too; this is the half that travels with the standalone copy. */
    expect(HTML).toMatch(/name="robots"\s+content="noindex/)
  })

  it("has no em dash in anything the reader is shown", () => {
    /* House rule. The only em dashes allowed are inside the listing parser's
       character classes, where they match what a seller typed. */
    const body = HTML.replace(/<script[\s\S]*?<\/script>/g, "")
    expect(body).not.toContain("\u2014")
  })
})
