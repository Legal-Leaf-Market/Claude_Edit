import { slotIndex, type ChainSubject, type SlotId } from "./chain"
import type { CatalogPedal } from "./catalog"
import { PEDAL_BY_SLUG, type Pedal } from "./pedals"

/**
 * The board: what can go on one, in what order, and how to put it in a link.
 *
 * PURE TYPESCRIPT, NO REACT, for the same reason lib/chain.ts is. The ordering
 * and the encoding are the parts worth testing, and a browser is not needed to
 * test either.
 *
 * TWO SOURCES, AND THE DIFFERENCE BETWEEN THEM IS NOT COSMETIC. A guide entry
 * is a circuit somebody here has read and written about. A catalogue row is a
 * product name and a photo from a shop's feed, with its effect type inferred
 * from that name by the sister site. Both can sit on a board; only one can be
 * quoted about what it does. `circuitKnown` carries that distinction into the
 * chain notes, which is what stops the builder implying this site has an
 * opinion on a pedal nobody here has heard.
 */

export type BoardSource = "guide" | "catalogue"

export type BoardItem = ChainSubject & {
  /** Stable identity, unique across both sources. See encodeBoard. */
  key: string
  name: string
  /** Who makes it, when we know. */
  maker: string | null
  slot: SlotId
  source: BoardSource
  /** Product photo, catalogue only. Guide entries are drawn, never photographed. */
  imageUrl: string | null
  /** False when the player has switched it off. It stays on the board and out of the signal. */
  engaged: boolean
}

/**
 * Where a catalogue pedal's inferred type sits in this guide's chain.
 *
 * NULL IS A REAL ANSWER and it is why this returns a union. The sister site
 * infers twelve effect types; this guide documents eleven slots and they are
 * not the same eleven. Two types have no honest home here:
 *
 *   looper   conventionally goes last, or in the amp's effects loop, and this
 *            guide's chain ends at reverb. Rather than pretend a looper is a
 *            reverb, it stays off the chain and the board says so.
 *   utility  covers a noise gate, an ABY switcher, a DI and a buffer, which
 *            belong in four different places. The type cannot tell them apart,
 *            so guessing one would be picking a position at random.
 *
 * `pitch` is the one approximation, and it is a stated one: pitch shifters
 * conventionally sit with the modulation block, after the gain and before the
 * time-based effects, so that is where they go.
 */
export function slotForCatalogType(type: string): SlotId | null {
  switch (type) {
    case "tuner":
      return "tuner"
    case "filter":
      return "filter"
    case "compressor":
      return "dynamics"
    case "drive":
      return "drive"
    case "eq":
      return "eq"
    case "pitch":
    case "modulation":
      return "modulation"
    case "delay":
      return "delay"
    case "reverb":
      return "reverb"
    case "volume":
      return "volume"
    default:
      return null
  }
}

/** A documented circuit, ready for the board. */
export function itemFromGuide(pedal: Pedal, engaged = true): BoardItem {
  return {
    key: `g:${pedal.slug}`,
    name: pedal.name,
    maker: pedal.maker,
    slot: pedal.slot,
    source: "guide",
    imageUrl: null,
    engaged,
    buffered: pedal.buffered,
    wantsGuitarDirect: pedal.wantsGuitarDirect,
    digital: pedal.digital,
    circuitKnown: true,
  }
}

/**
 * A catalogue row, ready for the board, or null when its type has no slot.
 *
 * Note what is NOT copied across: no price, no merchant, no link. A board is
 * a layout toy and the moment it quotes a price it is a shop, which is the
 * separation CLAUDE.md section 2a exists to keep.
 */
export function itemFromCatalog(pedal: CatalogPedal, engaged = true): BoardItem | null {
  const slot = slotForCatalogType(pedal.type)
  if (!slot) return null
  return {
    key: `c:${pedal.slug}`,
    name: pedal.model,
    maker: pedal.brand,
    slot,
    source: "catalogue",
    imageUrl: pedal.imageUrl,
    engaged,
    circuitKnown: false,
  }
}

