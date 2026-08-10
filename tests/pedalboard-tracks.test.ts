import { describe, expect, it } from "vitest"
import { TRACKS } from "@/lib/pedalboard/tracks"

/**
 * Pure data sanity checks for the "Iconic Tracks" roster, the same kind of
 * check pedalboard-icons.test.ts runs for Iconic Rigs: no database needed,
 * just guarding against copy-paste slips (a duplicate id breaking React's
 * key prop, an empty field silently rendering nothing, a track with no gear
 * at all).
 */
describe("TRACKS", () => {
  it("has a substantial, well-sourced roster", () => {
    expect(TRACKS.length).toBeGreaterThanOrEqual(10)
  })

  it("has unique ids, since those are used as React keys", () => {
    const ids = TRACKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("gives every entry the fields the UI depends on", () => {
    for (const track of TRACKS) {
      expect(track.song.trim()).not.toBe("")
      expect(track.artist.trim()).not.toBe("")
      expect(track.album.trim()).not.toBe("")
      expect(track.year).toBeGreaterThan(1900)
      expect(track.year).toBeLessThanOrEqual(new Date().getFullYear())
      expect(track.blurb.trim().length).toBeGreaterThan(10)
      expect(track.hue).toMatch(/^hsl\(/)
    }
  })

  it("gives every track at least one piece of gear with a brand and model", () => {
    for (const track of TRACKS) {
      expect(track.gear.length).toBeGreaterThan(0)
      for (const gear of track.gear) {
        expect(gear.brand.trim()).not.toBe("")
        expect(gear.model.trim()).not.toBe("")
      }
    }
  })

  it("only ever uses HIGH or MEDIUM confidence, never an unverifiable LOW claim", () => {
    for (const track of TRACKS) {
      expect(["HIGH", "MEDIUM"]).toContain(track.confidence)
    }
  })

  it("spreads hues across the full range rather than clustering", () => {
    const hues = TRACKS.map((t) => Number(t.hue.match(/hsl\((\d+)/)?.[1]))
    const uniqueHues = new Set(hues)
    expect(uniqueHues.size).toBe(TRACKS.length)
  })

  it("has no em dashes in any copy field, per house style", () => {
    const emDash = "—"
    for (const track of TRACKS) {
      expect(track.blurb).not.toContain(emDash)
      expect(track.song).not.toContain(emDash)
      expect(track.artist).not.toContain(emDash)
      expect(track.album).not.toContain(emDash)
    }
  })
})
