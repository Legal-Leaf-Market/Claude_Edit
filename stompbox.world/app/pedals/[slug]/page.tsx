import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { PEDALS, pedalBySlug } from "@/lib/pedals"
import { SLOT_BY_ID } from "@/lib/chain"
import { StompLink } from "@/components/ui/stomp"
import { CircuitFigure } from "@/components/circuit-figure"

/** Every pedal page is static: the dataset is a file, so there is nothing to revalidate. */
export function generateStaticParams() {
  return PEDALS.map((pedal) => ({ slug: pedal.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const pedal = pedalBySlug(slug)
  if (!pedal) return { title: "Not found" }

  return {
    title: `${pedal.maker} ${pedal.name}`,
    description: pedal.summary,
    alternates: { canonical: `/pedals/${pedal.slug}` },
    openGraph: {
      type: "article",
      title: `${pedal.maker} ${pedal.name}`,
      description: pedal.summary,
    },
  }
}

export default async function PedalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pedal = pedalBySlug(slug)
  if (!pedal) notFound()

  const slot = SLOT_BY_ID[pedal.slot]
  const siblings = PEDALS.filter(
    (entry) => entry.family === pedal.family && entry.slug !== pedal.slug,
  )

  return (
    <div className="shell-narrow py-12">
      <Link
        href="/pedals"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--dim)] underline-offset-4 hover:text-[var(--text)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All circuits
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="stencil">{pedal.maker}</span>
          <span className="pill text-xs">{pedal.family}</span>
          <span className="stencil text-[0.58rem]">{pedal.era}</span>
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--text)] sm:text-5xl">
          {pedal.name}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-[var(--dim)]">{pedal.summary}</p>
      </header>

      {/*
        The figure sits above the prose rather than beside it, because it is an
        illustration OF the paragraph underneath and reading the two in that
        order is the point. It also gives the page the one thing every page here
        was missing: something to look at that is not type.
      */}
      <div className="mt-10">
        <CircuitFigure shape={pedal.shape} />
      </div>

      <div className="mt-8 space-y-8">
        <section className="surface p-6">
          <h2 className="stencil">What the circuit does</h2>
          <p className="mt-3 leading-relaxed text-[var(--text)]">{pedal.circuit}</p>
        </section>

        <section className="surface p-6">
          <h2 className="stencil">What to listen for</h2>
          <p className="mt-3 leading-relaxed text-[var(--text)]">{pedal.listenFor}</p>
        </section>

        <section className="surface p-6">
          <h2 className="stencil">Where it goes</h2>
          <p className="mt-3 font-semibold text-[var(--text)]">
            The {slot.name.toLowerCase()} slot
          </p>
          <p className="mt-2 leading-relaxed text-[var(--dim)]">{slot.why}</p>

          {pedal.wantsGuitarDirect && (
            <p className="mt-4 border-t border-[var(--line)] pt-4 leading-relaxed text-[var(--dim)]">
              <span className="font-semibold text-[var(--accent-text)]">
                This one is fussy about what comes before it.
              </span>{" "}
              Its input impedance is low enough that it loads the guitar's pickups
              directly, and that loading is part of the sound. Put a buffered pedal in
              front and it thins out and stops cleaning up when you roll the guitar volume
              back.
            </p>
          )}

          {pedal.buffered && (
            <p className="mt-4 border-t border-[var(--line)] pt-4 leading-relaxed text-[var(--dim)]">
              <span className="font-semibold text-[var(--accent-text)]">
                This one has a buffered output.
              </span>{" "}
              Useful for driving a long cable run without losing top end, and worth
              knowing about if a vintage-style fuzz sits after it, because the fuzz will
              be hearing the buffer rather than your guitar.
            </p>
          )}

          <div className="mt-6">
            <StompLink href="/chain" size="sm" plain>
              See the whole chain
            </StompLink>
          </div>
        </section>

        <section className="surface p-6">
          <h2 className="stencil">Controls</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {pedal.controls.map((control) => (
              <li key={control} className="pill text-xs">
                {control}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {siblings.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-black text-[var(--text)]">
            Others in the {pedal.family.toLowerCase()} family
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {siblings.map((sibling) => (
              <li key={sibling.slug}>
                <Link
                  href={`/pedals/${sibling.slug}`}
                  className="surface block p-4 transition-colors hover:border-[var(--brand-gold)]"
                >
                  <span className="stencil">{sibling.maker}</span>
                  <p className="mt-1 font-semibold text-[var(--text)]">{sibling.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
                    {sibling.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
