import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { bannerPartner } from "@/lib/partners"

/**
 * A labelled partner placement.
 *
 * THE FIRST AD ON THIS SITE, and that is a decision rather than a drift.
 * CLAUDE.md records that Anderton's vanity link had no home here because
 * "putting it on a page would be the first ad on this site, which is a product
 * decision nobody has taken". It has now been taken, deliberately and narrowly:
 * one partner, in a couple of places, always labelled.
 *
 * WHAT KEEPS IT HONEST, and none of these is optional:
 *
 *   - IT SAYS WHAT IT IS. The word "Partner" and the fact that we earn from it
 *     are on the banner itself, not buried in the footer. An unlabelled
 *     placement dressed as a search result is what would actually break the
 *     footer's promise; a labelled one a shopper can identify in half a second
 *     does not.
 *   - IT IS NEVER IN A RESULT SET. It sits between sections, never inside a
 *     grid of listings, never in search, never on a gear page, and it never
 *     displaces a listing. Ranking stays price, discount, recency or shuffle.
 *   - IT LINKS THROUGH /go/partner, like everything else outbound, so the click
 *     is recorded and the destination is checked against the same allowlist.
 *   - IT IS VISUALLY QUIETER THAN THE CONTENT AROUND IT. Section 16: gold is an
 *     edge and muted at rest, and a banner is not the one primary action on any
 *     page it appears on.
 *
 * If a second partner ever wants one of these, that is a fresh product decision
 * and not a config change. Two labelled placements is a choice; five is an ad
 * network, and this site's whole pitch is being the thing that is not that.
 */
export function PartnerBanner({ slug }: { slug: string }) {
  const partner = bannerPartner(slug)
  // Nothing renders for a partner with no banner configured, which is the
  // normal state for all but one of them.
  if (!partner?.banner) return null

  const { headline, body, cta } = partner.banner

  return (
    <aside
      aria-label={`Partner: ${partner.name}`}
      className="my-10 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="min-w-0">
        <p className="eyebrow">Partner · we earn from this link</p>
        <p className="mt-1 font-display text-lg font-black tracking-[-0.01em] text-[var(--text)]">
          {headline}
        </p>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--dim)]">{body}</p>
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0">
        {/*
          The internal page first, deliberately. It is the one with the caveats
          on it (a subscription that takes your releases down if you stop
          paying is not a footnote), and sending someone to read those before
          they spend is the whole reason the focus page exists.
        */}
        <Link href={`/partners/${partner.slug}`} className="stomp">
          {cta}
        </Link>
        <a
          href={`/go/partner/${partner.slug}`}
          rel="nofollow sponsored noopener"
          className="stomp stomp-ghost"
        >
          Go to {partner.name}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </aside>
  )
}
