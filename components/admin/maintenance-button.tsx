"use client"

import { useCallback, useState } from "react"
import { Check, Download, ListTree, RefreshCw, Stethoscope, TriangleAlert } from "lucide-react"

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

/**
 * One merchant on the Impact account, as the server sees it.
 *
 * Passed in rather than imported. The registry reads lib/env.ts, which reads
 * process.env by computed key, and neither survives being pulled into a client
 * bundle: the values would be undefined in a browser and every merchant would
 * render as unconfigured.
 */
export type ImpactMerchantOption = {
  key: string
  label: string
  catalogId: string | null
  envVar: string
}

/** One partner's outbound link, as the server resolved it. */
export type PartnerLinkOption = {
  slug: string
  name: string
  envVar: string
  configured: boolean
  tracked: boolean
  host: string | null
  verdict: string
}

export function MaintenanceButton({
  merchants,
  partnerLinks = [],
}: {
  merchants: ImpactMerchantOption[]
  partnerLinks?: PartnerLinkOption[]
}) {
  return (
    <div className="space-y-3">
      <SourceStatusPanel />
      <ImpactCatalogueButton merchants={merchants} />
      <PartnerLinks links={partnerLinks} />
      <AndertonsButton />
      <ProbeButton />
      <StorefrontProbeButton />
      <PromoteCapturesPanel />
      <RebuildButton />
    </div>
  )
}

/**
 * Whether the two partner links are actually earning.
 *
 * A READOUT, NOT A BUTTON, because there is nothing to press: these are
 * environment variables and only Vercel can change them. What it does is make a
 * rejected link visible, which is the failure worth catching here.
 *
 * A link that is not on an Impact tracking host is ignored and the page falls
 * back to the merchant's own site. Nothing breaks, the button works, the shopper
 * arrives, and the click earns nothing. That is indistinguishable from working
 * unless something says so, and these two pages have no other monetisation at
 * all, since neither partner has catalogue rows carrying a feed's own link.
 */
