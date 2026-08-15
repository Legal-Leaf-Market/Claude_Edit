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
 * The other one is the sister site. Since stompbox.world's design took over
 * (CLAUDE.md section 16), both favicons are the same royal blue enclosure
 * with a white silkscreen, so the COLOUR no longer tells the tabs apart. The
 * GRAPHIC does: Gear Avail's face carries the tuning fork, stem running into
 * the footswitch; stompbox.world's face is a bare footswitch. Two projects in
 * one repository must not put the same picture in two tabs.
 */

const ROOT = resolve(__dirname, "..")
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf-8")

/**
 * Comments stripped before the colour checks. Both files explain in prose why
 * they hold no `var()`, and a naive substring search reads that explanation as
 * the violation it warns about.
 */
const markup = (source: string) => source.replace(/<!--[\s\S]*?-->/g, "")

/** The fork's two strokes: tines-and-bow, then the stem into the footswitch. */
const FORK_TINES = "M37 27v14a13 13 0 0 0 26 0V27"
const FORK_STEM = "M50 54v9"

const gearAvail = read("app/icon.svg")
const stompbox = read("stompbox.world/app/icon.svg")

describe("app/icon.svg", () => {
  it("resolves every colour without the document", () => {
    expect(markup(gearAvail)).not.toContain("var(")
    expect(markup(gearAvail)).not.toContain("currentColor")
    // The royal blue enclosure, the chrome print and the LED green, literal.
    expect(gearAvail).toContain("#183573")
    expect(gearAvail).toContain("#ffffff")
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
    // Two tines and a stem, the graphic from components/brand/logo.tsx.
    // Without it this is the sister site's icon with different geometry.
    expect(gearAvail).toContain(FORK_TINES)
    expect(gearAvail).toContain(FORK_STEM)
  })

  it("is not the same tab as the sister site", () => {
    expect(gearAvail).not.toEqual(stompbox)
    // One palette now, so the graphic is what separates the tabs: the fork
    // lives here and only here. If the sister site ever gains it, or this one
    // loses it, the two tabs collapse into one picture.
    expect(markup(stompbox)).not.toContain(FORK_TINES)
    expect(markup(stompbox)).not.toContain(FORK_STEM)
  })
})
