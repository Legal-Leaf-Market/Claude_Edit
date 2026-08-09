"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth-client"

const inputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--cream)]"

const CATEGORIES = [
  { value: "pedals", label: "Pedals" },
  { value: "guitars", label: "Guitars" },
  { value: "amps", label: "Amps" },
  { value: "recording", label: "Recording gear" },
  { value: "drums", label: "Drums" },
  { value: "other", label: "Other" },
]

/**
 * Posting a flip. No fee, no cut, no checkout: the sale itself happens off
 * platform once two people connect in the replies. After a successful post
 * we also point the seller at Reverb's and Craigslist's own posting pages,
 * since casting a wider net costs them nothing and we would rather this get
 * flipped than sit here unseen.
 */
export function FlipMatchCreateForm() {
  const { data: session, isPending } = useSession()
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [newThreadId, setNewThreadId] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("pending")
    setError(null)

    const form = new FormData(event.currentTarget)
    const askingPrice = String(form.get("askingPrice") ?? "").trim()

    try {
      const response = await fetch("/api/flip-match/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          category: String(form.get("category") ?? "other"),
          description: String(form.get("description") ?? "").trim(),
          askingPriceDollars: askingPrice ? Number(askingPrice) : null,
          location: String(form.get("location") ?? "").trim() || null,
          imageUrl: String(form.get("imageUrl") ?? "").trim() || null,
          website: String(form.get("website") ?? ""),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not post that.")
        setStatus("error")
        return
      }
      setNewThreadId(data.thread.id)
      setStatus("done")
    } catch {
      setError("Could not post that. Check your connection and try again.")
      setStatus("error")
    }
  }

  if (isPending) {
    return (
      <div className="panel flex items-center gap-2 p-6 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking your session
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="panel p-6">
        <p className="text-sm text-[var(--cream)]">Sign in to post something you want to flip.</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          An account exists so replies know who they are talking to. There is no fee, no cut, and
          Gear Avail never touches the sale itself.
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

  if (status === "done" && newThreadId) {
    return (
      <div className="panel p-6">
        <p className="text-base font-medium text-[var(--cream)]">Posted. It's live on the board now.</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Worth putting it in front of more eyes too. None of these links are ours, and none of them
          cost you anything either:
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/flip-match/${newThreadId}`}
            className="inline-flex h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-soft)]"
          >
            View your post
          </Link>
          <a
            href="https://reverb.com/my/listings/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--cream)] hover:bg-[var(--secondary)]"
          >
            Also post to Reverb
          </a>
          <a
            href="https://post.craigslist.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--cream)] hover:bg-[var(--secondary)]"
          >
            Also post to Craigslist
          </a>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-6">
      <div>
        <label htmlFor="flip-title" className={labelClass}>
          What are you flipping
        </label>
        <input
          id="flip-title"
          name="title"
          required
          minLength={3}
          maxLength={200}
          placeholder="Klon-style overdrive, barely used"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="flip-category" className={labelClass}>
            Category
          </label>
          <select id="flip-category" name="category" defaultValue="other" className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="flip-price" className={labelClass}>
            Asking (optional)
          </label>
          <input
            id="flip-price"
            name="askingPrice"
            type="number"
            min={1}
            step="1"
            placeholder="Make an offer"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="flip-location" className={labelClass}>
            Location (optional)
          </label>
          <input id="flip-location" name="location" maxLength={200} placeholder="City, state" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="flip-description" className={labelClass}>
          Details
        </label>
        <textarea
          id="flip-description"
          name="description"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          placeholder="Condition, why you're flipping it, anything a buyer would want to know."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <div>
        <label htmlFor="flip-image" className={labelClass}>
          Photo URL (optional)
        </label>
        <input
          id="flip-image"
          name="imageUrl"
          type="url"
          maxLength={2000}
          placeholder="A link to one photo makes it flip faster"
          className={inputClass}
        />
      </div>

      {/* Honeypot: hidden from real visitors via CSS, not just off-screen positioning. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="flip-website">Leave this blank</label>
        <input id="flip-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}

      <Button type="submit" disabled={status === "pending"} className="w-full">
        {status === "pending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Post it
      </Button>

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        Public thread, no DMs. Whoever's interested replies here, and you two work out the actual
        sale between yourselves.
      </p>
    </form>
  )
}
