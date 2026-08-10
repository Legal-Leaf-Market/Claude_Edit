"use client"

import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

/**
 * Header search. A plain form submit rather than live search on keystroke:
 * every query becomes a real, shareable, indexable URL, which is worth more to
 * this site than shaving a round trip off typing.
 */
export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get("q") ?? "")

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
        Search used music gear
      </label>
      {/* The family's .searchbox: a full pill that borders sage on focus, with
          the caret in sage too. Focus turning green rather than the accent
          colour is shared across all four sites. */}
      <div className="flex items-center gap-[9px] rounded-full border border-[var(--line)] bg-[var(--panel2)] px-4 py-[9px] transition-colors focus-within:border-[var(--sage)]">
        <Search className="h-4 w-4 shrink-0 text-[var(--dim)]" aria-hidden="true" />
        <input
          id="site-search"
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Stratocaster, SM58, Juno-106..."
          className="w-full min-w-0 border-0 bg-transparent text-[0.95rem] text-[var(--cream)] caret-[var(--sage)] placeholder:text-[var(--dim)] focus:outline-none"
        />
      </div>
    </form>
  )
}
