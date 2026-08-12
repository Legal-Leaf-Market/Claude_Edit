import Link from "next/link"
import { sql } from "drizzle-orm"
import { ArrowRight, BellRing, Cable, Disc3, LineChart, Search as SearchIcon } from "lucide-react"
import { InstagramStrip } from "@/components/instagram-strip"
import { PartnerBanner } from "@/components/partner-banner"
import { SubscribeForm } from "@/components/subscribe-form"
import { CategoryIcon, CATEGORY_HUE, FALLBACK_HUE } from "@/components/category-icon"
import { indexableCategories } from "@/lib/categories"
import { StoreMark } from "@/components/store-mark"
import { STORES } from "@/lib/stores"
import { BOARDS } from "@/lib/boards"
import { ListingCard } from "@/components/listing-card"
import { db } from "@/lib/db"
import { EFFECTS } from "@/lib/pedalboard/chain"
import { FEATURED_RIG_SLUGS, hueFor, initialsFor, rigStats, RIG_BY_SLUG, signaturePedal } from "@/lib/rigs"
import { search } from "@/lib/search"
import { StompLink } from "@/components/ui/stomp"

export const revalidate = 300

/**
 * Derived from lib/categories rather than hand-listed.
 *
 * The hardcoded version drifted: it used "keyboards-pianos" while slugify
 * turns "&" into "and", so /used/keyboards-pianos, /used/drums-percussion and
 * /used/recording-audio were all 404ing from the homepage. Deriving the list
 * means a category rename cannot silently break a link again.
 */
const CATEGORIES = indexableCategories()

