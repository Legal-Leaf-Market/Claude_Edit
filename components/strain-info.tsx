"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import useSWR from "swr"
import { Sparkles, Loader2, X } from "lucide-react"
import type { StrainProfile } from "@/app/api/strain/route"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function StrainInfo({ name, children }: { name: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const { data, isLoading } = useSWR<{ profile?: StrainProfile; error?: string }>(
    open && name ? `/api/strain?name=${encodeURIComponent(name)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 1000 * 60 * 60, shouldRetryOnError: false },
  )
  const profile = data?.profile
  const failed = !!data?.error

  // Escape to close + lock background scroll while the modal is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!name) return <>{children}</>

  const modal =
    open && mounted
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Strain info for ${name}`}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative flex h-full w-full flex-col overflow-hidden bg-navy text-mint shadow-[0_25px_80px_rgba(0,0,0,0.7)] sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-2xl sm:rounded-3xl sm:border sm:border-gold/40"
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-gold/20 bg-gradient-to-r from-lime/10 to-gold/10 px-5 py-4 sm:px-7 sm:py-5">
                <Sparkles className="h-6 w-6 shrink-0 text-gold" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-black leading-tight sm:text-2xl">{name}</h2>
                  <p className="text-[0.66rem] font-black uppercase tracking-widest text-gold/80">
                    AI Strain Profile
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close strain info"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-navy/60 text-mint transition hover:bg-gold/20"
                >
                  <X className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                {failed ? (
                  <p className="py-8 text-center text-base leading-relaxed text-muted-foreground">
                    Strain insights are temporarily unavailable. Please try again shortly.
                  </p>
                ) : isLoading || !profile ? (
                  <div className="flex items-center justify-center gap-3 py-16 text-base text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-lime" />
                    Generating strain profile…
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-full border border-lime/40 bg-lime/10 px-3.5 py-1 text-sm font-black text-mint">
                        {profile.type}
                      </span>
                      <span className="rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1 text-sm font-black text-gold">
                        THCa {profile.thca}
                      </span>
                    </div>

                    <p className="text-base leading-relaxed text-mint/90">{profile.description}</p>

                    <ProfileRow label="Effects" items={profile.effects} accent="lime" />
                    <ProfileRow label="Flavors" items={profile.flavors} accent="gold" />

                    {profile.lineage && profile.lineage.toLowerCase() !== "unknown" && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-bold text-gold">Lineage:</span> {profile.lineage}
                      </p>
                    )}

                    <p className="mt-1 border-t border-gold/15 pt-4 text-xs leading-relaxed text-muted-foreground">
                      AI-generated for information only. Verify potency with the store&apos;s lab
                      results.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="text-pretty">{children}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Strain info for ${name}`}
          className="group/strain inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-widest text-gold transition hover:bg-gold/20"
        >
          <Sparkles className="h-3 w-3" />
          Strain Info
        </button>
      </span>
      {modal}
    </>
  )
}

function ProfileRow({
  label,
  items,
  accent,
}: {
  label: string
  items: string[]
  accent: "lime" | "gold"
}) {
  if (!items?.length) return null
  const chip =
    accent === "lime"
      ? "border-lime/30 bg-lime/10 text-mint"
      : "border-gold/30 bg-gold/10 text-gold"
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-gold/80">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${chip}`}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}
