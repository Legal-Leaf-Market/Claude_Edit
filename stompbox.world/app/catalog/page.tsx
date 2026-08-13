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
    "Every effects pedal Gear Avail tracks, with the typical used price where there are enough listings to mean one.",
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
 * minutes anyway, so a shorter window here costs close to nothing.
 */
export const revalidate = 900

export default async function CatalogPage() {
  const { pedals, minSample, error } = await fetchCatalog(60)

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <p className="stencil">The catalogue</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text)] sm:text-5xl">
        What they go for
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--dim)]">
        Every effects pedal our sister site{" "}
        <a href={GEAR_AVAIL_URL} rel="noopener" className="underline">
          Gear Avail
        </a>{" "}
        tracks, with the typical used price beside it. A price only appears once there are
        at least {minSample} listings behind it, because an average of two asking prices is
        not a market price, it is two people guessing.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--dim)]">
        Prices are what the thing tends to sell for, not an offer. Buying happens on Gear
        Avail, which is where the shops and the fine print live. The{" "}
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
            Gear Avail answered with an empty list. That is what it returns before the
            ingestion crons have run against a fresh database.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-[var(--dim)]">
            {pedals.length} pedal{pedals.length === 1 ? "" : "s"}, most listed first
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pedals.map((pedal) => (
              <CatalogCard key={pedal.slug} pedal={pedal} minSample={minSample} />
            ))}
          </div>
          <p className="mt-10 text-xs leading-relaxed text-[var(--dim)]">
            Product and company names belong to their owners. This site speaks for none of
            them, and inclusion here is not a recommendation: the order is by how many
            listings exist, never by what anybody pays us.
          </p>
        </>
      )}
    </main>
  )
}
