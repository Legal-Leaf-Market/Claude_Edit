import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, Disc3, Wrench } from "lucide-react"
import { ListingImage } from "@/components/listing-image"
import { EFFECTS } from "@/lib/pedalboard/chain"
import { matchPedalsByName, pedalBoardDetails } from "@/lib/pedalboard/queries"
import { hueFor, initialsFor, rigChainOrder, rigFromSlug, RIGS, type RigPedal } from "@/lib/rigs"
import { formatPrice, sourceLabel } from "@/lib/utils"

export const revalidate = 600

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return RIGS.map((rig) => ({ slug: rig.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const rig = rigFromSlug(slug)
  if (!rig) return { title: "Rig not found" }

  const records = rig.records.map((r) => r.title).join(", ")
  return {
    title: `${rig.name}'s pedalboard`,
    description: `The pedals documented on ${rig.name}'s board with ${rig.context} (${rig.era}), what each one does, and the records they were used on: ${records}.`,
    alternates: { canonical: `/rigs/${rig.slug}` },
  }
}

export default async function RigPage({ params }: PageProps) {
  const { slug } = await params
  const rig = rigFromSlug(slug)
  if (!rig) notFound()

  const pedals = rigChainOrder(rig)

  // Match the whole board against the live catalogue in one round trip, then
  // pull availability for whatever matched. Both are wrapped: the rig page is
  // worth reading with an empty database, and it is the page most likely to be
  // hit before any feed is configured.
  const matches = await matchPedalsByName(
    pedals.map((p) => ({ brand: p.brand, model: p.model })),
  ).catch(() => [])

  const matchedSlugs = matches.map((m) => m.matched?.slug).filter((s): s is string => Boolean(s))
  const details = await pedalBoardDetails(matchedSlugs).catch(() => [])
  const bySlug = new Map(details.map((d) => [d.slug, d]))

  const rows = pedals.map((pedal, index) => {
    const matched = matches[index]?.matched ?? null
    const detail = matched ? bySlug.get(matched.slug) : undefined
    const cheapestSource = detail?.bySource[0]
    const cheapestCents = cheapestSource
      ? Math.min(
          cheapestSource.cheapestNewCents ?? Infinity,
          cheapestSource.cheapestUsedCents ?? Infinity,
        )
      : Infinity

    return {
      pedal,
      slug: matched?.slug ?? null,
      imageUrl: detail?.imageUrl ?? matched?.imageUrl ?? null,
      marketPriceCents: detail?.marketPriceCents ?? matched?.marketPriceCents ?? null,
      liveCents: Number.isFinite(cheapestCents) ? cheapestCents : null,
      liveSource: cheapestSource?.source ?? null,
      storeCount: detail?.bySource.length ?? 0,
    }
  })

  const inStock = rows.filter((row) => row.liveCents != null)
  const boardTotal = inStock.reduce((sum, row) => sum + (row.liveCents ?? 0), 0)
  const hue = hueFor(rig)

  return (
    <div className="shell-narrow py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[var(--muted-foreground)]">
        <Link href="/rigs" className="hover:text-[var(--text)]">
          Artist rigs
        </Link>
        <span className="mx-1.5" aria-hidden="true">
          /
        </span>
        <span className="text-[var(--text)]">{rig.name}</span>
      </nav>

      <header className="flex flex-wrap items-start gap-4">
        <span
          className="icon-badge h-16 w-16 shrink-0 text-lg"
          style={{ "--icon-hue": hue } as React.CSSProperties}
          aria-hidden="true"
        >
          {initialsFor(rig)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{rig.genre}</p>
          <h1 className="mt-1 font-display text-4xl font-bold leading-none tracking-[-0.03em] text-[var(--text)]">
            {rig.name}
          </h1>
          <p className="mt-1.5 text-[0.82rem] font-semibold uppercase tracking-[0.16em]" style={{ color: hue }}>
            {rig.context}, {rig.era}
          </p>
        </div>
      </header>

      <p className="mt-5 max-w-3xl text-base leading-relaxed text-[var(--muted-foreground)]">
        {rig.blurb}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/pedalboard?rig=${rig.slug}`}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--primary)] px-5 text-sm font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          Load this board into the builder
        </Link>
        {inStock.length > 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">
            <span className="card-price text-lg">{formatPrice(boardTotal)}</span> for the{" "}
            {inStock.length} of {rows.length} in stock right now
          </p>
        )}
      </div>

      {/* ---- The chain ---- */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-[var(--text)]">The chain</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Shown in conventional signal order rather than the order the sources list them, so it
          reads the way it would be wired: guitar on the left, amp on the right.
        </p>

        <ol className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <li key={`${row.pedal.brand}-${row.pedal.model}`}>
              <PedalRow row={row} position={index + 1} isLast={index === rows.length - 1} />
            </li>
          ))}
        </ol>
      </section>

      {/* ---- The records ---- */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-[var(--text)]">
          <Disc3 className="h-5 w-5" style={{ color: hue }} aria-hidden="true" />
          Documented on
        </h2>
        <ul className="mt-4 space-y-3">
          {rig.records.map((record) => (
            <li key={record.title} className="card-face p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="card-title text-base text-[var(--text)]">{record.title}</h3>
                <p className="text-xs uppercase tracking-wide text-[var(--dim)]">
                  {record.kind === "live" ? "Live album" : record.kind} · {record.year}
                </p>
              </div>

              {record.tracks.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {record.tracks.map((track) => (
                    <li
                      key={track}
                      className="rounded-full border border-[var(--line)] bg-[var(--chip)] px-2.5 py-1 text-xs text-[var(--text)]"
                    >
                      {track}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[var(--dim)]">
                  Documented at the session level rather than to specific tracks.
                </p>
              )}

              {record.note && (
                <p className="mt-2.5 border-t border-[var(--line)] pt-2.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {record.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs leading-relaxed text-[var(--muted-foreground)]">
        Editorial gear history, assembled from interviews, rig rundowns, live photography and liner
        notes. {rig.name} is not affiliated with Gear Avail and nothing here is an endorsement.
        Rigs change between tours and between takes, so this one is scoped to {rig.era} rather than
        presented as a career-long setup. In most cases what is documented is that a pedal was on
        the board during those sessions or that tour, not that it is audible on a specific bar of a
        specific take.
      </p>
    </div>
  )
}

type Row = {
  pedal: RigPedal
  slug: string | null
  imageUrl: string | null
  marketPriceCents: number | null
  liveCents: number | null
  liveSource: string | null
  storeCount: number
}

function PedalRow({ row, position, isLast }: { row: Row; position: number; isLast: boolean }) {
  const meta = EFFECTS[row.pedal.type]

  return (
    <div className="relative">
      <div
        className="card-face flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap"
        style={{ borderLeftColor: meta.hue, borderLeftWidth: 3 }}
      >
        <span className="flex w-8 shrink-0 flex-col items-center">
          <span className="font-display text-sm font-bold text-[var(--dim)]">{position}</span>
        </span>

        <ListingImage
          src={row.imageUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-md"
          fallbackLabel={meta.label}
          fallbackHue={meta.hue}
        />

        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="card-title text-[var(--text)]">
              {row.pedal.brand} {row.pedal.model}
            </p>
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide" style={{ color: meta.hue }}>
              {meta.label}
            </span>
            {row.pedal.notPedal && (
              <span className="text-[0.7rem] text-[var(--dim)]">rack or amp-top unit</span>
            )}
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
            {row.pedal.role}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {row.liveCents != null ? (
            <>
              <p className="card-price text-lg">{formatPrice(row.liveCents)}</p>
              <p className="text-xs text-[var(--dim)]">
                {row.liveSource ? sourceLabel(row.liveSource) : ""}
                {row.storeCount > 1 ? ` +${row.storeCount - 1} more` : ""}
              </p>
            </>
          ) : row.marketPriceCents != null ? (
            <>
              <p className="font-display text-base font-bold text-[var(--dim)]">
                ~{formatPrice(row.marketPriceCents)}
              </p>
              <p className="text-xs text-[var(--dim)]">used median, none listed</p>
            </>
          ) : (
            <p className="w-[10.5rem] text-xs leading-snug text-[var(--dim)]">
              Not stocked by any store we track
            </p>
          )}

          {row.slug ? (
            <Link
              href={`/gear/${row.slug}`}
              className="mt-1 inline-block text-xs font-semibold text-[var(--accent-text)] underline-offset-2 hover:underline"
            >
              Compare listings
            </Link>
          ) : (
            <Link
              href={`/search?q=${encodeURIComponent(`${row.pedal.brand} ${row.pedal.model}`)}`}
              className="mt-1 inline-block text-xs text-[var(--dim)] underline-offset-2 hover:underline"
            >
              Search the site
            </Link>
          )}
        </div>
      </div>

      {!isLast && (
        <div className="flex h-3 items-center justify-center" aria-hidden="true">
          <ChevronRight className="h-3.5 w-3.5 rotate-90 text-[var(--dim)]" />
        </div>
      )}
    </div>
  )
}
