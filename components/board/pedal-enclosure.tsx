"use client"

import { useCallback, useState } from "react"
import { ArrowLeftRight, Rotate3d, X } from "lucide-react"
import type { BoardItem } from "@/lib/board/model"
import { SLOT_BY_ID } from "@/lib/stompbox/chain"

/**
 * One pedal, on the board, drawn as the object it is.
 *
 * A DIE-CAST BOX, NOT A CARD. The whole design system is built on the idea
 * that a control is a piece of gear (globals.css, CLAUDE.md section 5), and
 * this is the one place on the site where that is literal rather than a
 * metaphor: the thing being represented actually is an enclosure with a
 * silkscreen, an LED and a footswitch.
 *
 * THE LED IS THE STATE, and it is the only saturated colour here, which is
 * what it means everywhere else on the site: this is live. Bypassed, the
 * enclosure keeps its shape and loses its light, exactly as it would on a
 * floor, rather than vanishing or greying into something that reads as
 * disabled. It is still on your board. It is just not in the signal.
 *
 * A PHOTO GOES ON THE FACE WHEN THERE IS ONE. Catalogue rows carry a product
 * shot and using it is the difference between a board of real pedals and a
 * board of identical grey boxes. Guide entries have no photo and get the
 * silkscreen treatment instead, which is also the honest signal that the two
 * are different kinds of thing.
 *
 * EVERY CONTROL FOR THIS PEDAL LIVES INSIDE THIS CARD, and that is a bug fix
 * with a cause worth writing down. Swap and pick-up used to be a row floated
 * under the enclosure by the builder, and they were not clickable: `.deck-row`
 * carries `rotateX(13deg)` with `preserve-3d`, so the pedals are hit-tested
 * against their PROJECTED geometry while a plain absolutely-positioned row is
 * hit-tested against its flat layout box. The neighbouring pedal's projection
 * covered it, `document.elementFromPoint` returned the sibling, and the only
 * way into the 3D viewer on this whole site simply did not respond to a
 * pointer. Nothing errored. Controls that live inside the card transform with
 * it, which is why the remove button always worked.
 */
export function PedalEnclosure({
  item,
  position,
  onToggle,
  onRemove,
  onSwap,
  onInspect,
  swapLabel,
}: {
  item: BoardItem
  /** 1-based place in the signal chain, printed on the box like a patch number. */
  position: number
  onToggle: () => void
  onRemove: () => void
  /** Try a different pedal in this slot. The common move, so it comes first. */
  onSwap: () => void
  /** Take it off the shelf and turn it over: the 3D viewer. */
  onInspect: () => void
  /** "another overdrive", so the label names the slot rather than the pedal. */
  swapLabel: string
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const showPhoto = Boolean(item.imageUrl) && !photoFailed

  /* A dead URL can finish failing before React hydrates, so onError alone
     misses it and the face stays empty instead of falling back. Same check,
     and the same reason, as components/listing-image.tsx. */
  const checkAlreadyFailed = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setPhotoFailed(true)
  }, [])
  const slot = SLOT_BY_ID[item.slot]

  return (
    <div
      className="group/pedal relative flex w-[8.5rem] flex-none flex-col items-center"
      data-engaged={item.engaged}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={item.engaged}
        title={`${item.engaged ? "Bypass" : "Engage"} ${item.name}`}
        className="enclosure"
        data-engaged={item.engaged}
      >
        {/*
          The front lip: the side of the box the tilt reveals. A child rather
          than a pseudo-element because it has to sit in the enclosure's own 3D
          space, and only ONE face is drawn since at this angle the sides are
          edge-on and would cost markup for pixels nobody sees.
        */}
        <span className="enclosure-lip" aria-hidden="true" />
        {/* Silkscreened position number and slot, the way a board gets labelled
            with tape before a gig. */}
        <span className="enclosure-tag">
          {position}. {slot.name}
        </span>

        <span className="enclosure-face">
          {showPhoto ? (
            /* A plain <img>, not next/image. The optimizer's allowlist held
               eBay and Reverb while the whole live catalogue is on
               cdn.shopify.com, so it 400d every photo and this face drew the
               silkscreen fallback for every pedal on the board. The hosts are
               allowlisted now, but a list that grows per merchant must not be
               what decides whether a picture appears. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              ref={checkAlreadyFailed}
              src={item.imageUrl as string}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-contain p-1.5"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <span className="enclosure-knobs" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </span>

        <span className="enclosure-name">{item.name}</span>
        {item.maker ? <span className="enclosure-maker">{item.maker}</span> : null}

        {/* The LED. Lit is in the signal, dark is bypassed. */}
        <span className="enclosure-led" data-on={item.engaged} aria-hidden="true" />
        <span className="enclosure-switch" aria-hidden="true" />

        <span className="sr-only">
          {item.name}, {slot.name} slot, currently {item.engaged ? "engaged" : "bypassed"}
        </span>
      </button>

      {/*
        MUTED AT REST RATHER THAN HIDDEN, which is section 16's rule about
        chrome applied to an affordance instead of to a colour. These were
        opacity 0 until hover, so on a touch screen they did not exist at all
        and on a desktop nobody found the viewer. Visible and quiet, then full
        on hover, is the same thing the rest of the interface does.
      */}
      <div className="enclosure-acts">
        <button
          type="button"
          onClick={onSwap}
          title={`Swap for ${swapLabel}`}
          className="enclosure-act"
        >
          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">
            Swap {item.name} for {swapLabel}
          </span>
        </button>

        <button
          type="button"
          onClick={onInspect}
          title="Pick it up and turn it over"
          className="enclosure-act"
        >
          <Rotate3d className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Pick up {item.name} and turn it over</span>
        </button>

        <button
          type="button"
          onClick={onRemove}
          title={`Take ${item.name} off the board`}
          className="enclosure-act enclosure-act-off"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Take {item.name} off the board</span>
        </button>
      </div>
    </div>
  )
}
