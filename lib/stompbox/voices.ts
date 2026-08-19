/**
 * People worth quoting on pedal circuits, and the rules for quoting them.
 *
 * WHY THIS IS A REGISTRY AND NOT A STRING ON EACH ENTRY. A quote attributed to a
 * named, living person is the highest-stakes claim this site can print. It is
 * higher stakes than a circuit description, which a reader can check against the
 * pedal in front of them, and higher than a decade, which is hedged by design.
 * Nobody can check a quote by listening. They can only trust it, or find the
 * source. So the source is mandatory, structurally, and the type below cannot be
 * satisfied without one.
 *
 * THE RULE THIS FILE ENFORCES: NO QUOTE WITHOUT A CITATION A READER CAN OPEN.
 * Every quote needs the speaker, what they do (which is context, not flattery),
 * where they said it, roughly when, and a URL. A remembered paraphrase with a
 * name on it is the thing this design exists to make impossible, because it
 * reads exactly like a sourced quote and is not one.
 *
 * NOT COVERED BY THE NO-CREDITS RULE, AND WORTH BEING PRECISE ABOUT WHY.
 * CLAUDE.md section 2 forbids artist attribution: "this pedal is on that record"
 * is a claim about a session nobody here witnessed, and a rig changes between
 * takes. This is a different kind of claim. A builder explaining a circuit they
 * designed, on the record, in public, is primary source material about the
 * subject of the page. The dataset still carries no artist field and the test
 * still asserts it.
 *
 * BUT A BUILDER IS NOT A DISINTERESTED PARTY, and the site's own editorial
 * stance depends on noticing that. lib/catalog.ts says the reason a circuit
 * entry carries no price and no merchant is so that the sentence calling a pedal
 * thin is written by somebody with nothing riding on it. A quote from the
 * founder of a pedal company is expert AND interested, often about their own
 * product or a competitor's. That is why `role` is required rather than
 * decorative: it is printed next to the words so a reader weighs them knowing
 * who is speaking. A quote from a builder about their own pedal also gets
 * `aboutOwnProduct`, which the renderer says out loud.
 */

export type Voice = {
  id: string
  /** Full name, spelled the way they spell it. */
  name: string
  /**
   * What they do, in the words a reader needs to weigh the quote.
   *
   * Required, and not a compliment. "Founder of JHS Pedals" is the context that
   * makes a quote about a Tube Screamer readable as an interested expert opinion
   * rather than a neutral finding.
   */
  role: string
  /** Where their published work lives, so a reader can go and check the rest of it. */
  homepage: string
}

/**
 * The voices this site is prepared to quote.
 *
 * EVERY ENTRY HERE IS A PERSON WHOSE NAME AND ROLE I AM CONFIDENT OF. A wrong
 * name over a real quote is a worse error than no quote at all, because it
 * misattributes somebody's words in public. Where a name is uncertain it stays
 * out of this file until it is checked against the source, and the source is the
 * company's own site or the person's own channel, not a recollection.
 */
export const VOICES: Voice[] = [
  {
    id: "josh-scott",
    name: "Josh Scott",
    role: "Founder of JHS Pedals, and host of The JHS Show",
    homepage: "https://www.jhspedals.info/",
  },
  {
    id: "brian-wampler",
    name: "Brian Wampler",
    role: "Founder of Wampler Pedals",
    homepage: "https://www.wamplerpedals.com/",
  },
]

export const VOICE_BY_ID = new Map(VOICES.map((voice) => [voice.id, voice]))

export type Citation = {
  /** Which voice. Must be a real id: an unknown one is a build-time mistake, not a fallback. */
  voiceId: string
  /**
   * Their words, verbatim, inside the quotation marks the renderer draws.
   *
   * VERBATIM OR NOT AT ALL. A tightened paraphrase in quotation marks is a
   * fabrication with a citation stapled to it, which is worse than an uncited
   * paraphrase because the citation buys it trust it has not earned. If the
   * useful version is a summary, write it as the site's own sentence in
   * `circuit` and cite the source with `paraphrase: true`.
   */
  quote: string
  /** True when the text above is the site's summary rather than their words. */
  paraphrase?: boolean
  /** What it appeared in: an episode title, an article title, an interview. */
  source: string
  /** Decade or year is fine here, unlike `era`: a citation's date is a fact about a publication. */
  published: string
  /** Where to go and check it. Required. */
  url: string
  /** True when the speaker built or sells the pedal being discussed. */
  aboutOwnProduct?: boolean
}

/**
 * Reasons a citation cannot be rendered.
 *
 * Returns the problems rather than throwing, so a half-entered citation is a
 * visible failure in CI and an omission on the page, never a quote missing its
 * attribution. The one thing that must not happen is words appearing on the page
 * with a name attached and no way to check them.
 */
export function citationProblems(citation: Citation): string[] {
  const problems: string[] = []

  if (!VOICE_BY_ID.has(citation.voiceId)) {
    problems.push(`Unknown voice "${citation.voiceId}". Add them to VOICES with a checked name and role.`)
  }
  if (citation.quote.trim().length < 20) {
    problems.push("The quote is too short to be a quote. A fragment of a sentence loses the context that made it true.")
  }
  if (!citation.source.trim()) problems.push("No source named.")
  if (!citation.published.trim()) problems.push("No publication date.")

  try {
    const url = new URL(citation.url)
    if (url.protocol !== "https:") problems.push("The citation URL is not https.")
  } catch {
    problems.push("The citation URL is not a URL a reader can open.")
  }

  return problems
}

export function isRenderableCitation(citation: Citation): boolean {
  return citationProblems(citation).length === 0
}
