"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Shuffle } from "lucide-react"
import { SORT_OPTIONS } from "@/lib/search/types"

/** A fresh shuffle is just a fresh seed; the SQL does the rest. */
function newSeed() {
  return Math.floor(Math.random() * 1_000_000)
}

export function SortSelect() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get("sort") ?? (params.get("q") ? "relevance" : "newest")
  const isShuffled = current === "shuffle"

  function go(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString())
    mutate(next)
    next.delete("page")
    router.push(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <span className="hidden sm:inline">Sort</span>
        <select
          value={current}
          onChange={(e) =>
            go((next) => {
              next.set("sort", e.target.value)
              // Picking shuffle from the dropdown should deal a new order, not
              // re-show whatever seed happened to be left in the URL.
              if (e.target.value === "shuffle") next.set("seed", String(newSeed()))
              else next.delete("seed")
            })
          }
          /* A panel-mounted rotary selector rather than a rounded pill. It is
             still a real <select>, so the platform picker and the keyboard are
             untouched; only the plate it is mounted on is drawn. */
          className="rotary"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {isShuffled && (
        <button
          type="button"
          onClick={() => go((next) => next.set("seed", String(newSeed())))}
          className="stomp stomp-sm"
        >
          <Shuffle className="h-4 w-4" aria-hidden="true" />
          Shuffle again
        </button>
      )}
    </div>
  )
}
