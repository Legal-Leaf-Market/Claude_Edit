import type { Metadata } from "next"
import Link from "next/link"
import { Disc3 } from "lucide-react"
import { EFFECTS } from "@/lib/pedalboard/chain"
import {
  allRecords,
  DECADES,
  hueFor,
  initialsFor,
  rigsByEffectFamily,
  rigsWithEffectFamily,
  rigStats,
  RIGS,
  signaturePedal,
  type Rig,
} from "@/lib/rigs"

export const metadata: Metadata = {
  title: "Artist rigs: the pedalboards behind the records",
  description:
    "Documented pedalboards from twenty-odd players, the albums and songs each rig is documented on, and what every pedal on them costs today.",
  alternates: { canonical: "/rigs" },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : ""
}

export default async function RigsPage({ searchParams }: PageProps) {
  const query = await searchParams
  const effect = first(query.effect)
  const decade = first(query.decade)
  const byRecord = first(query.view) === "records"

  const stats = rigStats()
  const families = rigsByEffectFamily()

  let rigs: Rig[] = RIGS
  if (effect) rigs = rigsWithEffectFamily(effect)
  if (decade) rigs = rigs.filter((r) => r.decade === decade)

  const activeLabel = [
    effect && families.find((f) => f.slug === effect)?.label,
    decade,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="shell py-8">
      <section className="hero" style={{ "--hero-hue": "#c678b4" } as React.CSSProperties}>
        <div className="hero-inner">
          <p className="eyebrow">Gear history</p>
          <h1 className="h-display mt-3">
            <span className="h-lead">The boards behind</span>
            the records
          </h1>
          <p className="hsub">
            What was actually on the floor when those records were made, why each pedal was there,
            and what it costs today. Assembled from interviews, rig rundowns and live photography.
          </p>
          <dl className="hstats">
            <div>
              <dt>Rigs</dt>
              <dd>{stats.rigs}</dd>
            </div>
            <div>
              <dt>Records</dt>
              <dd>{stats.records}</dd>
            </div>
            <div>
              <dt>Tracks</dt>
              <dd>{stats.tracks}</dd>
            </div>
            <div>
              <dt>Pedals</dt>
              <dd>{stats.pedals}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Filters. Every option here is derived from the dataset, so none of
          them can lead to an empty page: the same rule the search facets
          follow. */}
      <nav aria-label="Filter rigs" className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mega-col-title mr-1">Sound</span>
          <Link href="/rigs" className="pill" data-active={!effect && !decade && !byRecord}>
            Everything
          </Link>
          {families.map((family) => (
            <Link
              key={family.slug}
              href={`/rigs?effect=${family.slug}${decade ? `&decade=${decade}` : ""}`}
              className="pill"
              data-active={effect === family.slug}
            >
              {family.label}
              <span className="count">{family.count}</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mega-col-title mr-1">Era</span>
          {DECADES.map((d) => (
            <Link
              key={d}
              href={`/rigs?decade=${d}${effect ? `&effect=${effect}` : ""}`}
              className="pill"
              data-active={decade === d}
            >
              {d}
            </Link>
          ))}
          <Link href="/rigs?view=records" className="pill" data-active={byRecord}>
            <Disc3 className="h-3.5 w-3.5" aria-hidden="true" />
            By record
          </Link>
        </div>
      </nav>

      {byRecord ? <RecordIndex /> : <RigGrid rigs={rigs} activeLabel={activeLabel} />}

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-[var(--muted-foreground)]">
        This is editorial gear history, the same kind every guitar magazine and rig-rundown video
        publishes. No artist, band or manufacturer listed here is affiliated with Gear Avail, and
        nothing on these pages is an endorsement. Rigs change between tours and between takes, so
        each one is scoped to a documented era rather than presented as a career-long setup. Where
        only the sessions are documented, the record is listed without specific tracks.
      </p>
    </div>
  )
}

function RigGrid({ rigs, activeLabel }: { rigs: Rig[]; activeLabel: string }) {
  if (rigs.length === 0) {
    return (
      <p className="panel text-sm text-[var(--muted-foreground)]">
        Nothing written up for that combination yet.
      </p>
    )
  }

  return (
    <>
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        {rigs.length} rig{rigs.length === 1 ? "" : "s"}
        {activeLabel ? `, filtered to ${activeLabel}` : ""}.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rigs.map((rig) => (
          <li key={rig.slug}>
            <RigCard rig={rig} />
          </li>
        ))}
      </ul>
    </>
  )
}

function RigCard({ rig }: { rig: Rig }) {
  const signature = signaturePedal(rig)
  const trackCount = rig.records.reduce((sum, record) => sum + record.tracks.length, 0)

  return (
    <Link
      href={`/rigs/${rig.slug}`}
      className="card-face flex h-full flex-col p-4 transition-transform hover:-translate-y-0.5"
      style={{ borderTopColor: hueFor(rig), borderTopWidth: 3 }}
    >
      <div className="flex items-start gap-3">
        <span
          className="icon-badge h-11 w-11 shrink-0"
          style={{ "--icon-hue": hueFor(rig) } as React.CSSProperties}
          aria-hidden="true"
        >
          {initialsFor(rig)}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-base font-black leading-tight text-[var(--text)]">
            {rig.name}
          </span>
          <span className="block truncate text-xs text-[var(--muted-foreground)]">
            {rig.context} · {rig.era}
          </span>
        </span>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
        {rig.blurb}
      </p>

      <p className="mt-3 text-sm font-semibold" style={{ color: EFFECTS[signature.type].hue }}>
        {signature.brand} {signature.model}
      </p>

      <p className="mt-auto pt-3 text-xs text-[var(--dim)]">
        {rig.pedals.length} pedals · {rig.records.length} record
        {rig.records.length === 1 ? "" : "s"}
        {trackCount > 0 ? ` · ${trackCount} tracks` : ""}
      </p>
    </Link>
  )
}

function RecordIndex() {
  const records = allRecords()

  return (
    <>
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        {records.length} records, newest first. Each one links to the rig it was made with.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {records.map(({ rig, record }) => (
          <li key={`${rig.slug}-${record.title}`}>
            <Link
              href={`/rigs/${rig.slug}`}
              className="card-face flex h-full flex-col gap-1 p-4 transition-colors hover:border-[var(--copper)]"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="card-title text-[var(--text)]">{record.title}</span>
                <span className="shrink-0 font-display text-sm font-black text-[var(--dim)]">
                  {record.year}
                </span>
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {rig.name}, {rig.context}
              </span>
              {record.tracks.length > 0 && (
                <span className="mt-1 text-xs leading-relaxed" style={{ color: hueFor(rig) }}>
                  {record.tracks.join(" · ")}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
