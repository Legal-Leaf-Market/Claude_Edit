import { PedalPhoto } from "@/components/pedal-photo"
import {
  formatMarketPrice,
  gearAvailProductUrl,
  marketPriceLabel,
  type CatalogPedal,
} from "@/lib/catalog"

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
  /* New and used are separate markets over there, and gear that only new
     retailers stock is priced from the new median. Printing that under the
     words "typical used" would be this site stating something its own source
     does not say. An unlabelled price prints bare rather than guessing. */
  const label = marketPriceLabel(pedal.marketPriceClass)

  return (
    <a
      href={gearAvailProductUrl(pedal.slug)}
      rel="noopener"
      className="surface group flex flex-col p-4 transition-colors hover:border-[var(--chrome)]"
    >
      {/* The photo leads. A catalogue is a shelf, and a shelf you cannot see
          is a list. The API has sent one of these for every pedal since the
          endpoint was written and this card ignored it, which is why the page
          read as a wall of text. */}
      <PedalPhoto src={pedal.imageUrl} alt={`${pedal.brand} ${pedal.model}`} />

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <span className="stencil">{pedal.brand}</span>
        <span className="stencil text-[0.58rem]">{pedal.type}</span>
      </div>

      <h3 className="mt-1.5 text-lg font-black leading-tight tracking-tight text-[var(--text)]">
        {pedal.model}
      </h3>

      <div className="mt-3 flex-1" />

      {price ? (
        <p className="text-2xl font-black tracking-tight text-[var(--money)]">
          {price}
          {label ? (
            <span className="ml-2 align-middle text-xs font-normal text-[var(--dim)]">{label}</span>
          ) : null}
        </p>
      ) : (
        /* Saying why there is no number is more useful than an em space where
           a price should be, and it is the honest version of the same fact.
           SHORTER THAN IT WAS, because it turned out to be the common case
           rather than the exception: 46 of the 48 pedals on the shelf are
           stocked by exactly one seller, so a two-line explanation repeated
           down the whole grid buried the pedals it was explaining. The rule
           it compresses is stated in full at the top of the page, and the
           number stays here because the number is the checkable part. */
        <p className="text-sm text-[var(--dim)]">
          No price yet, needs {minSample} listings
        </p>
      )}

      <p className="mt-2 text-xs text-[var(--dim)]">
        {pedal.listingCount > 0
          ? `${pedal.listingCount} live listing${pedal.listingCount === 1 ? "" : "s"} on Gear Avail`
          : "No live listings right now"}
      </p>
    </a>
  )
}
