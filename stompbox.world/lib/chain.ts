import { PEDALS, pedalBySlug, type Pedal } from "./pedals"

/**
 * Signal chain order, and the reasons behind it.
 *
 * THIS IS A CONVENTION, NOT A LAW, and the copy says so everywhere it is
 * shown. The order below is what most boards do most of the time, and every
 * slot carries the reason it sits where it does, because a reason can be
 * argued with and a rule cannot. Plenty of well known sounds come from
 * breaking it deliberately.
 *
 * The engine is pure TypeScript with no React in it, so it is testable on its
 * own and the same function orders the chain on the server for the static page
 * and in the browser for the builder.
 */

export type SlotId =
  | "tuner"
  | "filter"
  | "dynamics"
  | "fuzz"
  | "drive"
  | "eq"
  | "gate"
  | "volume"
  | "modulation"
  | "delay"
  | "reverb"

export type Slot = {
  id: SlotId
  name: string
  /** What lives here. */
  examples: string
  /** Why it sits at this point rather than somewhere else. */
  why: string
}

/** In signal order, guitar first, amp last. */
export const SLOTS: Slot[] = [
  {
    id: "tuner",
    name: "Tuner",
    examples: "Any pedal tuner",
    why: "First, because it wants the raw signal to read pitch from, and because muting here kills everything downstream at once. It is the only pedal whose job is easier the less has happened to the signal.",
  },
  {
    id: "filter",
    name: "Wah and filter",
    examples: "Wah, envelope filter, fixed filters",
    why: "Early, so it shapes the plain guitar and the drive after it responds to that shape. Put a wah after a distortion instead and the sweep sounds flatter, because the distortion has already flattened the dynamics the filter would have moved through.",
  },
  {
    id: "dynamics",
    name: "Compressor",
    examples: "Optical, OTA and FET compressors",
    why: "Near the front, where the dynamic range is still wide enough to be worth squeezing. Some players put it last instead, to even out everything the board has done rather than what the guitar did, which is a real choice rather than a mistake.",
  },
  {
    id: "fuzz",
    name: "Fuzz",
    examples: "Fuzz Face, Big Muff, octave fuzz",
    why: "Ahead of the other gain, and for some circuits ahead of everything. A vintage-style fuzz has a very low input impedance and is voiced around loading the guitar's pickups directly, so anything buffered in front of it changes what it hears.",
  },
  {
    id: "drive",
    name: "Overdrive and distortion",
    examples: "Tube Screamer, RAT, DS-1",
    why: "After the fuzz and before everything time based. Distorting a signal and then delaying it keeps the repeats clean; delaying a signal and then distorting it drives the repeats and the dry note together into one smear.",
  },
  {
    id: "eq",
    name: "EQ and boost",
    examples: "Graphic EQ, clean boost",
    why: "Either side of the drive, and the two do different jobs. In front, it changes what the drive clips. After, it changes the finished sound. Most boards that own one put it after, then use a second in front when they want the drive itself voiced.",
  },
  {
    id: "gate",
    name: "Noise gate",
    examples: "Any gate or noise suppressor",
    why: "After the gain, because the gain is what made the noise. A gate ahead of a high-gain drive is closing on a quiet signal and then handing the silence to something with enormous gain, which amplifies the hiss it was meant to remove.",
  },
  {
    id: "volume",
    name: "Volume pedal",
    examples: "Passive or active volume pedals",
    why: "Position is a genuine choice. Before the drive it changes how hard the drive is pushed, so it doubles as a gain control. After the drive and before the delay it fades the level while leaving repeats to ring out. At the very end it is a master mute.",
  },
  {
    id: "modulation",
    name: "Modulation",
    examples: "Chorus, phaser, flanger, tremolo",
    why: "After the gain and before the delay, so the delay repeats a modulated signal rather than modulating an already repeated one. Reversed, the movement gets applied to the echoes as a block and the effect smears instead of swirling.",
  },
  {
    id: "delay",
    name: "Delay",
    examples: "Analog, digital and tape-style delay",
    why: "Near the end, repeating a signal that is already finished. Anything placed after a delay processes each repeat again, which is occasionally the point and usually a mess.",
  },
  {
    id: "reverb",
    name: "Reverb",
    examples: "Spring, plate and hall reverb",
    why: "Last, because it is the room. A delay into a reverb puts each repeat in the same space, which is what happens acoustically. A reverb into a delay repeats the room itself, which does not.",
  },
]

export const SLOT_BY_ID: Record<SlotId, Slot> = Object.fromEntries(
  SLOTS.map((slot) => [slot.id, slot]),
) as Record<SlotId, Slot>

const SLOT_INDEX: Record<SlotId, number> = Object.fromEntries(
  SLOTS.map((slot, index) => [slot.id, index]),
) as Record<SlotId, number>

export function slotIndex(id: SlotId): number {
  return SLOT_INDEX[id]
}

/**
 * Order a set of pedals into the conventional chain.
 *
 * STABLE WITHIN A SLOT. Two drives keep the order the caller gave them,
 * because which of two overdrives goes first is a taste decision this file has
 * no business making. The notes below say so out loud rather than picking one
 * silently, which is the same reason `chainNotes` exists at all.
 *
 * Unknown slugs are dropped rather than throwing: the builder's state can
 * outlive a dataset edit, and a stale link in somebody's history should render
 * a shorter board, not a crash.
 */
