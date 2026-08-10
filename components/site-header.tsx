import Link from "next/link"
import { Suspense } from "react"
import { CartBadge } from "./cart-badge"
import { LogoMark } from "./logo-mark"
import { SearchBox } from "./search-box"

/**
 * Primary navigation.
 *
 * Named for the two halves of the site rather than for five arbitrary
 * categories. The previous version listed Guitars/Amps/Synths/Studio plus a
 * lone Feed link, which meant the eleven store pages were unreachable without
 * typing a URL and six of the seven community boards were invisible.
 *
 * Each entry now points at an index that branches, so a visitor can find
 * everything by following the nav rather than by knowing it exists:
 *   Browse     -> /search, every listing with filters
 *   Stores     -> /shop, the eleven storefronts
 *   Deals      -> below-market listings
 *   Community  -> /feed, which lists all seven boards
 * Categories moved to the homepage mesh and the footer, where a long list
 * costs nothing.
 */
const NAV = [
  { href: "/search", label: "Browse" },
  { href: "/shop", label: "Stores" },
  { href: "/search?deals=1&sort=deal", label: "Deals" },
  { href: "/feed", label: "Community" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#0f0c0a]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[var(--amber)] transition-opacity hover:opacity-85"
        >
          <LogoMark />
          <span className="text-lg font-semibold tracking-tight text-[var(--cream)]">
            Gear<span className="text-[var(--amber)]">Avail</span>
          </span>
        </Link>

        {/* Search sits before the nav in source order: it is the primary action.
            The Suspense boundary is required, not decorative: SearchBox reads
            useSearchParams, and the header renders on every route including the
            statically prerendered ones. */}
        <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1">
          <Suspense fallback={<div className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)]" />}>
            <SearchBox />
          </Suspense>
        </div>

        <nav aria-label="Main" className="order-2 sm:order-3">
          <ul className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-lg px-2.5 py-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--cream)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <CartBadge />
      </div>
    </header>
  )
}
