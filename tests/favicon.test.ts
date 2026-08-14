import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * The favicon, and the two ways it silently breaks.
 *
 * A favicon is fetched OUTSIDE the document, so there is no :root to resolve
 * against: a `var()` or a `currentColor` in here does not fall back to the
 * theme, it falls back to nothing, and the tab goes blank or black. Nothing
 * throws and no build fails, which is why it is worth a test rather than a
 * comment (there is a comment too).
 *
 * The other one is the sister site. stompbox.world ships the same enclosure
 * silhouette in royal blue, and two projects in one repository must not put
 * the same picture in two tabs.
 */

const ROOT = resolve(__dirname, "..")
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf-8")

/**
 * Comments stripped before the colour checks. Both files explain in prose why
 * they hold no `var()`, and a naive substring search reads that explanation as
 * the violation it warns about.
 */
const markup = (source: string) => source.replace(/<!--[\s\S]*?-->/g, "")

const gearAvail = read("app/icon.svg")
const stompbox = read("stompbox.world/app/icon.svg")

describe("app/icon.svg", () => {
  it("resolves every colour without the document", () => {
    expect(markup(gearAvail)).not.toContain("var(")
    expect(markup(gearAvail)).not.toContain("currentColor")
    // The brand gold and the LED green, literal.
    expect(gearAvail).toContain("#ffc233")
    expect(gearAvail).toContain("#24e07a")
  })

  it("is a pedal: an enclosure, a lit LED and a footswitch", () => {
    // The owner asked for a pedal. The parts that say "pedal" rather than
    // "badge" are the portrait enclosure and the footswitch under the graphic.
    expect(gearAvail).toMatch(/<rect[^>]*rx="11"/)
    expect(gearAvail).toMatch(/<circle[^>]*cy="76"[^>]*r="11"/)
    expect(gearAvail).toMatch(/<circle[^>]*fill="#24e07a"/)
  })

  it("carries the brand's tuning fork on its face", () => {
    // Two tines and a stem, the mark from components/brand/logo.tsx. Without
    // it this is the sister site's icon in a different colour.
    expect(gearAvail).toContain("M37 27v14a13 13 0 0 0 26 0V27")
    expect(gearAvail).toContain("M50 54v9")
  })

  it("is not the same tab as the sister site", () => {
    expect(gearAvail).not.toEqual(stompbox)
    // Graphite here, royal blue there, and neither borrows the other's body.
    expect(gearAvail).toContain('fill="#262b31"')
    expect(gearAvail).not.toContain("#1e2f7a")
    expect(stompbox).not.toContain("#262b31")
  })
})
