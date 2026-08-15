import Link from "next/link"
import { Suspense } from "react"
import { AskButton } from "@/components/ask/ask-button"
import { CartBadge } from "@/components/cart-badge"
import { GearAvailMark, GearAvailWordmark } from "@/components/brand/logo"
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
        {/* Mark, then the drawn wordmark, then the descriptor stacked under
            it, bound by the same hairline the mark silkscreens inside its
            edge. */}
        <Link
          href="/"
          aria-label="Gear Avail, home"
          className="flex shrink-0 items-center gap-[11px] transition-opacity hover:opacity-85"
        >
          <GearAvailMark size={38} />
          <span className="block leading-none">
            <GearAvailWordmark height={17} />
            {/* The rule under the wordmark is the same hairline the mark
                silkscreens inside its edge, which is what binds a square mark
                to a wide wordmark without boxing the whole lockup. */}
            <span className="mt-[5px] hidden border-t border-[color:color-mix(in_srgb,var(--chrome)_38%,transparent)] pt-[3px] font-sans text-[0.56rem] font-semibold uppercase tracking-[0.28em] text-[var(--dim)] sm:block">
              Used &middot; Vintage &middot; New
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
          {/* Always visible, at every width. The control classes sit outside
              @layer, so a Tailwind `hidden` here would lose to .lp's own
              display anyway; the row fits a phone with the search collapsed,
              and a theme switch that is always in the same corner beats one
              that hides (the sister site's header makes the same call). */}
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>

      <div className="hidden lg:block">
        <MainNav />
      </div>
    </header>
  )
}
