import { pc, spell } from "@/lib/chords/pitch"
import {
  chordsInKey,
  keyName,
  keyPrefersFlats,
  numeralIn,
  scalePitchClasses,
  sharedNotes,
  symbolIn,
  type Key,
} from "@/lib/chords/key"
import { chordOf, chordPitchClasses, type Chord } from "@/lib/chords/quality"

/**
 * GETTING FROM ONE KEY TO ANOTHER, WORKED OUT RATHER THAN ASSERTED.
 *
 * This is the file the whole rewrite exists for. The studio it replaces had a
 * modulation planner with two key dropdowns, five strategies and a paragraph of
 * explanation, and it read NEITHER DROPDOWN. Every strategy returned the same
 * hard-coded grips with the chosen key names pasted over the labels, and the
 * prose asserted that Am7 is the vi of the source key and the ii of the target.
 * For C to G that is true. For the other hundred-odd pairs the dropdowns offer
 * it is false, and nothing on the page hints at it: the shapes look plausible,
 * the sentence reads like teaching, and a player takes it away and learns
 * something wrong.
 *
 * A pivot chord is a fact about two key signatures. So this computes it, and
 * WHEN THERE IS NO PIVOT IT SAYS SO. C major and F# major share two notes and
 * not one diatonic seventh chord: the honest answer there is "this strategy
 * does not apply to this pair, and here is the one that does", which is the
 * same instinct as refusing to publish a market price under `MIN_SAMPLE_SIZE`.
 */

export type Strategy = "pivot" | "dominant" | "tritone" | "chromatic-mediant" | "common-tone"

export const STRATEGIES: { id: Strategy; name: string; blurb: string }[] = [
  {
    id: "pivot",
    name: "Diatonic pivot",
    blurb: "Find a chord both keys own, then let the second key claim it.",
  },
  {
    id: "dominant",
    name: "Direct dominant",
    blurb: "Ignore the old key and simply announce the new one with its V7.",
  },
  {
    id: "tritone",
    name: "Tritone substitution",
    blurb: "Approach the new tonic from a semitone above, with the same tritone.",
  },
  {
    id: "chromatic-mediant",
    name: "Chromatic mediant",
    blurb: "Slide a third, sharing one note and changing everything around it.",
  },
  {
    id: "common-tone",
    name: "Common tone",
    blurb: "Hold one note still and rebuild the chord underneath it.",
  },
]

export type ModulationStep = {
  chord: Chord
  /** What the source key calls it, if it can. */
  numeralFrom: string | null
  /** What the target key calls it, if it can. */
  numeralTo: string | null
  /** One line on what this chord is doing here. */
  role: string
}

export type Modulation = {
  strategy: Strategy
  from: Key
  to: Key
  /**
   * Empty when the strategy genuinely does not fit this pair.
   *
   * The reason is in `note`, and the UI prints it instead of a chord chain. A
   * planner that always produces four chords is a planner that is guessing on
   * the pairs where it matters.
   */
  steps: ModulationStep[]
  /** What this route is and why it works, in words, about THESE two keys. */
  note: string
  /** How closely related the keys are: shared scale notes, out of seven. */
  shared: number
}

/** Roots a semitone apart read as flats far more often than as sharps. */
function preferFlat(key: Key): boolean {
  return keyPrefersFlats(key)
}

/** The target's own dominant seventh, which is what announces a new key. */
function dominantOf(key: Key): Chord {
  return chordOf(pc(key.tonic + 7), "dom7")!
}

/** The target's tonic, as a seventh so it sits in the same world as the rest. */
function tonicOf(key: Key): Chord {
  return chordOf(key.tonic, key.mode === "major" ? "maj7" : "min7")!
}

/**
 * Every chord the two keys both own.
 *
 * THIS IS THE WHOLE MECHANISM OF A DIATONIC PIVOT and it is four lines,
 * which is worth noticing given what it replaced. Ranked by how useful the
 * chord is once the second key has claimed it: a chord that lands on the
 * target's ii or IV walks straight into its V7, and one that lands on the
 * target's own tonic has not moved anybody anywhere.
 */
