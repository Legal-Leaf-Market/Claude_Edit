"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "llm-age-verified"

export function AgeGate() {
  // `null` until we've checked storage, so we never flash the gate for
  // returning visitors or cause a hydration mismatch.
  const [verified, setVerified] = useState<boolean | null>(null)
  const [declined, setDeclined] = useState(false)

  useEffect(() => {
    try {
      setVerified(window.localStorage.getItem(STORAGE_KEY) === "true")
    } catch {
      setVerified(false)
    }
  }, [])

  const confirm = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true")
    } catch {
      // storage is best-effort; still let them through for this session
    }
    setVerified(true)
  }

  // Not mounted yet, or already verified: render nothing.
  if (verified === null || verified) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/art/paisley-violet.png)" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-navy/85 backdrop-blur-md" aria-hidden />

      <div className="relative w-full max-w-md rounded-3xl border border-gold/30 bg-navy2/90 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold bg-gold/10 text-2xl font-black text-gold">
          21+
        </span>
        <h1 id="age-gate-title" className="text-2xl font-black uppercase tracking-wide text-mint">
          Age Verification
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          Legal-Leaf Market compares hemp-derived products intended for adults. You must be
          <strong className="text-mint"> 21 years or older</strong> to enter. By continuing you
          confirm you meet the legal age in your jurisdiction.
        </p>

        {declined ? (
          <p className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            You must be 21 or older to browse this marketplace.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={confirm}
              className="w-full rounded-xl bg-gradient-to-r from-lime to-gold px-4 py-3 text-sm font-black text-navy transition hover:brightness-105"
            >
              I am 21 or older — Enter
            </button>
            <button
              onClick={() => setDeclined(true)}
              className="w-full rounded-xl border border-gold/30 bg-white/5 px-4 py-3 text-sm font-bold text-mint transition hover:bg-white/10"
            >
              I am under 21
            </button>
          </div>
        )}

        <p className="mt-5 text-[0.66rem] leading-relaxed text-muted-foreground">
          These statements have not been evaluated by the FDA. Products are not intended to diagnose,
          treat, cure, or prevent any disease.
        </p>
      </div>
    </div>
  )
}
