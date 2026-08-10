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
    /*
     * The family masthead: sticky, saturated blur, and a 2px accent underline
     * carrying the site's own hue. The underline plus its warm glow is what
     * makes the header read as a masthead rather than as content that happens
     * to be pinned, and all four sites share the construction.
     */
    <header
      className="sticky top-0 z-40 border-b-2 border-[var(--copper)]"
      style={{
        background: "linear-gradient(180deg, rgba(10,8,6,.98), rgba(10,8,6,.94))",
        backdropFilter: "blur(16px) saturate(1.5)",
        WebkitBackdropFilter: "blur(16px) saturate(1.5)",
        boxShadow: "0 2px 24px rgba(210,112,58,.18)",
      }}
    >
      <div className="shell flex flex-wrap items-center gap-x-5 gap-y-3 py-3">
        {/* Mark, then display wordmark, then an italic script tagline stacked
            under it. The tagline is the piece that was missing: every sister
            carries one, and it is where the Cormorant italic first appears. */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-[11px] transition-opacity hover:opacity-85"
        >
          <LogoMark />
          <span className="block leading-none">
            <span className="block font-display text-[1.24rem] font-black uppercase tracking-[0.04em] text-[var(--cream)]">
              Gear Avail
            </span>
            <span className="mt-px hidden font-script text-[0.74rem] font-semibold uppercase italic tracking-[0.16em] text-[var(--copper)] sm:block">
              Used, vintage and new
            </span>
          </span>
        </Link>

        {/* Search sits before the nav in source order: it is the primary action.
            The Suspense boundary is required, not decorative: SearchBox reads
            useSearchParams, and the header renders on every route including the
            statically prerendered ones. */}
        <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1">
          <Suspense
            fallback={
              <div className="h-[42px] rounded-full border border-[var(--line)] bg-[var(--panel2)]" />
            }
          >
            <SearchBox />
          </Suspense>
        </div>

        <nav aria-label="Main" className="order-2 sm:order-3">
          <ul className="flex items-center gap-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="pill">
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
