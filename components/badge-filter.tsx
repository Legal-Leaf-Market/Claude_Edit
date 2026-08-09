"use client"

import { useEffect, useRef, useState } from "react"
import { Check, SlidersHorizontal, X } from "lucide-react"
import { BADGE_ORDER, BADGES, type BadgeId } from "@/lib/badges"

export function BadgeFilter({
  selected,
  counts,
  onChange,
}: {
  selected: string[]
  // How many products currently carry each badge (for the menu hint).
  counts: Record<string, number>
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const toggle = (id: BadgeId) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  const active = selected.length > 0

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-black transition ${
          active
            ? "border-transparent bg-gradient-to-r from-[#ff2d87] to-[#a855f7] text-white"
            : "border-gold/30 bg-white/5 text-mint hover:bg-white/10"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" strokeWidth={2.6} />
        Search by Badge
        {active && (
          <span className="rounded-full bg-white/25 px-1.5 text-xs font-black">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 w-72 rounded-2xl border border-gold/25 bg-navy p-2 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[0.66rem] font-black uppercase tracking-widest text-gold">
              Filter by badge
            </span>
            {active && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1 text-[0.68rem] font-bold text-muted-foreground transition hover:text-mint"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <ul className="flex flex-col gap-1">
            {BADGE_ORDER.map((id) => {
              const meta = BADGES[id]
              const isSel = selected.includes(id)
              const count = counts[id] ?? 0
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isSel}
                    onClick={() => toggle(id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                      isSel
                        ? "border-gold/50 bg-white/10"
                        : "border-transparent hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${
                        isSel ? "border-lime bg-lime text-navy" : "border-gold/40 bg-transparent"
                      }`}
                    >
                      {isSel && <Check className="h-3 w-3" strokeWidth={4} />}
                    </span>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dotClass}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black leading-tight text-mint">
                        {meta.label}
                        <span className="ml-1.5 text-[0.68rem] font-bold text-muted-foreground">
                          {count}
                        </span>
                      </span>
                      <span className="block text-[0.68rem] font-medium leading-tight text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
