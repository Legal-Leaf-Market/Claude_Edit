import Link from "next/link"
import { sql } from "drizzle-orm"
import { ArrowRight, BellRing, LineChart, Search as SearchIcon } from "lucide-react"
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="py-12 sm:py-16">
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-[var(--cream)] sm:text-5xl">
          Real gear, straight from the makers,{" "}
          <span className="text-[var(--amber)]">on one page</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg">
          Gear Avail pulls real-time inventory from independent instrument makers and retailers, so
          you can browse everything in one place instead of hunting down each store. Sorted by
          price, with the genuinely underpriced gear marked.
        </p>
        <p className="mt-3 max-w-2xl text-sm font-medium text-[var(--amber)]">
          No fees. No sellout. Built by a musician who's flipped over a thousand pedals, not a
          pitch deck.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/search"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--amber-soft)]"
          >
            Browse all gear
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/search?deals=1&sort=deal"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-5 text-sm font-medium text-[var(--cream)] transition-colors hover:bg-[var(--secondary)]"
          >
            See what is below market
          </Link>
        </div>

        {stats.listings > 0 && (
          <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-4">
            <Stat label="Live listings" value={stats.listings.toLocaleString()} />
            <Stat label="Instruments tracked" value={stats.gear.toLocaleString()} />
            <Stat label="Below market now" value={stats.deals.toLocaleString()} />
          </dl>
        )}
      </section>

      {deals && deals.hits.length > 0 && (
        <section className="pb-12">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-[var(--cream)]">Biggest discounts right now</h2>
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
        <h2 className="mb-4 text-xl font-semibold text-[var(--cream)]">Browse by category</h2>
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
          <h2 className="text-xl font-semibold text-[var(--cream)]">Shop by store</h2>
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
          <h2 className="text-xl font-semibold text-[var(--cream)]">The community</h2>
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
        <h2 className="mb-4 text-xl font-semibold text-[var(--cream)]">How Gear Avail works</h2>
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
        <h2 className="mb-4 text-xl font-semibold text-[var(--cream)]">Get the weekly hunt</h2>
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
      <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold text-[var(--cream)]">{value}</dd>
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
