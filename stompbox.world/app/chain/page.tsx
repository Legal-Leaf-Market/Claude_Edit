import type { Metadata } from "next"
import { ChainBuilder } from "@/components/chain-builder"
import { SLOTS } from "@/lib/chain"

export const metadata: Metadata = {
  title: "Signal chain order",
  description:
    "The conventional pedal order, guitar first and amp last, with the reason behind every position. Plus a builder that lays out your own board.",
  alternates: { canonical: "/chain" },
}

export default function ChainPage() {
  return (
    <div className="shell-narrow py-12">
      <header className="max-w-prose">
        <p className="stencil">Signal chain</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text)]">
          The order, and why
        </h1>
        <p className="mt-4 leading-relaxed text-[var(--dim)]">
          This is a convention, not a law. It is what most boards do most of the time, and
          every position below carries the reason it sits where it does, because a reason
          is something you can argue with. A good number of recognisable sounds come from
          breaking it on purpose.
        </p>
      </header>

      {/*
        The full list is server rendered rather than living inside the client
        builder. It is the part worth indexing and the part worth reading with
        no pedals selected, and a page whose entire content appears only after
        a click is a page with no content.
      */}
      <section className="mt-12">
        {/*
          One column, not two: this is a sequence, and a two-column grid asks
          the reader to go down and then jump back up to continue it.

          The cap that used to live here (max-w-4xl, no mx-auto) existed to stop
          a full-width card putting a third of the page of empty plate to the
          right of every paragraph. It did not achieve that. It just moved the
          empty plate to the right of the whole column, so the page sat against
          the left edge of a shell that was itself centred. The measure is now
          set by the narrower shell on the wrapper, which the header shares, so
          the column is capped AND centred.
        */}
        <ol className="space-y-4">
          {SLOTS.map((slot, index) => (
            <li key={slot.id} className="surface p-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <span
                  className="font-black tabular-nums text-[var(--accent-text)]"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="text-xl font-black text-[var(--text)]">{slot.name}</h2>
                <span className="stencil text-[0.58rem]">{slot.examples}</span>
              </div>
              <p className="mt-3 max-w-prose leading-relaxed text-[var(--dim)]">{slot.why}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20 border-t border-[var(--line)] pt-14">
        <ChainBuilder />
      </section>
    </div>
  )
}
