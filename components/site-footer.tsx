import Link from "next/link"

/**
 * Affiliate disclosure lives here and is deliberately plain. We earn on
 * outbound clicks, and saying so is both an FTC requirement and the honest
 * framing for a site whose entire product is telling you where to buy.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[#0b0908]/60">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-[var(--cream)]">MusicTime</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--muted-foreground)]">
              Used and vintage gear from across the marketplaces, matched to the same instrument so
              you can see every live price at once.
            </p>
          </div>

          <nav aria-label="Browse">
            <p className="text-sm font-semibold text-[var(--cream)]">Browse</p>
            <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted-foreground)]">
              <li>
                <Link href="/search" className="hover:text-[var(--cream)]">
                  All listings
                </Link>
              </li>
              <li>
                <Link href="/search?deals=1&sort=deal" className="hover:text-[var(--cream)]">
                  Below market
                </Link>
              </li>
              <li>
                <Link href="/alerts" className="hover:text-[var(--cream)]">
                  Price alerts
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <p className="text-sm font-semibold text-[var(--cream)]">How this works</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              MusicTime earns affiliate commission when you buy through an outbound link. That never
              changes your price, and it never changes how listings are ranked: sorting is by price
              and discount only.
            </p>
          </div>
        </div>

        <p className="mt-8 border-t border-[var(--border)] pt-6 text-xs text-[var(--muted-foreground)]">
          Prices and availability are captured from marketplace feeds and can change before you
          reach the seller. Always confirm the final price on the marketplace. MusicTime is not
          affiliated with eBay or Reverb.
        </p>
      </div>
    </footer>
  )
}
