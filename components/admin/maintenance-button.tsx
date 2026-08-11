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
      <AndertonsApiButton />
      <AndertonsButton />
      <ProbeButton />
      <RebuildButton />
    </div>
  )
}

/**
 * The Anderton's catalogue over Impact's REST API.
 *
 * Placed ABOVE the FTP pull because it is the one to try first: it needs two
 * values from Impact's API settings page rather than a mailed-out FTP pair and
 * a host that is only visible inside their platform, and it is plain HTTPS
 * from a serverless function rather than a control connection plus passive
 * data ports.
 *
 * Peek before pull, deliberately. Reading the field names off one real page
 * costs a second and is the only way to know the normaliser binds what it
 * thinks it binds.
 */
function AndertonsApiButton() {
  const [state, setState] = useState<"idle" | "peeking" | "diagnosing" | "running" | "done" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ wrote: number; total: number } | null>(null)

  async function call(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/andertons-api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
    return body
  }

  async function peek() {
    setState("peeking")
    setMessage(null)
    setDetail(null)
    try {
      const body = await call({ mode: "peek" })
      const unbound: string[] = body.unboundFields ?? []
      const boundPairs = Object.entries(body.bound ?? {}) as [string, string | null][]
      const missing = boundPairs.filter(([, header]) => !header).map(([field]) => field)

      setMessage(
        `Reached the catalogue: ${body.total?.toLocaleString() ?? "an unknown number of"} items` +
          `${body.totalPages ? ` across ${body.totalPages} pages` : ""}, ` +
          `${body.sampleSize} read as a sample. ` +
          (missing.length
            ? `${missing.length} field(s) this parser wants are NOT in the response: ${missing.join(", ")}.`
            : "Every field the parser wants is present."),
      )
      setDetail(
        [
          `items live under: ${body.itemsKey ?? "(not found)"}`,
          `envelope keys: ${(body.envelopeKeys ?? []).join(", ") || "(none)"}`,
          "",
          "bound:",
          ...boundPairs.map(([field, header]) => `  ${field.padEnd(16)} ${header ?? "-- NOT FOUND --"}`),
          "",
          `present but unused (${unbound.length}):`,
          ...unbound.map((f) => `  ${f}`),
        ].join("\n"),
      )
      setState("done")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

  /**
   * Which of the candidate causes of a 400 is the real one.
   *
   * A 400 from this endpoint means a bad parameter OR paging past Impact's
   * 20,000-record ceiling OR an API version this account cannot serve, and the
   * status alone separates none of them. This varies one thing at a time and
   * shows what came back, the same job "Diagnose the Anderton's connection"
   * does for the FTP side.
   */
  async function diagnose() {
    setState("diagnosing")
    setMessage(null)
    setDetail(null)
    try {
      const body = await call({ mode: "diagnose" })
      const probes: {
        label: string
        varies: string
        status: number
        ok: boolean
        records: number | null
        note: string
      }[] = body.probes ?? []
      const catalogs: Record<string, string>[] = body.catalogs ?? []

      setMessage(body.verdict ?? "No verdict returned.")
      setDetail(
        [
          ...probes.flatMap((p) => [
            `${p.ok ? "OK  " : "FAIL"} ${String(p.status).padEnd(4)} ${p.label}`,
            `          varies: ${p.varies}`,
            ...(p.records != null ? [`          records: ${p.records}`] : []),
            ...(p.note ? [`          said: ${p.note}`] : []),
            "",
          ]),
          catalogs.length ? `catalogues this account can read (${catalogs.length}):` : "",
          ...catalogs.map(
            (c) =>
              `  ${c.Id ?? c.CatalogId ?? "?"}  ${c.Name ?? c.CatalogName ?? ""}  ${c.NumberOfItems ?? c.ItemCount ?? ""}`,
          ),
        ]
          .filter(Boolean)
          .join("\n"),
      )
      setState("done")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

  /**
   * Page through the whole catalogue.
   *
   * The loop lives here for the same reason the FTP one does: a function stops
   * at 300 seconds and the browser does not. Each call reports the page to
   * resume from, and every write is keyed, so a refresh mid-run costs time and
   * nothing else.
   */
  async function pull() {
    setState("running")
    setMessage(null)
    setDetail(null)
    setProgress(null)

    let startPage = 1
    let written = 0
    let inserted = 0
    let updated = 0
    let ceiling = false

    try {
      // Page size and pages-per-call are the server's to choose: they follow
      // Impact's documented default and its paging ceiling, neither of which
      // is a thing a button should be asserting an opinion about.
      for (let guard = 0; guard < 60; guard++) {
        const body = await call({ mode: "pull", startPage })
        if (body.status === "failed") throw new Error(body.error ?? "The pull failed.")
        if (body.status === "skipped") throw new Error(body.reason ?? "Skipped.")

        written += body.wrote ?? 0
        inserted += body.stats?.inserted ?? 0
        updated += body.stats?.updated ?? 0
        ceiling = ceiling || Boolean(body.ceilingReached)
        setProgress({ wrote: written, total: body.totalRows ?? 0 })

        if (body.done || body.nextPage == null) break
        startPage = body.nextPage
      }

      setMessage(
        `Wrote ${written.toLocaleString()} rows: ${inserted.toLocaleString()} new, ${updated.toLocaleString()} updated. ` +
          (ceiling
            ? "This stopped at Impact's 20,000-record paging ceiling rather than at the end of the catalogue, so the rest of it needs the FTP pull below. Nothing was expired, because the rows past the ceiling were never looked at. "
            : "") +
          "Now run the rebuild at the bottom so they get priced.",
      )
      setState("done")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

  const busy = state === "running" || state === "peeking" || state === "diagnosing"

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-black text-[var(--text)]">
        Pull the Anderton&apos;s catalogue (API)
      </h2>
      <p className="mb-3 mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Impact&apos;s partner REST API, which needs only an <code>IMPACT_ACCOUNT_SID</code> and an{" "}
        <code>IMPACT_AUTH_TOKEN</code> from their API settings page. Try this before the FTP pull
        below: it is ordinary HTTPS, so none of the FTP plumbing applies, and it pages rather than
        re-downloading the whole file per chunk.
      </p>
      <p className="mb-3 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        <strong className="text-[var(--text)]">Check the schema first.</strong> It reads one page,
        writes nothing, and lists which fields the parser bound. A field that is present but unbound
        is the one worth knowing about: that is how a column silently arrives null on every row.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={peek} disabled={busy} className="stomp stomp-ghost">
          <Stethoscope
            className={`h-3.5 w-3.5 ${state === "peeking" ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
          {state === "peeking" ? "Reading..." : "Check the schema"}
        </button>
        <button type="button" onClick={diagnose} disabled={busy} className="stomp stomp-ghost">
          <Stethoscope
            className={`h-3.5 w-3.5 ${state === "diagnosing" ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
          {state === "diagnosing" ? "Probing..." : "Diagnose a failure"}
        </button>
        <button type="button" onClick={pull} disabled={busy} className="stomp">
          <Download
            className={`h-3.5 w-3.5 ${state === "running" ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
          {state === "running" ? "Pulling..." : "Pull it now"}
        </button>
      </div>

      {state === "running" && progress && (
        <p className="mt-3 text-sm tabular-nums text-[var(--accent-text)]">
          {progress.wrote.toLocaleString()}
          {progress.total ? ` of ${progress.total.toLocaleString()}` : ""} rows written
        </p>
      )}

      {message && (state === "done" || state === "error") && (
        <p
          className={`mt-3 flex items-start gap-2 text-sm ${
            state === "error" ? "text-[var(--red)]" : "text-[var(--money)]"
          }`}
        >
          {state === "error" ? (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{message}</span>
        </p>
      )}

      {detail && (
        <pre className="readout mt-3 max-h-80 overflow-auto whitespace-pre-wrap p-3 text-[0.7rem] leading-relaxed">
          {detail}
        </pre>
      )}
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

      {/*
        Both of these are settings that live in Impact's platform rather than
        in Vercel, which is why they are worth naming here: somebody debugging
        this will otherwise spend the round trip re-checking environment
        variables that are already correct.
      */}
      <ul className="mb-3 max-w-prose list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--muted-foreground)]">
        <li>
          The username and password are a dedicated pair Impact mails on request, from{" "}
          <strong className="text-[var(--text)]">
            Email Product Catalog FTP Username and Password
          </strong>{" "}
          in the platform. They are not the Impact account login, and requesting them needs the
          Technical Settings permission.
        </li>
        <li>
          The host belongs to the <strong className="text-[var(--text)]">Download via FTP</strong>{" "}
          panel on the product catalogue page. <code>products.impact.com</code> is what this
          defaults to, but that name is documented on the side brands upload to, so treat it as a
          starting guess rather than a fact.
        </li>
      </ul>

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