export function orderPedals(slugs: string[]): Pedal[] {
  const pedals = slugs
    .map((slug) => pedalBySlug(slug))
    .filter((pedal): pedal is Pedal => pedal !== undefined)

  return pedals
    .map((pedal, index) => ({ pedal, index }))
    .sort((a, b) => {
      const bySlot = slotIndex(a.pedal.slot) - slotIndex(b.pedal.slot)
      return bySlot !== 0 ? bySlot : a.index - b.index
    })
    .map((entry) => entry.pedal)
}

export type NoteLevel = "info" | "warn"

export type ChainNote = {
  level: NoteLevel
  title: string
  body: string
}

/**
 * What is worth saying about a particular set of pedals.
 *
 * These are notes, never errors. Nothing here blocks a layout or "fixes" it,
 * because every one of these arrangements is something a real board does on
 * purpose. The job is to say what the trade is, not to overrule it.
 */
export function chainNotes(pedals: Pedal[]): ChainNote[] {
  const notes: ChainNote[] = []
  const ordered = pedals

  const sensitive = ordered.filter((pedal) => pedal.wantsGuitarDirect)
  const buffered = ordered.filter((pedal) => pedal.buffered)

  /*
   * The one interaction on this page that genuinely surprises people, so it
   * leads. It fires only when both halves are present: a lone fuzz is fine,
   * and a lone buffer is fine.
   */
  if (sensitive.length > 0 && buffered.length > 0) {
    const oneFuzz = sensitive.length === 1
    const oneBuffer = buffered.length === 1
    notes.push({
      level: "warn",
      title: `A buffer is sharing the board with ${oneFuzz ? "a fuzz that does" : "fuzzes that do"} not want one`,
      body:
        `${listNames(sensitive)} ${oneFuzz ? "loads" : "load"} the guitar's pickups directly, and that loading is part of how ${oneFuzz ? "it sounds" : "they sound"} and how ${oneFuzz ? "it cleans" : "they clean"} up when you roll the volume back. ` +
        `${listNames(buffered)} ${oneBuffer ? "has a buffered output" : "have buffered outputs"}, so anything after ${oneBuffer ? "it" : "them"} is driven by the buffer instead of by the guitar. ` +
        `Keeping the fuzz first is what preserves the interaction. If the fuzz has to sit later, expect a thinner and more even sound that no longer cleans up from the guitar's volume control.`,
    })
  }

  const bySlot = new Map<SlotId, Pedal[]>()
  for (const pedal of ordered) {
    const existing = bySlot.get(pedal.slot)
    if (existing) existing.push(pedal)
    else bySlot.set(pedal.slot, [pedal])
  }

  for (const [slot, group] of bySlot) {
    if (group.length < 2) continue
    notes.push({
      level: "info",
      title: `Two or more in the ${SLOT_BY_ID[slot].name.toLowerCase()} slot`,
      body:
        `${listNames(group)} ${group.length === 2 ? "both" : "all"} sit at the same point in the chain, and the order between them is a taste call rather than a rule. ` +
        `The usual starting point is the lower-gain or more transparent one first, feeding the more aggressive one, because that way the second is being pushed by a clean-ish boosted signal rather than by an already ragged one. Swapping them is a completely reasonable thing to try.`,
    })
  }

  const compressor = ordered.find((pedal) => pedal.slot === "dynamics")
  const gain = ordered.filter((pedal) => pedal.slot === "drive" || pedal.slot === "fuzz")
  if (compressor && gain.length > 0) {
    notes.push({
      level: "info",
      title: "Compressor before the gain, which is a choice",
      body:
        `${compressor.name} is placed ahead of ${listNames(gain)} here, so the gain receives an already evened-out signal and reacts the same way to a light touch and a hard one. ` +
        `Moving the compressor after the gain instead lets the gain respond to your picking and squeezes the result, which keeps more of the dynamics you are playing with. Neither is wrong, and boards genuinely do both.`,
    })
  }

  const digital = ordered.filter((pedal) => pedal.digital)
  if (digital.length > 0) {
    notes.push({
      level: "info",
      title: "Check the power budget, not just the order",
      body:
        `${listNames(digital)} ${digital.length === 1 ? "is a digital circuit" : "are digital circuits"}, and digital pedals generally want noticeably more current than the analog ones beside them. ` +
        `This page does not publish current figures, because the honest number is the one printed on your own pedal or its manual rather than one guessed here. Add up what your supply is actually rated for before assuming a daisy chain will carry the board.`,
    })
  }

  if (ordered.length > 0 && !ordered.some((pedal) => pedal.slot === "tuner")) {
    notes.push({
      level: "info",
      title: "No tuner in the chain",
      body: "Not a problem, just worth saying: a tuner at the front is the one pedal that gets easier the less has happened to the signal, and its mute kills everything downstream in one press.",
    })
  }

  return notes
}

function listNames(pedals: Pedal[]): string {
  const names = pedals.map((pedal) => pedal.name)
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** Slots that at least one pedal in the dataset occupies, for the chain page. */
export function occupiedSlots(): Set<SlotId> {
  return new Set(PEDALS.map((pedal) => pedal.slot))
}
