import Link from "next/link"
import { InstagramGlyph } from "@/components/icons/instagram-glyph"
import { ThemeToggle } from "@/components/theme-toggle"
import { env } from "@/lib/env"
import { footerColumns } from "@/lib/nav"
import { indexableCategories } from "@/lib/categories"
import { STORES } from "@/lib/stores"

/**
 * The footer.
 *
 * Its link columns come from lib/nav.ts, the same tree the masthead reads, so
 * a route can no longer exist in one and not the other. Where the mega menu
 * shows a leading handful and an index link, the footer is exhaustive: every
 * category, every store. A footer is the right place to be complete, and it is
 * a real part of how these pages get crawled.
 *
 * Affiliate disclosure lives here and is deliberately plain. We earn on
 * outbound clicks, and saying so is both an FTC requirement and the honest
 * framing for a site whose entire product is telling you where to buy.
 */
export function SiteFooter() {
  const columns = footerColumns()

  return (
    <footer className="mt-16 border-t border-[var(--line)] bg-[var(--bg2)]">
      <div className="shell py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="font-display text-lg font-bold uppercase tracking-[0.04em] text-[var(--text)]">
              Gear Avail
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted-foreground)]">
              Real-time inventory from independent music gear makers and retailers, all in one
              place. Plus the boards behind the records, and a builder that checks your signal
              chain before you buy the wrong thing.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href={`https://instagram.com/${env.social.instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-text)] underline-offset-2 hover:underline"
              >
                <InstagramGlyph className="h-4 w-4" />@{env.social.instagramHandle}
              </a>
              <ThemeToggle />
            </div>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="eyebrow">{column.title}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted-foreground)]">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-[var(--text)]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <nav aria-label="Categories" className="mt-8 border-t border-[var(--line)] pt-6">
          <p className="eyebrow mb-3">By category</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--muted-foreground)]">
            {indexableCategories().map(({ slug, label }) => (
              <li key={slug}>
                <Link href={`/used/${slug}`} className="hover:text-[var(--text)]">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Stores" className="mt-6 border-t border-[var(--line)] pt-6">
          <p className="eyebrow mb-3">Every store</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--muted-foreground)]">
            {STORES.map((store) => (
              <li key={store.slug}>
                <Link href={`/shop/${store.slug}`} className="hover:text-[var(--text)]">
                  {store.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8 grid gap-6 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">How this works</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              Gear Avail earns affiliate commission when you buy through an outbound link. That
              never changes your price, and it never changes how listings are ranked: you sort by
              price, discount, how new a listing is, or a shuffle that gives every shop equal
              footing, and what a store pays us is not an input to any of them. No fees, no cut of
              your sale, no exit plan that ends with someone else&apos;s shareholders deciding what
              this costs you.
            </p>
          </div>
          <div>
            <p className="eyebrow">The fine print</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              Prices and availability are captured from marketplace feeds and can change before you
              reach the seller. Always confirm the final price on the marketplace. Artist rigs are
              editorial gear history: no artist, band or manufacturer named on this site is
              affiliated with Gear Avail, and nothing here is an endorsement. Gear Avail is not
              affiliated with eBay or Reverb.
            </p>
          </div>
        </div>

        <p className="mt-8 text-xs font-medium text-[var(--accent-text)]">
          Built by a musician who bought and sold over a thousand pedals the hard way, for the
          musicians doing it now. Not selling out. Not ever.
        </p>
      </div>
    </footer>
  )
}
