"use client"

import { useState } from "react"
import type { ListingDraft, ListingPublication } from "@/lib/db/schema"
import type { Readiness } from "@/lib/listing/readiness"

/**
 * The workbench. One record per physical unit, and a push button per channel.
 *
 * WHY THE READINESS LIST IS SHOWN BEFORE THE BUTTON IS PRESSED. A marketplace
 * rejects an incomplete listing in its own vocabulary, describing its own field
 * names. Printing what is still missing, in our words, next to the button that
 * would fail turns a round trip into a glance.
 *
 * WHY "IT SOLD" IS A FIRST-CLASS ACTION RATHER THAN A STATUS DROPDOWN. One
 * physical pedal on two marketplaces can be bought on both, and the second
 * buyer is the one who finds out. Making it effortless to list in two places
 * without making it equally effortless to take it down would be a worse tool
 * than listing by hand.
 */

type Row = {
  draft: ListingDraft
  publications: ListingPublication[]
  readiness: Readiness[]
}

type Props = {
  rows: Row[]
  channelStatus: Record<string, string>
}

const money = (cents: number | null) =>
  cents == null ? "not set" : "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const CHANNEL_LABEL: Record<string, string> = { reverb: "Reverb", ebay: "eBay" }

export function ListingsWorkbench({ rows, channelStatus }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key)
    try {
      const res = await fetch("/api/admin/listings/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setNotes((n) => ({ ...n, [key]: describe(data) }))
      if (data.status === "published" || data.ended) {
        // The server holds the truth about what is live where, so re-read it
        // rather than patching a copy of it in the browser.
        setTimeout(() => window.location.reload(), 900)
      }
    } catch {
      setNotes((n) => ({ ...n, [key]: "The request did not get through. Nothing was changed." }))
    } finally {
      setBusy(null)
    }
  }

  function describe(data: Record<string, unknown>): string {
    if (data.error) return String(data.error)
    if (data.status === "published") return "Live. Reloading."
    if (data.status === "already") return "Already live there. Nothing was sent."
    if (data.status === "not-ready") return "Still needs: " + (data.missing as string[]).join(", ")
    if (data.status === "failed") return String(data.reason)
    if (data.ended) {
      const ended = data.ended as { channel: string; ok: boolean; reason?: string }[]
      if (ended.length === 0) return "Nothing else was live. Marked sold."
      return ended
        .map((e) => (e.ok ? `${CHANNEL_LABEL[e.channel]} ended` : `${CHANNEL_LABEL[e.channel]} NOT ended: ${e.reason}`))
        .join(". ")
    }
    return "Done."
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-2xl font-black uppercase tracking-wide">Listings</h1>
      <p className="mt-2 max-w-[68ch] text-sm text-[var(--text-dim)]">
        One record per physical unit. Fill it in once, then push it to each channel when it is
        ready. Nothing here goes into the Gear Avail catalogue: our own stock stays out of the
        medians that judge everybody else&apos;s prices.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {Object.entries(channelStatus).map(([channel, status]) => (
          <div
            key={channel}
            className={
              "rounded border p-3 text-sm " +
              (status === "ready"
                ? "border-[var(--edge)] bg-[var(--panel)] text-[var(--text-dim)]"
                : "border-[var(--edge)] border-l-2 border-l-[var(--warn)] bg-[var(--sunk)] text-[var(--text-dim)]")
            }
          >
            <b className="text-[var(--text)]">{CHANNEL_LABEL[channel] ?? channel}</b>{" "}
            {status === "ready"
              ? "is connected."
              : status === "sandbox"
                ? "is pointing at the SANDBOX. Nothing pushed there is real."
                : status}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded border border-[var(--edge)] bg-[var(--panel)] p-4 text-sm text-[var(--text-dim)]">
          No listings yet. Create one by POSTing a SKU and a title to{" "}
          <code className="text-[var(--text)]">/api/admin/listings</code>, or add the form below
          once the first few are in and the shape has settled.
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        {rows.map(({ draft, publications, readiness }) => (
          <section key={draft.id} className="rounded border border-[var(--edge)] bg-[var(--panel)] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">{draft.title}</h2>
                <div className="mt-0.5 text-xs text-[var(--text-faint)]">
                  {draft.sku} &middot; {draft.condition ?? "no condition"} &middot;{" "}
                  {money(draft.priceCents)}
                  {draft.costCents != null ? ` · cost ${money(draft.costCents)}` : ""}
                </div>
              </div>
              <span className="rounded border border-[var(--edge)] px-2 py-0.5 text-[10px] uppercase tracking-[.12em] text-[var(--text-faint)]">
                {draft.status}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {readiness.map((r) => {
                const pub = publications.find((p) => p.channel === r.channel)
                const key = `${draft.id}:${r.channel}`
                const live = pub?.state === "published"
                /* A channel with no credentials cannot take anything, so the
                   button says so rather than offering a push that will come
                   back with a missing environment variable. The readiness list
                   is about the listing; this is about the connection. */
                const connected =
                  channelStatus[r.channel] === "ready" || channelStatus[r.channel] === "sandbox"
                return (
                  <div key={r.channel} className="rounded border border-[var(--edge)] bg-[var(--sunk)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-sm">{CHANNEL_LABEL[r.channel] ?? r.channel}</b>
                      {live ? (
                        <span className="text-xs text-[var(--accent-text)]">live</span>
                      ) : pub?.state === "ended" ? (
                        <span className="text-xs text-[var(--text-faint)]">ended</span>
                      ) : pub?.state === "failed" ? (
                        <span className="text-xs text-[var(--warn)]">failed</span>
                      ) : null}
                    </div>

                    {live && pub?.externalUrl ? (
                      <a
                        className="mt-1 block truncate text-xs text-[var(--accent-text)] underline"
                        href={pub.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {pub.externalUrl}
                      </a>
                    ) : null}

                    {!live && r.missing.length > 0 ? (
                      <ul className="mt-1 list-disc pl-4 text-xs text-[var(--text-dim)]">
                        {r.missing.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    ) : null}

                    {pub?.error ? (
                      <p className="mt-1 text-xs text-[var(--warn)]">{pub.error}</p>
                    ) : null}

                    <button
                      type="button"
                      className="mt-2 rounded border border-[var(--edge)] px-3 py-1 text-xs disabled:opacity-50"
                      disabled={busy === key || live || !r.ready || !connected}
                      onClick={() => act(key, { id: draft.id, channel: r.channel })}
                    >
                      {live
                        ? "Already live"
                        : !connected
                          ? "Not connected"
                          : busy === key
                            ? "Pushing..."
                            : `Push to ${CHANNEL_LABEL[r.channel]}`}
                    </button>

                    {connected && channelStatus[r.channel] === "sandbox" && !live ? (
                      <p className="mt-1 text-xs text-[var(--warn)]">
                        Sandbox. This will not create a real listing.
                      </p>
                    ) : null}

                    {notes[key] ? (
                      <p className="mt-1 text-xs text-[var(--text-dim)]">{notes[key]}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {publications.some((p) => p.state === "published") ? (
              <div className="mt-3 border-t border-[var(--edge)] pt-3">
                <p className="text-xs text-[var(--text-dim)]">
                  Sold? End it everywhere else before somebody buys it twice.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {publications
                    .filter((p) => p.state === "published")
                    .map((p) => {
                      const key = `${draft.id}:sold:${p.channel}`
                      return (
                        <button
                          key={p.channel}
                          type="button"
                          className="rounded border border-[var(--edge)] px-3 py-1 text-xs disabled:opacity-50"
                          disabled={busy === key}
                          onClick={() => act(key, { id: draft.id, action: "sold", soldOn: p.channel })}
                        >
                          {busy === key
                            ? "Ending..."
                            : `Sold on ${CHANNEL_LABEL[p.channel]}, end the rest`}
                        </button>
                      )
                    })}
                </div>
                {Object.entries(notes)
                  .filter(([k]) => k.startsWith(`${draft.id}:sold:`))
                  .map(([k, v]) => (
                    <p key={k} className="mt-1 text-xs text-[var(--text-dim)]">
                      {v}
                    </p>
                  ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  )
}
