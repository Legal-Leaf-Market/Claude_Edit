import Link from "next/link"
import { StompboxLogo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { NAV } from "@/lib/nav"

/**
 * The masthead. One row, because a two-row header on a site this size is
 * furniture.
 *
 * STILL NO HAMBURGER, and the reasoning has been revised rather than kept. It
 * used to say that three short labels fit across a phone and that a sheet you
 * have to open to discover three links is worse than three links. The first
 * half stopped being true when the catalogue arrived: four labels, one of them
 * two words, ran off the side of a phone and pushed the theme toggle past the
 * edge where it could not be reached at all. The second half is still true, so
 * the links stay visible and the ROW scrolls instead.
 *
 * The toggle sits outside the scroller deliberately. A control that can be
 * scrolled out of reach on the one screen size where it is hardest to find is
 * worse than a control that is always in the same corner.
 *
 * The descriptor under the wordmark is dropped below `sm`, which buys back
 * roughly the width of one nav label without losing the mark.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
      <div className="shell flex h-[var(--header-h)] items-center gap-2 sm:gap-4">
        <Link href="/" className="shrink-0" aria-label="stompbox.world, home">
          <span className="hidden sm:inline-flex">
            <StompboxLogo size={34} />
          </span>
          <span className="inline-flex sm:hidden">
            <StompboxLogo size={30} showDescriptor={false} />
          </span>
        </Link>

        {/*
          ml-auto rather than flex-1 with justify-end. An overflowing flex row
          that is end-justified clips its FIRST items and they cannot be
          scrolled back to, which hid Pedals completely on a phone. Sizing the
          row by its content and pushing it right with an auto margin keeps it
          right-aligned when it fits and scrolls from the start when it does not.
        */}
        <nav
          className="nav-rail ml-auto flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2"
          aria-label="Main"
        >
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              title={link.blurb}
              className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-[0.82rem] font-semibold text-[var(--dim)] transition-colors hover:text-[var(--text)] sm:px-3 sm:text-sm"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <span className="shrink-0">
          <ThemeToggle />
        </span>
      </div>
    </header>
  )
}
