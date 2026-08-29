"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import dynamic from "next/dynamic"
import { PEDAL_MODELS } from "@/lib/board/pedal-models"
import { renderSlug } from "@/lib/board/pedal-render"

/**
 * ONE PEDAL, FILLING THE VIEWPORT, HOLDING STILL.
 *
 * The client half of the render bench. It exists to be screenshotted, so
 * everything here is about the picture being the same picture twice: no
 * controls to be nudged, no idle drift, and a readiness flag the script can
 * wait on rather than a sleep long enough to be safe on the slowest model.
 *
 * TRANSPARENT ON PURPOSE. The stills land on cards in two themes, so a baked
 * ground would be a dark rectangle on paper and a light one at night. Alpha
 * costs the shadow nothing: the contact shadow composites over whatever the
 * card is.
 *
 * IT TAKES THE WHOLE DOCUMENT OVER, and two runs went in the bin learning why
 * a smaller measure will not do. The root layout is not optional in Next: every
 * route gets the masthead and the footer, so the first run photographed a Fuzz
 * Face with the site header composited across the top of it. A fixed overlay
 * inside the layout was no better, because a `transform` anywhere up the tree
 * makes a fixed element size against that ancestor instead of the viewport, and
 * the canvas came out taller than the page. So the bench mounts as a PORTAL on
 * `document.body`, hides every sibling outright, and the script photographs the
 * viewport rather than hunting for an element's box.
 */
const PedalViewer3D = dynamic(
  () => import("@/components/board/pedal-viewer-3d").then((m) => m.PedalViewer3D),
  { ssr: false },
)

declare global {
  interface Window {
    /**
     * Set once the canvas has been mounted and given a frame to compile shaders
     * and generate the PMREM environment. The script polls for it, then waits
     * for two identical screenshots on top: this flag says "the scene exists",
     * and pixel stability says "it has finished drawing itself".
     */
    __benchReady?: boolean
  }
}

/**
 * THE SLUG CROSSES THE BOUNDARY, NOT THE MODEL.
 *
 * A `PedalModel` carries two RegExps in `match`, and React refuses to serialise
 * a RegExp from a server component to a client one: passing the object straight
 * through is a 500 on every model, which is how this was first written. Looking
 * it up on this side costs nothing, since the table is a module constant that
 * the viewer's chunk is pulling in regardless.
 */
export function RenderBench({ slug }: { slug: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const model = useMemo(() => PEDAL_MODELS.find((entry) => renderSlug(entry) === slug), [slug])

  useEffect(() => {
    const node = document.createElement("div")
    node.id = "render-bench"
    node.setAttribute("style", "position:absolute;inset:0;background:transparent")

    /* Hide what the layout put here, rather than trying to out-position it. */
    const hidden: HTMLElement[] = []
    for (const child of Array.from(document.body.children)) {
      if (child instanceof HTMLElement) {
        hidden.push(child)
        child.style.display = "none"
      }
    }

    const page = document.documentElement.getAttribute("style")
    const body = document.body.getAttribute("style")
    const bare = "margin:0;padding:0;overflow:hidden;background:transparent;width:100%;height:100%"
    document.documentElement.setAttribute("style", bare)
    document.body.setAttribute("style", bare)
    document.body.appendChild(node)
    setHost(node)

    const frame = window.requestAnimationFrame(() => {
      window.__benchReady = true
    })

    return () => {
      window.cancelAnimationFrame(frame)
      window.__benchReady = false
      node.remove()
      for (const child of hidden) child.style.removeProperty("display")
      if (page === null) document.documentElement.removeAttribute("style")
      else document.documentElement.setAttribute("style", page)
      if (body === null) document.body.removeAttribute("style")
      else document.body.setAttribute("style", body)
    }
  }, [])

  if (!host || !model) return null

  return createPortal(
    /* `engaged` false so the LED is dark. A lit indicator is a claim that the
       pedal is switched on, and a still on a search card is not showing
       anybody's rig: it is showing the object. */
    <PedalViewer3D model={model} engaged={false} still />,
    host,
  )
}
