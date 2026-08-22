"use client"

import Image from "next/image"
import { useState } from "react"
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
 */
export function PedalEnclosure({
  item,
  position,
  onToggle,
  onRemove,
}: {
  item: BoardItem
  /** 1-based place in the signal chain, printed on the box like a patch number. */
  position: number
  onToggle: () => void
  onRemove: () => void
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const showPhoto = Boolean(item.imageUrl) && !photoFailed
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
            <Image
              src={item.imageUrl as string}
              alt=""
              fill
              sizes="140px"
              className="object-contain p-1.5"
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

      <button
        type="button"
        onClick={onRemove}
        title={`Take ${item.name} off the board`}
        className="enclosure-remove"
      >
        <span aria-hidden="true">x</span>
        <span className="sr-only">Take {item.name} off the board</span>
      </button>
    </div>
  )
}
