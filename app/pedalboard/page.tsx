import type { Metadata } from "next"
import Link from "next/link"
import { RigBuilder } from "@/components/pedalboard/rig-builder"
import type { BoardSlot } from "@/components/pedalboard/board"
import { decodeBoard, STARTER_ROLES } from "@/lib/pedalboard/board-url"
import { EFFECTS, inferEffectType } from "@/lib/pedalboard/chain"
import { matchPedalsByName, pedalBoardDetails, searchPedals } from "@/lib/pedalboard/queries"
import { rigChainOrder, rigFromSlug } from "@/lib/rigs"

export const metadata: Metadata = {
  title: "Rig builder",
  description:
    "Chain pedals in the order you would actually run them. Checks the signal chain, sizes a power supply, and prices the whole board against live listings from every store we track.",
  alternates: { canonical: "/pedalboard" },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : ""
}

/**
 * Build the opening board, server side, from whatever the URL asks for.
 *
 * Three ways in, in priority order:
 *   ?rig=david-gilmour   a documented rig, matched against the catalogue
 *   ?board=a,b,~Boss|DD-3   an encoded board (see lib/pedalboard/board-url.ts)
 *   ?pedals=a,b          the parameter the first version of this tool used
 *
 * All three resolve on the server so the first paint already has the board on
 * it. The old builder rendered empty and filled in from a client fetch, which
 * meant a shared link showed a blank board for a beat and had nothing for a
 * crawler to index.
 */
async function buildInitialSlots(
  query: Record<string, string | string[] | undefined>,
): Promise<BoardSlot[]> {
  const rigSlug = first(query.rig)
  if (rigSlug) {
    const rig = rigFromSlug(rigSlug)
    if (rig) {
      const pedals = rigChainOrder(rig)
      const matches = await matchPedalsByName(
        pedals.map((p) => ({ brand: p.brand, model: p.model })),
      ).catch(() => [])

      const matchedSlugs = matches.map((m) => m.matched?.slug).filter((s): s is string => Boolean(s))
      const details = await pedalBoardDetails(matchedSlugs).catch(() => [])
      const bySlug = new Map(details.map((d) => [d.slug, d]))

      return pedals.map((pedal, index) => {
        const matched = matches[index]?.matched ?? null
        const detail = matched ? bySlug.get(matched.slug) : undefined
        return {
          key: matched?.slug ?? `off:${pedal.brand}:${pedal.model}`,
          brand: pedal.brand,
          model: pedal.model,
          type: pedal.type,
          slug: matched?.slug ?? null,
          imageUrl: detail?.imageUrl ?? matched?.imageUrl ?? null,
          marketPriceCents: detail?.marketPriceCents ?? matched?.marketPriceCents ?? null,
          sampleSize: detail?.sampleSize ?? matched?.sampleSize ?? 0,
          bySource: detail?.bySource ?? [],
          role: pedal.role,
        }
      })
    }
  }

  const encoded = first(query.board) || first(query.pedals)
  const inputs = decodeBoard(encoded)
  if (inputs.length === 0) return []

  const slugs = inputs.flatMap((i) => (i.kind === "gear" ? [i.slug] : []))
  const details = await pedalBoardDetails(slugs).catch(() => [])
  const bySlug = new Map(details.map((d) => [d.slug, d]))

  return inputs.flatMap((input): BoardSlot[] => {
    if (input.kind === "gear") {
      const detail = bySlug.get(input.slug)
      // A slug in the URL that no longer resolves is dropped rather than shown
      // as an empty slot: the pedal may have left the catalogue entirely, and
      // a slot with no name on it is worse than one fewer slot.
      if (!detail) return []
      return [
        {
          key: detail.slug,
          brand: detail.brand,
          model: detail.model,
          type: detail.type,
          slug: detail.slug,
          imageUrl: detail.imageUrl,
          marketPriceCents: detail.marketPriceCents,
          sampleSize: detail.sampleSize,
          bySource: detail.bySource,
        },
      ]
    }

    return [
      {
        key: `off:${input.brand}:${input.model}`,
        brand: input.brand,
        model: input.model,
        type: inferEffectType(input.brand, input.model),
        slug: null,
        imageUrl: null,
        marketPriceCents: null,
        sampleSize: 0,
        bySource: [],
      },
    ]
  })
}

export default async function PedalboardPage({ searchParams }: PageProps) {
  const query = await searchParams
  const showStarter = first(query.preset) === "starter"

  const [initialSlots, suggestions] = await Promise.all([
    buildInitialSlots(query),
    searchPedals("").catch(() => []),
  ])

  return (
    <div className="shell-narrow py-8">
      {/*
        Its own hero rather than the shared CategoryHero.
        CategoryHero draws a full-bleed line-art motif behind the headline,
        which is right on a category page where the headline is short, and
        wrong here: the pedals motif runs a PCB trace straight through
        "Build the Board" and two lines of kicker. This matches the /rigs
        hero instead, so the two tool pages read as a pair.
      */}
      <section className="hero" style={{ "--hero-hue": "#22d3ee" } as React.CSSProperties}>
        <div className="hero-inner">
          <p className="eyebrow">Rig builder</p>
          <h1 className="h-display mt-3">
            <span className="h-lead">Chain them the way</span>
            you would run them
          </h1>
          <p className="hsub">
            It checks the signal order, sizes a power supply, and prices the whole board against
            what is in stock right now. Start empty, or load one of {" "}
            <Link href="/rigs" className="text-[var(--accent-text)] underline-offset-4 hover:underline">
              the documented rigs
            </Link>
            .
          </p>
        </div>
      </section>

      {showStarter && (
        <section className="panel mb-6">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            The four that cover most of it
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
            No brands here on purpose. This site earns commission on pedals, so naming four
            specific ones would be a recommendation paid for by the thing being recommended.
            The roles are the useful part; the search box below is where you pick the actual box.
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STARTER_ROLES.map((role, index) => (
              <li
                key={role.type}
                className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-3"
                style={{ borderTopColor: EFFECTS[role.type].hue, borderTopWidth: 3 }}
              >
                <p className="font-display text-xs font-bold text-[var(--dim)]">
                  {index + 1} of 4
                </p>
                <p className="mt-0.5 font-display text-base font-bold text-[var(--text)]">
                  {role.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {role.why}
                </p>
                <Link
                  href={`/search?q=${encodeURIComponent(EFFECTS[role.type].label)}&categories=${encodeURIComponent("Effects Pedals")}&sort=price_asc`}
                  className="mt-2 inline-block text-xs font-semibold text-[var(--accent-text)] underline-offset-2 hover:underline"
                >
                  See what is in stock
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <RigBuilder initialSlots={initialSlots} suggestions={suggestions} />

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-[var(--muted-foreground)]">
        Availability and prices come from the same live feeds as the rest of the site, so this is
        what is actually in stock right now rather than a catalogue snapshot. A pedal with no
        stores listed is not out of production: it just is not currently for sale from anyone we
        track. Artist rigs are documented gear history assembled from interviews, rig rundowns and
        live photography, and no artist or band listed is affiliated with Gear Avail.
      </p>
    </div>
  )
}
