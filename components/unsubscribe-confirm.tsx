"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * One button, one POST. The confirmation exists so that a mail client or
 * crawler pre-fetching the link cannot unsubscribe someone who never clicked;
 * see the note on the page that renders this.
 */
export function UnsubscribeConfirm({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle")

  async function unsubscribe() {
    setStatus("pending")
    try {
      const res = await fetch("/api/subscribe/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      setStatus(res.ok ? "done" : "error")
    } catch {
      setStatus("error")
    }
  }

  if (status === "done") {
    return (
      <div className="panel p-7 text-center">
        <h1 className="text-xl font-bold text-[var(--cream)]">You're unsubscribed.</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
          No more weekly emails. Your address stays on file only so we do not accidentally add you
          back later, and it is never sold or shared.
        </p>
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          Everything on the site works exactly the same without an email from us.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
        >
          Back to Gear Avail
        </Link>
      </div>
    )
  }

  return (
    <div className="panel p-7 text-center">
      <h1 className="text-xl font-bold text-[var(--cream)]">Stop the weekly email?</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
        One click and it stops. No survey, no "are you sure", no offer to win you back.
      </p>

      <Button onClick={unsubscribe} disabled={status === "pending"} className="mt-6 w-full">
        {status === "pending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Unsubscribe
      </Button>

      {status === "error" && (
        <p role="alert" className="mt-3 text-sm text-[var(--destructive)]">
          That did not go through. Try again, or reply to any of our emails and a person will
          handle it.
        </p>
      )}

      <Link
        href="/"
        className="mt-4 inline-block text-sm text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--cream)]"
      >
        Never mind, keep me subscribed
      </Link>
    </div>
  )
}
