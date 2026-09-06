import { describe, expect, it } from "vitest"
import { OUTREACH_HTML as HTML } from "@/app/admin/outreach/document"

/**
 * THE PARSER IS TESTED AS SHIPPED, not as a copy of itself.
 *
 * It lives inline in the served document, because that document also runs as a
 * file off a laptop with no server (section 26) and so cannot import anything.
 * A second copy in a module would be section 7's fork with the drift hidden
 * inside a regex, so instead the real script is pulled out of the real HTML and
 * evaluated. Same technique tests/capture/collector.test.ts uses on the
 * bookmarklet, for the same reason.
 *
 * The fixtures are real Marketplace listing bodies. Every assertion below is
 * something the previous line-by-line reader got wrong.
 */

function loadParser() {
  // The document carries two scripts (the no-flash theme init, then the app).
  // The app one is the module, and everything before it binds to the DOM is
  // pure logic that can be evaluated here.
  const open = HTML.indexOf('<script type="module">')
  const body = HTML.slice(HTML.indexOf(">", open) + 1, HTML.indexOf("const els = {", open))
  const fn = new Function(`${body}; return { parseListing, brandTier, looksLikeName };`)
  return fn() as {
    parseListing: (t: string) => {
      rows: { brand: string; model: string; ask: number | null; mv: number | null; tier: string; sold: boolean; accessory: boolean; score: number; grade: string; note: string }[]
      soldCount: number
      noPrice: number
      motivation: { labels: string[]; level: string; strength: number }
      nogo: { flags: string[]; weight: number; verdict: string }
    }
    brandTier: (n: string) => { tier: string; brand: string }
    looksLikeName: (t: string) => boolean
  }
}

const P = loadParser()

