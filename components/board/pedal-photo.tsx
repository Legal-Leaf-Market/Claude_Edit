"use client"

import { useCallback, useState } from "react"
import { ModelledRender } from "@/components/modelled-render"
import { renderForGear } from "@/lib/board/pedal-render"

/**
 * A catalogue pedal's photo, with a drawn enclosure standing in when there
 * isn't one.
 *
 * A PLAIN <img>, NOT next/image, AND THAT IS THE BUG FIX RATHER THAN A
 * PREFERENCE. This used to render through the optimizer, whose allowlist in
 * next.config.mjs held eBay and Reverb only. Every product photo in the live
 * catalogue is on cdn.shopify.com, so the optimizer answered 400
 * INVALID_IMAGE_OPTIMIZE_REQUEST for the whole shelf, onError fired, and the
 * board drew the fallback enclosure for every pedal on it. Nothing threw and
 * no test failed: it looked exactly like a catalogue with no photographs.
 *
 * The hosts are allowlisted now, but that is the smaller half. A list that has
 * to grow every time a merchant is added cannot be what decides whether a
 * picture appears, because the failure is silent and the next merchant will
 * reintroduce it. So this takes the same route components/listing-image.tsx
 * always did, and the optimizer is a bonus rather than a dependency.
 *
 * OBJECT-CONTAIN, NEVER COVER. These are cut-out product shots at wildly
 * different aspect ratios from a dozen different storefronts. Cropping them to
 * fill a uniform box slices the corners off half the pedals, and a pedal with
 * its footswitch cropped away is worse than one that sits small in its frame.
 */
export function PedalPhoto({
  src,
  alt,
  brand,
  model,
}: {
  src: string | null
  alt: string
  /**
   * Which pedal this is, so a missing photo can fall back to the measured
   * model rather than to the drawn enclosure.
   *
   * The lookup happens HERE rather than in each caller, so a second shelf
   * somewhere cannot quietly ship without it. It resolves through `modelFor`,
   * which is brand-scoped and whole-word: a pedal nobody has measured gets
   * null and keeps the enclosure glyph, which is the honest answer and the
   * common one.
   */
  brand?: string
  model?: string
}) {
  const [failed, setFailed] = useState(false)
  const checkAlreadyFailed = useAlreadyFailed(setFailed)
  const modelled = renderForGear(brand, model)

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--chip)]">
      {src && !failed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          ref={checkAlreadyFailed}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-200 group-hover:scale-[1.03]"
        />
      ) : modelled ? (
        <ModelledRender src={modelled.src} name={modelled.name} className="absolute inset-0" />
      ) : (
        <EnclosureGlyph />
      )}
    </div>
  )
}

/**
 * The same photo at parts-bin size.
 *
 * A separate component rather than a size prop on the one above, because the
 * two want different padding and rounding. What they share is the part that
 * matters: the fallback, because a bin of forty broken-image glyphs is worse
 * than a bin of forty drawn enclosures.
 */
export function PedalThumb({
  src,
  alt,
  brand,
  model,
}: {
  src: string | null
  alt: string
  brand?: string
  model?: string
}) {
  const [failed, setFailed] = useState(false)
  const checkAlreadyFailed = useAlreadyFailed(setFailed)
  const modelled = renderForGear(brand, model)

  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-[6px] bg-[var(--chip)]">
      {src && !failed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          ref={checkAlreadyFailed}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-0.5"
        />
      ) : modelled ? (
        /* No legend at 36px: see ModelledRender's `compact`. */
        <ModelledRender src={modelled.src} name={modelled.name} className="h-full w-full" compact />
      ) : (
        <EnclosureGlyph />
      )}
    </span>
  )
}

/**
 * onError alone is not enough, and this is lifted from listing-image.tsx
 * rather than reinvented.
 *
 * On a server-rendered page the browser starts fetching images from the HTML
 * it was served, so a dead URL can fail BEFORE React hydrates. The error event
 * fires with no listener attached and is lost, leaving an empty box that never
 * falls back. Expired marketplace CDN URLs make that the common case here, not
 * an edge case. This ref runs at attach time and asks the element whether it
 * has already finished loading with no intrinsic width, which is what a failed
 * image looks like after the fact.
 */
function useAlreadyFailed(setFailed: (v: boolean) => void) {
  return useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth === 0) setFailed(true)
    },
    [setFailed],
  )
}

/**
 * The stand-in: this site's own enclosure, drawn rather than photographed.
 *
 * Deliberately quiet. It is saying "no photo", not competing with the pedals
 * either side of it that do have one, so it sits at low opacity in the line
 * colour rather than in the accent.
 */
function EnclosureGlyph() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className="h-1/2 w-1/2 opacity-30"
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth="4"
        aria-hidden="true"
      >
        <rect x="22" y="6" width="56" height="88" rx="10" />
        <circle cx="50" cy="18" r="3" fill="var(--line-strong)" stroke="none" />
        <circle cx="50" cy="72" r="10" />
        <circle cx="37" cy="42" r="5" />
        <circle cx="63" cy="42" r="5" />
      </svg>
    </div>
  )
}
