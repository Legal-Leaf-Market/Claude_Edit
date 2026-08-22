import { describe, expect, it } from "vitest"
import { citationProblems, isRenderableCitation, VOICES, VOICE_BY_ID, type Citation } from "@/lib/stompbox/voices"
import { PEDALS } from "@/lib/stompbox/pedals"

/**
 * Quoting real people.
 *
 * This is the highest-stakes thing the site prints. A circuit description can be
 * checked against the pedal in your hands and an era is hedged to a decade, but
 * a quote can only be trusted or traced, so the tests here are about making the
 * untraceable version impossible rather than about formatting.
 *
 * The failure being defended against is specific: words appearing on the page
 * with a real person's name attached and no way to check whether they said them.
 * That is not a bug, it is a fabrication, and it does not announce itself.
 */

function citation(overrides: Partial<Citation> = {}): Citation {
  return {
    voiceId: "josh-scott",
    quote: "A long enough sentence to count as a real quotation rather than a fragment.",
    source: "The JHS Show, episode title",
    published: "2021",
    url: "https://example.com/some-episode",
    ...overrides,
  }
}

describe("the voices registry", () => {
  it("gives every voice a name, a role and somewhere to check their work", () => {
    for (const voice of VOICES) {
      expect(voice.name.length, voice.id).toBeGreaterThan(3)
      expect(voice.role.length, voice.id).toBeGreaterThan(10)
      expect(() => new URL(voice.homepage), voice.id).not.toThrow()
    }
  })

  it("has unique ids", () => {
    expect(new Set(VOICES.map((v) => v.id)).size).toBe(VOICES.length)
  })

  /**
   * `role` exists so a reader can weigh the words, which only works if it says
   * what the person's interest is. "Legend" would be flattery; "Founder of JHS
   * Pedals" is the fact that makes a quote about a Tube Screamer readable.
   */
  it("states what each voice actually does, not how good they are", () => {
    for (const voice of VOICES) {
      expect(voice.role, voice.id).toMatch(/founder|builder|designer|engineer|host|author|editor/i)
    }
  })
})

describe("a citation cannot skip its source", () => {
  it("accepts a complete one", () => {
    expect(citationProblems(citation())).toEqual([])
    expect(isRenderableCitation(citation())).toBe(true)
  })

  it("rejects a quote from somebody not in the registry", () => {
    const problems = citationProblems(citation({ voiceId: "someone-i-half-remember" }))
    expect(problems.join(" ")).toMatch(/Unknown voice/)
  })

  it("rejects a citation with no source, no date, or no link", () => {
    expect(citationProblems(citation({ source: "" })).length).toBeGreaterThan(0)
    expect(citationProblems(citation({ published: "" })).length).toBeGreaterThan(0)
    expect(citationProblems(citation({ url: "" })).length).toBeGreaterThan(0)
    expect(citationProblems(citation({ url: "not a url" })).length).toBeGreaterThan(0)
  })

  /** A fragment loses the context that made the sentence true. */
  it("rejects a quote too short to be one", () => {
    expect(citationProblems(citation({ quote: "It is great." })).length).toBeGreaterThan(0)
  })

  it("insists on https, so a citation cannot be served over a link that can be tampered with", () => {
    expect(citationProblems(citation({ url: "http://example.com/x" })).length).toBeGreaterThan(0)
  })
})

describe("what the dataset is allowed to carry", () => {
  /**
   * THE POINT OF ALL OF THIS. Every citation on every entry has to be
   * renderable, which means every quote on the site is traceable to a source a
   * reader can open. An entry with no citations passes: silence is honest, and
   * an empty field is the expected state until somebody has read a real quote at
   * its source.
   */
  it("has no unsourced quote anywhere in the dataset", () => {
    for (const pedal of PEDALS) {
      for (const entry of pedal.citations ?? []) {
        expect(citationProblems(entry), `${pedal.slug}: ${entry.source}`).toEqual([])
      }
    }
  })

  it("only ever quotes somebody the registry knows", () => {
    for (const pedal of PEDALS) {
      for (const entry of pedal.citations ?? []) {
        expect(VOICE_BY_ID.has(entry.voiceId), `${pedal.slug}`).toBe(true)
      }
    }
  })

  /**
   * The no-artist-credit rule still stands, and this is where it would be
   * eroded: a "quote" is a legitimate way to smuggle "so-and-so used this on
   * that record" onto the page. A quote may name a player if the speaker did,
   * but the dataset still carries no artist FIELD, which is what
   * tests/pedals.test.ts asserts and what this one leaves alone.
   */
  it("adds no artist-shaped field alongside citations", () => {
    for (const pedal of PEDALS) {
      const keys = Object.keys(pedal)
      for (const forbidden of ["artist", "artists", "usedBy", "players", "famousFor", "credits"]) {
        expect(keys, pedal.slug).not.toContain(forbidden)
      }
    }
  })
})
