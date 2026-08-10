"use client"

import { useRef, useState } from "react"
import { Plus } from "lucide-react"
import { TRACKS, type TrackEntry } from "@/lib/pedalboard/tracks"
import { formatPrice } from "@/lib/utils"
import type { PedalSummary } from "@/lib/pedalboard/queries"

type MatchState = "idle" | "checking" | "found" | "none"

type GearMatch = {
  state: MatchState
  pedal: PedalSummary | null
}

/**
 * "Iconic Tracks": pick a specific well-documented recording, see the
 * pedal(s) sourced as having been used on THAT track or album, not just an
 * artist's usual go-to gear (that's Iconic Rigs, above). A track can carry
 * more than one pedal, so each gear item gets its own independent live
 * catalogue check rather than one match per track.
 */
export function TrackSelect({
  onAdd,
  disabledSlugs,
}: {
  onAdd: (pedal: PedalSummary) => void
  disabledSlugs: Set<string>
}) {
  const [selected, setSelected] = useState<TrackEntry | null>(null)
  const [matches, setMatches] = useState<GearMatch[]>([])
  // Same stale-response guard as icon-select.tsx: only updates for whichever
  // track is CURRENTLY selected are allowed to land, so clicking through
  // tracks quickly can never leave a slower response's match attached to the
  // wrong recording.
  const requestIdRef = useRef<string | null>(null)

  function selectTrack(track: TrackEntry) {
    requestIdRef.current = track.id
    setSelected(track)
    setMatches(track.gear.map(() => ({ state: "checking", pedal: null })))

    track.gear.forEach((gear, index) => {
      const brandToken = gear.brand.split(" ")[0].toLowerCase()
      fetch(`/api/pedalboard/search?q=${encodeURIComponent(`${gear.brand} ${gear.model}`)}`)
        .then((res) => res.json())
        .then((data: { pedals: PedalSummary[] }) => {
          if (requestIdRef.current !== track.id) return
          const hit = data.pedals.find((p) => p.brand.toLowerCase().includes(brandToken)) ?? null
          setMatches((prev) => {
            const next = [...prev]
            next[index] = { state: hit ? "found" : "none", pedal: hit }
            return next
          })
        })
        .catch(() => {
          if (requestIdRef.current !== track.id) return
          setMatches((prev) => {
            const next = [...prev]
            next[index] = { state: "none", pedal: null }
            return next
          })
        })
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--cream)]">Iconic tracks</h2>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted-foreground)]">
          Pick a famous recording, see the pedal documented as part of that specific track or
          album, sourced from interviews and engineer/gear-press accounts, not guitar-forum lore.
          Not an endorsement or partnership with anyone listed here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {TRACKS.map((track) => (
          <button
            key={track.id}
            type="button"
            onClick={() => selectTrack(track)}
            aria-pressed={selected?.id === track.id}
            data-selected={selected?.id === track.id}
            className="track-badge"
            style={{ "--icon-hue": track.hue } as React.CSSProperties}
          >
            <span className="block truncate text-xs font-semibold text-[var(--cream)]">
              {track.song}
            </span>
            <span className="block truncate text-[0.7rem] font-normal text-[var(--muted-foreground)]">
              {track.artist}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--cream)]">
                {selected.song}{" "}
                <span className="font-normal text-[var(--muted-foreground)]">
                  ({selected.artist})
                </span>
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {selected.album} ({selected.year})
              </p>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
              style={{
                color: selected.hue,
                background: `color-mix(in srgb, ${selected.hue} 18%, transparent)`,
              }}
            >
              {selected.confidence} confidence
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-[var(--cream)]">{selected.blurb}</p>

          <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
            {selected.gear.map((gear, index) => {
              const match = matches[index]
              return (
                <div key={`${selected.id}-${index}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium" style={{ color: selected.hue }}>
                      {gear.brand} {gear.model}
                    </p>
                  </div>
                  {gear.note && (
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{gear.note}</p>
                  )}
                  {gear.signatureNote && (
                    <p className="mt-1 text-xs italic text-[var(--amber)]">{gear.signatureNote}</p>
                  )}
                  <div className="mt-1.5">
                    {match?.state === "checking" && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Checking our live catalog...
                      </p>
                    )}
                    {match?.state === "found" && match.pedal && (
                      <button
                        type="button"
                        disabled={disabledSlugs.has(match.pedal.slug)}
                        onClick={() => onAdd(match.pedal!)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-[var(--amber-soft)]"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        {disabledSlugs.has(match.pedal.slug)
                          ? "Already on board"
                          : `Add ${match.pedal.brand} ${match.pedal.model} (${match.pedal.marketPriceCents != null ? `~${formatPrice(match.pedal.marketPriceCents)}` : "price unknown"})`}
                      </button>
                    )}
                    {match?.state === "none" && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Not currently carried by any store we track.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
