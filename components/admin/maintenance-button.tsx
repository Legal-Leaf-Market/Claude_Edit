"use client"

import { useState } from "react"
import { Check, Download, RefreshCw, Stethoscope, TriangleAlert } from "lucide-react"

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
      <ProbeButton />
      <RebuildButton />
    </div>
  )
}

/**
 * "What does the server actually speak?"
 *
 * Only useful when the pull above is failing, which is why it sits underneath
 * it and describes itself as a diagnostic rather than as a step. It reaches
 * Impact but sends no credential and writes no rows, so it is safe to press
 * repeatedly while working a problem.
 */
function ProbeButton() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [reading, setReading] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)

  async function run() {
    setState("running")
    setReading(null)
    setTranscript(null)
    try {
      const response = await fetch("/api/admin/probe-ftp", { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)

      setReading(body.reading)
      setTranscript(
        (body.ports ?? [])
          .map(
            (p: { port: number; expecting: string; reached: boolean; transcript: string[]; error?: string }) =>
              [
                `port ${p.port}  (${p.expecting})`,
                `  ${p.reached ? "connected" : "no connection"}${p.error ? `  ${p.error}` : ""}`,
                ...p.transcript.map((line) => `  ${line.replace(/\n/g, "\n  ")}`),
              ].join("\n"),
          )
          .join("\n\n"),
      )
      setState("done")
    } catch (caught) {
      setReading(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-black text-[var(--text)]">
        Diagnose the Anderton&apos;s connection
      </h2>
      <p className="mb-3 mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Only worth pressing when the pull above is failing. It opens a socket to Impact on the three
        ports this drop could be on, records what the server says about itself, and quits. It sends
        no username or password on any of them, writes nothing, and reaches no database.
      </p>

      <button type="button" onClick={run} disabled={state === "running"} className="stomp stomp-ghost">
        <Stethoscope
          className={`h-3.5 w-3.5 ${state === "running" ? "animate-pulse" : ""}`}
          aria-hidden="true"
        />
        {state === "running" ? "Asking..." : "Ask the server"}
      </button>

      {reading && (
        <p
          className={`mt-3 flex items-start gap-2 text-sm ${
            state === "error" ? "text-[var(--red)]" : "text-[var(--accent-text)]"
          }`}
        >
          {state === "error" ? (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{reading}</span>
        </p>
      )}

      {/*
        The transcript is the evidence behind the reading above, and the reading
        is a guess at what the replies mean. Showing both means a wrong reading
        is correctable by looking rather than by another deploy.
      */}
      {transcript && (
        <pre className="readout mt-3 max-h-72 overflow-auto whitespace-pre-wrap p-3 text-[0.7rem] leading-relaxed">
          {transcript}
        </pre>
      )}
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
  const [progress, setProgress] = useState<{ wrote: number; total: number } | null>(null)

  /**
   * Pull the catalogue a slice at a time, until it is done.
   *
   * The loop lives in the browser rather than in the function because a Vercel
   * function stops at 300 seconds and 27,000 rows may not fit inside one. Each
   * request writes a slice and reports where to resume; the browser has no
   * such ceiling, so one click still means one finished catalogue.
   *
   * Every slice is idempotent, so a refresh mid-run loses nothing but time.
   */
  async function run() {
    setState("running")
    setMessage(null)
    setProgress(null)

    const LIMIT = 4000
    let offset = 0
    let written = 0
    let inserted = 0
    let updated = 0

    try {
      for (let guard = 0; guard < 40; guard++) {
        const response = await fetch("/api/admin/ingest-andertons", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offset, limit: LIMIT }),
        })
        const body = await response.json()
        if (!response.ok) {
          // The settings actually used matter as much as the error: a wrong
          // hostname and a DNS outage read identically otherwise.
          const used = body?.used
            ? ` [host: ${JSON.stringify(body.used.host)}, path: ${JSON.stringify(body.used.path)}, user set: ${body.used.userSet}, password set: ${body.used.passwordSet}]`
            : ""
          throw new Error(`${body?.error ?? response.status}${used}${body?.hint ? ` -- ${body.hint}` : ""}`)
        }
        if (body.status === "failed") throw new Error(body.error ?? "The pull failed.")
        if (body.status === "skipped") throw new Error(body.reason ?? "Skipped.")

        written += body.wrote ?? 0
        inserted += body.stats?.inserted ?? 0
        updated += body.stats?.updated ?? 0
        setProgress({ wrote: written, total: body.totalRows ?? 0 })

        if (body.done) break
        offset = (body.offset ?? offset) + (body.wrote ?? LIMIT)
        if (!body.wrote) break
      }

      setMessage(
        `Wrote ${written.toLocaleString()} rows: ${inserted.toLocaleString()} new, ${updated.toLocaleString()} updated. Now run the rebuild below so they get priced.`,
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
        Roughly 27,000 products over FTP from Impact. It arrives in slices of 4,000 because a
        serverless function stops at 300 seconds, and the browser keeps asking for the next one
        until it is finished. Leave this tab open. Safe to re-run: every row is keyed, so a repeat
        costs time and nothing else.
      </p>

      <button type="button" onClick={run} disabled={state === "running"} className="stomp">
        <Download
          className={`h-3.5 w-3.5 ${state === "running" ? "animate-pulse" : ""}`}
          aria-hidden="true"
        />
        {state === "running" ? "Pulling..." : "Pull it now"}
      </button>

      {state === "running" && progress && (
        <p className="mt-3 text-sm tabular-nums text-[var(--accent-text)]">
          {progress.wrote.toLocaleString()}
          {progress.total ? ` of ${progress.total.toLocaleString()}` : ""} rows written
        </p>
      )}

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
