"use client"

import { useCallback, useEffect, useState } from "react"
import type { CaptureTarget } from "@/lib/capture/targets"

/**
 * The operator side of the collector: install it, see what has landed, and act
 * as the relay tab for shops that will not let the collector post directly.
 *
 * THREE INSTALL METHODS, AND THE SECOND ONE IS NOT REDUNDANT. This is the part
 * a first attempt always gets wrong, so it is worth stating plainly:
 *
 *   The LOADER bookmarklet injects `<script src>` pointing back here. It is
 *   short and always current, and a shop with a strict `script-src` refuses it.
 *   The refusal is SILENT, because a blocked script fires no error event, so it
 *   reads as "the bookmark does nothing".
 *
 *   The SELF-CONTAINED bookmarklet carries the whole collector inside the URL,
 *   so there is nothing to fetch and nothing to block. It is built here, at
 *   load time, by fetching the live collector, which means the drag is always
 *   current and there is no duplicate committed to the repo to go stale.
 *
 *   The CONSOLE PASTE is the floor. Nothing can stop pasting source into a
 *   console, and it is the fallback where Safari refuses a very long
 *   bookmarklet URL.
 *
 * A SNAPSHOT THAT CANNOT SAY IT IS ONE is how a fixed reader gets reported as
 * broken. Once dragged, the self-contained build never updates itself, and a
 * stale collector does not throw: it returns a smaller catalogue that looks
 * fine. So the current build is printed here, the collector prints its own in
 * its panel, and the two differing is the whole diagnostic.
 */

type MerchantRow = {
  merchantKey: string
  pages: number
  products: number
  claimed: number | null
  lastAt: string
  builds: string | null
}

export function CollectClient({
  isRelay,
  targets,
}: {
  isRelay: boolean
  targets: CaptureTarget[]
}) {
  /* Decided on the server from the URL, so this page is server-rendered rather
     than blank until hydration. See app/collect/page.tsx. */
  return isRelay ? <RelayTab /> : <InstallPage targets={targets} />
}

/* -------------------------------------------------------------------------- */
/*  The relay tab                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Receive a capture from a shop whose CSP forbids the direct POST.
 *
 * The collector opened this tab, which is a NAVIGATION rather than a
 * connection, and `connect-src` does not govern navigations. It hands the
 * capture over with postMessage, and from here the POST is same-origin.
 *
 * Both ends pin the origin. The token arrives in the message because the
 * endpoint needs it, is used once, and is never stored or displayed.
 */
function RelayTab() {
  const [message, setMessage] = useState("Waiting for the collector...")

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      const data = event.data as
        | { type?: string; token?: string; payload?: { capture?: { products?: unknown[] } } }
        | undefined
      if (!data || data.type !== "ga-capture" || !data.payload) return

      const count = data.payload.capture?.products?.length ?? 0
      setMessage(`Sending ${count} products...`)

      void fetch("/api/capture/ingest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ga-admin-token": String(data.token ?? "") },
        body: JSON.stringify(data.payload),
      })
        .then(async (response) => ({ ok: response.ok, result: await response.json() }))
        .then((out) => {
          setMessage(
            out.ok
              ? `Stored ${out.result.stored} products under ${out.result.merchantKey}. You can close this tab.`
              : `Refused: ${out.result.error ?? "unknown"}`,
          )
          event.source?.postMessage(
            { type: "ga-relay-result", ok: out.ok, result: out.result },
            { targetOrigin: event.origin },
          )
        })
        .catch((error: Error) => {
          setMessage(`Failed: ${error.message}`)
          event.source?.postMessage(
            { type: "ga-relay-result", ok: false, error: error.message },
            { targetOrigin: event.origin },
          )
        })
    }

    window.addEventListener("message", onMessage)
    /* The collector waits for this before it will send. */
    try {
      window.opener?.postMessage({ type: "ga-relay-ready" }, "*")
    } catch {
      /* No opener means this tab was opened by hand; the paste box still works. */
    }
    return () => window.removeEventListener("message", onMessage)
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-display text-2xl font-bold text-[var(--text)]">Receiving a capture</h1>
      <p className="mt-3 text-[var(--text)]">{message}</p>
      <p className="mt-4 text-sm text-[var(--muted-foreground)]">
        This tab opened because the shop&apos;s own page does not permit sending directly. Close it
        once the capture has landed.
      </p>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*  The install page                                                          */
