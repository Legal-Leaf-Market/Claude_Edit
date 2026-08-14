"use client"

import Image from "next/image"
import { useState } from "react"

/**
 * A catalogue pedal's photo, with a drawn enclosure standing in when there
 * isn't one.
 *
 * WHY THIS IS A CLIENT COMPONENT for what is otherwise a static image. The
 * URLs come from another service over HTTP, and a merchant deleting a product
 * photo is an ordinary thing that happens without anybody here noticing. A
 * bare next/image renders a broken-image glyph in that case, which looks worse
 * on a shelf than no photo at all, so onError swaps in the fallback. That
 * needs a state hook, and a hook needs a client component.
 *
 * OBJECT-CONTAIN, NEVER COVER. These are cut-out product shots at wildly
 * different aspect ratios from a dozen different storefronts. Cropping them to
 * fill a uniform box slices the corners off half the pedals, and a pedal with
 * its footswitch cropped away is worse than one that sits small in its frame.
 */
export function PedalPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--chip)]">
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          /* Three across at the widest, two on a tablet, one on a phone. Told
             to the optimizer so it does not ship a 1500px product shot to a
             card that is never wider than a third of a 1400px shell. */
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          className="object-contain p-3 transition-transform duration-200 group-hover:scale-[1.03]"
          onError={() => setFailed(true)}
        />
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
 * two want different things: the card gets next/image and its optimizer,
 * which is worth it for a 4:3 panel, and a 36px chip does not. What they DO
 * share is the fallback, which is the part that matters: a bin of forty
 * broken-image glyphs is worse than a bin of forty drawn enclosures.
 */
export function PedalThumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)

  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-[6px] bg-[var(--chip)]">
      {src && !failed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-contain p-0.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <EnclosureGlyph />
      )}
    </span>
  )
}

/**
 * The stand-in: this site's own enclosure, drawn rather than photographed.
 *
 * Deliberately quiet. It is saying "no photo", not competing with the pedals
 * either side of it that do have one, so it sits at low opacity in the line
 * colour rather than in brass.
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
