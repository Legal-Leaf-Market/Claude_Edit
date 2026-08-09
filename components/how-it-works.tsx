"use client"

import { useEffect, useState } from "react"
import { HelpCircle, Scale, ShieldCheck, ShoppingCart, Store, X } from "lucide-react"

const STEPS = [
  {
    icon: Scale,
    title: "Compare by $/g",
    body: "Live prices from trusted hemp retailers, ranked by real price per gram.",
  },
  {
    icon: ShoppingCart,
    title: "Build one cart",
    body: "Add deals from any store into a single Legal-Leaf cart as you browse.",
  },
  {
    icon: Store,
    title: "Checkout per store",
    body: "Orders complete on each retailer's own site — your discount auto-applies.",
  },
  {
    icon: ShieldCheck,
    title: "Lab-tested hemp",
    body: "View third-party COAs from each retailer, right here. Adults 21+ only.",
  },
]

export function HowItWorks() {
  const [open, setOpen] = useState(false)

  // Close on Escape while the help panel is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      {/* Compact trigger — keeps the "how it works" out of the way until asked for. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How Legal-Leaf Market works"
        className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-white/5 px-3 py-1.5 text-xs font-bold text-mint transition hover:bg-white/10"
      >
        <HelpCircle className="h-4 w-4 text-gold" />
        How it works
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="how-it-works-title"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gold/30 bg-navy2 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <div
              className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20 mix-blend-screen"
              style={{ backgroundImage: "url(/art/paisley-violet.png)" }}
              aria-hidden
            />
            <header className="relative flex items-center justify-between border-b border-gold/20 px-5 py-4">
              <h2
                id="how-it-works-title"
                className="text-base font-black uppercase tracking-wide text-mint"
              >
                How Legal-Leaf Market Works
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 bg-white/5 text-mint transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="relative grid gap-4 p-5 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <div key={s.title} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                    <s.icon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-mint">
                      <span className="text-gold">{i + 1}.</span> {s.title}
                    </h3>
                    <p className="mt-0.5 text-[0.75rem] leading-snug text-muted-foreground">
                      {s.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="relative border-t border-gold/15 px-5 py-3 text-[0.68rem] leading-relaxed text-muted-foreground">
              Legal-Leaf is a price-comparison tool. Each order is placed and fulfilled on the
              retailer&apos;s own website. These statements have not been evaluated by the FDA.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
