"use client"

import { useCallback, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Check, Copy, Trash2 } from "lucide-react"
import { Board, type BoardEntry } from "./board"
import { PedalSearch } from "./pedal-search"
import { formatPrice } from "@/lib/utils"
import type { PedalBoardEntry, PedalSummary } from "@/lib/pedalboard/queries"

/** A signal chain this long is already an outlier board; keep the UI honest about that. */
const MAX_PEDALS = 12

export function PedalBoardBuilder({
  initialSlugs,
  initialEntries,
  suggestions,
}: {
  initialSlugs: string[]
  initialEntries: PedalBoardEntry[]
  suggestions: PedalSummary[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  const [slugs, setSlugs] = useState<string[]>(initialSlugs)
  const [entriesBySlug, setEntriesBySlug] = useState<Map<string, BoardEntry>>(
    () => new Map(initialEntries.map((e) => [e.slug, e])),
  )
  const [copied, setCopied] = useState(false)

  const syncUrl = useCallback(
    (nextSlugs: string[]) => {
      const qs = nextSlugs.length ? `?pedals=${nextSlugs.join(",")}` : ""
      router.replace(`${pathname}${qs}`, { scroll: false })
    },
    [pathname, router],
  )

  const addPedal = useCallback(
    (pedal: PedalSummary) => {
      if (slugs.includes(pedal.slug) || slugs.length >= MAX_PEDALS) return

      const nextSlugs = [...slugs, pedal.slug]
      setSlugs(nextSlugs)
      setEntriesBySlug((prev) => {
        const next = new Map(prev)
        next.set(pedal.slug, { ...pedal, bySource: [], loading: true })
        return next
      })
      syncUrl(nextSlugs)

      fetch(`/api/pedalboard/board?slugs=${encodeURIComponent(pedal.slug)}`)
        .then((res) => res.json())
        .then((data: { pedals: PedalBoardEntry[] }) => {
          const detail = data.pedals[0]
          if (!detail) return
          setEntriesBySlug((prev) => {
            const next = new Map(prev)
            next.set(pedal.slug, { ...detail, loading: false })
            return next
          })
        })
        .catch(() => {
          setEntriesBySlug((prev) => {
            const next = new Map(prev)
            const existing = next.get(pedal.slug)
            if (existing) next.set(pedal.slug, { ...existing, loading: false })
            return next
          })
        })
    },
    [slugs, syncUrl],
  )

  const removePedal = useCallback(
    (slug: string) => {
      const nextSlugs = slugs.filter((s) => s !== slug)
      setSlugs(nextSlugs)
      syncUrl(nextSlugs)
    },
    [slugs, syncUrl],
  )

  const movePedal = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction
      if (target < 0 || target >= slugs.length) return
      const nextSlugs = [...slugs]
      ;[nextSlugs[index], nextSlugs[target]] = [nextSlugs[target], nextSlugs[index]]
      setSlugs(nextSlugs)
      syncUrl(nextSlugs)
    },
    [slugs, syncUrl],
  )

  const clearBoard = useCallback(() => {
    setSlugs([])
    syncUrl([])
  }, [syncUrl])

  const entries = useMemo(
    () => slugs.map((slug) => entriesBySlug.get(slug)).filter((e): e is BoardEntry => e != null),
    [slugs, entriesBySlug],
  )

  const totalCents = entries.reduce(
    (sum, e) => (e.marketPriceCents != null ? sum + e.marketPriceCents : sum),
    0,
  )
  const missingPriceCount = entries.filter((e) => e.marketPriceCents == null).length

  function share() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <div className="space-y-4">
      <PedalSearch suggestions={suggestions} onAdd={addPedal} disabledSlugs={new Set(slugs)} />

      <Board entries={entries} onRemove={removePedal} onMove={movePedal} />

      {entries.length > 0 && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              Estimated board value
            </p>
            <p className="text-xl font-semibold text-[var(--cream)]">
              {totalCents > 0 ? formatPrice(totalCents) : "Not enough data yet"}
              {missingPriceCount > 0 && totalCents > 0 && (
                <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                  ({missingPriceCount} of {entries.length} not counted, too few listings)
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={share}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--cream)] transition-colors hover:bg-[var(--secondary)]"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Share this board"}
            </button>
            <button
              type="button"
              onClick={clearBoard}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--cream)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear board
            </button>
          </div>
        </div>
      )}

      {slugs.length >= MAX_PEDALS && (
        <p className="text-xs text-[var(--muted-foreground)]">
          {MAX_PEDALS} pedals is the limit here. Remove one to add another.
        </p>
      )}
    </div>
  )
}
