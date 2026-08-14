import { describe, expect, it } from "vitest"
import {
  decodeBoard,
  encodeBoard,
  itemFromCatalog,
  itemFromGuide,
  MAX_ITEMS,
  orderBoard,
  resolveBoard,
  slotForCatalogType,
  type BoardItem,
} from "@/lib/board"
import type { CatalogPedal } from "@/lib/catalog"
import { chainNotes, SLOTS } from "@/lib/chain"
import { PEDALS, pedalBySlug } from "@/lib/pedals"

/**
 * The board.
 *
 * The thing most worth pinning is the seam between the two sources. A guide
 * entry is a circuit somebody read; a catalogue row is a product name with a
 * slot inferred from it. Anything that lets the second borrow the first's
 * authority is the bug this file is looking for.
 */

function catalogPedal(overrides: Partial<CatalogPedal> = {}): CatalogPedal {
  return {
    slug: "boss-ds-1-distortion",
    brand: "Boss",
    model: "DS-1 Distortion",
    imageUrl: null,
    marketPriceCents: null,
    marketPriceClass: null,
    sampleSize: 0,
    listingCount: 1,
    type: "drive",
    ...overrides,
  }
}

describe("slotForCatalogType", () => {
  it("maps every slot this guide documents onto itself where the names agree", () => {
    expect(slotForCatalogType("tuner")).toBe("tuner")
    expect(slotForCatalogType("filter")).toBe("filter")
    expect(slotForCatalogType("drive")).toBe("drive")
    expect(slotForCatalogType("eq")).toBe("eq")
    expect(slotForCatalogType("modulation")).toBe("modulation")
    expect(slotForCatalogType("delay")).toBe("delay")
    expect(slotForCatalogType("reverb")).toBe("reverb")
    expect(slotForCatalogType("volume")).toBe("volume")
  })

  it("maps the two names that differ", () => {
    // The sister site calls it compressor; this guide's slot is dynamics.
    expect(slotForCatalogType("compressor")).toBe("dynamics")
    // Stated approximation: pitch conventionally sits with the modulation block.
    expect(slotForCatalogType("pitch")).toBe("modulation")
  })

  it("refuses to place a looper or a utility box", () => {
    /*
     * The important half. A looper conventionally goes last or in the amp's
     * loop and this chain ends at reverb; "utility" covers a gate, an ABY, a
     * DI and a buffer, which belong in four different places. Returning any
     * slot for these would be picking a position at random and printing it
     * with the same confidence as a documented one.
     */
    expect(slotForCatalogType("looper")).toBeNull()
    expect(slotForCatalogType("utility")).toBeNull()
    expect(slotForCatalogType("something-new")).toBeNull()
  })

  it("only ever returns a slot this guide actually documents", () => {
    const known = new Set(SLOTS.map((slot) => slot.id))
    for (const type of ["tuner", "filter", "compressor", "drive", "eq", "pitch", "modulation", "delay", "reverb", "volume", "looper", "utility"]) {
      const slot = slotForCatalogType(type)
      if (slot !== null) expect(known).toContain(slot)
    }
  })
})

describe("itemFromCatalog", () => {
  it("marks the circuit as unknown, which is the whole point", () => {
    const item = itemFromCatalog(catalogPedal())
    expect(item?.circuitKnown).toBe(false)
    expect(item?.source).toBe("catalogue")
  })

  it("carries no price, no merchant and no link onto the board", () => {
    const item = itemFromCatalog(
      catalogPedal({ marketPriceCents: 4500, marketPriceClass: "used", sampleSize: 9 }),
    )
    const serialized = JSON.stringify(item)
    expect(serialized).not.toContain("4500")
    expect(serialized).not.toContain("marketPrice")
    expect(Object.keys(item as object)).not.toContain("marketPriceCents")
  })

  it("returns null rather than a wrong slot for an unplaceable type", () => {
    expect(itemFromCatalog(catalogPedal({ type: "looper" }))).toBeNull()
  })
})

describe("itemFromGuide", () => {
  it("carries the circuit facts across", () => {
    const fuzz = PEDALS.find((pedal) => pedal.wantsGuitarDirect)
    expect(fuzz).toBeDefined()
    const item = itemFromGuide(fuzz!)
    expect(item.circuitKnown).toBe(true)
    expect(item.wantsGuitarDirect).toBe(true)
  })

  it("keys itself apart from a catalogue row that shares a slug", () => {
    // "ds-1" the circuit entry and "ds-1" the product row must never collide.
    const guide = itemFromGuide(pedalBySlug("ds-1")!)
    const shop = itemFromCatalog(catalogPedal({ slug: "ds-1" }))
    expect(guide.key).not.toBe(shop?.key)
  })
})

