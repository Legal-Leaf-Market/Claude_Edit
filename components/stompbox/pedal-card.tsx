import Link from "next/link"
import type { Pedal } from "@/lib/stompbox/pedals"
import { SLOT_BY_ID } from "@/lib/stompbox/chain"
import { sbHref } from "@/lib/stompbox/host"
import { CircuitFigure } from "@/components/stompbox/circuit-figure"
import { ModelledRender } from "@/components/modelled-render"
import { renderForGear } from "@/lib/board/pedal-render"

/**
 * One pedal, as a card.
 *
 * The whole card is the link rather than a "read more" at the bottom: it is a
 * grid of equally weighted things and a reader scanning it should be able to
 * hit any part of the one they want.
 */
export function PedalCard({ pedal, base }: { pedal: Pedal; base: string }) {
  /*
   * THE PEDAL ITSELF, WHERE SOMEBODY HAS MEASURED IT.
   *
   * The waveform says what the circuit does and it is the better half of this
   * card, but a grid of fifteen figures with no objects in it reads as a
   * textbook. A reader arriving on this page mostly knows these pedals by
   * sight, and the shape of a Cry Baby beside the shape of its filter sweep is
   * the fastest possible "yes, that one".
   *
   * `compact`, so no legend: at 64px a chip is three grey pixels. The alt text
   * still says it is drawn from measurements rather than photographed.
   */
  const modelled = renderForGear(pedal.maker, pedal.name)

  return (
    <Link
      href={sbHref(base, `/pedals/${pedal.slug}`)}
      className="surface group flex flex-col p-5 transition-colors hover:border-[var(--chrome)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="stencil">{pedal.maker}</span>
        <span className="stencil text-[0.58rem]">{pedal.era}</span>
      </div>

      <div className="mt-1.5 flex items-start justify-between gap-3">
        <h3 className="text-xl font-black tracking-tight text-[var(--text)]">{pedal.name}</h3>
        {modelled ? (
          <ModelledRender
            src={modelled.src}
            name={modelled.name}
            className="h-14 w-16 flex-none rounded-md"
            compact
          />
        ) : null}
      </div>

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
