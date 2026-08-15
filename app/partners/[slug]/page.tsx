import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { PARTNERS, partnerFromSlug } from "@/lib/partners"

/**
 * A partner focus page.
 *
 * The one kind of page on this site that is NOT built from ingested inventory.
 * Everything else here renders whatever the feeds currently say; these two are
 * hand-written, because what they sell has no stock level, no condition and no
 * second seller to price it against (lib/partners.ts sets out why that keeps
 * them out of the catalogue).
 *
 * Two things on this page are load bearing rather than decorative.
 *
 * The "why this is not in the catalogue" panel stays. A shopper who finds this
 * page from a search deserves to know immediately why there is no price
 * comparison on it, and saying so is the same instinct as the gear pages
 * printing "sample too small to publish a market price" instead of inventing
 * one.
 *
 * The disclosure stays too, and outbound links carry rel="nofollow sponsored",
 * exactly as listing cards do. This page exists because of an affiliate
 * relationship, and a page that exists because of one should say so on itself
 * rather than only in the footer.
 */

export const revalidate = 3600

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return PARTNERS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const partner = partnerFromSlug(slug)
  if (!partner) return { title: "Partner not found" }

  const title = `${partner.name}: ${partner.tagline} | Gear Avail`
  const description = partner.intro[0]

  return {
    title,
    description,
    alternates: { canonical: `/partners/${partner.slug}` },
    openGraph: { title, description, type: "website" },
  }
}

export default async function PartnerPage({ params }: PageProps) {
  const { slug } = await params
  const partner = partnerFromSlug(slug)
  if (!partner) notFound()

  const outbound = `/go/partner/${partner.slug}`

  return (
    <div className="shell-narrow py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--dim)]">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-[var(--text)]">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/partners" className="hover:text-[var(--text)]">
              Partners
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text)]">{partner.name}</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <p className="eyebrow">{partner.kind}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.01em] text-[var(--text)]">
          {partner.name}
        </h1>
        <p className="mt-2 text-base font-medium text-[var(--accent-text)]">{partner.tagline}</p>
      </header>

      <div className="mt-6 max-w-3xl space-y-4">
        {partner.intro.map((paragraph) => (
          <p key={paragraph.slice(0, 24)} className="text-base leading-relaxed text-[var(--dim)]">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <a href={outbound} rel="nofollow sponsored noopener" className="stomp stomp-go">
          Visit {partner.name}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        <p className="text-xs text-[var(--dim)]">
          Affiliate link. It costs you nothing extra, and it is why this page exists.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold tracking-[-0.01em] text-[var(--text)]">
          What is worth knowing first
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {partner.highlights.map((highlight) => (
            <div key={highlight.title} className="card-face p-5">
              <h3 className="text-sm font-semibold text-[var(--text)]">{highlight.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">{highlight.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {partner.facts.map((fact) => (
          <div key={fact.label} className="rounded-[12px] border border-[var(--line)] p-4">
            <p className="eyebrow">{fact.label}</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">{fact.value}</p>
          </div>
        ))}
      </section>

      {/*
        Stated on the page, not just in a comment. Somebody landing here from a
        search should not have to work out why a site full of price comparisons
        has none on this page.
      */}
      <section className="panel mt-10">
        <h2 className="font-display text-lg font-bold text-[var(--text)]">
          Why there is no price comparison here
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">{partner.whyNotListed}</p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
          Everything in{" "}
          <Link href="/search" className="text-[var(--accent-text)] underline-offset-2 hover:underline">
            the catalogue
          </Link>{" "}
          is real stock from a real feed, measured against a median built from listings we have
          actually seen. This is not that, and calling it that would make both claims worth less.
        </p>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-[var(--dim)]">
        Gear Avail earns a commission if you buy through the link above. That never changes your
        price, and it never affects how anything on this site is ranked: {partner.name} has no
        listings in the catalogue at all, so there is nothing here for a commission to move.{" "}
        {partner.name} is not affiliated with Gear Avail beyond that referral relationship, and
        nothing here is an endorsement by them of us.
      </p>
    </div>
  )
}
