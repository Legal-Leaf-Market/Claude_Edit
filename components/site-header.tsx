import Link from "next/link"
import { Suspense } from "react"
import { CartBadge } from "./cart-badge"
import { LogoMark } from "./logo-mark"
import { SearchBox } from "./search-box"

const NAV = [
  { href: "/search?deals=1&sort=deal", label: "Deals" },
  { href: "/used/electric-guitars", label: "Guitars" },
  { href: "/used/amplifiers", label: "Amps" },
  { href: "/used/synthesizers", label: "Synths" },
  { href: "/used/recording-audio", label: "Studio" },
  { href: "/feed", label: "Feed" },
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

        <nav aria-label="Gear categories" className="order-2 sm:order-3">
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
