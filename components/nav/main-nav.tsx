"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, ArrowRight } from "lucide-react"
import { currentSectionId, NAV_SECTIONS, NAV_UTILITY, type NavColumn } from "@/lib/nav"

/**
 * The masthead's second row: four sections, each opening a mega menu.
 *
 * Three interaction models have to coexist here and they conflict in ways that
 * are easy to get subtly wrong, so they are handled explicitly:
 *
 * POINTER. Open on hover, because a menu that needs a click to open costs a
 * click on every navigation. Closing is delayed by CLOSE_DELAY_MS: the gap
 * between the nav row and the panel is a few pixels of dead space, and closing
 * on the first mouseleave means the panel vanishes while the pointer is
 * travelling towards it. This is the single most common mega-menu bug.
 *
 * KEYBOARD. Enter and Space toggle, Escape closes and returns focus to the
 * trigger, Tab moves through the panel's links normally. Hover is never
 * required to reach anything. The trigger is a real link as well as a toggle,
 * so Enter on it when closed opens the menu and the section index is still
 * reachable from the first link inside.
 *
 * TOUCH. There is no hover on touch, so the first tap must open rather than
 * navigate. onPointerDown checks pointerType and calls preventDefault for
 * touch, which opens the panel and leaves the section index reachable from
 * inside it. Without this, a phone user taps "Shop" and is navigated away
 * before the menu they were reaching for exists. The mobile sheet is the
 * primary path on small screens anyway; this covers tablets and touch laptops
 * where the nav row is visible.
 */

const CLOSE_DELAY_MS = 140

export function MainNav() {
  const pathname = usePathname()
  const [openId, setOpenId] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef<Map<string, HTMLAnchorElement>>(new Map())

  const activeId = currentSectionId(pathname)

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpenId(null), CLOSE_DELAY_MS)
  }, [cancelClose])

  const open = useCallback(
    (id: string) => {
      cancelClose()
      setOpenId(id)
    },
    [cancelClose],
  )

  // Any navigation closes the menu. Without this, clicking a link inside a
  // panel leaves it hanging open over the page that just loaded, because the
  // pointer never left the panel and no mouseleave ever fires.
  useEffect(() => {
    setOpenId(null)
  }, [pathname])

  useEffect(() => () => cancelClose(), [cancelClose])

  // Escape closes from anywhere in the panel and puts focus back where it was.
  useEffect(() => {
    if (!openId) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      const id = openId
      setOpenId(null)
      if (id) triggerRefs.current.get(id)?.focus()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [openId])

  /**
   * Close when focus leaves the whole nav row, which is what makes tabbing
   * off the end of a panel behave. relatedTarget is null when focus goes to
   * the document itself (clicking dead space, or leaving the window), and in
   * that case closing is also right.
   */
  function onBlurCapture(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null
    if (next && rowRef.current?.contains(next)) return
    setOpenId(null)
  }

  return (
    <div
      ref={rowRef}
      className="masthead-nav-row relative"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
      onBlurCapture={onBlurCapture}
    >
      <div className="shell flex items-center justify-between gap-6">
        <nav aria-label="Main">
          <ul className="flex items-center gap-6">
            {NAV_SECTIONS.map((section) => {
              const isOpen = openId === section.id
              return (
                <li key={section.id} onMouseEnter={() => open(section.id)}>
                  <Link
                    ref={(node) => {
                      if (node) triggerRefs.current.set(section.id, node)
                      else triggerRefs.current.delete(section.id)
                    }}
                    href={section.href}
                    className="navlink"
                    data-open={isOpen}
                    data-current={activeId === section.id}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    onFocus={() => open(section.id)}
                    onPointerDown={(event) => {
                      if (event.pointerType !== "touch") return
                      event.preventDefault()
                      setOpenId(isOpen ? null : section.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowDown") return
                      event.preventDefault()
                      open(section.id)
                    }}
                  >
                    {section.label}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Secondary destinations. Real pages that do not need a whole panel,
            and the two that are the site's own asks. */}
        <ul className="hidden items-center gap-5 lg:flex">
          {NAV_UTILITY.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="text-[0.8rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--text)]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {NAV_SECTIONS.map((section) =>
        openId === section.id ? (
          <div key={section.id} className="megamenu" onMouseEnter={cancelClose}>
            <div className="shell grid gap-8 py-7 lg:grid-cols-[1fr_auto]">
              <div
                className="grid gap-8"
                style={{
                  gridTemplateColumns: `repeat(${section.columns.length}, minmax(0, 1fr))`,
                }}
              >
                {section.columns.map((column) => (
                  <MegaColumn key={column.title} column={column} />
                ))}
              </div>

              {section.feature && (
                <aside className="panel max-w-xs self-start p-5">
                  <p className="font-display text-base font-black text-[var(--text)]">
                    {section.feature.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {section.feature.body}
                  </p>
                  <Link
                    href={section.feature.href}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
                  >
                    {section.feature.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </aside>
              )}
            </div>
          </div>
        ) : null,
      )}
    </div>
  )
}

function MegaColumn({ column }: { column: NavColumn }) {
  return (
    <div>
      <p className="mega-col-title">{column.title}</p>
      <ul
        className={`mt-3 ${column.wide ? "grid grid-cols-2 gap-x-5" : ""}`}
      >
        {column.links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="mega-link">
              <span className="min-w-0">
                <span className="label">{link.label}</span>
                {link.hint && <span className="hint">{link.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {column.more && (
        <Link
          href={column.more.href}
          className="mt-3 inline-flex items-center gap-1.5 border-t border-[var(--line)] pt-3 text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
        >
          {column.more.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}
