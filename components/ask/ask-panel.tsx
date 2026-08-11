"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowUp, Sparkles, X } from "lucide-react"
import { ListingImage } from "@/components/listing-image"
import type { SearchHit } from "@/lib/search/types"
import { formatPrice, sourceLabel } from "@/lib/utils"

type Turn = {
  role: "user" | "assistant"
  content: string
  hits?: SearchHit[]
  traces?: string[]
}

/**
 * Suggestions, and they are load bearing.
 *
 * A blank assistant box gets typed into once and abandoned, because nobody
 * knows what it can do. These four are chosen to demonstrate the four
 * different tools behind it (live search, measured market price, the rig
 * dataset, the chain analyser) so a first-time visitor learns the shape of the
 * thing by clicking rather than by reading an explanation.
 */
const SUGGESTIONS = [
  "What fuzz pedals are in stock under $150?",
  "Is $600 a fair price for a used Jazzmaster?",
  "What was on David Gilmour's board for Comfortably Numb?",
  "I have a Big Muff, a DD-3 and a Cry Baby. What order?",
]

export function AskPanel() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [value, setValue] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    inputRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  // Return focus to the opener when the dialog closes, so a keyboard user is
  // not dropped back at the top of the document.
  useEffect(() => {
    if (!open) openerRef.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [turns, pending])

  async function submit(question: string) {
    const trimmed = question.trim()
    if (!trimmed || pending) return

    setValue("")
    setError(null)
    setPending(true)

    // The history sent up is the transcript BEFORE this question, which is
    // what the route expects: it appends the question itself.
    const history = turns.map((turn) => ({ role: turn.role, content: turn.content }))
    setTurns((prev) => [...prev, { role: "user", content: trimmed }])

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "That did not work.")
        return
      }

      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer ?? "",
          hits: Array.isArray(data.hits) ? data.hits : [],
          traces: Array.isArray(data.traces) ? data.traces : [],
        },
      ])
    } catch {
      setError("Could not reach the assistant. Search still works.")
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask about the catalogue"
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--glass-line)] bg-[var(--accent)] px-3 text-[0.8rem] font-semibold text-[var(--accent-text)] transition-colors hover:border-[var(--copper)]"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Ask</span>
      </button>

      {open && (
        <div className="ask-scrim flex items-end justify-center p-0 sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ask about the catalogue"
            className="ask-panel relative flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-display text-base font-black text-[var(--text)]">
                  Ask about the catalogue
                </p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  Answers come from this site&apos;s live listings, not from memory
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted-foreground)] hover:text-[var(--text)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              {turns.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                    It can search live listings, look up what an instrument actually sells for,
                    pull a documented artist rig, and check a signal chain. It will tell you when
                    it does not know rather than guessing, which on a price comparison site
                    matters more than being chatty.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => submit(suggestion)}
                        className="pill text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((turn, index) => (
                <div key={index} className={turn.role === "user" ? "flex justify-end" : ""}>
                  <div className={turn.role === "user" ? "max-w-[85%]" : "w-full"}>
                    <div className="ask-bubble whitespace-pre-wrap" data-role={turn.role}>
                      {turn.content}
                    </div>

                    {turn.hits && turn.hits.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {turn.hits.map((hit) => (
                          <li key={hit.id}>
                            <Link
                              href={hit.gearSlug ? `/gear/${hit.gearSlug}` : `/go/${hit.id}`}
                              className="surface flex items-center gap-3 p-2 transition-colors hover:border-[var(--copper)]"
                            >
                              <ListingImage
                                src={hit.primaryImageUrl}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-md"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-[var(--text)]">
                                  {hit.title}
                                </span>
                                <span className="block text-xs text-[var(--muted-foreground)]">
                                  {sourceLabel(hit.source)}
                                  {hit.condition ? ` · ${hit.condition}` : ""}
                                </span>
                              </span>
                              <span className="card-price shrink-0 text-base">
                                {formatPrice(hit.priceCents, hit.currency)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    {turn.traces && turn.traces.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {turn.traces.map((trace, i) => (
                          <span key={i} className="ask-trace">
                            {trace}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {pending && (
                <p className="ask-typing" aria-live="polite">
                  <span />
                  <span />
                  <span />
                  <span className="sr-only">Working on it</span>
                </p>
              )}

              {error && (
                <p className="text-sm text-[var(--red)]" role="alert">
                  {error}
                </p>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                submit(value)
              }}
              className="border-t border-[var(--line)] p-3"
            >
              <div className="flex items-end gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel2)] p-2 focus-within:border-[var(--sage)]">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter sends, Shift+Enter breaks the line. Standard, and
                    // the alternative (a send button only) costs a reach on
                    // every question.
                    if (event.key !== "Enter" || event.shiftKey) return
                    event.preventDefault()
                    submit(value)
                  }}
                  placeholder="What are you looking for?"
                  className="max-h-32 min-h-9 w-full resize-none border-0 bg-transparent px-1.5 py-1.5 text-sm text-[var(--text)] caret-[var(--sage)] placeholder:text-[var(--dim)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={pending || !value.trim()}
                  aria-label="Send"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] transition-opacity disabled:opacity-35"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 px-1 text-[0.7rem] leading-relaxed text-[var(--dim)]">
                Prices and stock are read live from the same feeds as the rest of the site, and can
                still move before you reach the seller. Confirm the final price on the store.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
