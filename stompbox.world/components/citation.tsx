import { citationProblems, VOICE_BY_ID, type Citation } from "@/lib/voices"

/**
 * A quote from somebody who builds these things, with its source attached.
 *
 * ATTRIBUTION IS NOT OPTIONAL AND NOT COLLAPSIBLE. The speaker, what they do,
 * where they said it and a link to it are all rendered every time, right under
 * the words. The rule the family applies to Wikimedia photographs is the same
 * one: no attribution, no image. Here it is no citation, no quote, and it is
 * enforced by returning null rather than by anybody remembering.
 *
 * ROLE SITS NEXT TO THE WORDS ON PURPOSE. A builder explaining a circuit is
 * primary source material and an interested party at the same time. Printing
 * "Founder of JHS Pedals" beside the quote is what lets a reader weigh it as
 * expert opinion rather than read it as a neutral finding, which matters most
 * exactly when the quote is about a competitor's pedal or their own.
 *
 * QUIETER THAN THE PROSE AROUND IT. A quote is evidence for the page's argument,
 * not the argument, so it sits in a bordered aside at body size rather than being
 * blown up as a pull quote. Blockquote styling that shouts turns a citation into
 * a testimonial, which is a different kind of page.
 */
export function CitationBlock({ citation }: { citation: Citation }) {
  const problems = citationProblems(citation)
  const voice = VOICE_BY_ID.get(citation.voiceId)

  /*
   * An incomplete citation renders NOTHING rather than rendering the words
   * without their source. A test fails on it too, so this is defence in depth
   * for the one mistake that must never reach a reader: a real person's name
   * over text nobody can check.
   */
  if (problems.length > 0 || !voice) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[citation] not rendered for "${citation.source}": ${problems.join(" ") || "unknown voice"}`,
      )
    }
    return null
  }

  return (
    <aside className="surface border-l-2 border-l-[var(--brand-gold)] p-5">
      <p className="stencil">
        {citation.paraphrase ? "Sourced, in our words" : "In their words"}
      </p>

      {citation.paraphrase ? (
        <p className="mt-3 leading-relaxed text-[var(--text)]">{citation.quote}</p>
      ) : (
        <blockquote className="mt-3">
          <p className="leading-relaxed text-[var(--text)]">
            {/* Typographic quotes drawn by the component, so the data stays clean
                and a stray straight quote in the source cannot break the markup. */}
            &ldquo;{citation.quote}&rdquo;
          </p>
        </blockquote>
      )}

      <footer className="mt-4 text-sm text-[var(--dim)]">
        <p>
          <a
            href={voice.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
          >
            {voice.name}
          </a>
          , {voice.role}
        </p>
        <p className="mt-1">
          <a
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:text-[var(--text)] hover:underline"
          >
            {citation.source}
          </a>
          , {citation.published}
          {citation.paraphrase ? ". Summarised rather than quoted, so check the source." : ""}
        </p>

        {/*
          Said out loud, because it is the thing a reader most needs and would
          otherwise have to infer from a company name.
        */}
        {citation.aboutOwnProduct && (
          <p className="mt-1 text-[var(--dim)]">
            Speaking about a pedal they build or sell.
          </p>
        )}
      </footer>
    </aside>
  )
}
