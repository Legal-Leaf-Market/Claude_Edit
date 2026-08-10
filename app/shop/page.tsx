import type { Metadata } from "next"
import Link from "next/link"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { StoreMark } from "@/components/store-mark"
import { STORES } from "@/lib/stores"
import { formatPrice } from "@/lib/utils"

export const revalidate = 900

export const metadata: Metadata = {
  title: "Every store on Gear Avail",
  description:
    "The independent makers and shops Gear Avail lists, with live inventory counts. No fees, no cut of their sale, and none of them pay for placement.",
  alternates: { canonical: "/shop" },
}

/**
 * The store index.
 *
 * This did not exist until the navigation review: eleven store pages had been
 * built with no way to reach any of them except by typing the URL. A shopper
 * cannot browse by shop if the list of shops is unlisted.
 *
 * Ordered by live inventory, which is the only ordering that helps a shopper.
 * Deliberately NOT ordered by commission, per the rule in CLAUDE.md.
 */
type Row = { source: string; listings: number; cheapest: number | null }

async function storeStats(): Promise<Map<string, Row>> {
  try {
    const result = await db.execute<Row>(sql`
      SELECT source, COUNT(*)::int AS listings, MIN(price_cents)::int AS cheapest
      FROM marketplace_listings
      WHERE listing_status = 'active'
      GROUP BY source
    `)
    return new Map(result.rows.map((r) => [r.source, r]))
  } catch {
    return new Map()
  }
}

export default async function ShopIndexPage() {
  const stats = await storeStats()
  const stores = STORES.map((s) => ({ ...s, stat: stats.get(s.source) })).sort(
    (a, b) => (b.stat?.listings ?? 0) - (a.stat?.listings ?? 0),
  )
  const total = [...stats.values()].reduce((sum, r) => sum + Number(r.listings), 0)

  return (
    <div className="shell py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--amber)]">
        Independent makers and shops
      </p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--cream)]">
        Every store we list
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)]">
        {total > 0 ? `${total.toLocaleString()} live listings across ` : ""}
        {stores.length} independent storefronts. None of them paid to be here, and none of them can
        pay to be higher up this page.
      </p>

      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <li key={store.slug}>
            <Link
              href={`/shop/${store.slug}`}
              className="panel flex h-full flex-col p-5 transition-colors hover:border-[var(--amber)]/40 hover:bg-[var(--secondary)]"
            >
              <div className="flex items-center gap-3">
                <StoreMark source={store.source} name={store.name} />
                <p className="text-base font-semibold text-[var(--cream)]">{store.name}</p>
              </div>
              <p className="mt-2 text-sm font-medium text-[var(--amber)]">{store.tagline}</p>
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {store.blurb}
              </p>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                {store.stat
                  ? `${Number(store.stat.listings).toLocaleString()} listings${
                      store.stat.cheapest != null
                        ? ` · from ${formatPrice(Number(store.stat.cheapest))}`
                        : ""
                    }`
                  : "Inventory syncing"}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="panel mt-10 p-6">
        <h2 className="text-lg font-black text-[var(--cream)]">Run a shop?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          We list independent sellers for free and take nothing from your sales. If you have gear
          online and want it in front of players who are already looking for it, tell us about it.
        </p>
        <Link
          href="/list-your-shop"
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--amber-soft)]"
        >
          Get your shop listed
        </Link>
      </div>
    </div>
  )
}
