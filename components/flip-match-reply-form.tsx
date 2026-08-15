"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth-client"

type Props = {
  threadId: string
  authorId: string
  isClosed: boolean
  /** Board-specific wording; falls back to Flip Match's phrasing. */
  closeButtonLabel?: string
  closedCopy?: string
}

/** The reply box, plus the poster's own "close this" control. Everything here is public. */
export function FlipMatchReplyForm({
  threadId,
  authorId,
  isClosed,
  closeButtonLabel = "Mark as flipped / take it down",
  closedCopy = "This post is closed. It's already flipped or off the table.",
}: Props) {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const isAuthor = session?.user?.id === authorId
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch(`/api/flip-match/threads/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: String(form.get("body") ?? "").trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not post that reply.")
        return
      }
      event.currentTarget.reset()
      router.refresh()
    } catch {
      setError("Could not post that reply. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  async function closeThread() {
    setClosing(true)
    try {
      const response = await fetch(`/api/flip-match/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      })
      if (response.ok) router.refresh()
    } finally {
      setClosing(false)
    }
  }

  if (isAuthor && !isClosed) {
    return (
      <div className="panel space-y-4 p-5">
        <Button variant="outline" onClick={closeThread} disabled={closing}>
          {closing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {closeButtonLabel}
        </Button>
        {renderReplyForm()}
      </div>
    )
  }

  if (isClosed) {
    return (
      <p className="panel p-5 text-sm text-[var(--muted-foreground)]">
        {closedCopy}
      </p>
    )
  }

  return <div className="panel p-5">{renderReplyForm()}</div>

  function renderReplyForm() {
    if (isPending) {
      return (
        <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking your session
        </p>
      )
    }

    if (!session?.user) {
      return (
        <div>
          <p className="text-sm text-[var(--cream)]">Sign in to reply.</p>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            Replies are public, same as the post itself. No DMs on Flip Match.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/sign-in"
              className="inline-flex h-9 items-center rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--cream)] hover:bg-[var(--secondary)]"
            >
              Create an account
            </Link>
          </div>
        </div>
      )
    }

    return (
      <form onSubmit={onSubmit} className="space-y-3">
        <label htmlFor="reply-body" className="block text-sm font-medium text-[var(--cream)]">
          Reply publicly
        </label>
        <textarea
          id="reply-body"
          name="body"
          required
          minLength={2}
          maxLength={2000}
          rows={3}
          placeholder="Interested. Still available?"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--cream)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        {error && (
          <p role="alert" className="text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Post reply
        </Button>
      </form>
    )
  }
}
