"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLink, ShieldCheck, X } from "lucide-react"
import { labResultsFor } from "@/lib/lab-results"

type Resolved = {
  url: string
  /** True when we matched the exact strain product/COA via search. */
  matched: boolean
  /** True when the URL is a store-wide lab-results listing (needs manual find). */
  listing: boolean
  /** True when `url` is the actual COA document (image/pdf), not a web page. */
  direct: boolean
  /** Kind of document when `direct` is true. */
  fileType?: "pdf" | "image"
  title?: string
}

export function CoaModal({
  open,
  onClose,
  storeName,
  strainName,
  productLink,
}: {
  open: boolean
  onClose: () => void
  storeName: string
  strainName: string
  productLink: string
}) {
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [searching, setSearching] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  // Close on Escape and lock body scroll while the viewer is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  // On open, search the store for this strain and resolve the best COA target.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSearching(true)
    setResolved(null)
    setLoaded(false)
    setFailed(false)

    const fallback = labResultsFor(storeName, productLink)

    ;(async () => {
      try {
        const res = await fetch(
          `/api/coa/find?store=${encodeURIComponent(storeName)}&strain=${encodeURIComponent(strainName)}`,
        )
        const data = (await res.json()) as {
          found: boolean
          url?: string
          title?: string
          direct?: boolean
          fileType?: "pdf" | "image"
        }
        if (cancelled) return
        if (data.found && data.url) {
          setResolved({
            url: data.url,
            matched: true,
            listing: false,
            direct: !!data.direct,
            fileType: data.fileType,
            title: data.title,
          })
        } else {
          setResolved({ url: fallback.url, matched: false, listing: fallback.dedicated, direct: false })
        }
      } catch {
        if (!cancelled)
          setResolved({ url: fallback.url, matched: false, listing: fallback.dedicated, direct: false })
      } finally {
        if (!cancelled) setSearching(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, storeName, strainName, productLink])

  // We ONLY embed COA documents we scraped into our own public Blob storage
  // (`direct`). Those have the correct content-type, no framing restrictions,
  // and no age gate. We deliberately do NOT embed retailer product/lab pages —
  // those force their own 21+ interstitial inside the frame, which is the dead
  // end we're avoiding. When there's no stored document, we show a clean
  // "open at retailer" card instead of embedding anything.
  const embedSrc = resolved?.direct ? resolved.url : null
  const isImage = resolved?.direct && resolved.fileType === "image"
  const isPdf = resolved?.direct && resolved.fileType === "pdf"
  useEffect(() => {
    if (!embedSrc) return
    setLoaded(false)
    setFailed(false)
    timeoutRef.current = window.setTimeout(() => setFailed(true), 15000)
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [embedSrc])

  if (!open) return null

  const subtitle = searching
    ? `Searching ${storeName} for "${strainName}"…`
    : resolved?.direct
      ? `Certificate of Analysis for "${strainName}".`
      : resolved?.matched
        ? `Matched "${strainName}" — showing its lab results.`
        : resolved?.listing
          ? `Couldn't auto-match — find "${strainName}" in the list below.`
          : `COA is published on this product's page.`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Lab results for ${strainName} at ${storeName}`}
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gold/30 bg-navy2 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <header className="flex items-center justify-between gap-3 border-b border-gold/20 bg-navy/60 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-lime" />
              <h2 className="truncate text-sm font-black uppercase tracking-wide text-mint">
                Lab Results — {storeName}
              </h2>
              {resolved?.matched && (
                <span className="shrink-0 rounded-full bg-lime/15 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wide text-lime">
                  {resolved.direct ? "COA found" : "Strain matched"}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {resolved && (
              <a
                href={resolved.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-mint transition hover:bg-gold/20"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Close lab results"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 bg-white/5 text-mint transition hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative flex-1 bg-white">
          {/* Spinner: while searching, or while a stored document is loading. */}
          {(searching || (embedSrc && !loaded && !failed)) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-navy2 text-mint">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
              <p className="text-sm font-semibold text-muted-foreground">
                {searching ? `Finding the COA for "${strainName}"…` : "Loading certificate…"}
              </p>
            </div>
          )}

          {/* Stored COA scan (JPEG/PNG) served from our own Blob storage. */}
          {embedSrc && isImage && (
            <div className="h-full w-full overflow-auto bg-white p-2 sm:p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={embedSrc}
                src={embedSrc || "/placeholder.svg"}
                alt={`Certificate of Analysis for ${strainName} from ${storeName}`}
                className="mx-auto h-auto w-full max-w-3xl"
                onLoad={() => {
                  setLoaded(true)
                  if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
                }}
                onError={() => setFailed(true)}
              />
            </div>
          )}

          {/* Stored COA PDF served from our own Blob storage. */}
          {embedSrc && isPdf && (
            <iframe
              key={embedSrc}
              src={`${embedSrc}#toolbar=1&view=FitH`}
              title={`Certificate of Analysis for ${strainName} from ${storeName}`}
              className="h-full w-full"
              onLoad={() => {
                setLoaded(true)
                if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
              }}
            />
          )}

          {/* No stored document (or it failed): clean "open at retailer" card —
              we never embed the retailer page, which would only show its 21+ gate. */}
          {!searching && (!embedSrc || failed) && resolved && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-navy2 px-6 text-center">
              <ShieldCheck className="h-10 w-10 text-lime" />
              <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                {embedSrc
                  ? `The certificate for "${strainName}" couldn't be displayed here.`
                  : `We couldn't pull a stored certificate for "${strainName}". ${storeName} publishes its lab results on their own site.`}
              </p>
              <a
                href={resolved.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-lime to-gold px-5 py-2.5 text-sm font-black text-navy transition hover:brightness-105"
              >
                <ExternalLink className="h-4 w-4" />
                {resolved.matched ? `Open COA at ${storeName}` : `View lab results at ${storeName}`}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
