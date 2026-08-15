import Link from "next/link"
import { Disc3 } from "lucide-react"
import { EFFECTS } from "@/lib/pedalboard/chain"
import { creditsForGear, hueFor, initialsFor } from "@/lib/rigs"

/**
 * "Heard on", for a gear detail page.
 *
 * This is the payoff of the rig dataset and the one thing a price comparison
 * site is otherwise structurally unable to say. Every competitor can tell a
 * shopper that a Big Muff is $89 at three stores. Only a site that carries the
 * records can tell them it is also Comfortably Numb, Cherub Rock and Seven
 * Nation Army, which is most of why somebody wants one.
 *
 * Renders nothing when there is no credit, which is the common case: the
 * catalogue is mostly small independent makers and the dataset is mostly
 * legacy pedals. An empty "as heard on" heading would be worse than no
 * section, so there is no empty state here on purpose.
 */
export function GearCredits({ brand, model }: { brand: string; model: string }) {
  const credits = creditsForGear(brand, model)
  if (credits.length === 0) return null

  return (
    <section className="panel mb-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[var(--text)]">
        <Disc3 className="h-4.5 w-4.5 text-[var(--accent-text)]" aria-hidden="true" />
        Heard on
      </h2>
      <div className="rule-accent my-3 w-24" />

      <ul className="space-y-4">
        {credits.map(({ rig, pedal, records }) => (
          <li key={rig.slug} className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
            <Link
              href={`/rigs/${rig.slug}`}
              className="icon-badge h-10 w-10 shrink-0 text-[0.7rem]"
              style={{ "--icon-hue": hueFor(rig) } as React.CSSProperties}
              aria-label={`${rig.name}'s rig`}
            >
              {initialsFor(rig)}
            </Link>

            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <Link
                  href={`/rigs/${rig.slug}`}
                  className="font-semibold text-[var(--text)] underline-offset-2 hover:underline"
                >
                  {rig.name}
                </Link>
                <span className="text-[var(--muted-foreground)]">
                  {" "}
                  with {rig.context}, {rig.era}
                </span>
                <span
                  className="ml-2 text-[0.7rem] font-semibold uppercase tracking-wide"
                  style={{ color: EFFECTS[pedal.type].hue }}
                >
                  {EFFECTS[pedal.type].label}
                </span>
              </p>

              <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {pedal.role}
              </p>

              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {records.map((record) => (
                  <li
                    key={record.title}
                    className="rounded-full border border-[var(--line)] bg-[var(--chip)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]"
                    title={record.tracks.join(", ")}
                  >
                    <span className="text-[var(--text)]">{record.title}</span> {record.year}
                    {record.tracks.length > 0 && (
                      <span className="text-[var(--dim)]"> · {record.tracks[0]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs leading-relaxed text-[var(--dim)]">
        Documented gear history from interviews, rig rundowns and live photography. Nobody named
        here is affiliated with Gear Avail, and this is not an endorsement.
      </p>
    </section>
  )
}
