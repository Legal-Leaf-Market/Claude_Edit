import { formatMarketPrice, gearAvailProductUrl, type CatalogPedal } from "@/lib/catalog"

/**
 * One catalogue pedal.
 *
 * Deliberately a different card from PedalCard. That one opens a circuit
 * entry written here and reads as this site's own voice; this one is a
 * pointer at somebody else's stock, and the two should not be mistaken for
 * each other at a glance. The tell is the price line and the outbound arrow.
 *
 * The link leaves for Gear Avail rather than listing merchants here, because
 * that is where the outbound-click accounting and the partner attribution
 * already work. Re-implementing either on a second domain would be a way to
 * get both wrong.
 */
export function CatalogCard({ pedal, minSample }: { pedal: CatalogPedal; minSample: number }) {
  const price = formatMarketPrice(pedal.marketPriceCents)

  return (
    <a
      href={gearAvailProductUrl(pedal.slug)}
      rel="noopener"
      className="surface group flex flex-col p-5 transition-colors hover:border-[var(--brand-edge)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="stencil">{pedal.brand}</span>
        <span className="stencil text-[0.58rem]">{pedal.type}</span>
      </div>

      <h3 className="mt-1.5 text-lg font-black leading-tight tracking-tight text-[var(--text)]">
        {pedal.model}
      </h3>

      <div className="mt-4 flex-1" />

      {price ? (
        <p className="text-2xl font-black tracking-tight text-[var(--money)]">
          {price}
          <span className="ml-2 align-middle text-xs font-normal text-[var(--dim)]">
            typical used
          </span>
        </p>
      ) : (
        /* Saying why there is no number is more useful than an em space where
           a price should be, and it is the honest version of the same fact. */
        <p className="text-sm text-[var(--dim)]">
          Fewer than {minSample} listings, so no market price yet
        </p>
      )}

      <p className="mt-2 text-xs text-[var(--dim)]">
        {pedal.listingCount > 0
          ? `${pedal.listingCount} listing${pedal.listingCount === 1 ? "" : "s"} on Gear Avail`
          : "No live listings right now"}
      </p>
    </a>
  )
}
