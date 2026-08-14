import { BOARDS } from "@/lib/boards"
import { indexableCategories } from "@/lib/categories"
import { FEATURED_RIG_SLUGS, rigsByEffectFamily, RIGS } from "@/lib/rigs"
import { PARTNERS } from "@/lib/partners"
import { STORES } from "@/lib/stores"

/**
 * The navigation tree, in one place.
 *
 * The previous header hand-listed four links and the footer hand-listed a
 * different set, which is how /pedalboard ended up in the footer but not the
 * nav, and how three category links 404ed for a while after a slug rename.
 * Everything that renders navigation now derives from this file, so a route
 * added here appears in the masthead, the mobile sheet and the footer at
 * once, and cannot appear in only one of them.
 *
 * Shape: four top-level sections, each with two or three columns of links.
 * Three to five columns of seven to nine links is the size a mega menu stays
 * scannable at; past that it stops being navigation and becomes a sitemap
 * printed on the page. Where a section has more entries than that (fifteen
 * categories, nineteen sources, twenty-odd rigs) the panel shows the ones
 * worth leading with and ends in a link to the full index.
 */

export type NavLink = {
  href: string
  label: string
  /** One line of context, shown in the mega menu only. Optional by design: a category name explains itself. */
  hint?: string
}

export type NavColumn = {
  title: string
  links: NavLink[]
  /** Rendered at the foot of the column, visually separated. The "see everything" escape hatch. */
  more?: NavLink
  /** Lay this column's links out in two sub-columns. For the long category list. */
  wide?: boolean
}

export type NavSection = {
  /** Stable id, used as the React key and for the open/closed state machine. */
  id: string
  label: string
  /** Where the label itself goes. Every section header is a real page, never a dead toggle. */
  href: string
  /** Any pathname starting with one of these marks the section as current. */
  match: string[]
  columns: NavColumn[]
  /** Optional pitch shown down the side of the panel. */
  feature?: { title: string; body: string; href: string; cta: string }
}

const categories = indexableCategories()

/**
 * Shopping intents, not filters. A shopper thinks "what is cheap right now",
 * not "sort=deal&deals=1", and these are the four or five of those worth
 * putting one click from every page.
 */
