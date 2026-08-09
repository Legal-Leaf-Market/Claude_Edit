"use client"

import { useCallback, useState } from "react"
import { ImageOff } from "lucide-react"
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
}: {
  src: string | null
  alt: string
  className?: string
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={checkAlreadyFailed}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("bg-[var(--muted)] object-cover", className)}
    />
  )
}
