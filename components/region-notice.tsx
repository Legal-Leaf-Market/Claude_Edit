import Link from "next/link"
import { Globe } from "lucide-react"
import { excludedStoreNamesFor, type Region } from "@/lib/regions"

/**
 * "We hid some listings, here is why, here is how to see them."
 *
 * Filtering out stores that cannot deliver to a shopper is the kind thing to
 * do (see lib/regions.ts), but hiding inventory SILENTLY is its own dishonesty
 * on a site whose whole promise is showing everything in one place. So the
 * removal is always stated, the store is always named, and undoing it is one
 * click.
 *
 * Renders nothing when nothing was hidden, which is the common case: only one
 * store currently declares a shipping restriction.
 */
export function RegionNotice({
  region,
  showAllHref,
  className = "",
}: {
  region: Region
  /**
   * Where "show anyway" goes. REQUIRED, and passed in rather than hardcoded,
   * because this component cannot see the shopper's current search.
   *
   * The first version used a bare `href="?ships=all"`, which in Next replaces
   * the entire query string: clicking it threw away the search term and every
   * active filter. Making the caller supply a URL built from the live params
   * is what stops that coming back, since there is no longer a default to
   * quietly fall back to.
   */
  showAllHref: string
  className?: string
}) {
  const hidden = excludedStoreNamesFor(region)
  if (hidden.length === 0) return null

  const names =
    hidden.length === 1
      ? hidden[0]
      : `${hidden.slice(0, -1).join(", ")} and ${hidden[hidden.length - 1]}`

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-xs text-[var(--muted-foreground)] ${className}`}
    >
      <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--dim)]" aria-hidden="true" />
      <span>
        Hiding {names}, which {hidden.length === 1 ? "does" : "do"} not ship to you.
      </span>
      <Link
        href={showAllHref}
        className="font-semibold text-[var(--accent-text)] underline-offset-2 hover:underline"
      >
        Show anyway
      </Link>
    </div>
  )
}

/**
 * The inverse, for a page that is ABOUT a restricted store rather than a list
 * that omits one. A shopper who followed a link to Anderton's from anywhere
 * needs to know before they get attached to a price.
 */
export function ShipsToBadge({ label }: { label: string | null }) {
  if (!label) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chrome-dk)] bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-text)]">
      <Globe className="h-3.5 w-3.5" aria-hidden="true" />
      Ships {label}
    </span>
  )
}
