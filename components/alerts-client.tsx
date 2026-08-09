"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth-client"
import { formatPrice, sourceLabel } from "@/lib/utils"

type Alert = {
  id: string
  query: string
  maxPriceCents: number | null
  sourceFilter: string | null
  channel: string
  createdAt: string
}

export function AlertsClient() {
  const { data: session, isPending } = useSession()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/alerts")
      if (response.status === 401) {
        setAlerts([])
        return
      }
      const data = await response.json()
      setAlerts(data.alerts ?? [])
    } catch {
      setError("Could not load your alerts. Try refreshing.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user) void load()
    else setLoading(false)
  }, [session, load])

  async function createAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    const form = new FormData(event.currentTarget)
    const maxPrice = String(form.get("maxPrice") ?? "").trim()
    const source = String(form.get("source") ?? "")

    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: String(form.get("query") ?? "").trim(),
          maxPriceDollars: maxPrice ? Number(maxPrice) : null,
          sourceFilter: source || null,
          channel: String(form.get("channel") ?? "email"),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not save that alert.")
        return
      }
      event.currentTarget.reset()
      await load()
    } catch {
      setError("Could not save that alert. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteAlert(id: string) {
    // Optimistic: the row disappears immediately and comes back if the delete
    // failed, which is the right trade for an action this cheap to retry.
    const previous = alerts
    setAlerts((current) => current.filter((alert) => alert.id !== id))
    const response = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!response.ok) {
      setAlerts(previous)
      setError("Could not delete that alert.")
    }
  }

  if (isPending) {
    return (
      <div className="panel mt-8 flex items-center gap-2 p-6 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking your session
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="panel mt-8 p-6">
        <p className="text-sm text-[var(--cream)]">Sign in to save an alert.</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          An account exists purely so we have somewhere to send the alert. There is no cart and no
          checkout on MusicTime.
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-soft)]"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-10 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--cream)] hover:bg-[var(--secondary)]"
          >
            Create an account
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-6">
      <form onSubmit={createAlert} className="panel space-y-4 p-5">
        <div>
          <label htmlFor="alert-query" className="mb-1.5 block text-sm font-medium text-[var(--cream)]">
            What are you looking for
          </label>
          <input
            id="alert-query"
            name="query"
            required
            minLength={2}
            maxLength={200}
            placeholder="Fender Player Stratocaster"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="alert-max" className="mb-1.5 block text-sm font-medium text-[var(--cream)]">
              Max price
            </label>
            <input
              id="alert-max"
              name="maxPrice"
              type="number"
              min={1}
              step="1"
              placeholder="700"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div>
            <label htmlFor="alert-source" className="mb-1.5 block text-sm font-medium text-[var(--cream)]">
              Marketplace
            </label>
            <select
              id="alert-source"
              name="source"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-sm text-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">Any</option>
              <option value="ebay">eBay</option>
              <option value="reverb">Reverb</option>
            </select>
          </div>
          <div>
            <label htmlFor="alert-channel" className="mb-1.5 block text-sm font-medium text-[var(--cream)]">
              Notify by
            </label>
            <select
              id="alert-channel"
              name="channel"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-sm text-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="email">Email</option>
              <option value="discord">Discord</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save alert
        </Button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--cream)]">Your alerts</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading</p>
        ) : alerts.length === 0 ? (
          <p className="panel p-6 text-sm text-[var(--muted-foreground)]">
            No alerts yet. Save one above and we will watch for it.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id} className="panel flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--cream)]">{alert.query}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {alert.maxPriceCents ? `Under ${formatPrice(alert.maxPriceCents)}` : "Any price"}
                    {alert.sourceFilter ? ` on ${sourceLabel(alert.sourceFilter)}` : ""} via{" "}
                    {alert.channel}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteAlert(alert.id)}
                  aria-label={`Delete alert for ${alert.query}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