function PartnerLinks({ links }: { links: PartnerLinkOption[] }) {
  if (links.length === 0) return null

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-bold text-[var(--text)]">Partner links</h2>
      <p className="mb-3 mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Martinic Audio and DistroKid have no catalogue, so these two pasted links are the only
        monetisation their pages have. A link that is not on an Impact tracking host is ignored
        rather than used, which earns nothing and looks exactly like working, so it is reported
        here rather than left to a log nobody reads.
      </p>

      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.slug} className="flex items-start gap-2 text-sm">
            {link.tracked ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--money)]" aria-hidden="true" />
            ) : (
              <TriangleAlert
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  link.configured ? "text-[var(--red)]" : "text-[var(--muted-foreground)]"
                }`}
                aria-hidden="true"
              />
            )}
            <span>
              <strong className="text-[var(--text)]">{link.name}</strong>{" "}
              <span className="text-[var(--muted-foreground)]">{link.verdict}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Any Impact.com catalogue: list them, peek at one, pull it.
 *
 * Placed ABOVE the FTP pull because it is the one to try first: it needs two
 * values from Impact's API settings page rather than a mailed-out FTP pair and
 * a host that is only visible inside their platform, and it is plain HTTPS
 * from a serverless function rather than a control connection plus passive
 * data ports. It is also the only path the seven merchants approved after
 * Anderton's have at all.
 *
 * THREE BUTTONS IN THE ORDER YOU NEED THEM.
 *
 * List first, because a catalogue id cannot be guessed and a wrong one can
 * return another advertiser's products under this merchant's name. Then peek,
 * because reading the field names off one real page costs a second and is the
 * only way to know the normaliser binds what it thinks it binds. Then pull.
 */
function ImpactCatalogueButton({ merchants }: { merchants: ImpactMerchantOption[] }) {
  const [merchant, setMerchant] = useState(merchants[0]?.key ?? "andertons")
  const [state, setState] = useState<"idle" | "listing" | "peeking" | "running" | "done" | "error">(
    "idle",
  )
  const [message, setMessage] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ wrote: number; total: number } | null>(null)

  const chosen = merchants.find((m) => m.key === merchant) ?? null

  async function call(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/impact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ merchant, ...payload }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
    return body
  }

  /**
   * Ask the account which catalogues it can actually read.
   *
   * The id column is the output that matters: it is the only way to fill in an
   * IMPACT_*_CATALOG_ID, and every merchant without one ingests nothing. The
   * env var name is printed beside each so the next step is a paste rather than
   * a lookup.
   */
  async function list() {
    setState("listing")
    setMessage(null)
    setDetail(null)
    try {
      const body = await call({ mode: "list" })
      const catalogs: {
        id: string
        name: string | null
        advertiser: string | null
        items: number | null
        wiredTo: string | null
        action: string
      }[] = body.catalogs ?? []

      const unwired = catalogs.filter((c) => !c.wiredTo)
      setMessage(
        `This account can read ${body.count} catalogue(s). ` +
          (unwired.length
            ? `${unwired.length} of them are not wired to a merchant yet. Each line below says which variable to paste it into.`
            : "Every one of them is already wired to a merchant."),
      )
      setDetail(
        [
          "catalogues on the account:",
          ...catalogs.flatMap((c) => [
            `  ${String(c.id).padEnd(8)} ${(c.advertiser ?? c.name ?? "(unnamed)").slice(0, 40).padEnd(42)}` +
              `${c.items != null ? `${c.items.toLocaleString()} items` : ""}`,
            `           ${c.action}`,
          ]),
          "",
          "merchants this site knows about:",
          ...(body.merchants ?? []).map(
            (m: ImpactMerchantOption) =>
              `  ${m.key.padEnd(18)} ${m.catalogId ? `catalogue ${m.catalogId}` : `NOT SET: paste an id into ${m.envVar}`}`,
          ),
        ].join("\n"),
      )
      setState("done")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
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
   * Page through the whole catalogue, five pages per request.
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

    try {
      for (let guard = 0; guard < 60; guard++) {
        const body = await call({ mode: "pull", startPage, pages: 5, pageSize: 1000 })
        if (body.status === "failed") throw new Error(body.error ?? "The pull failed.")
        if (body.status === "skipped") throw new Error(body.reason ?? "Skipped.")

        written += body.wrote ?? 0
        inserted += body.stats?.inserted ?? 0
        updated += body.stats?.updated ?? 0
        setProgress({ wrote: written, total: body.totalRows ?? 0 })

        if (body.done || body.nextPage == null) break
        startPage = body.nextPage
      }

      setMessage(
        `Wrote ${written.toLocaleString()} rows: ${inserted.toLocaleString()} new, ${updated.toLocaleString()} updated. Now run the rebuild at the bottom so they get priced.`,
      )
      setState("done")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

  const busy = state === "running" || state === "peeking" || state === "listing"

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-bold text-[var(--text)]">
        Pull an Impact catalogue
      </h2>
      <p className="mb-3 mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Impact&apos;s partner REST API, which needs only an <code>IMPACT_ACCOUNT_SID</code> and an{" "}
        <code>IMPACT_AUTH_TOKEN</code> from their API settings page, shared by every merchant on the
        account. For Anderton&apos;s, try this before the FTP pull below: it is ordinary HTTPS, so
        none of the FTP plumbing applies, and it pages rather than re-downloading the whole file per
        chunk. For every other merchant it is the only way in.
      </p>
      <p className="mb-3 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        <strong className="text-[var(--text)]">List, then check, then pull.</strong> The list reads
        the catalogue ids off the account, which is the only way to fill in an{" "}
        <code>IMPACT_*_CATALOG_ID</code>: a guessed id either 404s or returns a different
        advertiser&apos;s products under this merchant&apos;s name. The schema check then reads one
        page and writes nothing, listing which fields the parser bound. A field that is present but
        unbound is the one worth knowing about: that is how a column silently arrives null on every
        row.
      </p>

      <label className="mb-3 block max-w-sm text-sm text-[var(--muted-foreground)]">
        Merchant
        <select
          value={merchant}
          onChange={(event) => {
            setMerchant(event.target.value)
            setState("idle")
            setMessage(null)
            setDetail(null)
          }}
          className="mt-1 block w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]"
        >
          {merchants.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
              {m.catalogId ? ` (catalogue ${m.catalogId})` : " -- no catalogue id set"}
            </option>
          ))}
        </select>
      </label>

      {chosen && !chosen.catalogId && (
        <p className="mb-3 max-w-prose text-sm text-[var(--muted-foreground)]">
          No catalogue id for {chosen.label} yet, so a pull would write nothing. Press{" "}
          <strong className="text-[var(--text)]">List the catalogues</strong> and paste the matching
          id into <code>{chosen.envVar}</code>.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={list} disabled={busy} className="stomp stomp-ghost">
          <ListTree
            className={`h-3.5 w-3.5 ${state === "listing" ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
          {state === "listing" ? "Asking..." : "List the catalogues"}
        </button>
        <button type="button" onClick={peek} disabled={busy} className="stomp stomp-ghost">
          <Stethoscope
            className={`h-3.5 w-3.5 ${state === "peeking" ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
          {state === "peeking" ? "Reading..." : "Check the schema"}
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
      <h2 className="font-display text-base font-bold text-[var(--text)]">
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
      <h2 className="font-display text-base font-bold text-[var(--text)]">Pull the Anderton&apos;s catalogue</h2>
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
      <h2 className="font-display text-base font-bold text-[var(--text)]">Rebuild prices and deals</h2>
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

/**
 * "Does this shop want to be read?"
 *
 * THE STEP BEFORE ADDING A STORE, and the reason it is a button rather than a
 * habit. Section 2 has always required checking a merchant's own terms before
 * wiring one in, and doing that by hand is why the catalogue is twelve small
 * sellers rather than fifty: a check nobody can run in a minute eventually
 * gets skipped, and the first time it is skipped is the expensive time.
 *
 * It fetches three public documents off the origin and reports what they say.
 * It adds nothing, ingests nothing and approves nothing. Paste the findings
 * into the new row's `permission.note` in lib/storefronts.ts, so the basis for
 * that row outlives whoever added it.
 *
 * The one verdict that decides anything on its own is `refused`.
 */
function StorefrontProbeButton() {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [summary, setSummary] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)

  async function run() {
    if (!url.trim()) return
    setState("running")
    setSummary(null)
    setVerdict(null)
    setDetail(null)
    try {
      const response = await fetch("/api/admin/storefront-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)

      setVerdict(body.verdict)
      setSummary(body.summary)
      setDetail(
        [
          ...(body.alreadyIngested
            ? [
                `ALREADY IN THE REGISTRY as "${body.alreadyIngested.source}" ` +
                  `(${body.alreadyIngested.label}), basis ${body.alreadyIngested.recordedBasis}, ` +
                  `checked ${body.alreadyIngested.recordedOn}, ` +
                  `${body.alreadyIngested.scheduled ? "scheduled" : "paused"}.`,
                "",
              ]
            : []),
          ...(body.findings ?? []),
          "",
          body.catalogue?.sampleTitles?.length
            ? `Sample products: ${body.catalogue.sampleTitles.join(" | ")}`
            : "",
          "",
          "--- agents.md ---",
          body.agentsMd?.excerpt ?? `(${body.agentsMd?.status ?? body.agentsMd?.error})`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      setState("done")
    } catch (caught) {
      setSummary(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-bold text-[var(--text)]">
        Check a storefront before adding it
      </h2>
      <p className="mb-3 mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Reads the shop&apos;s agents.md, its robots.txt and one page of its catalogue endpoint, and
        reports what they actually say. It writes nothing and adds nothing. An endpoint answering is
        not a permission: what decides it is whether the shop publishes an agents.md sanctioning
        read-only catalogue access. Whether they run an affiliate program is a separate question and
        does not gate this.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="url"
          className="plate min-w-[16rem] flex-1"
          placeholder="https://someshop.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void run()
          }}
        />
        <button
          type="button"
          className="stomp"
          onClick={() => void run()}
          disabled={state === "running" || !url.trim()}
        >
          {state === "running" ? "Asking..." : "Check it"}
        </button>
      </div>

      {summary && (
        <p
          className="max-w-prose text-sm leading-relaxed"
          style={{
            color:
              verdict === "refused"
                ? "var(--money)"
                : verdict === "sanctioned"
                  ? "var(--accent-text)"
                  : "var(--muted-foreground)",
          }}
        >
          {verdict ? `${verdict.toUpperCase()}: ` : ""}
          {summary}
        </p>
      )}

      {detail && (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-[8px] border border-[var(--line)] bg-[var(--bg)] p-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
          {detail}
        </pre>
      )}
    </div>
  )
}

/**
 * WHAT IS BLOCKING EACH SOURCE, AND THE LAST THING THAT WENT WRONG.
 *
 * FIRST ON THE PAGE, because it is the question every other button here is
 * downstream of. The site has 8,298 active listings from twelve small Shopify
 * sellers and none at all from the three largest catalogues we are actually
 * entitled to read, and nothing anywhere said which value was missing.
 *
 * The `lastError` column is the part that has never existed. `ingest_runs`
 * has stored the reason the Anderton's FTP pull died since 11 August and no
 * surface in this app has ever shown it, which is the same shape of problem
 * as the Impact 400 that ran for two weeks saying only "400".
 */
function SourceStatusPanel() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [rows, setRows] = useState<SourceStatusRow[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setState("running")
    setMessage(null)
    try {
      const response = await fetch("/api/admin/source-status")
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
      setRows(body.statuses as SourceStatusRow[])
      setState("done")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

  const blocked = rows?.filter((r) => r.state === "blocked") ?? []
  const other = rows?.filter((r) => r.state !== "blocked" && r.state !== "live") ?? []
  const live = rows?.filter((r) => r.state === "live") ?? []

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-bold text-[var(--text)]">
        What is blocking each source
      </h2>
      <p className="mb-3 mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Every source, the state it is actually in, and for the blocked ones the exact variable and
        where its value is found. Also the text of the last failure, which is stored on every run and
        has never been shown anywhere until now.
      </p>

      <button type="button" className="stomp" onClick={() => void load()} disabled={state === "running"}>
        {state === "running" ? "Reading..." : rows ? "Refresh" : "Show me"}
      </button>

      {message && <p className="mt-3 text-sm text-[var(--money)]">{message}</p>}

      {blocked.length > 0 && (
        <div className="mt-4">
          <h3 className="font-display text-sm font-bold text-[var(--text)]">
            Blocked: somebody has to paste a value ({blocked.length})
          </h3>
          <ul className="mt-2 space-y-3">
            {blocked.map((row) => (
              <li key={row.source} className="border-l-2 border-[var(--chrome-dk)] pl-3">
                <p className="text-sm font-semibold text-[var(--text)]">
                  {row.label}{" "}
                  <span className="font-normal text-[var(--muted-foreground)]">({row.transport})</span>
                </p>
                <p className="text-sm text-[var(--accent-text)]">{row.blockedBy}</p>
                <p className="max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {row.whereFrom}
                </p>
                {row.lastError && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-[8px] border border-[var(--line)] bg-[var(--bg)] p-2 text-xs text-[var(--muted-foreground)]">
                    {`last failure ${row.lastError.at ?? ""}\n${row.lastError.text}`}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {other.length > 0 && (
        <div className="mt-4">
          <h3 className="font-display text-sm font-bold text-[var(--text)]">
            Nothing here can fix these ({other.length})
          </h3>
          <ul className="mt-2 space-y-3">
            {other.map((row) => (
              <li key={row.source} className="border-l-2 border-[var(--line)] pl-3">
                <p className="text-sm font-semibold text-[var(--text)]">
                  {row.label}{" "}
                  <span className="font-normal text-[var(--muted-foreground)]">({row.state})</span>
                </p>
                <p className="max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {row.blockedBy ? `${row.blockedBy}. ` : ""}
                  {row.whereFrom}
                </p>
                {row.lastError && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-[8px] border border-[var(--line)] bg-[var(--bg)] p-2 text-xs text-[var(--muted-foreground)]">
                    {`last failure ${row.lastError.at ?? ""}\n${row.lastError.text}`}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {live.length > 0 && (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          Live ({live.length}): {live.map((r) => r.label).join(", ")}
        </p>
      )}
    </div>
  )
}

type SourceStatusRow = {
  source: string
  label: string
  state: "live" | "blocked" | "merchant-side" | "paused"
  transport: string
  blockedBy?: string
  whereFrom?: string
  lastRun: { job: string; status: string; rowsUpserted: number; ageMinutes: number | null } | null
  lastError: { at: string | null; text: string } | null
}

/**
 * PUBLISH A MERCHANT'S CAPTURES, OR RETIRE THEM AGAIN.
 *
 * The one control in the capture pipeline that puts rows in front of shoppers,
 * so it previews first and always. "See what it would do" is the primary
 * action and writing is the second press, because nobody should learn what a
 * promotion does by doing it.
 *
 * IT SAYS THE COMMISSION TRUTH ON EVERY ROW. A promoted Impact or CJ listing
 * carries a null affiliate_url, because their deep links need a campaign and an
 * ad id that a captured page cannot hold and this repo never hand-builds one.
 * Those rows send real shoppers to real products and earn nothing, which is the
 * right trade (section 5: a tracker crediting nobody is worse than a clean
 * direct link) and also the best argument there is for connecting the feed.
 * Left unsaid it would look exactly like working monetisation.
 */
function PromoteCapturesPanel() {
  const [rules, setRules] = useState<PromotionRuleRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const call = useCallback(async (payload: Record<string, unknown>, label: string) => {
    setBusy(label)
    if (payload.mode !== "list") setResult(null)
    try {
      const response = await fetch("/api/admin/capture/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
      if (payload.mode === "list") {
        setRules(body.rules as PromotionRuleRow[])
      } else {
        setResult(JSON.stringify(body, null, 2))
      }
    } catch (caught) {
      setResult(caught instanceof Error ? caught.message : "Something went wrong.")
    } finally {
      setBusy(null)
    }
  }, [])

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-bold text-[var(--text)]">
        Publish captures as listings
      </h2>
      <p className="mb-3 mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Turns what the collector stored into listings a shopper can see. Only for merchants with a
        written-down basis in <code>PROMOTION_RULES</code>, because capturing a merchant&apos;s pages
        says nothing about the right to republish them. Preview first; writing is a second press.
      </p>
      <p className="mb-3 max-w-prose text-sm leading-relaxed text-[var(--accent-text)]">
        Captured rows expire on a timer, because a capture cannot learn that something sold.
        Re-capture the page to push the date out.
      </p>

      <button
        type="button"
        className="stomp"
        onClick={() => void call({ mode: "list" }, "list")}
        disabled={busy !== null}
      >
        {busy === "list" ? "Reading..." : rules ? "Refresh" : "What can be published"}
      </button>

      {rules && rules.length === 0 && (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          No merchant has a promotion rule yet.
        </p>
      )}

      {rules && rules.length > 0 && (
        <ul className="mt-4 space-y-4">
          {rules.map((rule) => (
            <li key={rule.merchantKey} className="border-l-2 border-[var(--chrome-dk)] pl-3">
              <p className="text-sm font-semibold text-[var(--text)]">
                {rule.merchantKey}{" "}
                <span className="font-normal text-[var(--muted-foreground)]">
                  &rarr; {rule.source} &middot; {rule.liveNow} live &middot; {rule.staleAfterDays}d
                  shelf life
                </span>
              </p>
              {!rule.earnsCommission && (
                <p className="text-sm text-[var(--money)]">
                  These listings earn NOTHING. No tracked link can be built from a captured page.
                </p>
              )}
              <p className="max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
                {rule.basis}, decided {rule.decidedOn}. {rule.note}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="stomp"
                  onClick={() => void call({ merchantKey: rule.merchantKey }, rule.merchantKey)}
                  disabled={busy !== null}
                >
                  See what it would do
                </button>
                <button
                  type="button"
                  className="stomp"
                  onClick={() =>
                    void call({ merchantKey: rule.merchantKey, commit: true }, rule.merchantKey)
                  }
                  disabled={busy !== null}
                >
                  Publish
                </button>
                <button
                  type="button"
                  className="stomp"
                  onClick={() => {
                    if (!window.confirm(`Retire every captured listing for ${rule.merchantKey}?`)) {
                      return
                    }
                    void call({ merchantKey: rule.merchantKey, mode: "clear" }, rule.merchantKey)
                  }}
                  disabled={busy !== null || rule.liveNow === 0}
                >
                  Retire them
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result && (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-[8px] border border-[var(--line)] bg-[var(--bg)] p-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
          {result}
        </pre>
      )}
    </div>
  )
}

type PromotionRuleRow = {
  merchantKey: string
  source: string
  basis: string
  note: string
  decidedOn: string
  earnsCommission: boolean
  staleAfterDays: number
  liveNow: number
}
