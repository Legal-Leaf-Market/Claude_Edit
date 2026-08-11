import type { EffectType } from "@/lib/pedalboard/chain"

/**
 * How a board is encoded into the URL.
 *
 * The URL is the board's only persistence. There is no account required, no
 * server-side save and no local storage, which is deliberate: a board is worth
 * sharing (that is most of what people do with these tools) and a link that
 * fully describes one is both the share feature and the save feature at once.
 *
 * Two kinds of slot have to survive a round trip:
 *
 *   a catalogue pedal   `big-muff-pi`         (a canonical_gear slug)
 *   an off-catalogue one `~Ibanez|TS9`        (brand and model, no listing)
 *
 * Off-catalogue slots exist because the feeds live today carry small
 * independent makers, not the legacy pedal brands every documented rig is made
 * of. Without them, loading a famous rig produces an empty board. With them, a
 * shared link to "Gilmour's board" keeps working as those pedals come into
 * stock, because the slot re-matches on every load rather than being frozen at
 * whatever the catalogue held when the link was made.
 *
 * The `?pedals=` parameter the first version of this tool used is still read,
 * so links shared before this change still open.
 */

export type BoardSlotInput =
  | { kind: "gear"; slug: string }
  | { kind: "off"; brand: string; model: string }

const OFF_PREFIX = "~"
const SEPARATOR = "|"

/** Longest board the tool will build. Past this it is a rack, not a pedalboard. */
export const MAX_SLOTS = 16

export function encodeSlot(slot: BoardSlotInput): string {
  if (slot.kind === "gear") return slot.slug
  return `${OFF_PREFIX}${slot.brand}${SEPARATOR}${slot.model}`
}

export function decodeSlot(token: string): BoardSlotInput | null {
  const trimmed = token.trim()
  if (!trimmed) return null

  if (!trimmed.startsWith(OFF_PREFIX)) {
    // A catalogue slug. Constrained to the shape slugify() produces, so a
    // crafted URL cannot push arbitrary text into a LIKE pattern downstream.
    if (!/^[a-z0-9-]{1,220}$/.test(trimmed)) return null
    return { kind: "gear", slug: trimmed }
  }

  const [brand, ...rest] = trimmed.slice(OFF_PREFIX.length).split(SEPARATOR)
  const model = rest.join(SEPARATOR)
  if (!brand || !model) return null
  // Length capped for the same reason: these become ILIKE patterns.
  return { kind: "off", brand: brand.slice(0, 60), model: model.slice(0, 80) }
}

export function encodeBoard(slots: BoardSlotInput[]): string {
  return slots.slice(0, MAX_SLOTS).map(encodeSlot).join(",")
}

export function decodeBoard(raw: string | undefined | null): BoardSlotInput[] {
  if (!raw) return []
  const seen = new Set<string>()
  const slots: BoardSlotInput[] = []
  for (const token of raw.split(",")) {
    const slot = decodeSlot(token)
    if (!slot) continue
    const key = encodeSlot(slot).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    slots.push(slot)
    if (slots.length >= MAX_SLOTS) break
  }
  return slots
}

/**
 * The one built-in preset, linked from the nav.
 *
 * Four pedals, no brands. Naming brands here would be a recommendation, and
 * recommending a specific pedal on a site that earns commission on pedals is
 * exactly the thing the footer promises does not happen. Describing the four
 * ROLES is genuinely useful and takes no position on what to buy: the search
 * box next to it is where a shopper picks the actual box.
 */
export const STARTER_ROLES: { type: EffectType; label: string; why: string }[] = [
  { type: "tuner", label: "A tuner", why: "First in the chain, and the mute switch for silent changes." },
  { type: "drive", label: "An overdrive", why: "The one pedal that changes your sound more than any other." },
  { type: "delay", label: "A delay", why: "Space and depth, and half of what makes a part sound finished." },
  { type: "reverb", label: "A reverb", why: "Last, so everything in front of it happens in the same room." },
]
