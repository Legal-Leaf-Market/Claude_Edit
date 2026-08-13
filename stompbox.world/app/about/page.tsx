import type { Metadata } from "next"
import { StompLink } from "@/components/ui/stomp"
import { env } from "@/lib/env"
import { SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "About",
  description:
    "What stompbox.world is, how the circuit descriptions are written, and the things it deliberately does not do.",
  alternates: { canonical: "/about" },
}

export default function AboutPage() {
  const handle = env.social.instagramHandle

  return (
    <div className="shell-narrow py-12">
      <header className="max-w-prose">
        <p className="stencil">About</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text)]">
          What this is
        </h1>
      </header>

      <div className="mt-8 space-y-10">
        <section className="surface p-6">
          <h2 className="text-xl font-black text-[var(--text)]">The idea</h2>
          <p className="mt-3 leading-relaxed text-[var(--dim)]">
            Most writing about pedals describes one pedal by comparing it to a different
            pedal you have also never played, and the vocabulary runs out fast: warm,
            creamy, transparent, musical. None of those words survives contact with a
            second person. {SITE_NAME} tries the other approach. Soft clipping inside an
            op-amp's feedback loop and hard clipping to ground are genuinely different
            circuits, they behave differently, and once you know which one you are looking
            at, the sound stops being a mystery and becomes a consequence.
          </p>
        </section>

        <section className="surface p-6">
          <h2 className="text-xl font-black text-[var(--text)]">How the entries are written</h2>
          <ul className="mt-3 space-y-4 leading-relaxed text-[var(--dim)]">
            <li>
              <span className="font-semibold text-[var(--text)]">
                Every claim is meant to be checkable.
              </span>{" "}
              The "what to listen for" section on each page is written so that you can pick
              up the pedal and find out whether this site is right. If something here is
              wrong, that is the mechanism for catching it.
            </li>
            <li>
              <span className="font-semibold text-[var(--text)]">
                Dates are decade level, deliberately.
              </span>{" "}
              Prototypes, production runs, revisions and reissues all disagree about what
              year a pedal "is". A precise year would be a false precision, so the entries
              say "late 1960s" and mean it.
            </li>
            <li>
              <span className="font-semibold text-[var(--text)]">
                There are no artist credits, on purpose.
              </span>{" "}
              Every pedal here has a famous name attached to it in somebody's memory, and
              that is exactly the problem. Rigs change between tours and between takes, so
              "this pedal is on that record" needs a source, and a wrong credit printed
              beside a circuit description reads as fact. Attribution deserves a dataset
              with real sourcing behind it rather than a decorative field here.
            </li>
            <li>
              <span className="font-semibold text-[var(--text)]">The chain page gives reasons.</span>{" "}
              Signal chain order is a convention, not a law, so every position states why
              it sits where it does. A reason can be argued with. A rule can only be
              obeyed or broken.
            </li>
          </ul>
        </section>

        <section className="surface p-6">
          <h2 className="text-xl font-black text-[var(--text)]">What it does not do</h2>
          <p className="mt-3 leading-relaxed text-[var(--dim)]">
            Nothing here is for sale, and there are no affiliate links anywhere on the
            site. That is not modesty, it is what lets an entry say a pedal sounds thin
            into a clean amp, or that a tone control scoops a hole in the middle of the
            frequency range, without any of it being a sales problem. It also collects
            nothing about you: the chain builder runs entirely in your browser and stores
            nothing.
          </p>
          <p className="mt-4 leading-relaxed text-[var(--dim)]">
            The one exception to "no third parties" is the Instagram section on the home
            page, which uses Instagram's own official embed. It is off unless post
            permalinks are configured, and the site works fine without it.
          </p>
        </section>

        <section className="surface p-6">
          <h2 className="text-xl font-black text-[var(--text)]">Corrections</h2>
          <p className="mt-3 leading-relaxed text-[var(--dim)]">
            The dataset is hand written and small, which means it is wrong occasionally
            and fixable quickly. If a circuit description does not match the pedal in your
            hands, that is worth saying.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <StompLink href={`https://instagram.com/${handle}`} external size="sm" plain>
              @{handle}
            </StompLink>
            <StompLink href="/pedals" size="sm" variant="ghost">
              Back to the circuits
            </StompLink>
          </div>
        </section>
      </div>
    </div>
  )
}