describe("orderBoard", () => {
  const item = (key: string, slot: BoardItem["slot"]): BoardItem => ({
    key,
    name: key,
    maker: null,
    slot,
    source: "guide",
    imageUrl: null,
    engaged: true,
  })

  it("puts the chain in signal order whatever order things were added in", () => {
    const ordered = orderBoard([
      item("reverb", "reverb"),
      item("tuner", "tuner"),
      item("drive", "drive"),
    ])
    expect(ordered.map((entry) => entry.key)).toEqual(["tuner", "drive", "reverb"])
  })

  it("is stable inside a slot, because which of two drives goes first is not ours to decide", () => {
    const ordered = orderBoard([item("second", "drive"), item("first", "drive")])
    expect(ordered.map((entry) => entry.key)).toEqual(["second", "first"])
  })
})

describe("the shareable link", () => {
  const guide = itemFromGuide(pedalBySlug("tube-screamer")!)
  const shop = itemFromCatalog(catalogPedal())!

  it("round trips a board", () => {
    const encoded = encodeBoard([guide, { ...shop, engaged: false }])
    const decoded = decodeBoard(encoded)
    expect(decoded).toEqual([
      { key: guide.key, engaged: true },
      { key: shop.key, engaged: false },
    ])
  })

  it("survives a link somebody mangled rather than throwing", () => {
    // Every one of these is something a chat client, a bookmark or a person
    // editing a URL by hand will eventually produce.
    expect(decodeBoard(null)).toEqual([])
    expect(decodeBoard("")).toEqual([])
    expect(decodeBoard("~~~")).toEqual([])
    expect(decodeBoard("nonsense")).toEqual([])
    expect(decodeBoard("g:tube-screamer~<script>")).toEqual([
      { key: "g:tube-screamer", engaged: true },
    ])
  })

  it("drops a repeat rather than wiring the same pedal in twice", () => {
    expect(decodeBoard("g:rat~g:rat")).toHaveLength(1)
  })

  it("stops at the board's capacity", () => {
    const tokens = Array.from({ length: MAX_ITEMS + 6 }, (_, i) => `g:pedal-${i}`).join("~")
    expect(decodeBoard(tokens)).toHaveLength(MAX_ITEMS)
  })

  it("drops keys that no longer resolve, so a stale link opens a shorter board", () => {
    const resolved = resolveBoard(
      decodeBoard("g:tube-screamer~g:a-pedal-that-was-renamed~c:not-in-stock-any-more"),
      [catalogPedal()],
    )
    expect(resolved.map((entry) => entry.key)).toEqual(["g:tube-screamer"])
  })

  it("resolves a catalogue key against the catalogue it is given", () => {
    const resolved = resolveBoard(decodeBoard("c:boss-ds-1-distortion"), [catalogPedal()])
    expect(resolved).toHaveLength(1)
    expect(resolved[0].circuitKnown).toBe(false)
  })
})

describe("notes about a board the guide has not read", () => {
  it("says so, because silence would read as a clean bill of health", () => {
    const notes = chainNotes([itemFromCatalog(catalogPedal())!])
    const disclaimer = notes.find((note) => note.title.includes("no circuit notes"))
    expect(disclaimer).toBeDefined()
    expect(disclaimer?.body).toContain("Absence of a warning is not a clean bill of health")
  })

  it("does not read an unknown circuit as a documented absence", () => {
    /*
     * The bug this guards. A catalogue row has no `buffered` field because
     * nobody knows, and a guide entry has none because it was checked and it
     * is not. Treating the first like the second is how this site would start
     * claiming a pedal has true bypass on the strength of a product name.
     */
    const fuzz = itemFromGuide(PEDALS.find((pedal) => pedal.wantsGuitarDirect)!)
    const unknown = itemFromCatalog(catalogPedal())!
    const notes = chainNotes([fuzz, unknown])
    expect(notes.some((note) => note.title.includes("buffer is sharing the board"))).toBe(false)
  })

  it("still fires the buffer warning when both halves are documented", () => {
    const fuzz = PEDALS.find((pedal) => pedal.wantsGuitarDirect)
    const buffered = PEDALS.find((pedal) => pedal.buffered)
    expect(fuzz && buffered).toBeTruthy()
    const notes = chainNotes([itemFromGuide(fuzz!), itemFromGuide(buffered!)])
    expect(notes.some((note) => note.level === "warn")).toBe(true)
  })

  it("leaves the guide-only notes exactly as they were", () => {
    // chainNotes(PEDALS) is what the chain page has always called. Widening
    // the parameter type must not change a single word of that output.
    const notes = chainNotes(PEDALS)
    expect(notes.some((note) => note.title.includes("no circuit notes"))).toBe(false)
  })
})
