"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { Disc3, Download, Loader2 } from "lucide-react"
import type { BoardSlot } from "./board"
import { EFFECTS } from "@/lib/pedalboard/chain"
import { hueFor, initialsFor, RIGS, signaturePedal, type Rig } from "@/lib/rigs"

/**
 * Character select, for pedalboards.
 *
 * Picking a player loads their documented board into the builder, matched
 * against the live catalogue as it loads. This is the piece that makes the
 * tool worth using over the free planners: they all start you at a blank grid
 * and assume you already know what you want, which is only true of people who
 * do not need the tool.
 *
 * A stylised monogram rather than a photograph, deliberately. No likeness
 * rights to navigate, it matches the abstract-icon language already used for
 * categories and stores, and it makes clear this is a reference page rather
 * than an endorsement.
 */
export function RigPicker({ onLoad }: { onLoad: (slots: BoardSlot[]) => void }) {
  const [selected, setSelected] = useState<Rig | null>(null)
  const [loading, setLoading] = useState(false)
  // Guards against a slower earlier request resolving after a faster later
  // one, which would drop the wrong board onto the builder.
  const requestRef = useRef<string | null>(null)

  function load(rig: Rig) {
    requestRef.current = rig.slug
    setLoading(true)
    fetch(`/api/pedalboard/rig?slug=${encodeURIComponent(rig.slug)}`)
      .then((res) => res.json())
      .then((data: { slots?: BoardSlot[] }) => {
        if (requestRef.current !== rig.slug) return
        if (Array.isArray(data.slots)) onLoad(data.slots)
      })
      .catch(() => {})
      .finally(() => {
        if (requestRef.current === rig.slug) setLoading(false)
      })
  }

  return (
    <section className="panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            Start from a board that made a record
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
            {RIGS.length} documented rigs. Pick one to load it, then swap any pedal for what is
            actually in stock. Gear history assembled from interviews, rig rundowns and live
            photography, not an endorsement by anyone listed.
          </p>
        </div>
        <Link
          href="/rigs"
          className="text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
        >
          Browse all rigs
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
        {RIGS.map((rig) => (
          <button
            key={rig.slug}
            type="button"
            onClick={() => setSelected(selected?.slug === rig.slug ? null : rig)}
            aria-pressed={selected?.slug === rig.slug}
            title={`${rig.name}, ${rig.context}`}
            className="icon-badge"
            style={{ "--icon-hue": hueFor(rig) } as React.CSSProperties}
            data-selected={selected?.slug === rig.slug}
          >
            {initialsFor(rig)}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <p className="font-display text-lg font-bold text-[var(--text)]">{selected.name}</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {selected.context} · {selected.era} · {selected.genre}
              </p>
            </div>
            <p className="text-sm font-semibold" style={{ color: hueFor(selected) }}>
              {signaturePedal(selected).brand} {signaturePedal(selected).model}
            </p>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">{selected.blurb}</p>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {selected.pedals.map((pedal) => (
              <li
                key={`${pedal.brand}-${pedal.model}`}
                className="rounded-full border px-2.5 py-1 text-xs"
                style={{
                  borderColor: EFFECTS[pedal.type].hue,
                  color: EFFECTS[pedal.type].hue,
                }}
              >
                {pedal.brand} {pedal.model}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--line)] pt-3">
            <button
              type="button"
              onClick={() => load(selected)}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {loading ? "Loading the board" : `Load this board (${selected.pedals.length} pedals)`}
            </button>

            <Link
              href={`/rigs/${selected.slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
            >
              <Disc3 className="h-3.5 w-3.5" aria-hidden="true" />
              {selected.records.length} record{selected.records.length === 1 ? "" : "s"} and the full
              write-up
            </Link>
          </div>

          <p className="mt-2 text-xs text-[var(--dim)]">
            Loading a board replaces whatever is on the builder now.
          </p>
        </div>
      )}
    </section>
  )
}
