import { describe, expect, it } from "vitest"
import { EFFECTS, EFFECT_ORDER, type EffectType } from "@/lib/pedalboard/chain"
import { SLOTS, type SlotId } from "@/lib/stompbox/chain"

/**
 * THE TWO SIGNAL-CHAIN MODULES MUST AGREE ABOUT SIGNAL ORDER.
 *
 * There are two of them, and there is a real reason for that rather than an
 * unfixed duplication. `lib/stompbox/chain.ts` is editorial: eleven slots, each
 * with a paragraph arguing for its position, rendered as the guide's chain
 * page. `lib/pedalboard/chain.ts` is a planner: fourteen types carrying current
 * draw, an enclosure colour and a keyword table for guessing a type off a feed
 * title. Merging them would force the guide to carry milliamps and the planner
 * to carry prose.
 *
 * WHAT MUST NOT DIFFER IS THE ORDER, and before the merge it did. The two files
 * lived in separate Vercel projects and drifted exactly where nobody was
 * looking:
 *
 *   - a VOLUME PEDAL sat after reverb in the planner and before modulation in
 *     the guide, so the two sites gave different answers to the one question
 *     both of them claim to answer with a reason
 *   - FUZZ had no slot of its own in the planner, which made "put the fuzz
 *     first" inexpressible even though it is the one placement rule here with
 *     an electrical cause rather than a taste
 *   - a NOISE GATE was filed as a utility, whose documented position is
 *     "depends entirely on the job it is doing", which is the opposite of what
 *     a gate's position depends on
 *
 * The owner ruled the guide canonical: it is the site whose whole premise is
 * being right about circuits. The planner adopted its order and kept the three
 * types the guide has no opinion on (pitch, looper, utility).
 *
 * This test is what stops that happening twice. It is deliberately about
 * RELATIVE ORDER rather than about ranks or ids: the planner spaces ranks by
 * ten to leave room for insertions, and the guide has no ranks at all, so
 * asserting on numbers would fail the next time somebody inserts a slot
 * correctly.
 */

/**
 * Guide slot -> planner type, for the slots both files describe.
 *
 * `dynamics` and `compressor` are the same slot under two names, which is
 * itself a piece of the old drift and is mapped rather than renamed: the
 * planner's id is load bearing in `TYPE_PATTERNS`, in `lib/rigs/data.ts` and in
 * every stored board, and renaming it to match a label is not worth a
 * migration.
 */
const SLOT_TO_TYPE: Record<SlotId, EffectType> = {
  tuner: "tuner",
  filter: "filter",
  dynamics: "compressor",
  fuzz: "fuzz",
  drive: "drive",
  eq: "eq",
  gate: "gate",
  volume: "volume",
  modulation: "modulation",
  delay: "delay",
  reverb: "reverb",
}

describe("the guide and the planner agree about signal order", () => {
  it("has a planner type for every slot the guide describes", () => {
    // A slot added to the guide with no counterpart here is the drift starting
    // again, and it is silent: the guide's page renders fine on its own.
    for (const slot of SLOTS) {
      expect(SLOT_TO_TYPE[slot.id], `no planner type for slot "${slot.id}"`).toBeDefined()
      expect(EFFECTS[SLOT_TO_TYPE[slot.id]]).toBeDefined()
    }
  })

  it("puts the shared slots in the same relative order in both files", () => {
    const guideOrder = SLOTS.map((slot) => SLOT_TO_TYPE[slot.id])
    /* The planner's order with its guide-less types removed, so the two lists
       are comparable without pretending the guide has an opinion on a looper. */
    const plannerOrder = EFFECT_ORDER.filter((type) => guideOrder.includes(type))
    expect(plannerOrder).toEqual(guideOrder)
  })

  it("keeps a volume pedal before modulation, which is where the two disagreed", () => {
    // Pinned by name as well as by the list above, because this is the exact
    // pair that drifted and a reader of a failure should see which one it is.
    const rank = (type: EffectType) => EFFECTS[type].rank
    expect(rank("volume")).toBeLessThan(rank("modulation"))
  })

  it("keeps fuzz ahead of the rest of the gain", () => {
    const rank = (type: EffectType) => EFFECTS[type].rank
    expect(rank("fuzz")).toBeLessThan(rank("drive"))
  })

  it("keeps the noise gate after the gain that makes the noise", () => {
    const rank = (type: EffectType) => EFFECTS[type].rank
    expect(rank("gate")).toBeGreaterThan(rank("drive"))
    expect(rank("gate")).toBeGreaterThan(rank("fuzz"))
  })

  it("gives every planner type a full entry, including the ones the guide skips", () => {
    for (const type of EFFECT_ORDER) {
      const meta = EFFECTS[type]
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.why.length).toBeGreaterThan(20)
      expect(meta.hue).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
