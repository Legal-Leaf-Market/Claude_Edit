import Link from "next/link"
import { InstagramGlyph } from "@/components/icons/instagram-glyph"
import { env } from "@/lib/env"
import { STORES } from "@/lib/stores"
import { BOARDS } from "@/lib/boards"
import { indexableCategories } from "@/lib/categories"

/**
 * Affiliate disclosure lives here and is deliberately plain. We earn on
 * outbound clicks, and saying so is both an FTC requirement and the honest
 * framing for a site whose entire product is telling you where to buy.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[#0b0908]/60">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm font-semibold text-[var(--cream)]">Gear Avail</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--muted-foreground)]">
              Real-time inventory from independent music gear makers and retailers, all in one
              place.
            </p>
            <a
              href={`https://instagram.com/${env.social.instagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--amber)] underline-offset-2 hover:underline"
            >
              <InstagramGlyph className="h-4 w-4" />@{env.social.instagramHandle}
            </a>
          </div>

          <nav aria-label="Shop">
            <p className="text-sm font-semibold text-[var(--cream)]">Shop</p>
            <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted-foreground)]">
              <li><Link href="/search" className="hover:text-[var(--cream)]">Browse everything</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--cream)]">All {STORES.length} stores</Link></li>
              <li><Link href="/search?deals=1&sort=deal" className="hover:text-[var(--cream)]">Below market</Link></li>
              <li><Link href="/pedalboard" className="hover:text-[var(--cream)]">Build your pedalboard</Link></li>
              <li><Link href="/alerts" className="hover:text-[var(--cream)]">Price alerts</Link></li>
              <li><Link href="/list-your-shop" className="hover:text-[var(--cream)]">Get your shop listed</Link></li>
            </ul>
          </nav>

          <nav aria-label="Community">
            <p className="text-sm font-semibold text-[var(--cream)]">Community</p>
            <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted-foreground)]">
              <li><Link href="/feed" className="hover:text-[var(--cream)]">The feed</Link></li>
              {BOARDS.map((b) => (
                <li key={b.slug}>
                  <Link href={`/boards/${b.slug}`} className="hover:text-[var(--cream)]">{b.navLabel}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-sm font-semibold text-[var(--cream)]">How this works</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              Gear Avail earns affiliate commission when you buy through an outbound link. That never
              changes your price, and it never changes how listings are ranked: you sort by price,
              discount, how new a listing is, or a shuffle that gives every shop equal footing, and
              what a store pays us is not an input to any of them. No fees, no cut of your sale, no
              exit plan that ends with someone else's shareholders deciding what this costs you.
            </p>
          </div>
        </div>

        <nav aria-label="Categories" className="mt-8 border-t border-[var(--border)] pt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            By category
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--muted-foreground)]">
            {indexableCategories().map(({ slug, label }) => (
              <li key={slug}>
                <Link href={`/used/${slug}`} className="hover:text-[var(--cream)]">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-8 text-xs font-medium text-[var(--amber)]">
          Built by a musician who bought and sold over a thousand pedals the hard way, for the
          musicians doing it now. Not selling out. Not ever.
        </p>

        <p className="mt-4 text-xs text-[var(--muted-foreground)]">
          Prices and availability are captured from marketplace feeds and can change before you
          reach the seller. Always confirm the final price on the marketplace. Gear Avail is not
          affiliated with eBay or Reverb.
        </p>
      </div>
    </footer>
  )
}
