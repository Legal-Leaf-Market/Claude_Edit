import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Store, Wrench } from "lucide-react"
import { StompLink } from "@/components/ui/stomp"
import { StoreMark } from "@/components/store-mark"
import { ShipsToBadge } from "@/components/region-notice"
import { andertonsRigCoverages } from "@/lib/andertons/rigs"
import { andertonsChannelSummary } from "@/lib/andertons/channel"
import { RIGS } from "@/lib/rigs"
import { storeFromSlug } from "@/lib/stores"
import { shipsToLabel } from "@/lib/regions"
import { formatPrice } from "@/lib/utils"

/**
 * The Anderton's section.
 *
 * WHY ONE MERCHANT GETS A SECTION AND THE OTHERS DO NOT, since that looks
 * exactly like the ranking-by-payout this site promises never to do. It is not
 * about the commission, and the test is what would happen if they paid
 * nothing: this page would still be here, because the two facts it is built on
 * would still be true.
 *
 *   1. It is the largest catalogue on the site by a distance, ~27,000 products
 *      against everything else combined.
 *   2. It ships to the UK ONLY, which means every OTHER surface on the site
 *      has to hide it from most visitors (section 15). A shopper in the UK is
 *      therefore the one person who cannot see how much of this site is
 *      relevant to them, and this page is where that is put right.
 *
 * The second reason is the real one. Regional hiding is honest but lossy, and
 * a section is the repair.
 *
 * NOTHING HERE READS THE COMMISSION LIST. Anderton's pays 4% on sixteen named
 * brands and 1% on the rest, and no ordering, filtering or emphasis on this
 * page or the ones under it knows that. Rig ordering is stock coverage; the
 * channel panel is counted from what got talked about.
 */

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Anderton's UK: the whole catalogue, the rigs, and the channel",
  description:
    "Anderton's ships within the UK only, so most of the site hides it. This is the section that does not: their catalogue, the artist rigs you can actually build from it, and what their channel demos.",
  alternates: { canonical: "/uk" },
}

