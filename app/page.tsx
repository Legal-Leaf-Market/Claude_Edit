import Link from "next/link"
import { sql } from "drizzle-orm"
import { ArrowRight, BellRing, Cable, LineChart, Search as SearchIcon } from "lucide-react"
import { InstagramStrip } from "@/components/instagram-strip"
import { SubscribeForm } from "@/components/subscribe-form"
import { CategoryIcon, CATEGORY_HUE } from "@/components/category-icon"
import { indexableCategories } from "@/lib/categories"
import { StoreMark } from "@/components/store-mark"
import { STORES } from "@/lib/stores"
import { BOARDS } from "@/lib/boards"
import { ListingCard } from "@/components/listing-card"
import { db } from "@/lib/db"
import { search } from "@/lib/search"

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

  return (
    <div className="shell">
      {/*
        The family hero: eyebrow, a Cormorant italic lead line, the Fraunces
        gradient headline, one sentence of subtitle, then the stat row. The
        live pill sits above it because freshness is the whole claim an
        aggregator makes, and section 10 of CLAUDE.md makes the point that a
        stale feed looks exactly like a quiet market.
      */}
      <section className="hero">
        <div className="hero-inner">
          {stats.listings > 0 && (
            <p className="mb-4">
              <span className="live-pill">
                <span className="dot" aria-hidden="true" />
                {stats.listings.toLocaleString()} listings live now
              </span>
            </p>
          )}
          <p className="eyebrow">Used, vintage and new</p>
          <h1 className="h-display mt-3">
            <span className="h-lead">Real gear, straight from the makers,</span>
            on one page
          </h1>
          <p className="hsub">
            Gear Avail pulls real-time inventory from independent instrument makers and retailers,
            so you can browse everything in one place instead of hunting down each store. Sorted by
            price, with the genuinely underpriced gear marked.
          </p>
          <p className="mx-auto mt-3 max-w-[56ch] font-script text-lg italic text-[var(--amber-soft)]">
            No fees. No sellout. Built by a musician who&apos;s flipped over a thousand pedals, not
            a pitch deck.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/search"
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-gradient-to-r from-[var(--sage-dk)] to-[var(--sage)] px-6 text-[13px] font-bold tracking-[0.03em] text-[#04140a] shadow-[0_4px_14px_rgba(34,197,94,.2)] transition-all hover:brightness-110 hover:shadow-[0_6px_20px_rgba(34,197,94,.35)]"
            >
              Browse all gear
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/search?deals=1&sort=deal"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--chip)] px-6 text-[13px] font-bold tracking-[0.03em] text-[var(--cream)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              See what is below market
            </Link>
          </div>

          {stats.listings > 0 && (
            <dl className="hstats">
              <Stat label="Live listings" value={stats.listings.toLocaleString()} />
              <Stat label="Instruments tracked" value={stats.gear.toLocaleString()} />
              <Stat label="Below market now" value={stats.deals.toLocaleString()} />
            </dl>
          )}
        </div>
      </section>

      {deals && deals.hits.length > 0 && (
        <section className="pb-12">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-black tracking-[-0.01em] text-[var(--cream)]">Biggest discounts right now</h2>
            <Link
              href="/search?deals=1&sort=deal"
              className="text-sm text-[var(--amber)] underline-offset-2 hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.hits.map((hit) => (
              <ListingCard key={hit.id} hit={hit} />
            ))}
          </div>
        </section>
      )}

      <section className="pb-12">
        <div className="panel flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#c678b422] text-[#c678b4]">
              <Cable className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-[-0.01em] text-[var(--cream)]">Build your pedalboard</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--muted-foreground)]">
                Chain pedals together the way you would actually run them, and see who has each one
                in stock, new or used, and what it should cost, all in one page.
              </p>
            </div>
          </div>
          <Link
            href="/pedalboard"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--amber-soft)]"
          >
            Start building
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="pb-12">
        <h2 className="mb-4 text-xl font-black tracking-[-0.01em] text-[var(--cream)]">Browse by category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/used/${category.slug}`}
              className="panel flex items-center gap-3 px-4 py-3.5 text-sm text-[var(--cream)] transition-colors hover:border-[var(--amber)]/40 hover:bg-[var(--secondary)]"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `${CATEGORY_HUE[category.slug] ?? "#f0a830"}22`,
                  color: CATEGORY_HUE[category.slug] ?? "#f0a830",
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
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-black tracking-[-0.01em] text-[var(--cream)]">Shop by store</h2>
          <Link href="/shop" className="text-sm text-[var(--amber)] underline-offset-2 hover:underline">
            All {STORES.length} stores
          </Link>
        </div>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          Independent makers and shops, each with their own page. None of them paid to be listed,
          and none of them can pay to rank higher.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {STORES.slice(0, 8).map((store) => (
            <Link
              key={store.slug}
              href={`/shop/${store.slug}`}
              className="panel flex items-center gap-2.5 px-4 py-3 text-sm text-[var(--cream)] transition-colors hover:border-[var(--amber)]/40 hover:bg-[var(--secondary)]"
            >
              <StoreMark source={store.source} name={store.name} size="sm" />
              <span className="truncate">{store.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="pb-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-black tracking-[-0.01em] text-[var(--cream)]">The community</h2>
          <Link href="/feed" className="text-sm text-[var(--amber)] underline-offset-2 hover:underline">
            See the feed
          </Link>
        </div>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          Public boards, no DMs and no fees. Flip your gear, find a bandmate, book a lesson, post a
          show. Whatever changes hands is between you and the other person.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BOARDS.map((board) => (
            <Link
              key={board.slug}
              href={`/boards/${board.slug}`}
              className="panel px-4 py-3 text-sm text-[var(--cream)] transition-colors hover:border-[var(--amber)]/40 hover:bg-[var(--secondary)]"
            >
              {board.navLabel}
            </Link>
          ))}
        </div>
      </section>

      <section className="pb-16">
        <h2 className="mb-4 text-xl font-black tracking-[-0.01em] text-[var(--cream)]">How Gear Avail works</h2>
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
        <h2 className="mb-4 text-xl font-black tracking-[-0.01em] text-[var(--cream)]">Get the weekly hunt</h2>
        <div className="max-w-2xl">
          <SubscribeForm source="home" />
        </div>
      </section>

      <InstagramStrip />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
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
    <div className="panel p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-[var(--cream)]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">{body}</p>
    </div>
  )
}
