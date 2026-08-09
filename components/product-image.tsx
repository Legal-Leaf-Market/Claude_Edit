"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Renders a product image, and when the source has a white/near-white
 * background, recolors that background to black so it blends with the dark
 * theme (instead of showing a jarring white box).
 *
 * How it works:
 * - Draws the image to an offscreen canvas (with crossOrigin so pixels are
 *   readable when the CDN allows it).
 * - Samples the border pixels; if they are overwhelmingly near-white, we treat
 *   it as a white-background image.
 * - Replaces near-white pixels with black and outputs a data URL.
 * - If the canvas is tainted (CDN blocks CORS) or anything fails, we silently
 *   fall back to the original image on the card's dark backdrop.
 */
export function ProductImage({
  src,
  alt,
  priority = false,
}: {
  src: string
  alt: string
  priority?: boolean
}) {
  const [resolvedSrc, setResolvedSrc] = useState(src)
  const canceled = useRef(false)

  useEffect(() => {
    canceled.current = false
    setResolvedSrc(src)
    if (!src || src === "/placeholder.svg") return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async"

    img.onload = () => {
      if (canceled.current) return
      try {
        // Cap processing resolution to keep this cheap across many cards.
        const maxDim = 500
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))

        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(img, 0, 0, w, h)

        const data = ctx.getImageData(0, 0, w, h)
        const px = data.data

        // Sample the border ring to decide if the background is white.
        const isNearWhite = (i: number) => px[i] > 236 && px[i + 1] > 236 && px[i + 2] > 236
        let borderWhite = 0
        let borderTotal = 0
        const step = 2
        for (let x = 0; x < w; x += step) {
          for (const y of [0, h - 1]) {
            const i = (y * w + x) * 4
            borderTotal++
            if (isNearWhite(i)) borderWhite++
          }
        }
        for (let y = 0; y < h; y += step) {
          for (const x of [0, w - 1]) {
            const i = (y * w + x) * 4
            borderTotal++
            if (isNearWhite(i)) borderWhite++
          }
        }

        // Require a strong majority of white border pixels to avoid touching
        // photos that merely have light areas.
        if (borderTotal === 0 || borderWhite / borderTotal < 0.7) return

        // Recolor near-white pixels to black, tracking which pixels were
        // background so we can trace an outline against the object afterward.
        const total = w * h
        const bg = new Uint8Array(total)
        for (let p = 0; p < total; p++) {
          const i = p * 4
          if (px[i] > 232 && px[i + 1] > 232 && px[i + 2] > 232) {
            bg[p] = 1
            px[i] = 0
            px[i + 1] = 0
            px[i + 2] = 0
          }
        }

        // Draw a thin green-gold line around the object: paint background
        // pixels that sit within `radius` of an object (non-background) pixel.
        const radius = Math.min(2, Math.max(1, Math.round(Math.min(w, h) / 260)))
        const OUTLINE: [number, number, number] = [150, 200, 95] // green-gold blend
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const p = y * w + x
            if (!bg[p]) continue // only paint on the background side of the edge
            let nearObject = false
            for (let dy = -radius; dy <= radius && !nearObject; dy++) {
              const ny = y + dy
              if (ny < 0 || ny >= h) continue
              for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx
                if (nx < 0 || nx >= w) continue
                if (!bg[ny * w + nx]) {
                  nearObject = true
                  break
                }
              }
            }
            if (nearObject) {
              const i = p * 4
              px[i] = OUTLINE[0]
              px[i + 1] = OUTLINE[1]
              px[i + 2] = OUTLINE[2]
              px[i + 3] = 255
            }
          }
        }
        ctx.putImageData(data, 0, 0)
        const url = canvas.toDataURL("image/png")
        if (!canceled.current) setResolvedSrc(url)
      } catch {
        // Tainted canvas / CORS blocked — keep the original image.
      }
    }

    img.onerror = () => {
      // Network/decoding error — keep whatever src we have.
    }

    img.src = src

    return () => {
      canceled.current = true
    }
  }, [src])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc || "/placeholder.svg"}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
}
