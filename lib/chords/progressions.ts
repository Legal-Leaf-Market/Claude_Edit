import { pc, type PitchClass } from "@/lib/chords/pitch"
import { keyName, type Key } from "@/lib/chords/key"
import { chordOf, type Chord } from "@/lib/chords/quality"

/**
 * PROGRESSIONS AS HARMONY, NOT AS SIX FRET NUMBERS.
 *
 * Each chord here is an offset from the tonic and a quality, so a progression
 * exists in every key and on every neck: the voicing search works out the
 * shapes. The studio this replaces stored grips, which meant a progression
 * lived in exactly one key, in exactly one tuning, and "transpose" was not a
 * thing the tool could do at all.
 *
 * The prose is the part worth keeping from the original, and most of it is
 * kept. What has changed is that it now describes something computed: a note
 * saying "the 7th falls a semitone to the 3rd" sits beside an analysis that
 * measured a semitone, rather than beside a hand-typed grip that may or may
 * not still contain those notes.
 */

export type ProgressionChord = {
  /** Semitones above the progression's tonic. */
  offset: number
  qualityId: string
  /** How the chord functions here. Written for the key the preset is in. */
  numeral: string
  /** What to notice, in one or two sentences. */
  note: string
}

export type Progression = {
  id: string
  name: string
  /** The key the preset was written in. It transposes from here. */
  key: Key
  blurb: string
  chords: ProgressionChord[]
}

const major = (tonic: PitchClass): Key => ({ tonic, mode: "major" })
const minor = (tonic: PitchClass): Key => ({ tonic, mode: "minor" })