const QUICK_PICKS: NavLink[] = [
  {
    href: "/search?deals=1&sort=deal",
    label: "Below market",
    hint: "Listings more than 20% under our measured median",
  },
  { href: "/search?sort=newest", label: "Just listed", hint: "Newest across every feed" },
  {
    href: "/search?maxPrice=100&sort=price_asc",
    label: "Under $100",
    hint: "Pedals, parts and accessories",
  },
  {
    href: "/search?shipping=local",
    label: "Local pickup",
    hint: "Skip shipping on the heavy stuff",
  },
  {
    href: "/search?sort=shuffle",
    label: "Shuffle the shops",
    hint: "Equal footing, no ranking by payout",
  },
]

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "shop",
    label: "Shop",
    href: "/search",
    match: ["/search", "/used", "/gear", "/deals", "/shop"],
    columns: [
      {
        title: "By category",
        wide: true,
        links: categories.map((c) => ({ href: `/used/${c.slug}`, label: c.label })),
        more: { href: "/search", label: "Browse everything" },
      },
      {
        title: "Ways in",
        links: QUICK_PICKS,
        more: { href: "/alerts", label: "Save a price alert" },
      },
      {
        title: "By store",
        links: STORES.slice(0, 7).map((s) => ({
          href: `/shop/${s.slug}`,
          label: s.name,
          hint: s.tagline,
        })),
        more: { href: "/shop", label: `All ${STORES.length} stores` },
      },
    ],
  },

  {
    id: "rigs",
    label: "Rigs",
    href: "/rigs",
    match: ["/rigs"],
    columns: [
      {
        title: "Players",
        links: FEATURED_RIG_SLUGS.map((slug) => {
          const rig = RIGS.find((r) => r.slug === slug)
          return {
            href: `/rigs/${slug}`,
            label: rig?.name ?? slug,
            hint: rig?.context,
          }
        }),
        more: { href: "/rigs", label: `All ${RIGS.length} rigs` },
      },
      {
        title: "By sound",
        links: rigsByEffectFamily().map((f) => ({
          href: `/rigs?effect=${f.slug}`,
          label: f.label,
          hint: `${f.count} ${f.count === 1 ? "rig" : "rigs"}`,
        })),
      },
      {
        title: "By record",
        links: [
          { href: "/rigs?view=records", label: "Every album and track", hint: "What was played on what" },
          { href: "/rigs?decade=1960s", label: "The 60s and 70s", hint: "Fuzz, wah and treble boosters" },
          { href: "/rigs?decade=1990s", label: "The 90s", hint: "Big Muffs, shoegaze and grunge" },
          { href: "/rigs?decade=2000s", label: "2000s onward", hint: "Loopers, pitch shifters, boutique" },
        ],
      },
    ],
    feature: {
      title: "Start from a real board",
      body: "Load any of these rigs straight into the builder, then swap each pedal for whatever is actually in stock today.",
      href: "/pedalboard",
      cta: "Open the rig builder",
    },
  },

  {
    id: "build",
    label: "Build",
    href: "/pedalboard",
    // The rig room is a view of a board rather than a place to build one, so
    // it lives under Build and never replaces /pedalboard in the section href.
    match: ["/pedalboard", "/rig-room"],
    columns: [
      {
        title: "The rig builder",
        links: [
          { href: "/pedalboard", label: "Start an empty board", hint: "Search the live catalogue and chain it up" },
          {
            href: "/pedalboard?preset=starter",
            label: "The starter board",
            hint: "Tuner, drive, delay, reverb: the four that cover most of it",
          },
          {
            href: "/rigs",
            label: "Load a famous rig",
            hint: "Twenty documented boards to build from",
          },
        ],
      },
      {
        title: "What it checks",
        links: [
          { href: "/pedalboard#chain", label: "Signal chain order", hint: "Flags anything running out of the usual order" },
          { href: "/pedalboard#power", label: "Power draw", hint: "Estimated total mA and how many isolated outputs" },
          { href: "/pedalboard#cost", label: "What it costs", hint: "Live prices per pedal across every store we track" },
          { href: "/rig-room", label: "See it in three dimensions", hint: "Turn the board around. The planner stays where it is" },
        ],
      },
    ],
  },

  {
    id: "community",
    label: "Community",
    href: "/feed",
    match: ["/feed", "/boards", "/flip-match", "/posts", "/partners"],
    columns: [
      {
        title: "The boards",
        links: BOARDS.map((b) => ({
          href: `/boards/${b.slug}`,
          label: b.navLabel,
          hint: b.tagline,
        })),
        more: { href: "/feed", label: "Everything, newest first" },
      },
      {
        title: "Taking part",
        links: [
          { href: "/sign-up", label: "Make an account", hint: "Needed to post, not to read" },
          { href: "/alerts", label: "Price alerts", hint: "Email or Discord when something drops" },
          { href: "/list-your-shop", label: "Get your shop listed", hint: "For owners, and for customers referring one" },
        ],
      },
      /*
       * The two partners live under Community rather than Shop, and that is
       * the honest filing. Shop means the catalogue: real stock, a price, a
       * median to measure it against. Software instruments and a distribution
       * subscription are none of those things, and putting them under Shop
       * would imply a comparison that does not exist.
       */
      {
        title: "Software and services",
        links: PARTNERS.map((partner) => ({
          href: `/partners/${partner.slug}`,
          label: partner.name,
          hint: partner.kind,
        })),
        more: { href: "/partners", label: "Why these are not in the catalogue" },
      },
    ],
  },

  /*
   * ONE MERCHANT WITH ITS OWN SECTION, and why that is not the ranking by
   * payout this site promises never to do.
   *
   * The test is what would happen if Anderton's paid nothing: this section
   * would still be here, because both facts behind it would still hold. It is
   * far and away the largest catalogue on the site, and it ships to the UK
   * ONLY, which means every other surface here HIDES it from most visitors
   * under section 15. Regional hiding is honest but lossy, and the visitor it
   * costs most is the UK shopper, who is exactly the person it was never
   * meant to affect. This section is that repair.
   *
   * Nothing under it reads the sixteen brands Anderton's pays 4% on. Rig
   * ordering is stock coverage and the channel panel is counted from what got
   * talked about.
   */
  {
    id: "uk",
    label: "UK",
    href: "/uk",
    match: ["/uk"],
    columns: [
      {
        title: "Anderton's",
        links: [
          { href: "/uk", label: "The UK section", hint: "Why this exists, and what is in it" },
          { href: "/shop/andertons", label: "The whole catalogue", hint: "Around 27,000 products, priced in pounds" },
          { href: "/uk/rigs", label: "Rigs you can build here", hint: "Documented boards, crossed against live stock" },
        ],
        more: { href: "/shop", label: "Every store" },
      },
      {
        title: "Build a board",
        links: [
          { href: "/pedalboard", label: "The planner", hint: "Chain order, power draw and cable count" },
          { href: "/rigs", label: "Every artist rig", hint: "All stores, not only the UK" },
        ],
      },
    ],
    feature: {
      title: "Ships to the UK only",
      body: "Anderton's deliver within the United Kingdom, so search hides them from everyone else by default. Nothing here is hidden from you.",
      href: "/uk",
      cta: "Open the section",
    },
  },
]