export function pivotChords(from: Key, to: Key): { chord: Chord; inFrom: string; inTo: string }[] {
  const useful: Record<number, number> = { 2: 5, 4: 4, 6: 3, 3: 2, 1: 0, 5: 1, 7: 1 }

  return chordsInKey(from)
    .map((entry) => {
      const inTo = numeralIn(to, entry.chord)
      return inTo ? { chord: entry.chord, inFrom: entry.numeral, inTo } : null
    })
    .filter((entry): entry is { chord: Chord; inFrom: string; inTo: string } => entry !== null)
    .filter((entry) => entry.chord.root !== to.tonic)
    .sort((a, b) => {
      const rank = (numeral: string) => {
        const degree = chordsInKey(to).find(
          (entry) => entry.numeral === numeral,
        )?.degree
        return degree ? (useful[degree] ?? 0) : 0
      }
      return rank(b.inTo) - rank(a.inTo)
    })
}

export function planModulation(from: Key, to: Key, strategy: Strategy): Modulation {
  const shared = sharedNotes(from, to)
  const base = { strategy, from, to, shared }

  if (from.tonic === to.tonic && from.mode === to.mode) {
    return {
      ...base,
      steps: [],
      note: `${keyName(from)} and ${keyName(to)} are the same key. Pick a different destination and the route will appear here.`,
    }
  }

  if (strategy === "pivot") return planPivot(base, from, to)
  if (strategy === "dominant") return planDominant(base, from, to)
  if (strategy === "tritone") return planTritone(base, from, to)
  if (strategy === "chromatic-mediant") return planChromaticMediant(base, from, to)
  return planCommonTone(base, from, to)
}

type Base = Pick<Modulation, "strategy" | "from" | "to" | "shared">

function planPivot(base: Base, from: Key, to: Key): Modulation {
  const pivots = pivotChords(from, to)

  if (!pivots.length) {
    /*
     * THE ANSWER THAT THE OLD TOOL COULD NOT GIVE. Distant keys have no chord
     * in common, and saying which route DOES work is more use than four
     * plausible-looking chords that do not.
     */
    return {
      ...base,
      steps: [],
      note:
        `${keyName(from)} and ${keyName(to)} share ${base.shared} of seven notes and not one ` +
        `diatonic seventh chord, so there is no pivot to find. That is not a limitation of the ` +
        `search: a pivot needs a chord both keys own, and these two own nothing together. Use ` +
        `the direct dominant or the tritone approach, both of which work by ignoring the old ` +
        `key rather than by leaning on it.`,
    }
  }

  const pivot = pivots[0]
  const dominant = dominantOf(to)

  return {
    ...base,
    steps: [
      {
        chord: tonicOf(from),
        numeralFrom: numeralIn(from, tonicOf(from)),
        numeralTo: numeralIn(to, tonicOf(from)),
        role: `Home, in ${keyName(from)}.`,
      },
      {
        chord: pivot.chord,
        numeralFrom: pivot.inFrom,
        numeralTo: pivot.inTo,
        role: `The pivot. ${symbolIn(from, pivot.chord)} is the ${pivot.inFrom} of ${keyName(from)} and the ${pivot.inTo} of ${keyName(to)}, so nothing has changed yet and everything is about to.`,
      },
      {
        chord: dominant,
        numeralFrom: numeralIn(from, dominant),
        numeralTo: "V7",
        role: `The commitment. ${symbolIn(to, dominant)} belongs to ${keyName(to)} and not to ${keyName(from)}, which is the moment the ear changes its mind.`,
      },
      {
        chord: tonicOf(to),
        numeralFrom: numeralIn(from, tonicOf(to)),
        numeralTo: numeralIn(to, tonicOf(to)),
        role: `Home, in ${keyName(to)}.`,
      },
    ],
    note:
      `${keyName(from)} and ${keyName(to)} share ${base.shared} of seven notes. ` +
      `${symbolIn(from, pivot.chord)} is heard as the ${pivot.inFrom} on the way in and as the ` +
      `${pivot.inTo} on the way out, which is what a pivot is: one chord with two names, ` +
      `reinterpreted underneath the listener. The change is only confirmed by the ` +
      `${symbolIn(to, dominant)} after it.` +
      (pivots.length > 1
        ? ` ${pivots.length - 1} other shared chord${pivots.length > 2 ? "s" : ""} would also work: ` +
          pivots
            .slice(1, 4)
            .map((entry) => `${symbolIn(to, entry.chord)} (${entry.inFrom} / ${entry.inTo})`)
            .join(", ") +
          "."
        : ""),
  }
}

