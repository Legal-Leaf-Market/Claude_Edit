"use client"

import { useState } from "react"
import Link from "next/link"
import { RigRoomCanvas } from "@/components/rig-room/rig-room-canvas"
import type { RigScene } from "@/lib/rig-room/scene"
import { mmToIn } from "@/lib/pedalboard/catalog/types"

/**
 * The rig room page body: the canvas, and the same rig as text underneath.
 *
 * THE LIST IS NOT A FALLBACK, it is the content. A canvas has no DOM, so
 * nothing in it is indexable, selectable, linkable or reachable by a screen
 * reader, and CLAUDE.md section 16 turns that into a rule rather than a
 * preference. So the chain below carries the real links and the real numbers,
 * and the 3D view is the part you can lose without losing the page.
 *
 * Selection is shared both ways: clicking a pedal in the room highlights its
 * row, and hovering a row lights the pedal. That is the whole reason the two
 * halves are worth having together rather than as separate pages.
 */
export function RigRoomView({ scene }: { scene: RigScene }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const inChainOrder = [...scene.boxes].sort(
    (a, b) => (a.chainPosition ?? 99) - (b.chainPosition ?? 99),
  )

  return (
    <div className="space-y-6">
      <RigRoomCanvas scene={scene} selectedKey={selectedKey} onSelect={setSelectedKey} />

      <p className="text-xs text-[var(--muted-foreground)]">
        Drag to turn the board, scroll to zoom, click a pedal to select it. Everything in the room is
        listed below with its real dimensions.
      </p>

      <div>
        <h2 className="mb-3 font-display text-lg font-black text-[var(--text)]">
          The chain, in signal order
        </h2>
        <ol className="space-y-2">
          {inChainOrder.map((box) => {
            const selected = box.key === selectedKey
            return (
              <li
                key={box.key}
                onMouseEnter={() => setSelectedKey(box.key)}
                onMouseLeave={() => setSelectedKey(null)}
                className={`panel flex flex-wrap items-center gap-4 p-3 transition-colors ${
                  selected ? "border-[var(--gold)]" : ""
                }`}
              >
                <span
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{ background: box.colour }}
                  aria-hidden="true"
                />
                <span className="w-6 shrink-0 text-center font-display text-sm font-black text-[var(--muted-foreground)]">
                  {box.chainPosition}
                </span>

                <span className="min-w-[11rem] flex-1">
                  <span className="block text-sm font-semibold text-[var(--text)]">
                    <span className="text-[var(--muted-foreground)]">{box.brand}</span> {box.model}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    {box.widthMm} x {box.depthMm} x {box.heightMm} mm, {mmToIn(box.widthMm).toFixed(1)}
                    {" x "}
                    {mmToIn(box.depthMm).toFixed(1)} in
                  </span>
                </span>

                {box.gearSlug && (
                  <Link
                    href={`/gear/${box.gearSlug}`}
                    className="shrink-0 text-xs text-[var(--accent-text)] underline-offset-2 hover:underline"
                  >
                    Prices across every store
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
