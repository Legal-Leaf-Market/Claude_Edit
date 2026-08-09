"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Newspaper } from "lucide-react"

// Basic, auto-hiding site toolbar. It sits fixed to the bottom of the
// viewport like a mobile app tab bar and doubles as the site's top-level
// navigation (Home / Articles). It stays tucked away near the very top of a
// page, then floats into view once you scroll — hiding again as you scroll
// down and reappearing as you scroll back up or approach the bottom of the
// page, so it never fights with the page's own header or content.
const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/articles", label: "Articles", icon: Newspaper },
]

export function FloatingToolbar() {
  const [visible, setVisible] = useState(false)
  const lastY = useRef(0)
  const ticking = useRef(false)
  const pathname = usePathname()

  useEffect(() => {
    lastY.current = window.scrollY

    const update = () => {
      const y = window.scrollY
      const nearBottom =
        y + window.innerHeight >= document.documentElement.scrollHeight - 160
      const scrolledUp = y < lastY.current - 4
      const scrolledDown = y > lastY.current + 4

      if (y < 40) {
        setVisible(false)
      } else if (nearBottom || scrolledUp) {
        setVisible(true)
      } else if (scrolledDown) {
        setVisible(false)
      }

      lastY.current = y
      ticking.current = false
    }

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(update)
        ticking.current = true
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav
      aria-label="Site navigation"
      className={`fixed inset-x-0 bottom-0 z-[60] mx-auto flex w-full max-w-sm items-stretch gap-1 border border-gold/25 bg-navy/95 px-2 py-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-300 ease-out sm:bottom-4 sm:rounded-2xl ${
        visible ? "translate-y-0" : "translate-y-[calc(100%+1rem)]"
      }`}
    >
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[0.65rem] font-black uppercase tracking-wide transition ${
              active ? "bg-white/10 text-lime" : "text-mint/80 hover:text-mint"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
