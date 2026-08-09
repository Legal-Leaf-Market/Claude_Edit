"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AdminSignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const passcode = new FormData(event.currentTarget).get("passcode")

    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Sign-in failed.")
        setPending(false)
        return
      }
      router.replace(redirectTo)
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-6">
      <div>
        <label htmlFor="passcode" className="mb-1.5 block text-sm font-medium text-[var(--cream)]">
          Admin passcode
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Enter admin
      </Button>
    </form>
  )
}
