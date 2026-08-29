"use client"

import { useCallback, useState } from "react"
import { ImageOff } from "lucide-react"
import { ModelledRender } from "@/components/modelled-render"
import { cn } from "@/lib/utils"

/**
 * Thumbnail for a marketplace listing.
 *
 * A plain <img> on purpose. These are hotlinked from eBay and Reverb CDNs whose
 * hostnames shift, and a URL the Next optimizer does not recognise renders as a
 * hard 500 rather than a missing picture. A broken image must never take out
 * the card around it, so the error path swaps in a placeholder instead.
 */
export function ListingImage({
  src,
  alt,
  className,
  fallbackLabel,
  fallbackHue,
  modelled,
}: {
  src: string | null
  alt: string
  className?: string
  /**
   * A measured model to draw when there is no photograph.
   *
   * Comes from `renderForGear()`, so it is null for the vast majority of
   * listings and that is correct: 88 pedals are measured and the catalogue is
   * larger than that. It sits AHEAD of `fallbackLabel` because a picture of
   * the actual object beats a tinted tile carrying the effect type, and behind
   * the real photograph because the seller's own picture is of the seller's
   * own unit, which is the thing being bought.
   */
  modelled?: { src: string; name: string } | null
  /**
   * What to draw instead of the broken-image glyph when there is no photo.
   *
   * The rig pages need this. A documented board is five pedals that nobody we
   * track stocks, so it is five rows with no photo, and five broken-image
   * icons in a column reads as a page that failed to load rather than as a
   * page about gear we do not sell. A tinted tile carrying the effect type
   * says the same true thing without looking broken.
   *
   * Strings rather than a ReactNode so this stays trivially passable from a
   * server component.
   */
  fallbackLabel?: string
  fallbackHue?: string
}) {
  const [failed, setFailed] = useState(false)

  /**
   * onError alone is not enough.
   *
   * On a prerendered page the browser starts fetching images from the served
   * HTML, so a dead URL can fail BEFORE React hydrates. The error event fires
   * with no listener attached and is lost forever, leaving the alt text spilling
   * out of a zero-height box. Expired marketplace CDN URLs make that the common
   * case, not an edge case.
   *
   * This ref runs at attach time and asks the element directly whether it has
   * already finished loading with no intrinsic width, which is what a failed
   * image looks like after the fact.
   */
  const checkAlreadyFailed = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setFailed(true)
  }, [])

  if (!src || failed) {
    if (modelled) {
      return <ModelledRender src={modelled.src} name={modelled.name} className={className} />
    }

    if (fallbackLabel) {
      return (
        <div
          className={cn("flex items-center justify-center overflow-hidden px-1 text-center", className)}
          style={{
            background: `color-mix(in srgb, ${fallbackHue ?? "var(--chrome-dk)"} 14%, var(--surface))`,
            color: fallbackHue ?? "var(--chrome-dk)",
          }}
        >
          <span className="text-[0.6rem] font-semibold uppercase leading-tight tracking-wide">
            {fallbackLabel}
          </span>
          <span className="sr-only">No photo available</span>
        </div>
      )
    }

    return (
      <div
        className={cn(
          "flex items-center justify-center bg-[var(--muted)] text-[var(--muted-foreground)]",
          className,
        )}
      >
        <ImageOff className="h-6 w-6 opacity-50" aria-hidden="true" />
        <span className="sr-only">No photo available</span>
      </div>
    )
  }

  return (
    // White backdrop and object-contain rather than a crop: these are hotlinked
    // product photos shot on all kinds of backgrounds (white, transparent,
    // lifestyle), and cropping to fill a fixed box regularly cuts off the
    // actual instrument. White reads consistently as "product photo" instead
    // of the card looking broken against this site's dark theme.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={checkAlreadyFailed}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("bg-white object-contain p-3", className)}
    />
  )
}
