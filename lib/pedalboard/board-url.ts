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

/* -------------------------------------------------------------------------- */
/*  A whole rig in a URL                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The board slots above describe WHAT is on the board. This describes the rest
 * of the rig: which board, which power supply, and where each pedal physically
 * sits.
 *
 * It is a separate parameter rather than a richer slot encoding, deliberately.
 * Every link ever shared carries `?board=` and must keep working, so placement
 * arrives alongside it in `?rig=` and a link without one simply has no layout
 * yet. The builder then auto-arranges, which is the same thing it does for a
 * freshly loaded artist rig.
 *
 * FORMAT, chosen to stay short enough to paste into a text message:
 *
 *   rig=<boardId>~<supplyId>~<key>:<x>:<y>:<rot>,<key>:<x>:<y>:<rot>,...
 *
 * Coordinates are whole millimetres. Sub-millimetre precision on a hand-dragged
 * pedal is noise, and rounding halves the length of the string.
 */

import type { Rotation } from "./catalog/types"

export type RigPlacement = {
  key: string
  xMm: number
  yMm: number
  rotation: Rotation
}

export type RigLayout = {
  boardId: string | null
  supplyId: string | null
  placements: RigPlacement[]
}

const RIG_SEPARATOR = "~"
const PLACEMENT_SEPARATOR = ","
const FIELD_SEPARATOR = ":"

/** Ids are our own slugs, so the same shape the slot decoder enforces. */
const ID_PATTERN = /^[a-z0-9-]{1,80}$/

function isRotation(value: number): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270
}

export function encodeRig(layout: RigLayout): string {
  const placements = layout.placements
    .slice(0, MAX_SLOTS)
    .map((p) =>
      [p.key, Math.round(p.xMm), Math.round(p.yMm), p.rotation].join(FIELD_SEPARATOR),
    )
    .join(PLACEMENT_SEPARATOR)

  return [layout.boardId ?? "", layout.supplyId ?? "", placements].join(RIG_SEPARATOR)
}

export function decodeRig(raw: string | undefined | null): RigLayout {
  const empty: RigLayout = { boardId: null, supplyId: null, placements: [] }
  if (!raw) return empty

  const [boardRaw = "", supplyRaw = "", placementsRaw = ""] = raw.split(RIG_SEPARATOR)

  const placements: RigPlacement[] = []
  const seen = new Set<string>()

  for (const token of placementsRaw.split(PLACEMENT_SEPARATOR)) {
    if (!token) continue
    const [key, x, y, rot] = token.split(FIELD_SEPARATOR)
    if (!key || seen.has(key)) continue

    const xMm = Number.parseInt(x ?? "", 10)
    const yMm = Number.parseInt(y ?? "", 10)
    const rotation = Number.parseInt(rot ?? "", 10)

    // A crafted URL must not be able to push a pedal to a coordinate that
    // breaks the canvas. Anything out of range is dropped rather than clamped,
    // so a corrupt link loses one placement instead of silently relocating it.
    if (!Number.isFinite(xMm) || !Number.isFinite(yMm)) continue
    if (xMm < 0 || yMm < 0 || xMm > 5000 || yMm > 5000) continue
    if (!isRotation(rotation)) continue

    seen.add(key)
    placements.push({ key: key.slice(0, 220), xMm, yMm, rotation })
    if (placements.length >= MAX_SLOTS) break
  }

  return {
    boardId: ID_PATTERN.test(boardRaw) ? boardRaw : null,
    supplyId: ID_PATTERN.test(supplyRaw) ? supplyRaw : null,
    placements,
  }
}