export default async function AndertonsSectionPage() {
  const store = storeFromSlug("andertons")
  const label = shipsToLabel("andertons")

  /*
   * Both degrade rather than fail. The rig coverage needs a database and the
   * channel needs a YouTube key, and neither is guaranteed in a preview
   * deploy; a section that 500s without them would make this page the most
   * fragile on the site rather than the most useful.
   */
  const [coverages, channel] = await Promise.all([
    andertonsRigCoverages(RIGS).catch(() => []),
    andertonsChannelSummary().catch(() => null),
  ])

  const buildable = coverages.filter((c) => c.stocked > 0).slice(0, 6)

  return (
    <div>
      <section className="hero" style={{ ["--hero-hue" as string]: "28" }}>
        <div className="hero-inner shell">
          <p className="eyebrow">The UK section</p>
          <h1 className="h-display">Anderton&apos;s</h1>
          <p className="hsub">
            {store?.blurb ??
              "Guildford's music shop, and the largest catalogue on this site. They deliver within the UK, which is why every other page here hides them from everyone else."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ShipsToBadge label={label} />
            <StompLink href="/shop/andertons" variant="go">
              <Store className="h-3.5 w-3.5" aria-hidden="true" />
              Browse the catalogue
            </StompLink>
          </div>
        </div>
      </section>

      <div className="shell space-y-12 py-12">
        {/*
          Said plainly and near the top rather than in a footnote. A shopper
          outside the UK who reads this and leaves has lost thirty seconds; one
          who finds out at the basket has lost the whole visit, and this site
          promises the price you see is one you can actually pay.
        */}
        <section className="panel p-5">
          <div className="flex items-start gap-4">
            <StoreMark source="andertons" name="Andertons Music Company" size="lg" />
            <div className="space-y-2">
              <h2 className="font-display text-lg font-black text-[var(--text)]">
                Delivery is UK only, and prices are in pounds
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
                Everything in this section is priced in GBP and ships within the United Kingdom.
                Outside the UK these listings are hidden from search by default, which is the
                behaviour that makes this page worth having rather than a bug it works around. You
                can always see them anyway with the &ldquo;show everything&rdquo; link on any search
                page.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Rigs</p>
              <h2 className="h-display text-2xl">Boards you can build here</h2>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
                Documented artist rigs crossed against what Anderton&apos;s has live. The gaps are
                shown rather than hidden: a board is only worth pricing if you can see what is
                missing from it.
              </p>
            </div>
            <StompLink href="/uk/rigs" variant="ghost">
              Every rig
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </StompLink>
          </div>

          {buildable.length === 0 ? (
            <p className="panel p-5 text-sm text-[var(--muted-foreground)]">
              No Anderton&apos;s stock has been ingested yet, so there is nothing to cross the rigs
              against. Pull the catalogue and this fills in.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {buildable.map((coverage) => (
                <Link
                  key={coverage.rig.slug}
                  href={`/uk/rigs/${coverage.rig.slug}`}
                  className="card-face group block p-4"
                >
                  <p className="card-title">{coverage.rig.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{coverage.rig.context}</p>
                  <p className="mt-3 text-sm font-semibold text-[var(--accent-text)]">
                    {coverage.stocked} of {coverage.total} pedals in stock
                  </p>
                  {coverage.subtotalCents != null && (
                    <p className="card-price mt-1">
                      {formatPrice(coverage.subtotalCents, "GBP")}
                      <span className="ml-1 text-xs font-normal text-[var(--muted-foreground)]">
                        for those {coverage.stocked}
                      </span>
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {channel && (
          <section className="space-y-5">
            <div>
              <p className="eyebrow">Anderton&apos;s TV</p>
              <h2 className="h-display text-2xl">What the channel actually plays</h2>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
                Counted from {channel.videosRead.toLocaleString()} recent uploads and the comments
                under them, matched against gear in this catalogue. Comments are counted and never
                quoted, and nobody is named.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="panel p-5">
                <h3 className="mb-3 font-display text-base font-black text-[var(--text)]">
                  Most demoed
                </h3>
                <MentionList mentions={channel.demoed.slice(0, 8)} unit="videos" />
              </div>

              {/*
                The one thing here that no product feed contains: gear the
                audience brings up more often than the channel does. A view
                count measures what was published, this measures what stuck.
              */}
              <div className="panel p-5">
                <h3 className="mb-3 font-display text-base font-black text-[var(--text)]">
                  Talked about more than demoed
                </h3>
                {channel.audienceFavourites.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Nothing yet: the channel is currently covering everything the comments raise.
                  </p>
                ) : (
                  <MentionList mentions={channel.audienceFavourites.slice(0, 8)} unit="comments" />
                )}
              </div>
            </div>
          </section>
        )}

        <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-display text-lg font-black text-[var(--text)]">
              Build something of your own
            </h2>
            <p className="mt-1 max-w-prose text-sm text-[var(--muted-foreground)]">
              The planner checks signal-chain order, power draw and cable count, and prices every
              slot across every store here, Anderton&apos;s included.
            </p>
          </div>
          <StompLink href="/pedalboard">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            Open the planner
          </StompLink>
        </section>
      </div>
    </div>
  )
}

function MentionList({
  mentions,
  unit,
}: {
  mentions: { pedalId: string; brand: string; model: string; count: number }[]
  unit: string
}) {
  if (mentions.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">Nothing matched the catalogue.</p>
  }

  return (
    <ol className="space-y-2">
      {mentions.map((mention) => (
        <li key={mention.pedalId} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-[var(--text)]">
            <span className="text-[var(--muted-foreground)]">{mention.brand}</span> {mention.model}
          </span>
          <span className="shrink-0 tabular-nums text-xs text-[var(--muted-foreground)]">
            {mention.count} {unit}
          </span>
        </li>
      ))}
    </ol>
  )
}