export const PROGRESSIONS: Progression[] = [
  {
    id: "one-fret-pivot",
    name: "The one-finger pivot",
    key: major(4),
    blurb:
      "Five chords, one root, and almost nothing moving. The point is how little it takes to change what a chord means: the same bass, the same shape, one note walking down.",
    chords: [
      {
        offset: 0,
        qualityId: "maj",
        numeral: "I",
        note: "The starting position. Plain, settled, nothing pulling anywhere.",
      },
      {
        offset: 0,
        qualityId: "maj7",
        numeral: "Imaj7",
        note: "One voice drops a semitone from the root to the seventh. Nothing else has changed and the chord is now unmistakably wistful.",
      },
      {
        offset: 0,
        qualityId: "dom7",
        numeral: "I7",
        note: "The same voice drops another semitone. A major seventh and a minor seventh are one fret apart and the second one wants to go somewhere.",
      },
      {
        offset: 0,
        qualityId: "min",
        numeral: "i",
        note: "Now the third moves instead: down a semitone, and the whole chord turns over. This is the single most consequential note in the system.",
      },
      {
        offset: 0,
        qualityId: "min7",
        numeral: "i7",
        note: "Both moves at once. Flat third, flat seventh, the same root underneath the lot.",
      },
    ],
  },
  {
    id: "two-five-one",
    name: "ii-V-I, and what the guide tones do",
    key: major(0),
    blurb:
      "The most-played three chords in the repertoire. Watch the third and seventh of each chord: one holds and one falls a semitone, then they swap jobs. Everything else is decoration.",
    chords: [
      {
        offset: 2,
        qualityId: "min7",
        numeral: "ii7",
        note: "The approach. Its seventh is the note that will fall; its third is the note that will stay.",
      },
      {
        offset: 7,
        qualityId: "dom7",
        numeral: "V7",
        note: "The seventh of ii has dropped a semitone and become the third of V7. The third of ii did not move at all and is now the seventh of V7. Two voices, one of them stationary.",
      },
      {
        offset: 0,
        qualityId: "maj7",
        numeral: "Imaj7",
        note: "It happens again: the seventh of V7 falls a semitone to the third of I, and the third of V7 holds and becomes the seventh. This is why the cadence sounds inevitable.",
      },
      {
        offset: 0,
        qualityId: "69",
        numeral: "I6/9",
        note: "An ending that does not point anywhere. The major seventh is a bright, slightly unresolved note; swapping it for the sixth and ninth stops the chord leaning forward.",
      },
    ],
  },
  {
    id: "tritone-sub",
    name: "The same cadence with the bass walking down",
    key: major(0),
    blurb:
      "Replace the V7 with the dominant a tritone away. The two notes that do the work are unchanged; only the bass note moves, and now it descends by semitones all the way home.",
    chords: [
      {
        offset: 2,
        qualityId: "min9",
        numeral: "ii9",
        note: "The same approach chord, with a ninth on top for air.",
      },
      {
        offset: 1,
        qualityId: "dom7s11",
        numeral: "bII7",
        note: "The substitution. It shares its third and seventh with the V7 it replaced, swapped over, so it resolves to the same place. The raised eleventh is what stops it sounding like a mistake.",
      },
      {
        offset: 0,
        qualityId: "maj9",
        numeral: "Imaj9",
        note: "Home. The bass has walked down by a semitone at a time, which is the entire reason anybody does this.",
      },
    ],
  },
  {
    id: "backdoor",
    name: "The back door",
    key: major(0),
    blurb:
      "A cadence that arrives from underneath instead of from above. Borrowed from the parallel minor, and once you have heard it you will hear it everywhere in pop and gospel.",
    chords: [
      {
        offset: 0,
        qualityId: "maj7",
        numeral: "Imaj7",
        note: "Home, so there is something to leave.",
      },
      {
        offset: 5,
        qualityId: "min7",
        numeral: "iv7",
        note: "Borrowed from the parallel minor. The flattened sixth degree arrives here and it is what makes the rest sound the way it does.",
      },
      {
        offset: 10,
        qualityId: "dom7",
        numeral: "bVII7",
        note: "The back door itself. Not the dominant of anything in this key, and it still resolves home: its own seventh is a semitone above the third of the tonic chord.",
      },
      {
        offset: 0,
        qualityId: "maj7",
        numeral: "Imaj7",
        note: "Home again, arrived at from below. Compare the pull of this with the V7 in the cadence above.",
      },
    ],
  },
  {
    id: "minor-two-five",
    name: "Minor ii-V-i",
    key: minor(9),
    blurb:
      "The same machinery in a minor key, and it needs one note that the key does not contain: the raised seventh in the dominant chord. That borrowed note is the whole cadence.",
    chords: [
      {
        offset: 2,
        qualityId: "min7b5",
        numeral: "iiø7",
        note: "Half diminished, which is simply what the second degree of a minor key is. The flattened fifth is diatonic here, not an alteration.",
      },
      {
        offset: 7,
        qualityId: "dom7b9",
        numeral: "V7b9",
        note: "The one chord that is not in the key. Natural minor gives a minor v, which does not pull; raising its third borrows the leading note and turns it into a dominant. The flat ninth comes free from the minor scale above it.",
      },
      {
        offset: 0,
        qualityId: "min7",
        numeral: "i7",
        note: "Home. The flat ninth of the dominant falls a semitone into the fifth of the tonic, which is a smaller move than it sounds.",
      },
    ],
  },
  {
    id: "coltrane",
    name: "Giant Steps, first eight bars",
    key: major(11),
    blurb:
      "Three tonics a major third apart, dividing the octave evenly, each announced by its own dominant. There is no pivot anywhere in it: the point is arriving somewhere new before the ear has settled anywhere.",
    chords: [
      { offset: 0, qualityId: "maj7", numeral: "Imaj7", note: "Key centre one." },
      { offset: 3, qualityId: "dom7", numeral: "V7/bIII", note: "Already leaving. This is the dominant of the next centre, a major third down." },
      { offset: 8, qualityId: "maj7", numeral: "Imaj7", note: "Key centre two, a major third below the first." },
      { offset: 11, qualityId: "dom7", numeral: "V7/bVI", note: "And leaving again, immediately." },
      { offset: 4, qualityId: "maj7", numeral: "Imaj7", note: "Key centre three. A major third below the second, and a major third above the first: the cycle closes." },
      { offset: 10, qualityId: "min7", numeral: "ii7", note: "The turn back. A normal ii chord, which after all of that feels like sitting down." },
      { offset: 3, qualityId: "dom7", numeral: "V7", note: "Its dominant." },
      { offset: 8, qualityId: "maj7", numeral: "Imaj7", note: "Resolving to centre two, where the second half of the tune starts." },
    ],
  },
  {
    id: "descending-bass",
    name: "A bass line doing the work",
    key: major(0),
    blurb:
      "Every chord here is chosen so the lowest note falls by a step. The harmony is following the bass rather than the other way round, which is how most memorable progressions are actually built.",
    chords: [
      { offset: 0, qualityId: "maj7", numeral: "Imaj7", note: "Root in the bass." },
      { offset: 11, qualityId: "min7b5", numeral: "viiø7", note: "A step down. This is the tonic chord with a different note underneath it as much as it is a chord in its own right." },
      { offset: 9, qualityId: "min7", numeral: "vi7", note: "Another step. The relative minor, arrived at by walking rather than by jumping." },
      { offset: 8, qualityId: "dom7", numeral: "bVI7", note: "Chromatic, and the first note here that is not in the key. It is going somewhere specific." },
      { offset: 7, qualityId: "dom7", numeral: "V7", note: "And there it is. The bass has descended five semitones without a single leap." },
      { offset: 0, qualityId: "maj7", numeral: "Imaj7", note: "Home." },
    ],
  },
]

/**
 * Turn a preset into actual chords, in whatever key is asked for.
 *
 * THIS IS WHAT MAKES THE PRESETS WORTH HAVING. A stored grip is a progression
 * in one key; a stored offset is the progression itself.
 */
export function chordsOf(progression: Progression, tonic: PitchClass): Chord[] {
  return progression.chords
    .map((entry) => chordOf(pc(tonic + entry.offset), entry.qualityId))
    .filter((chord): chord is Chord => chord !== null)
}

/** The key a preset is in once transposed. */
export function keyOf(progression: Progression, tonic: PitchClass): Key {
  return { tonic: pc(tonic), mode: progression.key.mode }
}

/** "ii-V-I, and what the guide tones do, in Eb major". */
export function progressionTitle(progression: Progression, tonic: PitchClass): string {
  return `${progression.name}, in ${keyName(keyOf(progression, tonic))}`
}
