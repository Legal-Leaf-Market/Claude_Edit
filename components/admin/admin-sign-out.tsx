"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function AdminSignOut() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        try {
          await fetch("/api/admin/session", { method: "DELETE" })
        } catch {
          // Clearing the cookie is best-effort; the redirect below still applies.
        }
        router.replace("/admin/sign-in")
        router.refresh()
      }}
      className="rounded-lg border border-gold/30 bg-white/[0.06] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-mint transition hover:border-gold/60 hover:bg-white/[0.1] disabled:opacity-50"
    >
      {pending ? "Leaving…" : "Exit admin"}
    </button>
  )
}
