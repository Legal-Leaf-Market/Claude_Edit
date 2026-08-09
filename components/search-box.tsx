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
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
        <input
          id="site-search"
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Stratocaster, SM58, Juno-106..."
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
    </form>
  )
}
