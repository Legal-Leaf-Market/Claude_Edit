import { itemFromGuide, MAX_ITEMS, type BoardItem, type CatalogInput } from "@/lib/board/model"
import { itemFromCatalog } from "@/lib/board/model"
import { pedalBySlug } from "@/lib/stompbox/pedals"

/**
 * A board in a URL.
 *
 * Pedal players swap things in and out constantly and then want to show
 * somebody, so a board has to survive being pasted into a text message. That
 * rules out an id in a database: a board nobody signed in to make still has to
 * be shareable, and it should keep working when this site does not.
 *
 * THE FORMAT IS DELIBERATELY BORING. `g:big-muff` for a documented circuit,
 * `c:boss-ds-1` for a real product, `!` suffix for bypassed, joined by `~`.
 * Readable, diffable, and short enough that a ten pedal board fits in a link
 * nobody has to shorten. A binary packing would be shorter and would make every
 * future change a migration of everybody's saved links.
 *
 * FORWARD COMPATIBILITY IS THE WHOLE JOB HERE. Links outlive deploys: somebody
 * will open a board next year containing a pedal that has since left the
 * catalogue, or a token written by a version that knew a slot this one does
 * not. Every one of those drops the offending pedal and keeps the rest, because
 * a board that renders nine of ten pedals is a board, and an error page is a
 * lost link.
 */

const SEP = "~"
const OFF = "!"

/** One token for one pedal, with its on/off state. */
export function encodeItem(item: BoardItem): string {
  const id = item.source === "guide" ? `g:${item.guideSlug}` : `c:${item.catalogSlug}`
  return item.engaged ? id : `${id}${OFF}`
}

export function encodeBoard(items: BoardItem[]): string {
  return items.slice(0, MAX_ITEMS).map(encodeItem).join(SEP)
}

export type BoardToken = {
  source: "guide" | "catalogue"
  slug: string
  engaged: boolean
}

/**
 * Parse a shared board back into tokens.
 *
 * Tolerant on purpose: an unrecognised prefix, an empty segment or a slug with
 * nothing after the colon is skipped rather than thrown on.
 */
export function decodeBoard(raw: string | null | undefined): BoardToken[] {
  if (!raw) return []
  const out: BoardToken[] = []

  for (const piece of raw.split(SEP)) {
    if (out.length >= MAX_ITEMS) break
    const token = piece.trim()
    if (!token) continue

    const engaged = !token.endsWith(OFF)
    const body = engaged ? token : token.slice(0, -1)
    const colon = body.indexOf(":")
    if (colon < 1) continue

    const prefix = body.slice(0, colon)
    const slug = body.slice(colon + 1).trim()
    if (!slug) continue
    if (prefix !== "g" && prefix !== "c") continue

    out.push({ source: prefix === "g" ? "guide" : "catalogue", slug, engaged })
  }

  return out
}

/**
 * Turn tokens back into a board, given whatever catalogue the page has.
 *
 * A catalogue token whose product is no longer stocked is DROPPED rather than
 * rendered as a placeholder. A greyed-out box saying "this pedal is gone" is
 * worse than the board simply being a pedal shorter: the player came to look at
 * a rig, not at an obituary, and the share link they were sent still shows them
 * the rest of it.
 */
export function resolveBoard(tokens: BoardToken[], catalog: CatalogInput[]): BoardItem[] {
  const bySlug = new Map(catalog.map((entry) => [entry.slug, entry]))
  const out: BoardItem[] = []
  const seen = new Set<string>()

  for (const token of tokens) {
    let item: BoardItem | null = null

    if (token.source === "guide") {
      const pedal = pedalBySlug(token.slug)
      item = pedal ? itemFromGuide(pedal, token.engaged) : null
    } else {
      const entry = bySlug.get(token.slug)
      item = entry ? itemFromCatalog(entry, token.engaged) : null
    }

    /* The same pedal twice is a paste accident, not a rig. Two of one drive is
       a real board, but two of the same PRODUCT is one product listed twice. */
    if (!item || seen.has(item.key)) continue
    seen.add(item.key)
    out.push(item)
  }

  return out
}