/**
 * Secondary masthead links, right-aligned on the nav row. Real destinations
 * that do not deserve a whole mega menu, and the two that are the site's own
 * asks (alerts, and getting more shops on board).
 */
export const NAV_UTILITY: NavLink[] = [
  { href: "/search?deals=1&sort=deal", label: "Below market" },
  { href: "/alerts", label: "Alerts" },
  { href: "/list-your-shop", label: "List your shop" },
]

/** Which section, if any, owns this pathname. Drives the current-page underline. */
export function currentSectionId(pathname: string): string | null {
  for (const section of NAV_SECTIONS) {
    if (section.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return section.id
    }
  }
  return null
}

/**
 * The footer's own columns, derived from the same tree.
 *
 * Deliberately flattened rather than reusing NAV_SECTIONS verbatim: a footer
 * is a place to be exhaustive, so it takes every category and every board,
 * where the mega menu takes the leading handful and a link to the index.
 */
export function footerColumns(): NavColumn[] {
  return [
    {
      title: "Shop",
      links: [
        { href: "/search", label: "Browse everything" },
        { href: "/search?deals=1&sort=deal", label: "Below market" },
        { href: "/search?sort=newest", label: "Just listed" },
        { href: "/shop", label: `All ${STORES.length} stores` },
        { href: "/alerts", label: "Price alerts" },
        { href: "/cart", label: "Your cart" },
      ],
    },
    {
      title: "Rigs and tools",
      links: [
        { href: "/rigs", label: "Artist rigs" },
        { href: "/rigs?view=records", label: "By album and track" },
        { href: "/pedalboard", label: "Rig builder" },
        { href: "/pedalboard?preset=starter", label: "The starter board" },
      ],
    },
    {
      title: "Community",
      links: [
        { href: "/feed", label: "The feed" },
        ...BOARDS.map((b) => ({ href: `/boards/${b.slug}`, label: b.navLabel })),
        // Labelled here as what they are, for the same reason the pages
        // themselves are: they are not part of the catalogue and the footer is
        // the wrong place to be coy about it.
        ...PARTNERS.map((p) => ({ href: `/partners/${p.slug}`, label: p.name })),
      ],
    },
  ]
}
