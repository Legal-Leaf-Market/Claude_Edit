"use client"

import { useCallback, useState } from "react"

/**
 * A merchant logo that degrades to a fallback instead of leaving a hole.
 *
 * Same reasoning as ListingImage: these are hotlinked from an external CDN,
 * and on a prerendered page the browser starts fetching before React hydrates,
 * so a dead URL can fail with no listener attached. The ref check asks the
 * element directly whether it already finished loading with no intrinsic
 * width, which is what a failed image looks like after the fact.
 */
export function StoreLogo({
  src,
  alt,
  className,
  fallback,
}: {
  src: string
  alt: string
  className?: string
  fallback: React.ReactNode
}) {
  const [failed, setFailed] = useState(false)

  const checkAlreadyFailed = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setFailed(true)
  }, [])

  if (failed) return <>{fallback}</>

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={checkAlreadyFailed}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  )
}
