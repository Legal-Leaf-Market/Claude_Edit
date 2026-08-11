"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, Menu, X } from "lucide-react"
import { currentSectionId, NAV_SECTIONS, NAV_UTILITY } from "@/lib/nav"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * The phone navigation: a full-height sheet rather than a dropdown.
 *
 * Accordion sections rather than the desktop mega menu, because a three-column
 * panel on a 390px screen is four columns of one word each. Only one section
 * is open at a time, so the whole tree stays reachable by scrolling a short
 * distance instead of a long one, and the section covering the current page
 * starts open so a visitor lands oriented.
 *
 * The sheet also locks body scroll while it is open. Without that, scrolling
 * inside the sheet chains to the page underneath once it hits its end, and the
 * page scrolls away behind the overlay.
 */
export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    setExpanded(currentSectionId(pathname) ?? NAV_SECTIONS[0].id)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)

    // Focus the close button rather than the first link: it is the control a
    // visitor most needs if they opened this by accident, and it puts the tab
    // order at the top of the sheet either way.
    closeRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, pathname])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text)] transition-colors hover:border-[var(--copper)] lg:hidden"
      >
        <Menu className="h-4.5 w-4.5" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="absolute inset-y-0 right-0 flex w-[min(400px,92vw)] flex-col border-l border-[var(--line)] bg-[var(--bg2)] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
              <span className="font-display text-base font-black uppercase tracking-[0.04em] text-[var(--text)]">
                Menu
              </span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <nav aria-label="Main" className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <ul className="space-y-1">
                {NAV_SECTIONS.map((section) => {
                  const isExpanded = expanded === section.id
                  return (
                    <li key={section.id} className="border-b border-[var(--line)] pb-1 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={section.href}
                          className="flex-1 py-3 font-display text-lg font-black text-[var(--text)]"
                        >
                          {section.label}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : section.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${section.label}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)]"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="space-y-4 pb-4">
                          {section.columns.map((column) => (
                            <div key={column.title}>
                              <p className="mega-col-title">{column.title}</p>
                              <ul className="mt-1.5 space-y-0.5">
                                {column.links.map((link) => (
                                  <li key={link.href}>
                                    <Link
                                      href={link.href}
                                      className="block py-1.5 text-sm text-[var(--muted-foreground)]"
                                    >
                                      {link.label}
                                    </Link>
                                  </li>
                                ))}
                                {column.more && (
                                  <li>
                                    <Link
                                      href={column.more.href}
                                      className="block py-1.5 text-sm font-semibold text-[var(--accent-text)]"
                                    >
                                      {column.more.label}
                                    </Link>
                                  </li>
                                )}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              <ul className="mt-6 space-y-1 border-t border-[var(--line)] pt-4">
                {NAV_UTILITY.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block py-2 text-sm font-medium text-[var(--muted-foreground)]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/sign-in" className="block py-2 text-sm font-medium text-[var(--muted-foreground)]">
                    Sign in
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
