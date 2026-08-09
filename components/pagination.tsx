import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * Server-rendered pagination.
 *
 * Real <a> links rather than buttons: every page of results is its own
 * crawlable URL, which is the point of a programmatic-SEO site.
 */
export function Pagination({
  page,
  perPage,
  found,
  buildHref,
}: {
  page: number
  perPage: number
  found: number
  buildHref: (page: number) => string
}) {
  const lastPage = Math.max(1, Math.ceil(found / perPage))
  if (lastPage <= 1) return null

  // A compact window around the current page, always including first and last.
  const window = new Set<number>([1, lastPage, page - 1, page, page + 1])
  const pages = [...window].filter((p) => p >= 1 && p <= lastPage).sort((a, b) => a - b)

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link
          href={buildHref(page - 1)}
          rel="prev"
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--cream)] hover:bg-[var(--secondary)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </Link>
      )}

      {pages.map((p, index) => {
        const previous = pages[index - 1]
        const gap = previous !== undefined && p - previous > 1
        return (
          <span key={p} className="flex items-center gap-1">
            {gap && <span className="px-1 text-[var(--muted-foreground)]">...</span>}
            <Link
              href={buildHref(p)}
              aria-current={p === page ? "page" : undefined}
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm transition-colors ${
                p === page
                  ? "bg-[var(--primary)] font-medium text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] text-[var(--cream)] hover:bg-[var(--secondary)]"
              }`}
            >
              {p}
            </Link>
          </span>
        )
      })}

      {page < lastPage && (
        <Link
          href={buildHref(page + 1)}
          rel="next"
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--cream)] hover:bg-[var(--secondary)]"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  )
}
