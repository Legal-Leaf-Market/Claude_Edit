/**
 * THE nav tree. The header, the mobile sheet and the footer all read this.
 *
 * One source, because a link added to the header and forgotten in the footer
 * is the most common way a small site starts contradicting itself, and because
 * the sitemap can then be generated from the same list rather than
 * hand-maintained beside it.
 */

export type NavLink = {
  href: string
  label: string
  /** Shown in the footer under the link, and as the title attribute. */
  blurb: string
}

export const NAV: NavLink[] = [
  {
    href: "/pedals",
    label: "Pedals",
    blurb: "What each circuit does to your signal",
  },
  {
    href: "/chain",
    label: "Signal chain",
    blurb: "The conventional order, and the reason behind every position",
  },
  {
    href: "/board",
    label: "Build a board",
    blurb: "Put real pedals on a board, stomp them on and off, send the link",
  },
  {
    href: "/catalog",
    label: "Catalogue",
    blurb: "What each pedal goes for, from our sister site Gear Avail",
  },
  {
    href: "/about",
    label: "About",
    blurb: "What this is, and what it deliberately does not do",
  },
]

/** Every static route, for the sitemap. Pedal pages are appended from the dataset. */
export const STATIC_ROUTES = ["/", ...NAV.map((link) => link.href)]
