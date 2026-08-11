import { describe, expect, it } from "vitest"
import { decodeBoard, decodeRig, encodeRig, MAX_SLOTS } from "@/lib/pedalboard/board-url"

/**
 * The rig URL.
 *
 * The URL is the only persistence this tool has, so a link is both the save
 * feature and the share feature. Two properties matter more than anything
 * else: a link that has been shared must keep working, and a crafted link must
 * not be able to do anything strange.
 */

describe("round trip", () => {
  it("survives a full rig unchanged", () => {
    const layout = {
      boardId: "pedaltrain-classic-2",
      supplyId: "strymon-zuma",
      placements: [
        { key: "boss-ds-1", xMm: 0, yMm: 180, rotation: 0 as const },
        { key: "ibanez-ts9", xMm: 92, yMm: 180, rotation: 90 as const },
      ],
    }

    expect(decodeRig(encodeRig(layout))).toEqual(layout)
  })

  it("keeps a rig with no board or supply chosen yet", () => {
    const layout = {
      boardId: null,
      supplyId: null,
      placements: [{ key: "boss-ds-1", xMm: 10, yMm: 20, rotation: 180 as const }],
    }

    expect(decodeRig(encodeRig(layout))).toEqual(layout)
  })

  it("rounds sub-millimetre drag positions, since that precision is noise", () => {
    const encoded = encodeRig({
      boardId: null,
      supplyId: null,
      placements: [{ key: "a", xMm: 12.7, yMm: 40.2, rotation: 0 }],
    })

    expect(decodeRig(encoded).placements[0]).toEqual({ key: "a", xMm: 13, yMm: 40, rotation: 0 })
  })
})

describe("backward compatibility", () => {
  /**
   * Placement arrived AFTER links were already being shared. A link with only
   * ?board= must still open, with no layout, so the builder can auto-arrange.
   */
  it("leaves an old board-only link perfectly valid", () => {
    const slots = decodeBoard("boss-ds-1,ibanez-ts9")
    expect(slots).toHaveLength(2)

    const rig = decodeRig(undefined)
    expect(rig).toEqual({ boardId: null, supplyId: null, placements: [] })
  })

  it("treats an empty rig parameter as no layout rather than an error", () => {
    expect(decodeRig("")).toEqual({ boardId: null, supplyId: null, placements: [] })
    expect(decodeRig("~~")).toEqual({ boardId: null, supplyId: null, placements: [] })
  })
})

describe("hostile input", () => {
  it("rejects a board id that is not one of our slugs", () => {
    expect(decodeRig("../../etc/passwd~~").boardId).toBeNull()
    expect(decodeRig("Robert'); DROP TABLE~~").boardId).toBeNull()
    expect(decodeRig("UPPERCASE~~").boardId).toBeNull()
  })

  /**
   * Dropped rather than clamped. A corrupt link losing one pedal is obvious;
   * a link silently relocating one to the corner looks like the tool is buggy.
   */
  it("drops a placement pushed to an absurd coordinate", () => {
    expect(decodeRig("~~a:999999:0:0").placements).toHaveLength(0)
    expect(decodeRig("~~a:-50:0:0").placements).toHaveLength(0)
    expect(decodeRig("~~a:NaN:0:0").placements).toHaveLength(0)
  })

  it("drops a placement at an angle a pedal cannot actually sit at", () => {
    expect(decodeRig("~~a:0:0:45").placements).toHaveLength(0)
    expect(decodeRig("~~a:0:0:0").placements).toHaveLength(1)
    expect(decodeRig("~~a:0:0:270").placements).toHaveLength(1)
  })

  it("keeps the first of a duplicated key rather than stacking two", () => {
    const placements = decodeRig("~~a:0:0:0,a:100:0:0").placements
    expect(placements).toHaveLength(1)
    expect(placements[0].xMm).toBe(0)
  })

  it("caps the placement count at the board's slot limit", () => {
    const many = Array.from({ length: MAX_SLOTS + 12 }, (_, i) => `p${i}:0:0:0`).join(",")
    expect(decodeRig(`~~${many}`).placements).toHaveLength(MAX_SLOTS)
  })

  it("ignores malformed tokens without losing the good ones around them", () => {
    const placements = decodeRig("~~a:0:0:0,,garbage,b:50:10:90").placements
    expect(placements.map((p) => p.key)).toEqual(["a", "b"])
  })
})
