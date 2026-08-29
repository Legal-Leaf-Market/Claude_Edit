import { pc, spell } from "@/lib/chords/pitch"
import { keyPrefersFlats, type Key } from "@/lib/chords/key"
import { chordOf, chordSymbol, type Chord } from "@/lib/chords/quality"

/**
 * REHARMONISATION THAT CHANGES THE NOTES.
 *
 * Three buttons on the studio this replaces claimed to alter a chord. None of
 * them did the thing they said:
 *
 *   - "Tritone sub" always produced Db7(#11) with one hard-coded grip,
 *     whatever chord you pressed it on. Correct for a G7, wrong for the other
 *     eleven, and it did not check that the chord was a dominant at all before
 *     overwriting it.
 *   - "Altered dominant" rewrote the chord's NAME and FORMULA and left the
 *     frets exactly as they were, so the panel said 7#9b13 while the guitar
 *     played a plain dominant seventh.
 *   - "Shell voicing" subtracted one from a fret number and added one to
 *     another, with no idea what note it landed on, and wrote the result back
 *     over the stored grip so the toggle could never be undone.
 *
 * Each operation here returns a CHORD or refuses, with the reason. The voicing
 * search then finds shapes for whatever comes back, so the notes and the label
 * cannot disagree.
 */

export type Reharm = {
  chord: Chord
  /** What changed, and why it works. Written about this chord, not in general. */
  why: string
}

export type ReharmResult = Reharm | { chord: null; why: string }

/**
 * Swap a dominant for the dominant a tritone away.
 *
 * REFUSES ON ANYTHING THAT IS NOT A DOMINANT, and that is the substance of the
 * operation rather than input validation. The trick works because two dominant
 * sevenths a tritone apart share their third and seventh, swapped over; a
 * major seventh chord has no such partner, so there is nothing to substitute
 * and pretending otherwise just replaces the chord with an unrelated one.
 */
export function tritoneSub(chord: Chord, key: Key): ReharmResult {
  if (chord.quality.family !== "dominant") {
    return {
      chord: null,
      why: `A tritone substitution swaps one dominant seventh for another. ${chordSymbol(chord, keyPrefersFlats(key))} is a ${chord.quality.name}, and there is no dominant here to substitute. Move to the V7 and try again.`,
    }
  }

  const substitute = chordOf(pc(chord.root + 6), "dom7s11")
  if (!substitute) return { chord: null, why: "No substitute available." }

  const flats = keyPrefersFlats(key)
  const third = spell(pc(chord.root + 4), flats)
  const seventh = spell(pc(chord.root + 10), flats)

  return {
    chord: substitute,
    why:
      `${chordSymbol(chord, flats)} and ${chordSymbol(substitute, flats)} contain the same two ` +
      `notes, ${third} and ${seventh}, with the roles reversed: what was the third is now the ` +
      `seventh. That pair is the tritone that makes a dominant want to resolve, so the ` +
      `substitute resolves to exactly the same chord. What changes is the bass, which now ` +
      `descends by a semitone instead of falling a fifth.`,
  }
}

/**
 * Turn a dominant into an altered dominant.
 *
 * AND IT ACTUALLY REMOVES THE FIFTH, which is what "altered" means. The
 * altered scale has no perfect fifth in it: the b13 and the #11 sit where it
 * would be. A voicing that keeps the natural fifth and calls itself altered is
 * exactly the bug this replaces.
 */
export function alterDominant(chord: Chord, key: Key): ReharmResult {
  if (chord.quality.family !== "dominant") {
    return {
      chord: null,
      why: `Only a dominant can be altered: the alterations are to the fifth and the ninth of a chord that is already pulling somewhere. ${chordSymbol(chord, keyPrefersFlats(key))} is a ${chord.quality.name}.`,
    }
  }

  if (chord.quality.id === "dom7alt") {
    const plain = chordOf(chord.root, "dom7")!
    return {
      chord: plain,
      why: `Back to a plain dominant seventh. The natural fifth returns and the flat ninth goes.`,
    }
  }

  const altered = chordOf(chord.root, "dom7alt")!
  const flats = keyPrefersFlats(key)

  return {
    chord: altered,
    why:
      `Every note of ${chordSymbol(chord, flats)} that can be raised or lowered has been, except ` +
      `the two that decide what the chord is. The third and the seventh stay; the fifth leaves ` +
      `entirely, because the altered scale has no perfect fifth, and ` +
      `${spell(pc(chord.root + 1), flats)} arrives as the flat ninth. More tension in, the same ` +
      `resolution out.`,
  }
}

/**
 * Add the next extension up: 7 becomes 9, 9 becomes 13.
 *
 * Extensions are stacked thirds, so this walks up the stack rather than
 * offering a menu of every possible chord. A chord with no seventh has nothing
 * to extend and says so.
 */
export function extend(chord: Chord, key: Key): ReharmResult {
  const ladder: Record<string, string> = {
    maj7: "maj9",
    min7: "min9",
    dom7: "dom9",
    dom9: "dom13",
    maj: "maj7",
    min: "min7",
    "6": "69",
  }

  const next = ladder[chord.quality.id]
  if (!next) {
    return {
      chord: null,
      why: `${chordSymbol(chord, keyPrefersFlats(key))} is already as extended as this tool will take it. Extensions stack in thirds and the next one up would start colouring the chord rather than thickening it.`,
    }
  }

  const extended = chordOf(chord.root, next)!
  return {
    chord: extended,
    why: `Another third on top. ${chordSymbol(chord, keyPrefersFlats(key))} becomes ${chordSymbol(extended, keyPrefersFlats(key))}: the chord's function is unchanged, and a guitar will usually have to drop the fifth to fit the new note in.`,
  }
}

/**
 * The dominant of a chord, so any chord can be approached from its own V.
 *
 * The single most useful reharmonisation there is, and the original had no
 * button for it at all.
 */
export function secondaryDominant(chord: Chord, key: Key): ReharmResult {
  const five = chordOf(pc(chord.root + 7), "dom7")!
  const flats = keyPrefersFlats(key)

  return {
    chord: five,
    why:
      `${chordSymbol(five, flats)} is the dominant of ${chordSymbol(chord, flats)}, whether or ` +
      `not it belongs to the key. Putting it in front borrows the pull of a cadence for one ` +
      `chord: the ear hears ${spell(chord.root, flats)} as a tonic for a moment before the key ` +
      `takes it back.`,
  }
}

/** Every operation, for a toolbar that names what each one needs. */
export const REHARMS: {
  id: string
  name: string
  blurb: string
  apply: (chord: Chord, key: Key) => ReharmResult
}[] = [
  {
    id: "tritone",
    name: "Tritone sub",
    blurb: "Swap a dominant for the one a tritone away. Same tritone, different bass.",
    apply: tritoneSub,
  },
  {
    id: "alter",
    name: "Alter it",
    blurb: "Take the fifth off a dominant and flatten the ninth. Maximum tension.",
    apply: alterDominant,
  },
  {
    id: "extend",
    name: "Extend",
    blurb: "Stack the next third on top: 7 to 9, 9 to 13.",
    apply: extend,
  },
  {
    id: "secondary",
    name: "Approach it",
    blurb: "Insert this chord's own dominant in front of it.",
    apply: secondaryDominant,
  },
]