function planDominant(base: Base, from: Key, to: Key): Modulation {
  const dominant = dominantOf(to)
  const alsoInFrom = numeralIn(from, dominant)

  return {
    ...base,
    steps: [
      {
        chord: tonicOf(from),
        numeralFrom: numeralIn(from, tonicOf(from)),
        numeralTo: numeralIn(to, tonicOf(from)),
        role: `Home, in ${keyName(from)}.`,
      },
      {
        chord: dominant,
        numeralFrom: alsoInFrom,
        numeralTo: "V7",
        role: alsoInFrom
          ? `${symbolIn(to, dominant)} is also the ${alsoInFrom} of ${keyName(from)}, so this route is gentler than it looks here.`
          : `${symbolIn(to, dominant)} is foreign to ${keyName(from)}. Nothing prepares it, which is the point: it announces the new key rather than easing into it.`,
      },
      {
        chord: tonicOf(to),
        numeralFrom: numeralIn(from, tonicOf(to)),
        numeralTo: numeralIn(to, tonicOf(to)),
        role: `Home, in ${keyName(to)}.`,
      },
    ],
    note:
      `The blunt route, and the one that always works. A dominant seventh names its ` +
      `key on its own: the tritone inside ${symbolIn(to, dominant)} resolves to ` +
      `${symbolIn(to, tonicOf(to))} and to nothing else, so the ear accepts the new tonic ` +
      `without being talked into it. ` +
      (alsoInFrom
        ? `Here it happens to be diatonic to ${keyName(from)} as well (${alsoInFrom}), which softens the arrival.`
        : `Here it is entirely foreign to ${keyName(from)}, which is why it sounds like a cut rather than a turn.`),
  }
}

function planTritone(base: Base, from: Key, to: Key): Modulation {
  const dominant = dominantOf(to)
  const sub = chordOf(pc(to.tonic + 1), "dom7s11")!
  const flats = preferFlat(to)

  /* The shared pair is the whole justification, so name the actual notes. */
  const third = spell(pc(dominant.root + 4), flats)
  const seventh = spell(pc(dominant.root + 10), flats)

  return {
    ...base,
    steps: [
      {
        chord: tonicOf(from),
        numeralFrom: numeralIn(from, tonicOf(from)),
        numeralTo: numeralIn(to, tonicOf(from)),
        role: `Home, in ${keyName(from)}.`,
      },
      {
        chord: sub,
        numeralFrom: numeralIn(from, sub),
        numeralTo: "bII7",
        role: `The substitution. ${symbolIn(to, sub)} carries the same two notes as ${symbolIn(to, dominant)}, with its root a semitone above the target instead of a fifth above.`,
      },
      {
        chord: tonicOf(to),
        numeralFrom: numeralIn(from, tonicOf(to)),
        numeralTo: numeralIn(to, tonicOf(to)),
        role: `Home, in ${keyName(to)}. The bass has fallen one fret.`,
      },
    ],
    note:
      `Two dominant sevenths a tritone apart contain the same tritone, with the third and ` +
      `seventh swapped. ${symbolIn(to, dominant)} has ${third} and ${seventh}; ` +
      `${symbolIn(to, sub)} has the same pair the other way up. So the substitute resolves ` +
      `exactly where the dominant would, and the bass walks down by a semitone into ` +
      `${spell(to.tonic, flats)} rather than dropping a fifth. The #11 is written in because ` +
      `it is the note that makes the chord sound intended rather than mistaken.`,
  }
}

