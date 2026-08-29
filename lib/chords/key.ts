import { pc, spell, type PitchClass } from "@/lib/chords/pitch"
import { chordOf, chordSymbol, type Chord } from "@/lib/chords/quality"

/**
 * KEYS, AND THE CHORDS THAT ACTUALLY BELONG TO THEM.
 *
 * This file exists because the studio it replaces had no idea what a key was.
 * Its modulation planner took a "from" key and a "to" key off two dropdowns,
 * ignored both, emitted the same four hard-coded grips every time, and printed
 * a confident sentence explaining that Am7 is the vi of the first key and the
 * ii of the second. That is true for C and G. It is false for every other pair
 * the dropdowns offer, and nothing about the page says so: the shapes look
 * right, the prose reads right, and a player learns a wrong thing.
 *
 * That is the same failure this project treats as unforgivable everywhere else
 * (CLAUDE.md section 8: inventing a market price is worse than publishing
 * none). A pivot chord is a fact about two key signatures, and a fact can be
 * computed. So it is.
 */

export type Mode = "major" | "minor"

export type Key = {
  tonic: PitchClass
  mode: Mode
}

/**
 * Major scale, then natural minor.
 *
 * NATURAL MINOR RATHER THAN HARMONIC, with the harmonic V7 added by hand
 * below. Both are true of minor keys and neither alone is: the scale a melody
 * uses is natural, and the dominant a cadence uses is harmonic. Picking one
 * and pretending is how a tool ends up claiming a minor key has no V7 in it.
 */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]

const MAJOR_QUALITIES = ["maj7", "min7", "min7", "maj7", "dom7", "min7", "min7b5"]
const MINOR_QUALITIES = ["min7", "min7b5", "maj7", "min7", "min7", "maj7", "dom7"]

const MAJOR_NUMERALS = ["Imaj7", "ii7", "iii7", "IVmaj7", "V7", "vi7", "viiø7"]
const MINOR_NUMERALS = ["i7", "iiø7", "bIIImaj7", "iv7", "v7", "bVImaj7", "bVII7"]

/**
 * WHICH KEYS ARE WRITTEN WITH FLATS.
 *
 * Not a guess from the pitch class: F major has one flat and F# major has six
 * sharps, and they are a semitone apart. This is the circle of fifths, which
 * is a fact about notation rather than about sound, and it is the only thing
 * that makes a Db7 print as Db7 instead of as C#7.
 *
 * Keys on the boundary (Gb/F#, Db/C#, Cb/B) are given the spelling players
 * actually read on a chart.
 */
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1, 6]) /* F Bb Eb Ab Db Gb */
const FLAT_MINOR_TONICS = new Set([2, 7, 0, 5, 10, 3]) /* d g c f bb eb */

export function keyPrefersFlats(key: Key): boolean {
  return key.mode === "major" ? FLAT_MAJOR_TONICS.has(pc(key.tonic)) : FLAT_MINOR_TONICS.has(pc(key.tonic))
}

/** "Eb major", "F# minor". */
export function keyName(key: Key): string {
  return `${spell(key.tonic, keyPrefersFlats(key))} ${key.mode}`
}

export type DiatonicChord = {
  chord: Chord
  /** 1-based scale degree. */
  degree: number
  /** "ii7", "V7", "bVImaj7". */
  numeral: string
}

/**
 * The seventh chords of a key.
 *
 * SEVENTHS RATHER THAN TRIADS, because everything this tool is for lives in
 * seventh-chord harmony: guide tones are the 3rd and the 7th, a ii-V-I is
 * three sevenths, and a tritone substitution is defined by a tritone that only
 * exists once there is a 7th. Triads are available by ignoring the top note.
 */
export function diatonicChords(key: Key): DiatonicChord[] {
  const steps = key.mode === "major" ? MAJOR_STEPS : MINOR_STEPS
  const qualities = key.mode === "major" ? MAJOR_QUALITIES : MINOR_QUALITIES
  const numerals = key.mode === "major" ? MAJOR_NUMERALS : MINOR_NUMERALS

  return steps.map((step, index) => ({
    chord: chordOf(pc(key.tonic + step), qualities[index])!,
    degree: index + 1,
    numeral: numerals[index],
  }))
}

/**
 * The chords a key uses that are not in its scale, and are not borrowed.
 *
 * In a minor key the dominant is the whole reason harmonic minor exists: the
 * bVII7 of natural minor does not pull home, and V7 with a raised leading note
 * does. Returning it separately, rather than folding it into `diatonicChords`,
 * keeps the scale honest while making the cadence available.
 */
export function functionalDominant(key: Key): DiatonicChord {
  return {
    chord: chordOf(pc(key.tonic + 7), "dom7")!,
    degree: 5,
    numeral: "V7",
  }
}

/** Every chord a key can plausibly call its own, for pivot hunting. */
export function chordsInKey(key: Key): DiatonicChord[] {
  return key.mode === "minor" ? [...diatonicChords(key), functionalDominant(key)] : diatonicChords(key)
}

/**
 * The scale degrees of a key, as pitch classes.
 *
 * Used by the modulation planner to count how many notes two keys share, which
 * is the actual measure of how far apart they are: C and G share six of seven
 * and sit next to each other on the circle; C and F# share two and sit
 * opposite.
 */
export function scalePitchClasses(key: Key): Set<PitchClass> {
  const steps = key.mode === "major" ? MAJOR_STEPS : MINOR_STEPS
  return new Set(steps.map((step) => pc(key.tonic + step)))
}

/** How many notes two keys have in common. Seven means the same key. */
export function sharedNotes(from: Key, to: Key): number {
  const target = scalePitchClasses(to)
  let count = 0
  for (const note of scalePitchClasses(from)) if (target.has(note)) count += 1
  return count
}

/**
 * How the same chord is numbered in a given key, or null if it is foreign.
 *
 * THE WHOLE POINT OF A PIVOT is that one chord has two names, so being able to
 * ask "what do you call this in your key?" and get an honest null is what makes
 * a pivot detectable rather than assertable.
 */
export function numeralIn(key: Key, chord: Chord): string | null {
  const found = chordsInKey(key).find(
    (entry) => entry.chord.root === chord.root && entry.chord.quality.id === chord.quality.id,
  )
  return found ? found.numeral : null
}

/** Print a chord the way this key would write it. */
export function symbolIn(key: Key, chord: Chord): string {
  return chordSymbol(chord, keyPrefersFlats(key))
}

/**
 * Every key, in the order players think about them: around the circle of
 * fifths rather than up the chromatic scale, so the neighbours in the list are
 * the neighbours in the harmony.
 */
export function allKeys(mode: Mode): Key[] {
  const circle = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]
  return circle.map((tonic) => ({ tonic, mode }))
}
