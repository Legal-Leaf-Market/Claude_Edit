"use client"

import { useState } from "react"
import { Check, Download, RefreshCw, TriangleAlert } from "lucide-react"

/**
 * "Rebuild prices and deals", for a human with a browser.
 *
 * The same work the nightly cron does, minus the bearer token nobody can send
 * from a browser address bar. See app/api/admin/maintenance/route.ts for why
 * that gap turned out to matter.
 *
 * It reports what actually happened rather than just going green. This job
 * takes minutes on a large catalogue and the interesting failure is the quiet
 * one, where it runs fine and repriced nothing because the ingest never
 * happened.
 */

type Result = {
  seconds: number
  resolved?: unknown
  deals?: unknown
  indexed?: unknown
}

export function MaintenanceButton() {
  return (
    <div className="space-y-3">
      <AndertonsButton />
      <RebuildButton />
    </div>
  )
}

/**
 * Pull the Anderton's catalogue.
 *
 * Separate from the rebuild because it is a different kind of risk: it reaches
 * a third party over FTP and may simply time out, so it says so up front
 * rather than looking broken when it does.
 */
function AndertonsButton() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  async function run() {
    setState("running")
    setMessage(null)
    try {
      const response = await fetch("/api/admin/ingest-andertons", { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(`${body?.error ?? response.status}${body?.hint ? ` -- ${body.hint}` : ""}`)
      setMessage(
        `Done in ${body.seconds}s. Saw ${body.seen ?? "?"} rows, inserted ${body.inserted ?? 0}, updated ${body.updated ?? 0}, skipped ${body.skipped ?? 0}. Now run the rebuild below.`,
      )
      setState("done")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-black text-[var(--text)]">Pull the Anderton&apos;s catalogue</h2>
      <p className="mb-3 mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Fetches roughly 27,000 products over FTP from Impact and upserts them. This may TIME OUT:
        a Vercel function gets 300 seconds and this is the largest feed on the site. If it does,
        that is the answer rather than a fault, and the job needs the BullMQ worker instead.
      </p>

      <button type="button" onClick={run} disabled={state === "running"} className="stomp">
        <Download
          className={`h-3.5 w-3.5 ${state === "running" ? "animate-pulse" : ""}`}
          aria-hidden="true"
        />
        {state === "running" ? "Pulling, this takes minutes" : "Pull it now"}
      </button>

      {state === "done" && message && (
        <p className="mt-3 flex items-start gap-2 text-sm text-[var(--money)]">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </p>
      )}
      {state === "error" && (
        <p className="mt-3 flex items-start gap-2 text-sm text-[var(--red)]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </p>
      )}
    </div>
  )
}

function RebuildButton() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setState("running")
    setError(null)
    try {
      const response = await fetch("/api/admin/maintenance", { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
      setResult(body)
      setState("done")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-black text-[var(--text)]">Rebuild prices and deals</h2>
      <p className="mb-3 mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Resolves listings the ingest left unmatched, recomputes every market price, prunes old
        alert records and rebuilds the search index. The same job the nightly cron runs. Safe to
        run twice: it fetches no feeds, sends no mail and spends no third-party call budget.
      </p>

      <button type="button" onClick={run} disabled={state === "running"} className="stomp stomp-go">
        <RefreshCw
          className={`h-3.5 w-3.5 ${state === "running" ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        {state === "running" ? "Running, this takes a minute" : "Run it now"}
      </button>

      {state === "done" && result && (
        <p className="mt-3 flex items-start gap-2 text-sm text-[var(--money)]">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Done in {result.seconds}s. Prices and deal badges are rebuilt. If the site still shows
            none, nothing has been ingested yet rather than anything being broken here.
          </span>
        </p>
      )}

      {state === "error" && (
        <p className="mt-3 flex items-start gap-2 text-sm text-[var(--red)]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