/**
 * Order a board into the conventional chain.
 *
 * STABLE WITHIN A SLOT, exactly as orderPedals is: which of two overdrives
 * goes first is the player's call, so the order they were added in is kept and
 * the notes say out loud that it is a taste decision.
 */
export function orderBoard(items: BoardItem[]): BoardItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const bySlot = slotIndex(a.item.slot) - slotIndex(b.item.slot)
      return bySlot !== 0 ? bySlot : a.index - b.index
    })
    .map((entry) => entry.item)
}

/** Only what is switched on carries signal, and only that is worth noting on. */
export function engagedOf(items: BoardItem[]): BoardItem[] {
  return items.filter((item) => item.engaged)
}

/**
 * A board is capped, and the cap is about honesty rather than storage.
 *
 * Sixteen is already a big pedalboard. Past that the chain notes stop being
 * readable, the URL stops being sendable, and the thing stops resembling
 * anything anybody would actually stand behind.
 */
export const MAX_ITEMS = 16

/* -------------------------------------------------------------------------- */
/*  The shareable link                                                        */
/* -------------------------------------------------------------------------- */

/**
 * One token per pedal: an optional `!` for bypassed, then the key.
 *
 * The key already carries its source as a `g:` or `c:` prefix, which is what
 * makes a guide slug and a catalogue slug that happen to match impossible to
 * confuse. "ds-1" is a circuit entry here and "boss-ds-1-distortion" is a
 * catalogue row, and one day those will collide.
 */
const SEPARATOR = "~"

export function encodeBoard(items: BoardItem[]): string {
  return items
    .slice(0, MAX_ITEMS)
    .map((item) => `${item.engaged ? "" : "!"}${item.key}`)
    .join(SEPARATOR)
}

export type BoardToken = { key: string; engaged: boolean }

/**
 * Read a board back out of a link.
 *
 * TOTALLY PERMISSIVE, because the input is a URL somebody may have edited,
 * truncated by a chat client, or kept in a bookmark since before a pedal was
 * renamed. Anything unrecognisable is dropped rather than thrown on: a stale
 * link should open a shorter board, never an error page. Resolving a key to an
 * actual pedal happens later and drops again on the same principle.
 */
export function decodeBoard(raw: string | null | undefined): BoardToken[] {
  if (!raw) return []
  const seen = new Set<string>()
  const tokens: BoardToken[] = []
  for (const piece of raw.split(SEPARATOR)) {
    const trimmed = piece.trim()
    if (!trimmed) continue
    const engaged = !trimmed.startsWith("!")
    const key = engaged ? trimmed : trimmed.slice(1)
    if (!/^[gc]:[a-z0-9-]+$/i.test(key)) continue
    /* A board holds one of each. A link repeating a pedal is a mangled link,
       and two identical enclosures wired in series is not a thing to render. */
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push({ key, engaged })
    if (tokens.length >= MAX_ITEMS) break
  }
  return tokens
}

/**
 * Turn decoded tokens back into board items, given the catalogue that is
 * currently live. Unknown keys are dropped, per decodeBoard's contract.
 */
export function resolveBoard(tokens: BoardToken[], catalog: CatalogPedal[]): BoardItem[] {
  const bySlug = new Map(catalog.map((pedal) => [pedal.slug, pedal]))
  const items: BoardItem[] = []
  for (const token of tokens) {
    const slug = token.key.slice(2)
    if (token.key.startsWith("g:")) {
      const pedal = PEDAL_BY_SLUG[slug]
      if (pedal) items.push(itemFromGuide(pedal, token.engaged))
    } else {
      const pedal = bySlug.get(slug)
      if (pedal) {
        const item = itemFromCatalog(pedal, token.engaged)
        if (item) items.push(item)
      }
    }
  }
  return items
}
