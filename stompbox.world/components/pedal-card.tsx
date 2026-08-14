import Link from "next/link"
import type { Pedal } from "@/lib/pedals"
import { SLOT_BY_ID } from "@/lib/chain"
import { CircuitFigure } from "@/components/circuit-figure"

/**
 * One pedal, as a card.
 *
 * The whole card is the link rather than a "read more" at the bottom: it is a
 * grid of equally weighted things and a reader scanning it should be able to
 * hit any part of the one they want.
 */
export function PedalCard({ pedal }: { pedal: Pedal }) {
  return (
    <Link
      href={`/pedals/${pedal.slug}`}
      className="surface group flex flex-col p-5 transition-colors hover:border-[var(--brand-gold)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="stencil">{pedal.maker}</span>
        <span className="stencil text-[0.58rem]">{pedal.era}</span>
      </div>

      <h3 className="mt-1.5 text-xl font-black tracking-tight text-[var(--text)]">
        {pedal.name}
      </h3>

      {/*
        The shape, small and uncaptioned. A grid of these is the fastest way to
        see that Drive contains two different circuits: the rounded peaks and
        the sheared ones sit side by side under the same heading. Hidden from
        assistive tech here, since the caption it would need is on the page this
        card links to.
      */}
      <div className="mt-3">
        <CircuitFigure shape={pedal.shape} size="card" />
      </div>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--dim)]">{pedal.summary}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="pill text-xs">{pedal.family}</span>
        <span className="text-xs text-[var(--dim)]">
          Goes in the {SLOT_BY_ID[pedal.slot].name.toLowerCase()} slot
        </span>
      </div>
    </Link>
  )
}
