"use client"

import { useRef, useState } from "react"
import { Plus } from "lucide-react"
import { ICONS, initialsFor, type IconEntry } from "@/lib/pedalboard/icons"
import { formatPrice } from "@/lib/utils"
import type { PedalSummary } from "@/lib/pedalboard/queries"

type MatchState = "idle" | "checking" | "found" | "none"

/**
 * "Iconic Rigs": a character-select grid of well-documented player/pedal
 * pairings. Picking one runs the SAME live search the manual search box
 * uses, so a match only ever appears if the pedal is genuinely in the
 * catalogue right now. Most will come back empty today, since the live
 * feeds do not carry legacy pedal brands yet, and this says so plainly
 * rather than adding a board slot with nothing real behind it.
 */
export function IconSelect({
  onAdd,
  disabledSlugs,
}: {
  onAdd: (pedal: PedalSummary) => void
  disabledSlugs: Set<string>
}) {
  const [selected, setSelected] = useState<IconEntry | null>(null)
  const [matchState, setMatchState] = useState<MatchState>("idle")
  const [match, setMatch] = useState<PedalSummary | null>(null)
  // Guards against a slower, earlier request resolving after a faster later
  // one: only the response for whichever icon is CURRENTLY selected is
  // allowed to update state, so clicking through icons quickly can never
  // leave a stale match (and its "Add" button) attached to the wrong player.
  const requestIdRef = useRef<string | null>(null)

  function selectIcon(icon: IconEntry) {
    requestIdRef.current = icon.id
    setSelected(icon)
    setMatch(null)
    setMatchState("checking")

    const brandToken = icon.brand.split(" ")[0].toLowerCase()
    fetch(`/api/pedalboard/search?q=${encodeURIComponent(`${icon.brand} ${icon.model}`)}`)
      .then((res) => res.json())
      .then((data: { pedals: PedalSummary[] }) => {
        if (requestIdRef.current !== icon.id) return
        const hit = data.pedals.find((p) => p.brand.toLowerCase().includes(brandToken)) ?? null
        setMatch(hit)
        setMatchState(hit ? "found" : "none")
      })
      .catch(() => {
        if (requestIdRef.current === icon.id) setMatchState("none")
      })
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--cream)]">Iconic rigs</h2>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted-foreground)]">
          Pick a player, see the pedal that made their tone famous. Well-documented gear history, not
          an endorsement or partnership with anyone listed here.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {ICONS.map((icon) => (
          <button
            key={icon.id}
            type="button"
            onClick={() => selectIcon(icon)}
            aria-pressed={selected?.id === icon.id}
            title={icon.name}
            className="icon-badge"
            style={{ "--icon-hue": icon.hue } as React.CSSProperties}
            data-selected={selected?.id === icon.id}
          >
            {initialsFor(icon)}
          </button>
        ))}
      </div>

      {selected && (
        <div className="panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--cream)]">{selected.name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{selected.context}</p>
            </div>
            <p className="text-sm font-medium" style={{ color: selected.hue }}>
              {selected.brand} {selected.model}
            </p>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-[var(--cream)]">{selected.blurb}</p>
          {selected.signatureNote && (
            <p className="mt-1.5 text-xs italic text-[var(--amber)]">{selected.signatureNote}</p>
          )}

          <div className="mt-3 border-t border-[var(--border)] pt-3">
            {matchState === "checking" && (
              <p className="text-xs text-[var(--muted-foreground)]">Checking our live catalog...</p>
            )}
            {matchState === "found" && match && (
              <button
                type="button"
                disabled={disabledSlugs.has(match.slug)}
                onClick={() => onAdd(match)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-[var(--amber-soft)]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {disabledSlugs.has(match.slug)
                  ? "Already on board"
                  : `Add ${match.brand} ${match.model} (${match.marketPriceCents != null ? `~${formatPrice(match.marketPriceCents)}` : "price unknown"})`}
              </button>
            )}
            {matchState === "none" && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Not currently carried by any store we track. As more sources come online this may
                change, but for now there is nothing real to add.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
