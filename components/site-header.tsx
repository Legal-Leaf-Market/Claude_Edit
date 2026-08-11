import Link from "next/link"
import { Suspense } from "react"
import { AskButton } from "@/components/ask/ask-button"
import { CartBadge } from "@/components/cart-badge"
import { LogoMark } from "@/components/logo-mark"
import { MainNav } from "@/components/nav/main-nav"
import { MobileNav } from "@/components/nav/mobile-nav"
import { SearchBox } from "@/components/search-box"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * The masthead.
 *
 * Two rows, and the split is the whole point of the redesign. The old header
 * put the wordmark, the search field, four nav links and the cart on one line,
 * which meant the nav had room for four items and nothing else. Eleven store
 * pages and six of the seven community boards were unreachable without typing
 * a URL, and the fix kept being "add another link", which the one row could
 * not absorb.
 *
 * So: row one is identity and tools (mark, search, ask, cart, theme), row two
 * is navigation and nothing else. Navigation now has a full row to itself and
 * opens into mega menus (components/nav/main-nav.tsx), which is what lets a
 * visitor reach every category, every store, every board and every rig by
 * following the nav rather than by knowing the page exists.
 *
 * Below the lg breakpoint the nav row is replaced by the sheet in
 * components/nav/mobile-nav.tsx. A mega menu on a phone is a bad joke.
 */
export function SiteHeader() {
  return (
    <header className="masthead">
      <div className="shell flex items-center gap-3 py-3 sm:gap-4">
        {/* Mark, then display wordmark, then an italic script tagline stacked
            under it. Every sister carries one, and it is where the Cormorant
            italic first appears. */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-[11px] transition-opacity hover:opacity-85"
        >
          <LogoMark />
          <span className="block leading-none">
            <span className="block font-display text-[1.24rem] font-black uppercase tracking-[0.04em] text-[var(--text)]">
              Gear Avail
            </span>
            <span className="mt-px hidden font-script text-[0.74rem] font-semibold uppercase italic tracking-[0.16em] text-[var(--accent-text)] sm:block">
              Used, vintage and new
            </span>
          </span>
        </Link>

        {/* Search takes the whole middle. It is the primary action on an
            aggregator and it now has the width to look like it. The Suspense
            boundary is required, not decorative: SearchBox reads
            useSearchParams and the header renders on every route including
            the statically prerendered ones. */}
        <div className="min-w-0 flex-1">
          <Suspense
            fallback={
              <div className="h-[42px] rounded-full border border-[var(--line)] bg-[var(--panel2)]" />
            }
          >
            <SearchBox />
          </Suspense>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <AskButton />
          <CartBadge />
          <ThemeToggle className="hidden sm:flex" />
          <MobileNav />
        </div>
      </div>

      <div className="hidden lg:block">
        <MainNav />
      </div>
    </header>
  )
}