/** Headline counts. Wrapped because an empty database is the normal first-run state. */
async function siteStats() {
  try {
    const result = await db.execute<{ listings: number; gear: number; deals: number }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE listing_status = 'active')::int AS listings,
        COUNT(DISTINCT canonical_gear_id)::int AS gear,
        COUNT(*) FILTER (WHERE is_deal AND listing_status = 'active')::int AS deals
      FROM marketplace_listings
    `)
    const row = result.rows[0]
    return {
      listings: Number(row?.listings ?? 0),
      gear: Number(row?.gear ?? 0),
      deals: Number(row?.deals ?? 0),
    }
  } catch {
    return { listings: 0, gear: 0, deals: 0 }
  }
}

export default async function HomePage() {
  const [stats, deals] = await Promise.all([
    siteStats(),
    search({ dealsOnly: true, sort: "deal", perPage: 6 }).catch(() => null),
  ])
  const rigs = rigStats()

  return (
    <div className="shell">
      {/*
        The rack panel. It replaced the family hero (centred eyebrow, Cormorant
        italic lead, Fraunces gradient headline, script pull quote), which was
        a good hero belonging to the hemp sites and read here as a borrowed
        suit. See THE RACK PANEL in globals.css.

        The status LED stays at the top because freshness is the whole claim an
        aggregator makes: section 10 of CLAUDE.md notes that a stale feed looks
        exactly like a quiet market, and the only thing that tells them apart
        is a number that says when the stock was last counted.
      */}
      <section className="rack mt-4">
        <div className="rack-inner">
          {stats.listings > 0 && (
            <p className="rack-status mb-5">
              <span className="led" aria-hidden="true" />
              {stats.listings.toLocaleString()} listings live now
            </p>
          )}

          <h1 className="rack-title">
            Every shop&apos;s stock.
            <br />
            <em>One page.</em>
          </h1>

          <p className="rack-sub">
            Gear Avail pulls live inventory from independent makers and retailers, so you can
            compare everything in one place instead of opening eleven tabs. Sorted by price, with
            the genuinely underpriced gear marked, and a market price only where there are enough
            listings to actually mean one.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <StompLink href="/search" variant="go" size="lg">
              Browse all gear
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </StompLink>
            <StompLink href="/rigs" size="lg">
              The boards behind the records
            </StompLink>
          </div>

          {stats.listings > 0 && (
            <dl className="readouts mt-9">
              <Readout label="Live listings" value={stats.listings.toLocaleString()} />
              <Readout label="Instruments tracked" value={stats.gear.toLocaleString()} />
              <Readout label="Below market now" value={stats.deals.toLocaleString()} />
              <Readout label="Documented rigs" value={rigs.rigs.toLocaleString()} />
            </dl>
          )}
        </div>
      </section>

      {/*
        The two tools, immediately after the hero and before any inventory.

        This is the ordering decision the redesign turns on. Every gear
        aggregator opens with a wall of listings, and a wall of listings is
        the one thing this site cannot win on: it will never have more
        inventory than Reverb. What it has that they do not is the rig
        database and a builder that checks a chain, so those go where a
        visitor actually sees them.
      */}
      <section className="pb-12">
        <div className="grid gap-4 lg:grid-cols-2">
          <ToolCard
            hue="#c678b4"
            icon={<Disc3 className="h-6 w-6" aria-hidden="true" />}
            eyebrow="Gear history"
            title="The boards behind the records"
            body={`${rigs.rigs} documented pedalboards, the ${rigs.records} records and ${rigs.tracks} tracks each is documented on, and what every pedal on them costs today.`}
            href="/rigs"
            cta="Browse the rigs"
          >
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {FEATURED_RIG_SLUGS.map((slug) => {
                const rig = RIG_BY_SLUG.get(slug)
                if (!rig) return null
                return (
                  <li key={slug}>
                    <Link
                      href={`/rigs/${slug}`}
                      className="icon-badge h-10 w-10 text-[0.7rem]"
                      style={{ "--icon-hue": hueFor(rig) } as React.CSSProperties}
                      title={`${rig.name}: ${signaturePedal(rig).brand} ${signaturePedal(rig).model}`}
                    >
                      {initialsFor(rig)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </ToolCard>

          <ToolCard
            hue="#22d3ee"
            icon={<Cable className="h-6 w-6" aria-hidden="true" />}
            eyebrow="Interactive"
            title="Build the board"
            body="Chain pedals the way you would actually run them. It flags anything out of the usual signal order, sizes a power supply, and prices the whole thing against live listings."
            href="/pedalboard"
            cta="Open the builder"
          >
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {(["tuner", "filter", "compressor", "drive", "modulation", "delay", "reverb"] as const).map(
                (type) => (
                  <li
                    key={type}
                    className="rounded-full border px-2.5 py-1 text-xs"
                    style={{ borderColor: EFFECTS[type].hue, color: EFFECTS[type].hue }}
                  >
                    {EFFECTS[type].label}
                  </li>
                ),
              )}
            </ul>
          </ToolCard>
        </div>
      </section>

      {deals && deals.hits.length > 0 && (
        <section className="pb-12">
          <SectionHead
            title="Biggest discounts right now"
            href="/search?deals=1&sort=deal"
            linkLabel="See all"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.hits.map((hit) => (
              <ListingCard key={hit.id} hit={hit} />
            ))}
          </div>
        </section>
      )}

      <section className="pb-12">
        <SectionHead title="Browse by category" href="/search" linkLabel="Everything" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/used/${category.slug}`}
              className="card-face flex items-center gap-3 px-4 py-3.5 text-sm text-[var(--text)] transition-colors hover:border-[var(--copper)]"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `${CATEGORY_HUE[category.slug] ?? FALLBACK_HUE}22`,
                  color: CATEGORY_HUE[category.slug] ?? FALLBACK_HUE,
                }}
              >
                <CategoryIcon slug={category.slug} />
              </span>
              <span className="truncate">{category.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="pb-12">
        <SectionHead
          title="Shop by store"
          href="/shop"
          linkLabel={`All ${STORES.length} stores`}
        />
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          Independent makers and shops, each with their own page. None of them paid to be listed,
          and none of them can pay to rank higher.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {STORES.slice(0, 8).map((store) => (
            <Link
              key={store.slug}
              href={`/shop/${store.slug}`}
              className="card-face flex items-center gap-2.5 px-4 py-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--copper)]"
            >
              <StoreMark source={store.source} name={store.name} size="sm" />
              <span className="truncate">{store.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="pb-12">
        <SectionHead title="The community" href="/feed" linkLabel="See the feed" />
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          Public boards, no DMs and no fees. Flip your gear, find a bandmate, book a lesson, post a
          show. Whatever changes hands is between you and the other person.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BOARDS.map((board) => (
            <Link
              key={board.slug}
              href={`/boards/${board.slug}`}
              className="card-face px-4 py-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--copper)]"
            >
              {board.navLabel}
            </Link>
          ))}
        </div>
      </section>

      {/*
        The one partner placement on this page, and it sits here rather than
        anywhere above it for a reason: everything above is ranked inventory,
        and a labelled ad belongs after the ranking rather than inside it. See
        components/partner-banner.tsx for what keeps it honest.
      */}
      <PartnerBanner slug="distrokid" />

      <section className="pb-16">
        <h2 className="mb-4 font-display text-xl font-black tracking-[-0.01em] text-[var(--text)]">
          How Gear Avail works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <HowItWorks
            icon={<SearchIcon className="h-5 w-5" aria-hidden="true" />}
            title="One search, every store"
            body="We ingest each source's real catalogue, verified against its own published terms, rather than scraping a storefront built for humans. What you see here is what is actually in stock."
          />
          <HowItWorks
            icon={<LineChart className="h-5 w-5" aria-hidden="true" />}
            title="A market price you can check"
            body="Each instrument gets a rolling median from the listings we have actually seen. If the sample is too thin to mean anything, we say so rather than inventing a number."
          />
          <HowItWorks
            icon={<BellRing className="h-5 w-5" aria-hidden="true" />}
            title="Alerts for the gear you want"
            body="Save a search with a price ceiling. When something matching drops below it, you get an email or a Discord ping, usually within the hour."
          />
        </div>
      </section>

      <section className="pb-16">
        <h2 className="mb-4 font-display text-xl font-black tracking-[-0.01em] text-[var(--text)]">
          Get the weekly hunt
        </h2>
        <div className="max-w-2xl">
          <SubscribeForm source="home" />
        </div>
      </section>

      <InstagramStrip />
    </div>
  )
}

function SectionHead({
  title,
  href,
  linkLabel,
}: {
  title: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-xl font-black tracking-[-0.01em] text-[var(--text)]">
        {title}
      </h2>
      <Link
        href={href}
        className="text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
      >
        {linkLabel}
      </Link>
    </div>
  )
}

function ToolCard({
  hue,
  icon,
  eyebrow,
  title,
  body,
  href,
  cta,
  children,
}: {
  hue: string
  icon: React.ReactNode
  eyebrow: string
  title: string
  body: string
  href: string
  cta: string
  children?: React.ReactNode
}) {
  return (
    <div className="panel flex flex-col" style={{ borderTopColor: hue, borderTopWidth: 3 }}>
      <div className="flex items-start gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${hue}22`, color: hue }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1 font-display text-xl font-black tracking-[-0.01em] text-[var(--text)]">
            {title}
          </h2>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">{body}</p>

      {children}

      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  )
}

/**
 * One readout on the rack panel. A <div> inside the <dl> rather than a bare
 * dt/dd pair, because the panel lays these out as boxes and a dl's children
 * cannot be flex items individually.
 */
function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function HowItWorks({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="panel">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]">
        {icon}
      </div>
      <h3 className="mt-3 font-display text-base font-black text-[var(--text)]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">{body}</p>
    </div>
  )
}
