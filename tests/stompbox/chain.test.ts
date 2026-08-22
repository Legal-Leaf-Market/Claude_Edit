import { describe, expect, it } from "vitest"
import { chainNotes, orderPedals, SLOTS, slotIndex } from "@/lib/stompbox/chain"
import { PEDALS } from "@/lib/stompbox/pedals"

describe("orderPedals", () => {
  it("puts the chain in signal order regardless of the order given", () => {
    const ordered = orderPedals(["dd-2", "tube-screamer", "cry-baby", "fuzz-face"])
    expect(ordered.map((pedal) => pedal.slug)).toEqual([
      "cry-baby",
      "fuzz-face",
      "tube-screamer",
      "dd-2",
    ])
  })

  it("keeps fuzz ahead of drive, which is the whole point of the fuzz slot", () => {
    const ordered = orderPedals(["tube-screamer", "big-muff"])
    expect(slotIndex(ordered[0].slot)).toBeLessThan(slotIndex(ordered[1].slot))
    expect(ordered[0].slug).toBe("big-muff")
  })

  it("is stable within a slot, because which of two drives goes first is a taste call", () => {
    expect(orderPedals(["rat", "tube-screamer"]).map((p) => p.slug)).toEqual([
      "rat",
      "tube-screamer",
    ])
    expect(orderPedals(["tube-screamer", "rat"]).map((p) => p.slug)).toEqual([
      "tube-screamer",
      "rat",
    ])
  })

  it("drops unknown slugs rather than throwing, so a stale link renders a shorter board", () => {
    expect(orderPedals(["tube-screamer", "not-a-pedal"]).map((p) => p.slug)).toEqual([
      "tube-screamer",
    ])
    expect(orderPedals([])).toEqual([])
  })
})

describe("chainNotes", () => {
  it("warns when a buffered pedal shares a board with a fuzz that wants the guitar direct", () => {
    const notes = chainNotes(orderPedals(["klon-centaur", "fuzz-face"]))
    const warning = notes.find((note) => note.level === "warn")
    expect(warning).toBeDefined()
    expect(warning?.body).toContain("Fuzz Face")
    expect(warning?.body).toContain("Centaur")
  })

  it("does not warn about a buffer when no sensitive fuzz is present", () => {
    const notes = chainNotes(orderPedals(["klon-centaur", "big-muff"]))
    expect(notes.some((note) => note.level === "warn")).toBe(false)
  })

  it("does not warn about a sensitive fuzz when no buffer is present", () => {
    const notes = chainNotes(orderPedals(["fuzz-face", "rat"]))
    expect(notes.some((note) => note.level === "warn")).toBe(false)
  })

  it("flags two pedals sharing a slot without picking an order for them", () => {
    const notes = chainNotes(orderPedals(["rat", "tube-screamer"]))
    const note = notes.find((entry) => entry.title.includes("overdrive and distortion"))
    expect(note).toBeDefined()
    expect(note?.level).toBe("info")
    expect(note?.body).toContain("taste call")
  })

  /*
   * The notes are assembled from fragments, so every count-dependent verb is a
   * place the prose can go wrong. These pin the singular and plural forms of
   * each one, because "Centaur and Tube Screamer all sit" reads as broken
   * English on a page whose whole claim is that the writing is careful.
   */
  it("agrees its verbs with one pedal and with several", () => {
    const two = chainNotes(orderPedals(["rat", "tube-screamer"])).find((n) =>
      n.title.includes("overdrive"),
    )
    expect(two?.body).toContain("both sit")
    expect(two?.body).not.toContain("all sit")

    const three = chainNotes(orderPedals(["rat", "tube-screamer", "ds-1"])).find((n) =>
      n.title.includes("overdrive"),
    )
    expect(three?.body).toContain("all sit")

    const oneFuzz = chainNotes(orderPedals(["klon-centaur", "fuzz-face"])).find(
      (n) => n.level === "warn",
    )
    expect(oneFuzz?.title).toContain("a fuzz that does not want one")
    expect(oneFuzz?.body).toContain("loads the guitar's pickups")
    expect(oneFuzz?.body).toContain("has a buffered output")

    const twoFuzz = chainNotes(orderPedals(["klon-centaur", "fuzz-face", "octavia"])).find(
      (n) => n.level === "warn",
    )
    expect(twoFuzz?.title).toContain("fuzzes that do not want one")
    expect(twoFuzz?.body).toContain("load the guitar's pickups")

    const oneDigital = chainNotes(orderPedals(["dd-2"])).find((n) =>
      n.title.includes("power budget"),
    )
    expect(oneDigital?.body).toContain("is a digital circuit")
  })

  it("says a digital pedal wants a power check, without inventing a current figure", () => {
    const notes = chainNotes(orderPedals(["dd-2"]))
    const note = notes.find((entry) => entry.title.includes("power budget"))
    expect(note).toBeDefined()
    // The house rule: no measurement this repo cannot back up. A milliamp
    // number printed here would be a guess presented as a spec.
    expect(note?.body).not.toMatch(/\d+\s?mA/i)
  })

  it("returns nothing at all for an empty board", () => {
    expect(chainNotes([])).toEqual([])
  })
})

describe("SLOTS", () => {
  it("has a unique id per slot and an index that matches its position", () => {
    const ids = SLOTS.map((slot) => slot.id)
    expect(new Set(ids).size).toBe(ids.length)
    SLOTS.forEach((slot, index) => expect(slotIndex(slot.id)).toBe(index))
  })

  it("gives every slot a reason, because a rule with no reason cannot be argued with", () => {
    for (const slot of SLOTS) {
      expect(slot.why.length).toBeGreaterThan(80)
      expect(slot.examples.length).toBeGreaterThan(0)
    }
  })

  it("only uses slot ids that the dataset can actually reference", () => {
    for (const pedal of PEDALS) {
      expect(SLOTS.some((slot) => slot.id === pedal.slot)).toBe(true)
    }
  })
})
