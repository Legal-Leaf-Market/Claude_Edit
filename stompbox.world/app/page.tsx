import Link from "next/link"
import { ArrowRight, Cable, CircuitBoard, Ear } from "lucide-react"
import { InstagramStrip } from "@/components/instagram-strip"
import { PedalCard } from "@/components/pedal-card"
import { StompLink } from "@/components/ui/stomp"
import { PEDALS } from "@/lib/pedals"
import { SLOTS } from "@/lib/chain"

/** A handful for the home page. The directory holds the rest. */
const FEATURED = ["tube-screamer", "fuzz-face", "big-muff", "deluxe-memory-man", "cry-baby", "phase-90"]

export default function HomePage() {
  const featured = FEATURED.map((slug) => PEDALS.find((pedal) => pedal.slug === slug)).filter(
    (pedal): pedal is NonNullable<typeof pedal> => pedal !== undefined,
  )

  const makers = new Set(PEDALS.map((pedal) => pedal.maker)).size

  return (
    <div className="shell pb-8">
      {/*
        The rack panel. Left aligned rather than centred, because equipment is
        labelled from the left and centred type reads as a brochure. The LED
        sits at the top because that is where a unit reports itself.
      */}
      <section className="rack mt-6">
        <div className="rack-inner">
          <p className="rack-status mb-5">
            <span className="led" aria-hidden="true" />
            {PEDALS.length} circuits documented
          </p>

          <h1 className="rack-title">
            What the circuit
            <br />
            <em>actually does</em>
          </h1>

          <p className="rack-sub">
            Most pedal writing tells you what something sounds like by comparing it to
            another pedal you have also never played. This does the other thing: what the
            circuit is doing to your signal, what you can hear as a result, and where it
            goes in the chain. Nothing here is for sale.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <StompLink href="/pedals" variant="go" size="lg">
              Browse the circuits
            </StompLink>
            <StompLink href="/chain" size="lg" plain>
              Build a signal chain
            </StompLink>
          </div>

          <dl className="readouts mt-10">
            <div className="readout">
              <dt>Circuits</dt>
              <dd>{PEDALS.length}</dd>
            </div>
            <div className="readout">
              <dt>Makers</dt>
              <dd>{makers}</dd>
            </div>
            <div className="readout">
              <dt>Chain slots</dt>
              <dd>{SLOTS.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* What the site is, in three plain claims. */}
      <section className="mt-20 grid gap-5 md:grid-cols-3">
        {[
          {
            Icon: CircuitBoard,
            title: "The circuit, not the adjective",
            body: "Soft clipping in a feedback loop and hard clipping to ground are different things and they sound different. Saying which one a pedal does is more useful than calling it warm.",
          },
          {
            Icon: Ear,
            title: "Something you can check",
            body: "Every description says what to listen for, described so you can hold the pedal and find out whether this page is right. That is the standard the writing is held to.",
          },
          {
            Icon: Cable,
            title: "Order, with reasons",
            body: "The chain page gives the conventional order and the reason behind each position, because a reason can be argued with and a rule cannot. Plenty of good sounds break it.",
          },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="surface p-6">
            <Icon className="h-5 w-5 text-[var(--accent-text)]" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-black text-[var(--text)]">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-20">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-black text-[var(--text)]">Start here</h2>
          <Link
            href="/pedals"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
          >
            All {PEDALS.length} circuits
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((pedal) => (
            <PedalCard key={pedal.slug} pedal={pedal} />
          ))}
        </div>
      </section>

      <section className="mt-20">
        <InstagramStrip />
      </section>
    </div>
  )
}
