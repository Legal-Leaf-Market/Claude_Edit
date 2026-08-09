"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function AdminPasscodeForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [passcode, setPasscode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? "Sign-in failed.")
        setPending(false)
        return
      }
      // Replace so the passcode screen doesn't sit in the back-button history.
      router.replace(redirectTo)
      router.refresh()
    } catch {
      setError("Couldn't reach the server. Try again.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[0.65rem] font-black uppercase tracking-widest text-gold">
          Admin passcode
        </span>
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-bold text-mint outline-none transition focus:border-lime/60 focus:ring-2 focus:ring-lime/25"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || passcode.length === 0}
        className="w-full rounded-lg bg-lime px-4 py-2 text-sm font-black uppercase tracking-wider text-primary-foreground transition hover:bg-lime/85 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Enter admin"}
      </button>
    </form>
  )
}
