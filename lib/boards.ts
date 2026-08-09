import type { BoardKind } from "@/lib/db/schema"

export type BoardCategoryOption = { value: string; label: string }

/**
 * One config per board `kind` (see lib/db/schema.ts's flipThreads.kind
 * comment for why they all share one table). Every board reuses the same
 * post-plus-public-replies mechanics; everything that differs between them
 * -- copy, category choices, whether a price field even makes sense -- lives
 * here, not duplicated across page files.
 */
export type BoardConfig = {
  kind: BoardKind
  slug: string
  navLabel: string
  title: string
  tagline: string
  description: string
  categories: BoardCategoryOption[]
  defaultCategory: string
  showPrice: boolean
  /**
   * Whether to offer a Patreon field. Only on the boards where the poster is
   * building an ongoing audience (teaching, playing shows, building gear);
   * on a one-off flip it is noise. Convenience for the poster, not a revenue
   * channel: Gear Avail takes nothing from it.
   */
  showPatreon: boolean
  priceLabel: string
  pricePlaceholder: string
  postCtaLabel: string
  postButtonLabel: string
  closeButtonLabel: string
  closedCopy: string
  emptyBoardCopy: string
  itemNounPlural: string
}

export const BOARDS: BoardConfig[] = [
  {
    kind: "flip",
    slug: "flip-match",
    navLabel: "Flip Match",
    title: "Flip Match",
    tagline: "Flipper enablement, not a marketplace",
    description:
      "Post what you're flipping. Whoever's interested replies right here, in the open, old-school forum style: no DMs, no algorithm deciding who sees it. We never take a fee and never touch the sale itself; that happens between the two of you once you connect.",
    categories: [
      { value: "pedals", label: "Pedals" },
      { value: "guitars", label: "Guitars" },
      { value: "amps", label: "Amps" },
      { value: "recording", label: "Recording gear" },
      { value: "drums", label: "Drums" },
      { value: "other", label: "Other" },
    ],
    defaultCategory: "other",
    showPrice: true,
    showPatreon: false,
    priceLabel: "Asking (optional)",
    pricePlaceholder: "Make an offer",
    postCtaLabel: "What are you flipping",
    postButtonLabel: "Post it",
    closeButtonLabel: "Mark as flipped / take it down",
    closedCopy: "This post is closed. It's already flipped or off the table.",
    emptyBoardCopy: "Nothing posted yet. Be the first to flip something here.",
    itemNounPlural: "posts",
  },
  {
    kind: "wanted",
    slug: "wanted",
    navLabel: "Wanted",
    title: "Wanted",
    tagline: "Post what you're hunting for",
    description:
      "Can't find it on the storefronts? Post what you're after and let someone with one in a closet reply. Same rules as Flip Match: public thread, no fee, the actual handoff happens between the two of you.",
    categories: [
      { value: "pedals", label: "Pedals" },
      { value: "guitars", label: "Guitars" },
      { value: "amps", label: "Amps" },
      { value: "recording", label: "Recording gear" },
      { value: "drums", label: "Drums" },
      { value: "other", label: "Other" },
    ],
    defaultCategory: "other",
    showPrice: true,
    showPatreon: false,
    priceLabel: "Budget (optional)",
    pricePlaceholder: "Flexible",
    postCtaLabel: "What are you hunting for",
    postButtonLabel: "Post it",
    closeButtonLabel: "Mark as found / take it down",
    closedCopy: "This one's found. No longer looking.",
    emptyBoardCopy: "Nothing posted yet. Be the first to post what you're after.",
    itemNounPlural: "wanted posts",
  },
  {
    kind: "bandmates",
    slug: "bandmates",
    navLabel: "Bandmates",
    title: "Bandmates",
    tagline: "Find people to actually play with",
    description:
      "Looking for a drummer, a singer, someone to jam with on weekends? Post it here. Public replies, no DMs, and no vetting from us: you're arranging with a stranger on the internet, so use the same judgment you would anywhere else.",
    categories: [
      { value: "looking-for", label: "Looking for a musician" },
      { value: "available", label: "Available to join a band" },
      { value: "jam", label: "Casual jam / practice" },
      { value: "other", label: "Other" },
    ],
    defaultCategory: "looking-for",
    showPrice: false,
    showPatreon: true,
    priceLabel: "",
    pricePlaceholder: "",
    postCtaLabel: "What are you looking for",
    postButtonLabel: "Post it",
    closeButtonLabel: "Mark as filled / take it down",
    closedCopy: "This one's filled.",
    emptyBoardCopy: "Nothing posted yet. Be the first to look for bandmates here.",
    itemNounPlural: "posts",
  },
  {
    kind: "lessons",
    slug: "lessons",
    navLabel: "Lessons",
    title: "Lessons",
    tagline: "Learn from, or teach, a real musician",
    description:
      "Independent teachers post what they teach; players post what they want to learn. Public replies, no booking system, no cut of what changes hands: you work out the rate, the schedule, and the format directly with each other.",
    categories: [
      { value: "guitar", label: "Guitar" },
      { value: "bass", label: "Bass" },
      { value: "drums", label: "Drums" },
      { value: "vocals", label: "Vocals" },
      { value: "production", label: "Production / recording" },
      { value: "other", label: "Other instrument" },
    ],
    defaultCategory: "other",
    showPrice: true,
    showPatreon: true,
    priceLabel: "Rate (optional)",
    pricePlaceholder: "Per lesson",
    postCtaLabel: "What are you teaching or want to learn",
    postButtonLabel: "Post it",
    closeButtonLabel: "Mark as booked / take it down",
    closedCopy: "This one's booked up.",
    emptyBoardCopy: "Nothing posted yet. Be the first to offer or look for lessons.",
    itemNounPlural: "posts",
  },
  {
    kind: "shows",
    slug: "shows",
    navLabel: "Shows",
    title: "Local Shows",
    tagline: "Who's playing, and where",
    description:
      "Post a show you're playing, promoting, or just want people to know about. No ticketing here, just word of mouth in the open: public replies, no DMs, no fee.",
    categories: [
      { value: "playing", label: "I'm playing this show" },
      { value: "promoting", label: "Promoting / open mic / venue" },
      { value: "other", label: "Other" },
    ],
    defaultCategory: "playing",
    showPrice: false,
    showPatreon: true,
    priceLabel: "",
    pricePlaceholder: "",
    postCtaLabel: "What's the show",
    postButtonLabel: "Post it",
    closeButtonLabel: "Mark as past / take it down",
    closedCopy: "This show's passed.",
    emptyBoardCopy: "Nothing posted yet. Be the first to post a show.",
    itemNounPlural: "shows",
  },
  {
    kind: "free",
    slug: "free-gear",
    navLabel: "Free Gear",
    title: "Free Gear",
    tagline: "Zero price, pure goodwill",
    description:
      "Giving something away, no strings attached. Same public-thread rules as everywhere else here: whoever wants it replies, you two work out the pickup.",
    categories: [
      { value: "pedals", label: "Pedals" },
      { value: "guitars", label: "Guitars" },
      { value: "amps", label: "Amps" },
      { value: "accessories", label: "Cables, straps, parts" },
      { value: "other", label: "Other" },
    ],
    defaultCategory: "other",
    showPrice: false,
    showPatreon: false,
    priceLabel: "",
    pricePlaceholder: "",
    postCtaLabel: "What are you giving away",
    postButtonLabel: "Post it",
    closeButtonLabel: "Mark as gone / take it down",
    closedCopy: "This one's gone. Nice.",
    emptyBoardCopy: "Nothing posted yet. Be the first to give something away.",
    itemNounPlural: "posts",
  },
  {
    kind: "studio",
    slug: "studio-swap",
    navLabel: "Studio Swap",
    title: "Studio Swap",
    tagline: "Rehearsal and studio time, peer to peer",
    description:
      "Got a home studio or rehearsal space sitting empty some hours? Post it. Need time in one? Post that instead. Public replies, no booking fee, no cut.",
    categories: [
      { value: "offering", label: "Offering space/time" },
      { value: "looking-for", label: "Looking for space/time" },
    ],
    defaultCategory: "offering",
    showPrice: true,
    showPatreon: true,
    priceLabel: "Rate (optional)",
    pricePlaceholder: "Per hour/session",
    postCtaLabel: "What's the space",
    postButtonLabel: "Post it",
    closeButtonLabel: "Mark as taken / take it down",
    closedCopy: "This one's taken.",
    emptyBoardCopy: "Nothing posted yet. Be the first to post here.",
    itemNounPlural: "posts",
  },
]

export const BOARD_BY_SLUG = new Map<string, BoardConfig>(BOARDS.map((b) => [b.slug, b]))
export const BOARD_BY_KIND = new Map<BoardKind, BoardConfig>(BOARDS.map((b) => [b.kind, b]))

export function boardFromSlug(slug: string): BoardConfig | null {
  return BOARD_BY_SLUG.get(slug) ?? null
}
