"use client"

import { useState } from "react"
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
      <ImpactCatalogueButton merchants={merchants} />
      <PartnerLinks links={partnerLinks} />
      <AndertonsButton />
      <ProbeButton />
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
      <h2 className="font-display text-base font-black text-[var(--text)]">Partner links</h2>
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
  const [state, setState] = useState<
    "idle" | "listing" | "peeking" | "diagnosing" | "running" | "done" | "error"
  >("idle")
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

  const busy =
    state === "running" || state === "peeking" || state === "listing" || state === "diagnosing"

  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-display text-base font-black text-[var(--text)]">
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
  const [state, setState] = useState<"idle" | "listing" | "running" | "done" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ wrote: number; total: number } | null>(null)

  /**
   * Open the drop, list it, close. No download.
   *
   * Worth its own button because a pull is 27,000 rows against a 300 second
   * ceiling: a wrong path or a rejected login costs minutes and then reports a
   * timeout, which is indistinguishable from the catalogue simply being too
   * big. This answers "does the login work and is there a file there" in about
   * a second, and shows which file a pull would actually take.
   */
  async function list() {
    setState("listing")
    setMessage(null)
    setDetail(null)
    try {
      const response = await fetch("/api/admin/ingest-andertons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "list" }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.hint || body?.error || `HTTP ${response.status}`)

      const files: { name: string; sizeBytes: number; modified: string | null }[] = body.files ?? []

      /*
       * Three outcomes, and the middle one is the easiest to misread. A
       * missing configured path means the LOGIN WORKED, so the listing below
       * is from somewhere else and is a menu of what to set rather than the
       * drop itself.
       */
      setMessage(
        body.configuredPathMissing
          ? `The SSH login worked, but ${body.configuredPath} does not exist on the server. Listed below is ${body.path} instead, which is what this account can actually see. Set IMPACT_ANDERTONS_FTP_PATH to the right directory from that list and press this again.`
          : body.chosen
            ? `Connected over SSH and found ${files.length} entries in ${body.path}. A pull would take ${body.chosen}.`
            : `Connected over SSH, but nothing in ${body.path} looks like a catalogue file. What is actually there is listed below.`,
      )
      setDetail(
        files
          .map(
            (f) =>
              `  ${f.name.padEnd(44)} ${(f.sizeBytes ? `${(f.sizeBytes / 1_048_576).toFixed(1)} MB` : "").padStart(9)}  ${f.modified ?? ""}`,
          )
          .join("\n") || "(the directory is empty)",
      )
      setState("done")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Something went wrong.")
      setState("error")
    }
  }

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
        Roughly 27,000 products over <strong className="text-[var(--text)]">SFTP</strong> from
        Impact. It arrives in slices of 4,000 because a serverless function stops at 300 seconds,
        and the browser keeps asking for the next one until it is finished. Leave this tab open.
        Safe to re-run: every row is keyed, so a repeat costs time and nothing else.
      </p>
      <p className="mb-3 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        <strong className="text-[var(--text)]">List the drop first.</strong> A rejected login or a
        wrong directory takes minutes to surface as a failed pull and then looks like a timeout,
        which is the opposite problem. Listing answers it in a second and names the file a pull
        would take.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={list}
          disabled={state === "running" || state === "listing"}
          className="stomp stomp-ghost"
        >
          <Stethoscope
            className={`h-3.5 w-3.5 ${state === "listing" ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
          {state === "listing" ? "Listing..." : "List the drop"}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={state === "running" || state === "listing"}
          className="stomp"
        >
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

      {detail && (
        <pre className="readout mt-3 max-h-80 overflow-auto whitespace-pre-wrap p-3 text-[0.7rem] leading-relaxed">
          {detail}
        </pre>
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
