import type { Metadata } from "next"
import { CategoryHero } from "@/components/category-hero"
import { PedalBoardBuilder } from "@/components/pedalboard/pedal-board-builder"
import { pedalBoardDetails, searchPedals } from "@/lib/pedalboard/queries"

export const metadata: Metadata = {
  title: "Build your pedalboard",
  description:
    "Chain pedals together and see which stores carry each one, new or used, and the going market price, without opening a dozen tabs.",
  alternates: { canonical: "/pedalboard" },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PedalboardPage({ searchParams }: PageProps) {
  const query = await searchParams
  const raw = typeof query.pedals === "string" ? query.pedals : ""
  const initialSlugs = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(
    0,
    12,
  )

  const [initialEntries, suggestions] = await Promise.all([
    pedalBoardDetails(initialSlugs),
    searchPedals(""),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <CategoryHero
        slug="effects-pedals"
        eyebrow="Interactive tool"
        title="Build Your Pedalboard"
        kicker="Chain them however you'd actually run them. We'll show you who has each one in stock, new or used, and what it should cost."
      />

      <PedalBoardBuilder
        initialSlugs={initialSlugs}
        initialEntries={initialEntries}
        suggestions={suggestions}
      />

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-[var(--muted-foreground)]">
        Availability and prices come from the same live feeds as the rest of the site, so what you
        see here is what is actually in stock right now, not a catalogue snapshot. A pedal with no
        stores listed is not out of production, it just is not currently for sale from anyone we
        track.
      </p>
    </div>
  )
}