/* -------------------------------------------------------------------------- */

function InstallPage({ targets }: { targets: CaptureTarget[] }) {
  const [loaderUrl, setLoaderUrl] = useState("#")
  const [inlineUrl, setInlineUrl] = useState<string | null>(null)
  const [inlineNote, setInlineNote] = useState("Building...")
  const [build, setBuild] = useState<string | null>(null)
  const [merchants, setMerchants] = useState<MerchantRow[] | null>(null)
  const [writable, setWritable] = useState(true)
  const [pasted, setPasted] = useState("")
  const [pasteToken, setPasteToken] = useState("")
  const [pasteMessage, setPasteMessage] = useState("")
  const [copied, setCopied] = useState("")
  const [needsSignIn, setNeedsSignIn] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/capture/ingest")
      const body = await response.json()
      if (response.status === 401) {
        /*
         * Expected, not an error. This page is deliberately not behind the
         * passcode: the bookmarklet and the target list are not secrets and an
         * operator installing them should not have to sign in first. Only the
         * state table is gated, because it is our own operating information.
         */
        setNeedsSignIn(true)
        setMerchants([])
        return
      }
      setNeedsSignIn(false)
      setMerchants(body.merchants ?? [])
      setWritable(Boolean(body.writable))
    } catch {
      setMerchants([])
    }
  }, [])

  useEffect(() => {
    const src = `${window.location.origin}/gear-collector.js`

    /*
     * The loader, built from the CURRENT origin so a preview deploy produces a
     * bookmarklet pointing at that preview rather than at production. The
     * cache-buster matters because a bookmarklet is kept for months.
     *
     * The setTimeout is the CSP detector: a blocked cross-origin script fires
     * no error event in most browsers, so `onerror` alone would report nothing
     * at all. Waiting for the flag the collector sets is what turns silence
     * into a sentence.
     */
    setLoaderUrl(
      "javascript:" +
        encodeURIComponent(
          `(function(){var d=document,s=d.createElement('script');` +
            `s.src='${src}?'+Date.now();` +
            `s.onerror=function(){alert('Could not load the collector.');};` +
            `d.body.appendChild(s);` +
            `setTimeout(function(){if(!window.__GEAR_COLLECTOR__){alert('The collector did not run. ` +
            `This shop blocks scripts from other origins. Use the self-contained bookmarklet or the ` +
            `console method on the install page.');}},2500);})()`,
        ),
    )

    /*
     * The self-contained build, assembled from the live source. The preamble is
     * not optional: an inlined program has no document.currentScript, so
     * without it the collector could not work out where to send.
     */
    void fetch(`${src}?${Date.now()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        setBuild(response.headers.get("x-collector-build"))
        return response.text()
      })
      .then((source) => {
        const preamble = `window.__GEAR_COLLECTOR_SRC__=${JSON.stringify(src)};`
        /*
         * encodeURIComponent, not a template. A "#" anywhere in the source
         * would truncate the URL and leave a program ending mid-statement,
         * with no error at all.
         */
        const url = "javascript:" + encodeURIComponent(`(function(){${preamble}${source}})();`)
        setInlineUrl(url)
        setInlineNote(
          `Ready, ${Math.round(url.length / 1024)} KB. Long bookmarks are fine in Chrome, Edge and ` +
            `Firefox; Safari can refuse very long ones, and the console method is the fallback there.`,
        )
      })
      .catch((error: Error) => setInlineNote(`Could not build it: ${error.message}. Use the console method.`))

    void load()
  }, [load])

  async function copySource() {
    try {
      const src = `${window.location.origin}/gear-collector.js`
      const response = await fetch(`${src}?${Date.now()}`)
      const source = await response.text()
      /*
       * Baked in for the same reason the inline build needs it: pasted source
       * has no currentScript, so without this a console paste would not know
       * where to send.
       */
      const payload = `window.__GEAR_COLLECTOR_SRC__ = ${JSON.stringify(src)};\n${source}`
      await navigator.clipboard.writeText(payload)
      setCopied(`Copied ${Math.round(payload.length / 1024)} KB. Paste it into the console on the shop page.`)
    } catch {
      setCopied("Could not copy automatically. Open /gear-collector.js and copy it by hand.")
    }
  }

  async function sendPaste() {
    let body: unknown
    try {
      body = JSON.parse(pasted)
    } catch {
      setPasteMessage("That is not valid JSON.")
      return
    }
    try {
      const response = await fetch("/api/capture/ingest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ga-admin-token": pasteToken.trim() },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      setPasteMessage(
        response.ok ? `Stored ${result.stored} products under ${result.merchantKey}.` : `Refused: ${result.error}`,
      )
      if (response.ok) void load()
    } catch (error) {
      setPasteMessage(`Failed: ${(error as Error).message}`)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold text-[var(--text)]">Collector</h1>
      <p className="mt-2 max-w-prose text-[var(--text)]">
        Reads the catalogue page <em>you</em> are looking at and sends it here. It automates
        &quot;write down what is on my screen&quot;. It does not visit anything your browser was not
        already taken to, and it makes no request to the merchant at all.
      </p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        A capture is research: it tells you what a merchant actually stocks, so a decision about
        chasing them rests on evidence rather than on a homepage. It does not become a listing.
        Publishing a merchant&apos;s catalogue is a separate question, decided by whether we hold a
        feed or a published permission for them.
      </p>

      {!writable && (
        <p className="mt-4 rounded-[10px] border border-[var(--money)] p-3 text-sm text-[var(--money)]">
          ADMIN_PASSCODE is unset, so sending is disabled entirely.
        </p>
      )}

      <h2 className="mt-9 font-display text-lg font-bold text-[var(--accent-text)]">1 &middot; Install</h2>
      <div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--muted-foreground)]">Drag this to your bookmarks bar:</p>
        <a
          className="stomp mt-2 inline-block"
          href={loaderUrl}
          onClick={(event) => {
            event.preventDefault()
            alert("Drag this to your bookmarks bar. Clicking it here would run it on this page, which has no catalogue to read.")
          }}
        >
          Grab catalogue
        </a>

        <hr className="my-5 border-0 border-t border-[var(--line)]" />

        <p className="text-sm text-[var(--muted-foreground)]">
          <strong className="text-[var(--text)]">Nothing happened on the shop&apos;s site?</strong>{" "}
          Drag this one instead:
        </p>
        <a
          className="stomp mt-2 inline-block"
          href={inlineUrl ?? "#"}
          onClick={(event) => {
            event.preventDefault()
            alert("Drag this to your bookmarks bar.")
          }}
        >
          Grab catalogue (self-contained)
        </a>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">{inlineNote}</p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
          The first one loads the collector from this site when you click it, and a shop with a
          strict <code>script-src</code> refuses that, silently, because a blocked script fires no
          error. This one carries the whole collector inside the bookmark, so there is nothing to
          load and nothing to block.
        </p>

        {build && (
          <p className="mt-4 rounded-[10px] border border-[var(--chrome-dk)] p-3 text-sm leading-relaxed text-[var(--accent-text)]">
            <strong>The self-contained bookmark is a snapshot.</strong> It carries the collector as
            it is today and never updates itself. Current build:{" "}
            <strong className="font-mono">{build}</strong>. The collector prints its own build in
            its panel on the shop page. If the two differ, re-drag the button. A stale reader does
            not fail, it returns a smaller catalogue that looks fine.
          </p>
        )}
      </div>

      <h2 className="mt-9 font-display text-lg font-bold text-[var(--accent-text)]">2 &middot; Capture</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm leading-relaxed text-[var(--muted-foreground)]">
        <li>
          Open a category page and <strong className="text-[var(--text)]">let it finish loading</strong>.
          Scroll to the bottom and press any Load More until it stops: what is in the page is all
          this can see.
        </li>
        <li>Click the bookmark.</li>
        <li>
          Press <strong className="text-[var(--text)]">Crawl every page</strong> to walk the rest of
          that section on its own, or just capture the page you are on.
        </li>
        <li>Check the count, confirm the merchant key, paste the admin passcode, press Send.</li>
      </ol>
      <p className="mt-3 max-w-prose rounded-[10px] border-l-2 border-[var(--chrome-dk)] pl-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
        <strong className="text-[var(--text)]">A menu inside a cross-origin iframe cannot be read.</strong>{" "}
        That is the same-origin policy working correctly rather than a bug to route around.
        Right-click the grid, choose This Frame, Open Frame in New Tab, and run the bookmarklet
        there.
      </p>

      <h2 className="mt-9 font-display text-lg font-bold text-[var(--accent-text)]">
        3 &middot; Where to point it
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
        Open a category, let it load, then press the bookmark and hit{" "}
        <strong className="text-[var(--text)]">Crawl every page</strong>. It walks that section&apos;s
        pagination from inside the merchant&apos;s own page, one page at a time with a pause between,
        and stops on its own when a page adds nothing new. The merchant key beside each is what the
        capture files under, so it has to match.
      </p>
      <div className="mt-3 space-y-3">
        {targets.map((target) => (
          <div
            key={target.merchantKey}
            className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <p className="font-display text-base font-bold text-[var(--text)]">
              {target.label}{" "}
              <code className="font-mono text-sm font-normal text-[var(--accent-text)]">
                {target.merchantKey}
              </code>
            </p>
            <p className="mt-1 max-w-prose text-sm text-[var(--muted-foreground)]">{target.basis}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {target.entries.map((entry) => (
                <a
                  key={entry.url}
                  className="stomp"
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {entry.label}
                </a>
              ))}
            </div>
            {target.notes && target.notes.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {target.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-9 font-display text-lg font-bold text-[var(--accent-text)]">4 &middot; What has landed</h2>
      <div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
        {needsSignIn ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            <a className="underline" href="/admin/operating-model">
              Sign in
            </a>{" "}
            to see what has been captured. Installing the bookmarklet and capturing do not need it;
            only this table does, because it is our own operating information.
          </p>
        ) : merchants === null ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
        ) : merchants.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Nothing captured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  <th className="py-2 pr-3">Merchant</th>
                  <th className="py-2 pr-3">Pages</th>
                  <th className="py-2 pr-3">Products</th>
                  <th className="py-2 pr-3">Claimed</th>
                  <th className="py-2">Last</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((row) => (
                  <tr key={row.merchantKey} className="border-t border-[var(--line)]">
                    <td className="py-2 pr-3 font-mono text-[var(--text)]">{row.merchantKey}</td>
                    <td className="py-2 pr-3">{row.pages}</td>
                    <td className="py-2 pr-3 text-[var(--text)]">{row.products}</td>
                    {/* The gap between these two is the whole reason to show it. */}
                    <td className="py-2 pr-3 text-[var(--muted-foreground)]">{row.claimed ?? "-"}</td>
                    <td className="py-2 text-[var(--muted-foreground)]">
                      {String(row.lastAt).replace("T", " ").slice(0, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="stomp mt-4" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <h2 className="mt-9 font-display text-lg font-bold text-[var(--accent-text)]">Console method</h2>
      <div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
          Open the page, press F12, Console, paste, Enter. Some sites block pasting until you type{" "}
          <code>allow pasting</code> first. This copies the whole script rather than a one-line
          loader on purpose: a loader still has to fetch from another origin, which is exactly what
          a strict policy forbids. Pasted source has nothing left to block.
        </p>
        <button type="button" className="stomp mt-3" onClick={() => void copySource()}>
          Copy collector source
        </button>
        {copied && <p className="mt-2 text-sm text-[var(--muted-foreground)]">{copied}</p>}
      </div>

      <h2 className="mt-9 font-display text-lg font-bold text-[var(--accent-text)]">Paste a capture</h2>
      <div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
          The floor under everything: no policy can stop a clipboard. If a shop blocked both sending
          and the relay tab, press Copy in the collector panel and paste it here.
        </p>
        <textarea
          className="plate mt-3 w-full font-mono text-xs"
          rows={4}
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder='{"merchantKey":"zzounds","capture":{...}}'
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="plate"
            type="password"
            placeholder="admin passcode"
            value={pasteToken}
            onChange={(event) => setPasteToken(event.target.value)}
          />
          <button type="button" className="stomp" onClick={() => void sendPaste()}>
            Send
          </button>
        </div>
        {pasteMessage && <p className="mt-2 text-sm text-[var(--muted-foreground)]">{pasteMessage}</p>}
      </div>
    </main>
  )
}