describe("the listing parser, as served", () => {
  it("reads a plain name-dash-price lot", () => {
    const { rows } = P.parseListing(`All pedals in excellent condition! Not looking for any trades, thanks.

Strymon El Cap V2 - $250
JHS The Klone - $500
Universal Audio Ruby - $200
OneSpot Pro CS7 - $100
Lehle Mono Volume - $200
Eventide TimeFactor - $150`)
    expect(rows).toHaveLength(6)
    expect(rows[0].ask).toBe(250)
    expect(rows.map((r) => r.tier)).toEqual(["A", "A", "A", "?", "A", "A"])
  })

  it("scores a boutique pedal above a budget one at the same price", () => {
    // The single strongest signal in the file, and the old reader had none of it.
    const { rows } = P.parseListing("Strymon Flint - $150\nBehringer TO800 - $150")
    expect(rows[0].tier).toBe("A")
    expect(rows[1].tier).toBe("C")
    expect(rows[0].score).toBeGreaterThan(rows[1].score)
  })

  it("takes the name off the PREVIOUS line", () => {
    // Sellers write this constantly and the old reader produced junk names.
    const { rows } = P.parseListing(`Boss DS-1
$45

MXR Phase 90
barely used
$70`)
    expect(rows).toHaveLength(2)
    expect(`${rows[0].brand} ${rows[0].model}`.trim()).toContain("DS-1")
    expect(rows[0].ask).toBe(45)
    expect(`${rows[1].brand} ${rows[1].model}`.trim()).toContain("Phase 90")
    expect(rows[1].ask).toBe(70)
    expect(rows[1].note).toContain("barely used")
  })

  it("refuses price lines that are not pedals", () => {
    // Each of these would have become a row with a price attached.
    const { rows } = P.parseListing(`Boss DS-1 - $45
Shipping is $12 anywhere in the US
Venmo or Cash App only
All for $400
These go for $90 on Reverb`)
    expect(rows).toHaveLength(1)
    expect(rows[0].ask).toBe(45)
  })

  it("marks what has already gone, and drags its score down", () => {
    const { rows, soldCount } = P.parseListing(`Boss DS-1 - $45 SOLD
MXR Phase 90 - $70
EHX Big Muff - $60 pending`)
    expect(soldCount).toBe(2)
    const sold = rows.find((r) => r.sold)!
    const open = rows.find((r) => !r.sold && !r.model.includes("Muff"))!
    expect(sold.score).toBeLessThan(open.score)
  })

  it("keeps accessories but scores them down", () => {
    // A power supply in the lot is real, and is not what we are buying.
    const { rows } = P.parseListing("Strymon Flint - $150\nTruetone 1 Spot power supply - $40")
    expect(rows).toHaveLength(2)
    const acc = rows.find((r) => r.accessory)!
    expect(acc.score).toBeLessThan(rows.find((r) => !r.accessory)!.score)
  })

  it("reads why they are selling, and how hard", () => {
    const urgent = P.parseListing("Moving next week and need the cash.\nBoss DS-1 - $45")
    expect(urgent.motivation.level).toBe("High")
    expect(urgent.motivation.labels.join(" ")).toMatch(/Moving|Needs cash/)

    const quiet = P.parseListing("Boss DS-1 - $45")
    expect(quiet.motivation.level).toBe("Unknown")
    expect(quiet.motivation.strength).toBe(0)
  })

  it("flags a seller who will not move, and one who knows the comps", () => {
    const firm = P.parseListing("Prices are firm, no lowballers. I know what these are worth.\nBoss DS-1 - $45")
    expect(firm.nogo.verdict).toBe("NO-GO")
    expect(firm.nogo.flags.join(" ")).toContain("firm")

    const open = P.parseListing("Open to offers on the lot.\nBoss DS-1 - $45")
    expect(open.nogo.verdict).toBe("")
  })

  it("lets motivation raise the score and no-go language lower it", () => {
    const same = "Boss DS-1 - $45\nMXR Phase 90 - $70\nEHX Soul Food - $60"
    const eager = P.parseListing("Moving out of state, everything must go.\n" + same)
    const firm = P.parseListing("Prices are firm and non-negotiable. I know what they are worth.\n" + same)
    expect(eager.rows[0].score).toBeGreaterThan(firm.rows[0].score)
  })

  it("does not read a condition blurb as a pedal name", () => {
    expect(P.looksLikeName("excellent condition")).toBe(false)
    expect(P.looksLikeName("comes with original box")).toBe(false)
    expect(P.looksLikeName("Boss DS-1")).toBe(true)
    expect(P.looksLikeName("Klon Centaur")).toBe(true)
  })

  it("keeps a real pedal whose line also mentions what it goes for new", () => {
    // The narrow edge between the two rules, and the reason a known brand is
    // the escape hatch rather than the word "reverb".
    const { rows } = P.parseListing("Strymon BigSky, goes for $400 new, asking $250")
    expect(rows).toHaveLength(1)
    expect(rows[0].tier).toBe("A")
  })

  it("keeps a reverb PEDAL while dropping a price reference to Reverb", () => {
    const { rows } = P.parseListing("Walrus Slo Reverb - $180\nThese go for $90 on Reverb")
    expect(rows).toHaveLength(1)
    expect(rows[0].ask).toBe(180)
  })

  it("strips the sold marker off the name without eating the name", () => {
    // Both halves earned a place. The marker welded to the model travels into
    // the message and into the comps lookup as part of the pedal's name. And
    // the first fix for that shipped a regex missing a backslash, which turned
    // /\\s{2,}/ into /s{2,}/ and quietly rewrote "Boss" as "Bo".
    const { rows } = P.parseListing("EHX Big Muff - $60 SOLD\nBoss DS-1 - $45")
    expect(rows[0].model).toBe("Big Muff")
    expect(rows[0].sold).toBe(true)
    expect(`${rows[1].brand} ${rows[1].model}`.trim()).toBe("Boss DS-1")
  })

  it("counts a missing price only for lines that read like a pedal", () => {
    // Counting prose reported "4 with no price found" on a listing whose only
    // real miss was none, which teaches the reader to ignore the number.
    const { noPrice } = P.parseListing(`Moving out of state, everything must go.
Open to offers on the lot.
Strymon Flint - $150
Boss DS-1`)
    expect(noPrice).toBe(1)
  })

  it("still refuses to invent a market value", () => {
    // The whole point of section 26. Every number here is the seller's own
    // price or a score about the opportunity, never a valuation.
    const { rows } = P.parseListing("Some Unknown Boutique Thing - $200")
    expect(rows[0].ask).toBe(200)
    expect(rows[0].mv ?? null).toBeNull()
  })
})
