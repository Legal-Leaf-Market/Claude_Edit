"use client"

import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

/**
 * Header search. A plain form submit rather than live search on keystroke:
 * every query becomes a real, shareable, indexable URL, which is worth more to
 * this site than shaving a round trip off typing.
 *
 * The "/" shortcut is the one piece of live behaviour. It is the convention on
 * every search-first site a musician already uses, it costs one keydown
 * listener, and on an aggregator the search field is where a returning visitor
 * wants to be within a second of the page painting.
 */
export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get("q") ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the field in step when the query changes underneath us, which happens
  // when a shopper clicks a suggested search or hits back. Without this the box
  // keeps showing whatever was typed last, contradicting the results below it.
  useEffect(() => {
    setValue(params.get("q") ?? "")
  }, [params])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
      // Never steal the keystroke from someone typing into something else,
      // including a rich-text area or any other focused field.
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return
      }
      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const query = value.trim()
    // Carry the active filters over so searching from a filtered page narrows
    // rather than resetting the shopper's context.
    const next = new URLSearchParams(params.toString())
    if (query) next.set("q", query)
    else next.delete("q")
    next.delete("page")
    router.push(`/search?${next.toString()}`)
  }

  return (
    <form onSubmit={onSubmit} role="search" className={className}>
      <label htmlFor="site-search" className="sr-only">
        Search music gear
      </label>
      {/* The family's .searchbox: a full pill that borders sage on focus, with
          the caret in sage too. Focus turning green rather than the accent
          colour is shared across all four sites. */}
      <div className="flex items-center gap-[9px] rounded-full border border-[var(--line)] bg-[var(--panel2)] px-4 py-[9px] transition-colors focus-within:border-[var(--sage)]">
        <Search className="h-4 w-4 shrink-0 text-[var(--dim)]" aria-hidden="true" />
        <input
          ref={inputRef}
          id="site-search"
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Stratocaster, Big Muff, SM58, Juno-106..."
          className="w-full min-w-0 border-0 bg-transparent text-[0.95rem] text-[var(--text)] caret-[var(--sage)] placeholder:text-[var(--dim)] focus:outline-none"
        />
        <kbd
          aria-hidden="true"
          className="hidden shrink-0 rounded border border-[var(--line)] bg-[var(--chip)] px-1.5 py-0.5 font-sans text-[0.65rem] font-semibold text-[var(--dim)] lg:block"
        >
          /
        </kbd>
      </div>
    </form>
  )
}