function planChromaticMediant(base: Base, from: Key, to: Key): Modulation {
  const distance = pc(to.tonic - from.tonic)
  const isMediant = [3, 4, 8, 9].includes(distance)

  const fromTonic = tonicOf(from)
  const toTonic = tonicOf(to)
  const shared = [...chordPitchClasses(fromTonic)].filter((pitch) =>
    chordPitchClasses(toTonic).has(pitch),
  )

  if (!isMediant) {
    return {
      ...base,
      steps: [],
      note:
        `A chromatic mediant is a move of a major or minor third. ${keyName(from)} to ` +
        `${keyName(to)} is ${distance} semitone${distance === 1 ? "" : "s"}, so this is not one. ` +
        `Choose a destination a third away, or use the pivot or dominant route for this pair.`,
    }
  }

  const flats = preferFlat(to)

  return {
    ...base,
    steps: [
      {
        chord: fromTonic,
        numeralFrom: numeralIn(from, fromTonic),
        numeralTo: numeralIn(to, fromTonic),
        role: `Home, in ${keyName(from)}.`,
      },
      {
        chord: toTonic,
        numeralFrom: numeralIn(from, toTonic),
        numeralTo: numeralIn(to, toTonic),
        role: `Straight there. No dominant, no preparation, one third of a move.`,
      },
    ],
    note:
      `Chromatic mediants work by sharing almost nothing and one thing. These two tonic ` +
      `chords hold ${shared.length} note${shared.length === 1 ? "" : "s"} in common` +
      (shared.length
        ? ` (${shared.map((pitch) => spell(pitch, flats)).join(", ")})` +
          `, and that note is what stops the move sounding like an edit. `
        : `, which is why this pair sounds abrupt rather than cinematic. `) +
      `Everything else changes at once, which is the effect: no dominant announces it and ` +
      `nothing prepares it, so the listener arrives somewhere else without having been ` +
      `taken there.`,
  }
}

function planCommonTone(base: Base, from: Key, to: Key): Modulation {
  const fromTonic = tonicOf(from)
  const toTonic = tonicOf(to)
  const flats = preferFlat(to)

  const held = [...chordPitchClasses(fromTonic)].filter((pitch) =>
    chordPitchClasses(toTonic).has(pitch),
  )

  if (!held.length) {
    /*
     * A REAL "NO". The tonic sevenths of some key pairs share nothing at all,
     * and a common-tone modulation with no common tone is not a thing that
     * exists. The old planner drew one anyway.
     */
    const bridge = chordOf(pc(from.tonic + 9), "dom7")!
    return {
      ...base,
      steps: [],
      note:
        `${symbolIn(from, fromTonic)} and ${symbolIn(to, toTonic)} have no note in common, so ` +
        `there is nothing to hold. A common-tone move needs a shared pitch to sit still while ` +
        `the harmony changes underneath it; without one this is just a jump. Try the pivot or ` +
        `the tritone route for these two, or approach ${keyName(to)} through ` +
        `${symbolIn(to, bridge)} first.`,
    }
  }

  const note = held[0]

  return {
    ...base,
    steps: [
      {
        chord: fromTonic,
        numeralFrom: numeralIn(from, fromTonic),
        numeralTo: numeralIn(to, fromTonic),
        role: `Home, in ${keyName(from)}. ${spell(note, flats)} is in this chord.`,
      },
      {
        chord: toTonic,
        numeralFrom: numeralIn(from, toTonic),
        numeralTo: numeralIn(to, toTonic),
        role: `Home, in ${keyName(to)}. ${spell(note, flats)} is still here, and it is the only thing that is.`,
      },
    ],
    note:
      `${spell(note, flats)} belongs to both tonic chords, so a voicing that keeps it on the ` +
      `same string across the change gives the ear something to hold while everything else ` +
      `moves. ` +
      (held.length > 1
        ? `${held.length} notes are shared here (${held.map((pitch) => spell(pitch, flats)).join(", ")}), which makes this an easy pair. `
        : `Only one note is shared, which is what makes the move feel like a discovery rather than a step. `) +
      `The voicings below are chosen for smallest total movement, so the held note tends to ` +
      `stay where it is without being told to.`,
  }
}

/** Which scale notes change, for the panel that shows what the ear is tracking. */
export function notesGainedAndLost(from: Key, to: Key): { gained: number[]; lost: number[] } {
  const before = scalePitchClasses(from)
  const after = scalePitchClasses(to)

  return {
    gained: [...after].filter((pitch) => !before.has(pitch)).sort((a, b) => a - b),
    lost: [...before].filter((pitch) => !after.has(pitch)).sort((a, b) => a - b),
  }
}
