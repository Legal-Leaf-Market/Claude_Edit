import type { Metadata } from "next"
import Link from "next/link"
import { CatalogCard } from "@/components/catalog-card"
import { fetchCatalog, GEAR_AVAIL_URL } from "@/lib/catalog"

/*
 * Bare title, no site name. The root layout carries a
 * `template: "%s | stompbox.world"`, so naming the site here got it printed
 * twice and the live page shipped as
 * "Pedal catalogue | stompbox.world | stompbox.world".
 * Every other route passes a bare string for exactly this reason.
 */
export const metadata: Metadata = {
  title: "Pedal catalogue",
  description:
    "Every effects pedal with live listings on Gear Avail, most listed first, with the typical price where there are enough listings to mean one.",
}

/**
 * The catalogue: the pedal slice of Gear Avail, on this domain.
 *
 * Rebuilt on a schedule rather than per request. Nothing here is personalised
 * and the underlying data moves on an ingestion cron, so a static page is both
 * faster and cheaper than rendering it live.
 *
 * FIFTEEN MINUTES RATHER THAN AN HOUR, AND THE REASON IS THE FAILURE CASE.
 * A prerendered page caches whatever it rendered, INCLUDING the "catalogue is
 * not answering" state. So this number is not just how stale a price may be,
 * it is also how long a bad render stays on the site after the cause is fixed.
 * That is not hypothetical: the first deploy of this page cached an upstream
 * query error, and with an hourly window it would have sat there looking
 * broken long after the fix shipped. The upstream is CDN-cached for ten
 * minutes anyway, so a shorter window here costs close to nothing. The fetch
 * in lib/catalog.ts is pinned to the same window, because a longer one there
 * silently wins over this one.
 */
export const revalidate = 900

/**
 * How much of the shelf this page shows.
 *
 * The upstream caps a page at 200. This is a browse page rather than a search,
 * so it shows a generous slice and points at Gear Avail for the rest instead
 * of paginating a copy of somebody else's catalogue.
 */
const SHOWN = 120

export default async function CatalogPage() {
  const { pedals, minSample, total, browseUrl, error } = await fetchCatalog(SHOWN)
  const remaining = Math.max(total - pedals.length, 0)

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <p className="stencil">The catalogue</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text)] sm:text-5xl">
        What they go for
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--dim)]">
        Every effects pedal with live listings on our sister site{" "}
        <a href={GEAR_AVAIL_URL} rel="noopener" className="underline">
          Gear Avail
        </a>{" "}
        right now, with the typical price beside it. A price only appears once there are at
        least {minSample} listings of one condition behind it, because an average of two
        asking prices is not a market price, it is two people guessing.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--dim)]">
        Prices are what the thing tends to sell for, not an offer. New and used are counted
        as the two markets they are, so a price says which one it measures. Buying happens
        on Gear Avail, which is where the shops and the fine print live. The{" "}
        <Link href="/pedals" className="underline">
          circuit guide
        </Link>{" "}
        stays free of all of it: no prices, no merchants, nothing riding on the opinion.
      </p>

      {error ? (
        /* Degrade to the guide rather than to an error. The catalogue is an
           addition to this site, not the reason it exists. */
        <div className="surface mt-10 p-6">
          <h2 className="text-lg font-black tracking-tight text-[var(--text)]">
            The catalogue is not answering
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
            Gear Avail could not be reached, so there is nothing to price right now. The{" "}
            <Link href="/pedals" className="underline">
              circuit guide
            </Link>{" "}
            and the{" "}
            <Link href="/chain" className="underline">
              signal chain builder
            </Link>{" "}
            do not depend on it and are unaffected.
          </p>
          <p className="mt-3 text-xs text-[var(--dim)]">Reason: {error}</p>
        </div>
      ) : pedals.length === 0 ? (
        <div className="surface mt-10 p-6">
          <h2 className="text-lg font-black tracking-tight text-[var(--text)]">
            Nothing in the catalogue yet
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
            Gear Avail answered with an empty list, which means no pedal has a live listing
            behind it at the moment. That is what it returns before the ingestion crons have
            run against a fresh database.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-[var(--dim)]">
            {remaining > 0
              ? `${pedals.length} of ${total.toLocaleString()} pedals with live listings, most listed first`
              : `${pedals.length} pedal${pedals.length === 1 ? "" : "s"} with live listings, most listed first`}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pedals.map((pedal) => (
              <CatalogCard key={pedal.slug} pedal={pedal} minSample={minSample} />
            ))}
          </div>
          {remaining > 0 ? (
            <p className="mt-8 text-sm text-[var(--dim)]">
              <a href={browseUrl} rel="noopener" className="underline">
                The other {remaining.toLocaleString()} are on Gear Avail
              </a>
              , listing by listing, with the shop and the condition on each one.
            </p>
          ) : null}
          <p className="mt-10 text-xs leading-relaxed text-[var(--dim)]">
            Product and company names belong to their owners. This site speaks for none of
            them, and inclusion here is not a recommendation: the order is by how many live
            listings exist, never by what anybody pays us.
          </p>
        </>
      )}
    </main>
  )
}
