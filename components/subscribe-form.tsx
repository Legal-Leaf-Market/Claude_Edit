"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Newsletter signup.
 *
 * The optional "what are you hunting for" field is the point of the whole
 * thing: gear shopping is a months-long hunt, so a list that knows what each
 * person is looking for can send something genuinely useful rather than a
 * generic blast. It is optional because demanding it would cost more signups
 * than the data is worth.
 */
export function SubscribeForm({
  source,
  compact = false,
}: {
  source: string
  compact?: boolean
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("pending")
    setError(null)

    const form = new FormData(event.currentTarget)
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? "").trim(),
          hunting: String(form.get("hunting") ?? "").trim() || undefined,
          source,
          website: String(form.get("website") ?? ""),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Could not sign you up just now.")
        setStatus("error")
        return
      }
      setStatus("done")
    } catch {
      setError("Could not sign you up just now. Check your connection.")
      setStatus("error")
    }
  }

  if (status === "done") {
    return (
      <div className="panel p-5">
        <p className="text-sm font-medium text-[var(--cream)]">You're on the list.</p>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          One email a week with what turned up. Unsubscribe link in every one, and we never sell
          the list.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "space-y-2" : "panel space-y-3 p-5"}>
      {!compact && (
        <div>
          <p className="text-sm font-semibold text-[var(--cream)]">The weekly hunt</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
            One email a week: what showed up, what dropped in price, and what the makers are
            releasing. No selling your address, ever.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`sub-email-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`sub-email-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-10 w-full flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <Button type="submit" disabled={status === "pending"} className="shrink-0">
          {status === "pending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Sign up
        </Button>
      </div>

      {!compact && (
        <div>
          <label htmlFor={`sub-hunt-${source}`} className="sr-only">
            What are you hunting for
          </label>
          <input
            id={`sub-hunt-${source}`}
            name="hunting"
            maxLength={200}
            placeholder="Hunting for something specific? (optional)"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      )}

      {/* Honeypot: hidden from real visitors via CSS, not off-screen positioning. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`sub-web-${source}`}>Leave this blank</label>
        <input id={`sub-web-${source}`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
    </form>
  )
}
