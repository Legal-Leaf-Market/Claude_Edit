import type { Metadata } from "next"
import Link from "next/link"
import { andertonsRigCoverages } from "@/lib/andertons/rigs"
import { RIGS } from "@/lib/rigs"
import { formatPrice } from "@/lib/utils"
import { ShipsToBadge } from "@/components/region-notice"
import { shipsToLabel } from "@/lib/regions"

/**
 * Every documented rig, ranked by how much of it Anderton's can supply.
 *
 * Ranked by PROPORTION rather than count, so a four-pedal board fully in stock
 * sits above a sixteen-pedal one that is half there. That is the order a
 * shopper deciding what to build wants, and it is a fact about inventory
 * rather than about payout: the sixteen brands Anderton's pays 4% on are not
 * an input to this or anything under it.
 */

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Artist rigs you can build at Anderton's",
  description:
    "Every documented artist pedalboard on this site, crossed against Anderton's live UK stock. The gaps are shown rather than hidden.",
  alternates: { canonical: "/uk/rigs" },
}

export default async function AndertonsRigsPage() {
  const coverages = await andertonsRigCoverages(RIGS).catch(() => [])
  const withStock = coverages.filter((c) => c.stocked > 0)

  return (
    <div className="shell space-y-8 py-10">
      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/uk" className="hover:text-[var(--accent-text)]">
            Anderton&apos;s
          </Link>{" "}
          / Rigs
        </p>
        <h1 className="h-display">Rigs you can build here</h1>
        <p className="max-w-prose text-sm leading-relaxed text-[var(--muted-foreground)]">
          Each of these is a pedalboard documented on real records, priced against what
          Anderton&apos;s has live today. Nothing is a shopping list: the rigs are scoped to the era
          they are documented on, and a slot Anderton&apos;s does not stock is shown as a gap rather
          than swapped for something they do.
        </p>
        <ShipsToBadge label={shipsToLabel("andertons")} />
      </header>

      {coverages.length === 0 ? (
        <p className="panel p-5 text-sm text-[var(--muted-foreground)]">
          Nothing to show yet. This page crosses the rigs dataset against ingested Anderton&apos;s
          stock, so it fills in once the catalogue has been pulled.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(withStock.length > 0 ? withStock : coverages).map((coverage) => (
            <Link
              key={coverage.rig.slug}
              href={`/uk/rigs/${coverage.rig.slug}`}
              className="card-face block p-4"
            >
              <p className="card-title">{coverage.rig.name}</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">{coverage.rig.context}</p>

              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span
                  className={
                    coverage.complete
                      ? "text-sm font-semibold text-[var(--sage)]"
                      : "text-sm font-semibold text-[var(--accent-text)]"
                  }
                >
                  {coverage.stocked} of {coverage.total} in stock
                </span>
                {coverage.complete && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--sage)]">
                    Complete
                  </span>
                )}
              </div>

              {coverage.subtotalCents != null && (
                <p className="card-price mt-1">{formatPrice(coverage.subtotalCents, "GBP")}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
