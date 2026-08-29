import { pc, type Midi, type PitchClass } from "@/lib/chords/pitch"

/**
 * THE NECK.
 *
 * STRINGS RUN LOW TO HIGH, index 0 is the fat one, and that ordering is not
 * arbitrary: it is the order a chord diagram is written in ("x32010" starts at
 * the 6th string), so the data and the picture agree without anybody reversing
 * anything. The studio this replaces stored its tunings high-to-low and its
 * chords low-to-high, and then reversed the index at every use site with a
 * comment explaining which way round it was. Every one of those comments was a
 * chance to get it wrong.
 */

export type Tuning = {
  id: string
  name: string
  /** Open-string MIDI notes, lowest string first. */
  strings: Midi[]
  /** True when this tuning is what the stock voicing library assumes. */
  standard?: boolean
}

export const TUNINGS: Tuning[] = [
  { id: "standard", name: "Standard (E A D G B E)", strings: [40, 45, 50, 55, 59, 64], standard: true },
  { id: "drop-d", name: "Drop D (D A D G B E)", strings: [38, 45, 50, 55, 59, 64] },
  { id: "dadgad", name: "DADGAD (D A D G A D)", strings: [38, 45, 50, 55, 57, 62] },
  { id: "open-d", name: "Open D (D A D F# A D)", strings: [38, 45, 50, 54, 57, 62] },
  { id: "open-g", name: "Open G (D G D G B D)", strings: [38, 43, 50, 55, 59, 62] },
  { id: "half-down", name: "Half step down (Eb Ab Db Gb Bb Eb)", strings: [39, 44, 49, 54, 58, 63] },
  /* A seven-string, because the whole voicing engine is a search and nothing
     in it assumes six. Adding one is a row. */
  { id: "seven-standard", name: "Seven string (B E A D G B E)", strings: [35, 40, 45, 50, 55, 59, 64] },
]

export function tuningById(id: string): Tuning {
  return TUNINGS.find((tuning) => tuning.id === id) ?? TUNINGS[0]
}

/** How far up the neck this tool looks. Past here nobody voices a chord. */
export const MAX_FRET = 15

/** The MIDI note sounding at one position. */
export function noteAt(tuning: Tuning, string: number, fret: number): Midi {
  return tuning.strings[string] + fret
}

/** Its pitch class. */
export function pitchAt(tuning: Tuning, string: number, fret: number): PitchClass {
  return pc(noteAt(tuning, string, fret))
}

/**
 * A shape: one entry per string, lowest first. `null` is a muted string.
 *
 * Fret 0 is an open string and is genuinely free: it needs no finger, costs
 * nothing in the span, and is why guitar harmony in E and A sounds different
 * from guitar harmony in Eb. The scorer in `voicing.ts` treats it that way.
 */
export type Shape = (number | null)[]

/** "x32010", the way a chord chart writes it. */
export function shapeToString(shape: Shape): string {
  return shape.map((fret) => (fret === null ? "x" : String(fret))).join("-")
}

/** Every string that actually sounds, low to high, as MIDI. */
export function shapeNotes(tuning: Tuning, shape: Shape): Midi[] {
  const notes: Midi[] = []
  shape.forEach((fret, string) => {
    if (fret !== null) notes.push(noteAt(tuning, string, fret))
  })
  return notes
}

/** The lowest sounding note, which is what the ear hears as the bass. */
export function bassNote(tuning: Tuning, shape: Shape): Midi | null {
  const notes = shapeNotes(tuning, shape)
  return notes.length ? notes[0] : null
}

/** The inlay positions on a normal neck, so the drawing has landmarks. */
export const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21]
export const DOUBLE_INLAY_FRETS = [12, 24]
