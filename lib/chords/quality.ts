import { degreeLabel, pc, spell, type PitchClass } from "@/lib/chords/pitch"

/**
 * CHORD QUALITIES AS INTERVAL SETS, NOT AS GRIPS.
 *
 * The studio this replaces stored every chord as six fret numbers typed by
 * hand, which works exactly as far as somebody was willing to type. Change the
 * tuning and every grip is silently wrong; ask for a chord nobody typed and
 * there is no answer; press "altered dominant" and the label changes while the
 * notes stay put, because a label is all there was.
 *
 * A quality here is what the chord IS: a set of semitone distances from the
 * root, plus which of them can be left out when six strings will not hold
 * them. `lib/chords/voicing.ts` turns that into shapes for whatever tuning is
 * in front of it, so a chord exists whether or not anybody typed it.
 */

export type Degree = {
  /** Semitones above the root. */
  semitones: number
  /** How it is written in the formula: "b7", "#11". */
  label: string
  /**
   * Can a six-string guitar leave this one out?
   *
   * WHICH TONES ARE EXPENDABLE IS THE ACTUAL CRAFT of guitar voicing, and it
   * is not a matter of taste. The 5th says nothing about quality and goes
   * first, which is why every jazz shell drops it. The root goes second,
   * because a bass player or the ear supplies it. What can never go is the
   * pair that decides whether the chord is major, minor or dominant: the 3rd
   * and the 7th. Dropping a guide tone does not thin the chord, it changes
   * which chord it is.
   */
  optional: boolean
}

export type Quality = {
  /** The key used everywhere else to name this quality. */
  id: string
  /** What goes after the root: "m7", "maj7", "7#9". Empty for a major triad. */
  suffix: string
  /** Spoken name, for the panel that explains what is happening. */
  name: string
  degrees: Degree[]
  /**
   * Which family the chord belongs to, for the analysis that has to reason
   * about function rather than about spelling: a 7b9 and a 13 are both
   * dominants and both want to resolve down a fifth.
   */
  family: "major" | "minor" | "dominant" | "diminished" | "augmented" | "suspended"
}

const required = (semitones: number, label: string): Degree => ({
  semitones,
  label,
  optional: false,
})
const spare = (semitones: number, label: string): Degree => ({ semitones, label, optional: true })

/** Root, always present, always droppable last. */
const ROOT = spare(0, "R")
const FIFTH = spare(7, "5")

/**
 * THE QUALITIES THIS TOOL KNOWS.
 *
 * Deliberately a table rather than a parser over arbitrary symbols. A parser
 * accepts "Cmaj7#11b13" and has to invent an answer; a table says plainly what
 * it does and does not cover, which is the same instinct as refusing to
 * publish a market price under `MIN_SAMPLE_SIZE`.
 */
export const QUALITIES: Quality[] = [
  {
    id: "maj",
    suffix: "",
    name: "major triad",
    family: "major",
    degrees: [ROOT, required(4, "3"), FIFTH],
  },
  {
    id: "min",
    suffix: "m",
    name: "minor triad",
    family: "minor",
    degrees: [ROOT, required(3, "b3"), FIFTH],
  },
  {
    id: "dim",
    suffix: "dim",
    name: "diminished triad",
    family: "diminished",
    degrees: [ROOT, required(3, "b3"), required(6, "b5")],
  },
  {
    id: "aug",
    suffix: "aug",
    name: "augmented triad",
    family: "augmented",
    degrees: [ROOT, required(4, "3"), required(8, "#5")],
  },
  {
    id: "sus4",
    suffix: "sus4",
    name: "suspended fourth",
    family: "suspended",
    /* The 4 IS the chord here: it is what replaced the third, so it cannot be
       the thing that gets dropped. */
    degrees: [ROOT, required(5, "4"), FIFTH],
  },
  {
    id: "sus2",
    suffix: "sus2",
    name: "suspended second",
    family: "suspended",
    degrees: [ROOT, required(2, "2"), FIFTH],
  },
  {
    id: "maj7",
    suffix: "maj7",
    name: "major seventh",
    family: "major",
    degrees: [ROOT, required(4, "3"), FIFTH, required(11, "7")],
  },
  {
    id: "maj9",
    suffix: "maj9",
    name: "major ninth",
    family: "major",
    degrees: [ROOT, required(4, "3"), FIFTH, required(11, "7"), spare(14, "9")],
  },
  {
    id: "6",
    suffix: "6",
    name: "major sixth",
    family: "major",
    degrees: [ROOT, required(4, "3"), FIFTH, required(9, "6")],
  },
  {
    id: "69",
    suffix: "6/9",
    name: "six-nine",
    family: "major",
    degrees: [ROOT, required(4, "3"), FIFTH, required(9, "6"), required(14, "9")],
  },
  {
    id: "min7",
    suffix: "m7",
    name: "minor seventh",
    family: "minor",
    degrees: [ROOT, required(3, "b3"), FIFTH, required(10, "b7")],
  },
  {
    id: "min9",
    suffix: "m9",
    name: "minor ninth",
    family: "minor",
    degrees: [ROOT, required(3, "b3"), FIFTH, required(10, "b7"), spare(14, "9")],
  },
  {
    id: "min6",
    suffix: "m6",
    name: "minor sixth",
    family: "minor",
    degrees: [ROOT, required(3, "b3"), FIFTH, required(9, "6")],
  },
  {
    id: "minmaj7",
    suffix: "m(maj7)",
    name: "minor major seventh",
    family: "minor",
    degrees: [ROOT, required(3, "b3"), FIFTH, required(11, "7")],
  },
  {
    id: "dom7",
    suffix: "7",
    name: "dominant seventh",
    family: "dominant",
    degrees: [ROOT, required(4, "3"), FIFTH, required(10, "b7")],
  },
  {
    id: "dom9",
    suffix: "9",
    name: "dominant ninth",
    family: "dominant",
    degrees: [ROOT, required(4, "3"), FIFTH, required(10, "b7"), spare(14, "9")],
  },
  {
    id: "dom13",
    suffix: "13",
    name: "dominant thirteenth",
    family: "dominant",
    degrees: [ROOT, required(4, "3"), FIFTH, required(10, "b7"), required(21, "13")],
  },
  {
    id: "dom7b9",
    suffix: "7b9",
    name: "dominant seventh, flat ninth",
    family: "dominant",
    degrees: [ROOT, required(4, "3"), FIFTH, required(10, "b7"), required(13, "b9")],
  },
  {
    id: "dom7s9",
    suffix: "7#9",
    name: "dominant seventh, sharp ninth",
    family: "dominant",
    degrees: [ROOT, required(4, "3"), FIFTH, required(10, "b7"), required(15, "#9")],
  },
  {
    id: "dom7s11",
    suffix: "7#11",
    name: "lydian dominant",
    family: "dominant",
    /* The whole point of the chord is the raised eleventh, and it is what
       makes a tritone substitution sound intentional rather than wrong, so it
       is required even though an eleventh normally would not be. */
    degrees: [ROOT, required(4, "3"), FIFTH, required(10, "b7"), required(18, "#11")],
  },
  {
    id: "dom7b13",
    suffix: "7b13",
    name: "dominant seventh, flat thirteenth",
    family: "dominant",
    degrees: [ROOT, required(4, "3"), required(10, "b7"), required(20, "b13")],
  },
  {
    id: "dom7alt",
    suffix: "7alt",
    name: "altered dominant",
    family: "dominant",
    /*
     * NO NATURAL FIFTH AT ALL, and that is the definition rather than an
     * omission. The altered scale has no perfect fifth in it: what sits there
     * is the b13 and the #11. A voicing that keeps the 5 and calls itself
     * altered is the uploaded studio's bug written into the data, where the
     * button changed the label and left the notes alone.
     */
    degrees: [ROOT, required(4, "3"), required(10, "b7"), required(13, "b9"), spare(20, "b13")],
  },
  {
    id: "min7b5",
    suffix: "m7b5",
    name: "half-diminished",
    family: "diminished",
    degrees: [ROOT, required(3, "b3"), required(6, "b5"), required(10, "b7")],
  },
  {
    id: "dim7",
    suffix: "dim7",
    name: "diminished seventh",
    family: "diminished",
    degrees: [ROOT, required(3, "b3"), required(6, "b5"), required(9, "bb7")],
  },
  {
    id: "7sus4",
    suffix: "7sus4",
    name: "dominant seventh, suspended fourth",
    family: "suspended",
    degrees: [ROOT, required(5, "4"), FIFTH, required(10, "b7")],
  },
]

