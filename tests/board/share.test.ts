import { describe, expect, it } from "vitest"
import { decodeBoard, encodeBoard, resolveBoard } from "@/lib/board/share"
import { itemFromGuide, type CatalogInput } from "@/lib/board/model"
import { PEDALS, pedalBySlug } from "@/lib/stompbox/pedals"

/**
 * A board in a URL.
 *
 * This is the whole persistence story: no account, no row in a table, just a
 * link somebody can paste into a text message. Which means these links outlive
 * deploys, and the tests that matter are the ones about a link written by a
 * version of the site that no longer exists.
 */

const CATALOG: CatalogInput[] = [
  { slug: "boss-ds-1", brand: "Boss", model: "DS-1 Distortion", imageUrl: null, type: "drive" },
  { slug: "mxr-phase-90", brand: "MXR", model: "Phase 90", imageUrl: null, type: "modulation" },
]

describe("round trip", () => {
  it("survives encode and decode with the board intact", () => {
    const board = [
      itemFromGuide(pedalBySlug("cry-baby")!),
      itemFromGuide(pedalBySlug("big-muff")!),
    ]
    const back = resolveBoard(decodeBoard(encodeBoard(board)), CATALOG)
    expect(back.map((i) => i.key)).toEqual(["g:cry-baby", "g:big-muff"])
  })

  it("remembers which pedals were switched off", () => {
    // Bypass is part of the rig. A shared board that silently switches
    // everything on is a different sound from the one that was sent.
    const board = [
      itemFromGuide(pedalBySlug("cry-baby")!, false),
      itemFromGuide(pedalBySlug("big-muff")!, true),
    ]
    const back = resolveBoard(decodeBoard(encodeBoard(board)), CATALOG)
    expect(back.map((i) => i.engaged)).toEqual([false, true])
  })

  it("keeps guide entries and real products apart", () => {
    const encoded = "g:big-muff~c:boss-ds-1"
    const back = resolveBoard(decodeBoard(encoded), CATALOG)
    expect(back.map((i) => i.source)).toEqual(["guide", "catalogue"])
    expect(back[1].catalogSlug).toBe("boss-ds-1")
  })
})

describe("links written by a version that no longer exists", () => {
  it("DROPS a product that has left the catalogue and keeps the rest", () => {
    /*
     * The common case a year from now. A greyed-out "this pedal is gone" box
     * would be worse than the board simply being a pedal shorter: the person
     * following the link came to look at a rig, not an obituary.
     */
    const back = resolveBoard(decodeBoard("g:big-muff~c:long-gone~c:boss-ds-1"), CATALOG)
    expect(back.map((i) => i.key)).toEqual(["g:big-muff", "c:boss-ds-1"])
  })

  it("drops a guide slug that no longer exists", () => {
    const back = resolveBoard(decodeBoard("g:not-a-pedal~g:big-muff"), CATALOG)
    expect(back.map((i) => i.key)).toEqual(["g:big-muff"])
  })

  it("never throws on junk, however mangled", () => {
    for (const raw of ["", "~~~", ":::", "x:big-muff", "g:", "g", "%%%", "g:big-muff~"]) {
      expect(() => resolveBoard(decodeBoard(raw), CATALOG)).not.toThrow()
    }
  })

  it("ignores the same product listed twice", () => {
    // Two drives is a real board. The same product twice is a paste accident.
    const back = resolveBoard(decodeBoard("c:boss-ds-1~c:boss-ds-1"), CATALOG)
    expect(back).toHaveLength(1)
  })

  it("refuses to open an unbounded board", () => {
    // A hand-written link with two hundred pedals in it should not become two
    // hundred DOM nodes and a power estimate for a rig nobody owns.
    const huge = PEDALS.map((p) => `g:${p.slug}`).join("~").repeat(4)
    expect(resolveBoard(decodeBoard(huge), CATALOG).length).toBeLessThanOrEqual(16)
  })
})
