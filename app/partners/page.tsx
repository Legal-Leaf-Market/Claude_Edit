import type { Metadata } from "next"
import Link from "next/link"
import { PARTNERS } from "@/lib/partners"

/**
 * The partner index.
 *
 * Two entries, and it exists so neither focus page is an orphan reachable only
 * from a banner. The store index (/shop) had exactly that problem: eleven store
 * pages with no list of stores anywhere, which meant they might as well not
 * have existed.
 *
 * It says what these are and, more importantly, what they are not, so nobody
 * arrives expecting the price comparison the rest of the site is built on.
 */
export const revalidate = 3600

export const metadata: Metadata = {
  title: "Partners: software and services | Gear Avail",
  description:
    "Two things Gear Avail links to that are not gear: software instruments and music distribution. Neither is in the catalogue, and this page explains why.",
  alternates: { canonical: "/partners" },
}

export default function PartnersIndexPage() {
  return (
    <div className="shell-narrow py-10">
      <p className="eyebrow">Not gear</p>
      <h1 className="mt-1 font-display text-3xl font-black tracking-[-0.01em] text-[var(--text)]">
        Software and services
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--dim)]">
        Everything in the catalogue is a physical thing with a price, a condition and at least one
        seller to measure it against. These two are neither, so they sit here instead of in the
        search grid, where a plugin licence would turn up in a filter for gear under $200 with
        local pickup.
      </p>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--dim)]">
        We earn a commission on both, and they are the only pages on this site that exist because
        of that. Nothing about them touches how listings are ranked, because neither has a listing.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {PARTNERS.map((partner) => (
          <li key={partner.slug}>
            <Link
              href={`/partners/${partner.slug}`}
              className="card-face flex h-full flex-col p-5 transition-colors hover:border-[var(--brand-gold)]"
            >
              <p className="eyebrow">{partner.kind}</p>
              <p className="mt-1 text-base font-semibold text-[var(--text)]">{partner.name}</p>
              <p className="mt-1 text-sm font-medium text-[var(--accent-text)]">{partner.tagline}</p>
              <p className="mt-2 line-clamp-4 flex-1 text-sm leading-relaxed text-[var(--dim)]">
                {partner.intro[0]}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
