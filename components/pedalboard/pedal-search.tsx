"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Plus, Search } from "lucide-react"
import { ListingImage } from "@/components/listing-image"
import { renderForGear } from "@/lib/board/pedal-render"
import { EFFECTS } from "@/lib/pedalboard/chain"
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
const DEBOUNCE_MS = 220

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
      setLoading(false)
      return
    }

    setLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/pedalboard/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data: { pedals: PedalSummary[] }) => setResults(data.pedals ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, suggestions])

  // Close on an outside click. Without this the dropdown stays open behind
  // whatever the shopper clicked next, over the board they are trying to see.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="pedal-search" className="sr-only">
        Search pedals to add to the board
      </label>
      <div className="flex items-center gap-[9px] rounded-full border border-[var(--line)] bg-[var(--panel2)] px-4 py-[10px] transition-colors focus-within:border-[var(--sage)]">
        <Search className="h-4 w-4 shrink-0 text-[var(--dim)]" aria-hidden="true" />
        <input
          id="pedal-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false)
          }}
          placeholder="Add a pedal by name..."
          autoComplete="off"
          className="w-full min-w-0 border-0 bg-transparent text-[0.95rem] text-[var(--text)] caret-[var(--sage)] placeholder:text-[var(--dim)] focus:outline-none"
        />
        {loading && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--dim)]" aria-hidden="true" />
        )}
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--popover)] p-1.5 shadow-[var(--shadow)]">
          {results.length === 0 ? (
            <p className="px-2 py-3 text-sm text-[var(--muted-foreground)]">
              {query.trim()
                ? "No pedal in the catalogue matches that. The feeds live today carry small independent makers rather than the legacy brands, so try loading a documented rig instead: unstocked pedals still take a slot there."
                : "Nothing in the pedal catalogue yet."}
            </p>
          ) : (
            results.map((pedal) => {
              const already = disabledSlugs.has(pedal.slug)
              const meta = EFFECTS[pedal.type]
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
                    modelled={renderForGear(pedal.brand, pedal.model)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[var(--text)]">
                      {pedal.brand} {pedal.model}
                    </span>
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      <span style={{ color: meta.hue }}>{meta.label}</span>
                      {" · "}
                      {pedal.marketPriceCents != null
                        ? `~${formatPrice(pedal.marketPriceCents)} market`
                        : "too few listings to price"}
                    </span>
                  </span>
                  {already ? (
                    <span className="shrink-0 text-xs text-[var(--dim)]">On board</span>
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-[var(--dim)]" aria-hidden="true" />
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
