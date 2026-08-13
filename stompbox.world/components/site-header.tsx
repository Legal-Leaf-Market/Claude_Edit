import Link from "next/link"
import { StompboxLogo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { NAV } from "@/lib/nav"

/**
 * The masthead. One row, because this site has three destinations and a
 * two-row header on a three-page site is furniture.
 *
 * The nav is not collapsed into a hamburger on mobile. Three short labels fit
 * across a phone, and a sheet that has to be opened to discover three links is
 * strictly worse than three links.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
      <div className="shell flex h-[var(--header-h)] items-center justify-between gap-4">
        <Link href="/" className="shrink-0" aria-label="stompbox.world, home">
          <StompboxLogo size={34} />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              title={link.blurb}
              className="rounded-full px-3 py-2 text-[0.82rem] font-semibold text-[var(--dim)] transition-colors hover:text-[var(--text)] sm:text-sm"
            >
              {link.label}
            </Link>
          ))}
          <span className="ml-1 sm:ml-2">
            <ThemeToggle />
          </span>
        </nav>
      </div>
    </header>
  )
}
