/**
 * PITCHES, AND HOW THEY ARE SPELLED.
 *
 * The uploaded studio this replaces held everything as a sharp pitch class and
 * printed it that way, so a Db7 chord announced its root as C#, an Eb key
 * showed D#, and a flat-key progression read as a page of accidentals nobody
 * writes. Spelling is not decoration in harmony: Db and C# are the same key on
 * a guitar and different notes on paper, and which one you print is what tells
 * a reader whether they are in the flat world or the sharp one.
 *
 * So a pitch class travels with the key it is being read in, and the key
 * decides the spelling. That is the whole of this file.
 */

/** Semitones above C. Always 0..11. */
export type PitchClass = number

/** A MIDI note number. Middle C is 60. */
export type Midi = number

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

/** Normalise any integer into 0..11. */
export function pc(value: number): PitchClass {
  return ((value % 12) + 12) % 12
}

/**
 * Parse a written note into a pitch class.
 *
 * Handles double accidentals and the enharmonics a key signature genuinely
 * produces (Cb, E#, Fb, B#), because a modulation to Gb major has a Cb in it
 * and a parser that answers 0 for anything it does not recognise turns that
 * into a silent wrong chord rather than an error.
 */
export function parseNote(name: string): PitchClass | null {
  const match = /^([A-Ga-g])([#b♯♭x]*)$/.exec(name.trim())
  if (!match) return null

  const letters: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
  let value = letters[match[1].toLowerCase()]

  for (const accidental of match[2]) {
    if (accidental === "#" || accidental === "♯") value += 1
    else if (accidental === "b" || accidental === "♭") value -= 1
    else if (accidental === "x") value += 2
  }

  return pc(value)
}

/**
 * Print a pitch class, in sharps or flats.
 *
 * `preferFlat` comes from the key rather than from a setting, so the caller
 * never has to remember which world it is in: `spell(pitch, keyPrefersFlats)`.
 */
export function spell(value: PitchClass, preferFlat: boolean): string {
  return (preferFlat ? FLAT_NAMES : SHARP_NAMES)[pc(value)]
}

/** Octave-independent distance from `from` up to `to`, in semitones. */
export function intervalFrom(from: PitchClass, to: PitchClass): number {
  return pc(to - from)
}

/**
 * How far apart two actual pitches are, in semitones.
 *
 * Signed, because voice leading cares which way a voice moved: a 7th falling a
 * semitone to a 3rd is the whole argument for a ii-V-I, and the same distance
 * upward is a different event.
 */
export function motion(from: Midi, to: Midi): number {
  return to - from
}

/** Concert pitch. A4 = 440Hz, MIDI 69. */
export function midiToFrequency(midi: Midi): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** MIDI note to a written name with its octave, e.g. 64 -> "E4". */
export function midiToName(midi: Midi, preferFlat: boolean): string {
  return `${spell(pc(midi), preferFlat)}${Math.floor(midi / 12) - 1}`
}

/**
 * The name of a scale degree, given its distance from the root.
 *
 * ONE LABEL PER SEMITONE, AND SOME OF THEM ARE A COMPROMISE. Six semitones is
 * a #11 in a dominant chord and a b5 in a half-diminished one, and nine is a
 * 13 over a dominant and a 6 over a major triad; the honest thing at this
 * layer, which knows the interval and not yet the chord, is to print both
 * rather than pick the wrong one. `degreeLabelFor` below narrows it once the
 * quality is known.
 */
export function degreeLabel(semitones: number): string {
  return ["R", "b9", "9", "b3", "3", "11", "b5/#11", "5", "#5/b13", "6/13", "b7", "7"][
    pc(semitones)
  ]
}