const BY_ID = new Map(QUALITIES.map((quality) => [quality.id, quality]))

export function qualityById(id: string): Quality | null {
  return BY_ID.get(id) ?? null
}

/** A chord is a root and a quality. Nothing about the guitar is in here. */
export type Chord = {
  root: PitchClass
  quality: Quality
}

export function chordOf(root: PitchClass, qualityId: string): Chord | null {
  const quality = qualityById(qualityId)
  return quality ? { root: pc(root), quality } : null
}

/** How the chord is written: "Cmaj7", "Bbm7b5", "F#7alt". */
export function chordSymbol(chord: Chord, preferFlat: boolean): string {
  return `${spell(chord.root, preferFlat)}${chord.quality.suffix}`
}

/** Its formula, as a reader would say it aloud: "1 3 5 b7". */
export function chordFormula(chord: Chord): string {
  return chord.quality.degrees.map((degree) => degree.label).join(" ")
}

/**
 * Every pitch class in the chord.
 *
 * Compressed into one octave, because a guitar voicing does not care which
 * octave a ninth is in, only whether that pitch class is allowed to sound.
 */
export function chordPitchClasses(chord: Chord): Set<PitchClass> {
  return new Set(chord.quality.degrees.map((degree) => pc(chord.root + degree.semitones)))
}

/** The degrees that a voicing may not leave out. */
export function requiredPitchClasses(chord: Chord): Set<PitchClass> {
  return new Set(
    chord.quality.degrees
      .filter((degree) => !degree.optional)
      .map((degree) => pc(chord.root + degree.semitones)),
  )
}

/**
 * What to call a pitch class inside THIS chord.
 *
 * Six semitones is a #11 in a lydian dominant and a b5 in a half-diminished
 * chord, and the difference is not cosmetic: it is which chord the player is
 * looking at. Asking the quality first, and falling back to the ambiguous
 * general label only for a note the chord does not contain, is what lets the
 * fretboard print "#11" under a Db7#11 and "b5" under a Bm7b5.
 */
export function degreeLabelFor(chord: Chord, pitch: PitchClass): string {
  const distance = pc(pitch - chord.root)
  const found = chord.quality.degrees.find((degree) => pc(degree.semitones) === distance)
  return found ? found.label : degreeLabel(distance)
}

/**
 * Is this pitch class one of the two that decide the chord's quality?
 *
 * The 3rd and the 7th, which is what "guide tones" means. Everything the
 * voice-leading panel says about smooth motion is really about these two, so
 * they are worth being able to ask about directly.
 */
export function isGuideTone(chord: Chord, pitch: PitchClass): boolean {
  const distance = pc(pitch - chord.root)
  return [3, 4, 5, 9, 10, 11].includes(distance)
    ? chord.quality.degrees.some(
        (degree) => !degree.optional && pc(degree.semitones) === distance && degree.semitones !== 0,
      )
    : false
}
