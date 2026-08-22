"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth-client"
import type { BoardConfig } from "@/lib/boards"

/* A field is a hole routed into the panel; a <select> is a plate with a rotary
   behind it. Both are the shared vocabulary from globals.css rather than a
   bordered rectangle, so a form does not read as the one part of the site
   nobody dressed. */
const inputClass = "plate h-10 w-full px-3 text-sm"
const selectClass = "rotary h-10 w-full"
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--cream)]"

/**
 * The one post form, for every board. Everything board-specific (copy,
 * categories, whether a price field applies) comes from the BoardConfig, so
 * adding a board is data rather than another component.
 *
 * After a flip post specifically we point the seller at Reverb's and
 * Craigslist's own posting pages: casting a wider net costs them nothing and
 * we would rather the thing sell than sit here unseen. Neither link is ours
 * and neither earns us anything.
 */
export function BoardPostForm({ board }: { board: BoardConfig }) {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [newPostId, setNewPostId] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("pending")
    setError(null)

    const form = new FormData(event.currentTarget)
    const price = String(form.get("askingPrice") ?? "").trim()

    try {
      const response = await fetch("/api/flip-match/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: board.kind,
          title: String(form.get("title") ?? "").trim(),
          category: String(form.get("category") ?? board.defaultCategory),
          description: String(form.get("description") ?? "").trim(),
          askingPriceDollars: board.showPrice && price ? Number(price) : null,
          location: String(form.get("location") ?? "").trim() || null,
          imageUrl: String(form.get("imageUrl") ?? "").trim() || null,
          patreonUrl: String(form.get("patreonUrl") ?? "").trim() || null,
          website: String(form.get("website") ?? ""),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not post that.")
        setStatus("error")
        return
      }
      setNewPostId(data.thread.id)
      setStatus("done")
      router.refresh()
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
        <p className="text-sm text-[var(--cream)]">Sign in to post.</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          An account exists so replies know who they are talking to. There is no fee, no cut, and
          Gear Avail never touches whatever you arrange with each other.
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
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

  if (status === "done" && newPostId) {
    return (
      <div className="panel p-6">
        <p className="text-base font-medium text-[var(--cream)]">Posted. It's live on the feed now.</p>
        {board.kind === "flip" && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Worth putting it in front of more eyes too. Neither of these is ours, and neither costs
            you anything:
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/posts/${newPostId}`}
            className="inline-flex h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
          >
            View your post
          </Link>
          {board.kind === "flip" && (
            <>
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
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setStatus("idle")
            setNewPostId(null)
          }}
          className="mt-4 text-sm text-[var(--accent-text)] underline-offset-2 hover:underline"
        >
          Post another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-6">
      <div>
        <label htmlFor="board-title" className={labelClass}>
          {board.postCtaLabel}
        </label>
        <input id="board-title" name="title" required minLength={3} maxLength={200} className={inputClass} />
      </div>

      <div className={board.showPrice ? "grid gap-4 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>
        <div>
          <label htmlFor="board-category" className={labelClass}>
            Category
          </label>
          <select id="board-category" name="category" defaultValue={board.defaultCategory} className={selectClass}>
            {board.categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {board.showPrice && (
          <div>
            <label htmlFor="board-price" className={labelClass}>
              {board.priceLabel}
            </label>
            <input
              id="board-price"
              name="askingPrice"
              type="number"
              min={1}
              step="1"
              placeholder={board.pricePlaceholder}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="board-location" className={labelClass}>
            Location (optional)
          </label>
          <input id="board-location" name="location" maxLength={200} placeholder="City, state" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="board-description" className={labelClass}>
          Details
        </label>
        <textarea
          id="board-description"
          name="description"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <div>
        <label htmlFor="board-image" className={labelClass}>
          Photo URL (optional)
        </label>
        <input id="board-image" name="imageUrl" type="url" maxLength={2000} className={inputClass} />
      </div>

      {board.showPatreon && (
        <div>
          <label htmlFor="board-patreon" className={labelClass}>
            Your Patreon (optional)
          </label>
          <input
            id="board-patreon"
            name="patreonUrl"
            type="url"
            maxLength={300}
            placeholder="patreon.com/yourname"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            Shown on your post so people can follow your work directly. We take nothing from it.
          </p>
        </div>
      )}

      {/* Honeypot: hidden from real visitors via CSS, not just off-screen positioning. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="board-website">Leave this blank</label>
        <input id="board-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}

      <Button type="submit" disabled={status === "pending"} className="w-full">
        {status === "pending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {board.postButtonLabel}
      </Button>

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        Public thread, no DMs. Whoever's interested replies right here.
      </p>
    </form>
  )
}
