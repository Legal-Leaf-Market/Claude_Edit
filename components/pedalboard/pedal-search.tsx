"use client"

import { useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"
import { ListingImage } from "@/components/listing-image"
import { formatPrice } from "@/lib/utils"
import type { PedalSummary } from "@/lib/pedalboard/queries"

/**
 * Autocomplete box for adding a pedal to the board.
 *
 * Debounced rather than live-on-keystroke: this hits the database on every
 * change, and firing it for every letter of "tube screamer" would be nine
 * queries for one pedal. An empty box still shows something (the most-listed
 * pedals, passed in as `suggestions`), so there is never a dead-end blank
 * dropdown before a shopper has typed anything.
 */
export function PedalSearch({
  suggestions,
  onAdd,
  disabledSlugs,
}: {
  suggestions: PedalSummary[]
  onAdd: (pedal: PedalSummary) => void
  disabledSlugs: Set<string>
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<PedalSummary[]>(suggestions)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults(suggestions)
      return
    }
    setLoading(true)
    const handle = setTimeout(() => {
      fetch(`/api/pedalboard/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => setResults(data.pedals ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [query, suggestions])

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Tube Screamer, Big Muff, Deco..."
          className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {open && (
        <div className="panel absolute z-20 mt-1.5 max-h-96 w-full overflow-y-auto p-1.5 shadow-xl">
          {!query.trim() && (
            <p className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Most listed pedals
            </p>
          )}
          {loading && <p className="px-2.5 py-2 text-sm text-[var(--muted-foreground)]">Searching...</p>}
          {!loading && results.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-[var(--muted-foreground)]">
              No pedals matched. Try a shorter name or just the brand.
            </p>
          )}
          {!loading &&
            results.map((pedal) => {
              const already = disabledSlugs.has(pedal.slug)
              return (
                <button
                  key={pedal.slug}
                  type="button"
                  disabled={already}
                  onClick={() => {
                    onAdd(pedal)
                    setQuery("")
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-[var(--secondary)]"
                >
                  <ListingImage
                    src={pedal.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[var(--cream)]">
                      {pedal.brand} {pedal.model}
                    </span>
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {pedal.marketPriceCents != null
                        ? `~${formatPrice(pedal.marketPriceCents)} market`
                        : "Not enough data yet"}
                    </span>
                  </span>
                  {already && (
                    <span className="shrink-0 text-xs text-[var(--muted-foreground)]">On board</span>
                  )}
                </button>
              )
            })}
        </div>
      )}
    </div>
  )
}
