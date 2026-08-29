import { pc, type Midi } from "@/lib/chords/pitch"
import {
  MAX_FRET,
  bassNote,
  noteAt,
  pitchAt,
  shapeNotes,
  type Shape,
  type Tuning,
} from "@/lib/chords/fretboard"
import { chordPitchClasses, requiredPitchClasses, type Chord } from "@/lib/chords/quality"

/**
 * VOICINGS ARE FOUND, NOT TYPED.
 *
 * This is the piece that makes the whole tool honest. The studio it replaces
 * stored six fret numbers per chord, hand-typed, which means:
 *
 *   - a chord nobody typed does not exist,
 *   - every grip is a standard-tuning grip, so choosing DADGAD silently showed
 *     the wrong notes under the right names,
 *   - "make this dominant altered" changed the label and left the notes alone,
 *     because there was nothing to change them to,
 *   - and the "shell voicing" button did arithmetic on fret NUMBERS
 *     (`frets[1] - 1`, `frets[1] + 1`) with no idea what note it landed on,
 *     destroying the stored grip on the way so the toggle could never be
 *     undone.
 *
 * Searching the neck fixes all four at once, and it is a small search: six
 * strings, a four-fret window, a handful of candidate notes per string.
 *
 * WHAT MAKES A VOICING GOOD IS NOT TASTE. It is whether a hand can hold it and
 * whether the chord is still the chord. Both are checkable, and both are
 * checked below, which is why this returns a ranked list rather than one
 * answer: the panel offers the alternatives instead of pretending there is a
 * single correct grip.
 */

export type Voicing = {
  shape: Shape
  /** Sounding pitches, low to high. */
  notes: Midi[]
  /** Lowest fretted fret, or 0 for an all-open shape. Where the hand sits. */
  position: number
  /** Fretted frets spanned. An open string costs nothing. */
  span: number
  /** Fingers needed, counting a barre at the lowest fret as one. */
  fingers: number
  /** True when the lowest sounding note is the root. */
  rootInBass: boolean
  /** Which degrees are actually sounding, by label. */
  degrees: string[]
  /** Higher is more playable and more complete. See `scoreVoicing`. */
  score: number
  /** Set when the search was given a chord to come from. Semitones moved. */
  motionFromPrevious?: number
}

export type VoicingOptions = {
  /** Where on the neck to look. Both inclusive. */
  minFret?: number
  maxFret?: number
  /** Largest reach in frets. Four is a normal hand; five is a stretch. */
  maxSpan?: number
  /** Smallest number of sounding strings. */
  minStrings?: number
  /**
   * Insist the lowest note is the root.
   *
   * ON BY DEFAULT, because a teaching tool that quietly hands you a second
   * inversion when you asked for the chord is teaching the wrong thing. Turn
   * it off to see slash voicings on purpose.
   */
  rootInBass?: boolean
  /**
   * Drop everything but root, third and seventh.
   *
   * The jazz shell, done properly: it is a statement about DEGREES, so it is
   * expressed as degrees and the search finds shapes that contain those and
   * nothing else. The version this replaces subtracted one from a fret number
   * and hoped.
   */
  shell?: boolean
  /** Rank by smallest movement from this voicing, not just by playability. */
  from?: Voicing | null
  /** How many to return. */
  limit?: number
}

/**
 * WHAT A HAND CAN DO, as three numbers rather than as a feeling.
 *
 * A barre counts as one finger, which is what makes a six-string F possible at
 * all; anything else needs its own finger. Four is the limit because a thumb
 * over the top is a real technique and not one a tool should assume.
 */
const MAX_FINGERS = 4
const DEFAULT_SPAN = 4

/** Fingers a shape needs, treating the lowest fretted fret as barrable. */
function fingerCount(shape: Shape): number {
  const fretted = shape.filter((fret): fret is number => fret !== null && fret > 0)
  if (!fretted.length) return 0

  const lowest = Math.min(...fretted)
  const onLowest = fretted.filter((fret) => fret === lowest).length
  const above = fretted.filter((fret) => fret > lowest).length

  /* One finger for the lowest fret whether it holds one string or five; the
     rest need one each. */
  return (onLowest > 0 ? 1 : 0) + above
}

/** Muted strings sitting between two sounding ones. Playable, but awkward. */
function innerMutes(shape: Shape): number {
  const sounding = shape.map((fret) => fret !== null)
  const first = sounding.indexOf(true)
  const last = sounding.lastIndexOf(true)
  if (first < 0) return 0

  let count = 0
  for (let i = first; i <= last; i++) if (!sounding[i]) count += 1
  return count
}

/**
 * Rank a shape.
 *
 * The weights are deliberately blunt and all in one place, so the reason a
 * voicing came top is readable rather than emergent. Completeness first,
 * because a chord missing its third is a different chord; then the hand.
 */
function scoreVoicing(voicing: Omit<Voicing, "score">, chord: Chord, options: VoicingOptions): number {
  let score = 0

  const sounding = voicing.shape.filter((fret) => fret !== null).length
  const all = chordPitchClasses(chord)
  const present = new Set(voicing.notes.map((note) => pc(note)))
  let covered = 0
  for (const pitch of all) if (present.has(pitch)) covered += 1

  /* Every distinct chord tone that made it in. The biggest term by design. */
  score += covered * 26

  /* A hand that fits. */
  score -= Math.max(0, voicing.span - 3) * 9
  score -= Math.max(0, voicing.fingers - 3) * 7
  score -= innerMutes(voicing.shape) * 14

  /* More strings ringing is generally better, up to a point: a six-string
     voicing with the root doubled twice is not better than a clean four. */
  score += Math.min(sounding, 5) * 4

  if (voicing.rootInBass) score += 12

  /* Low on the neck is easier and is where these shapes are usually taught,
     unless the caller asked for a region. */
  score -= voicing.position * 0.7

  /* An open string is free and it rings longer than a fretted one. */
  score += voicing.shape.filter((fret) => fret === 0).length * 3

  if (options.from && voicing.motionFromPrevious != null) {
    /*
     * MINIMAL MOTION, WEIGHTED HEAVILY WHEN ASKED FOR. The entire subject of
     * this tool is that good progressions move few voices a short way, so
     * when a previous chord is supplied it should dominate everything except
     * completeness.
     */
    score -= voicing.motionFromPrevious * 6
  }

  return score
}

/**
 * Total semitone movement from one voicing to another.
 *
 * NOT FRET DELTAS PER STRING, which is what the studio this replaces measured
 * and called voice leading. Two problems with that: a string muted in one
 * chord and fretted in the next was skipped entirely, so the biggest motion in
 * the change was invisible, and it described what the HAND did rather than
 * what the ear heard. This matches pitches to pitches and takes the cheapest
 * assignment, which is the actual definition.
 *
 * Exhaustive over permutations because a guitar chord has at most seven notes,
 * so the worst case is 5040 comparisons of two integers.
 */
export function totalMotion(from: Midi[], to: Midi[]): number {
  if (!from.length || !to.length) return 0

  const [small, large] = from.length <= to.length ? [from, to] : [to, from]
  let best = Infinity

  const used = new Array<boolean>(large.length).fill(false)

  const walk = (index: number, running: number) => {
    if (running >= best) return
    if (index === small.length) {
      best = Math.min(best, running)
      return
    }
    for (let i = 0; i < large.length; i++) {
      if (used[i]) continue
      used[i] = true
      walk(index + 1, running + Math.abs(small[index] - large[i]))
      used[i] = false
    }
  }

  walk(0, 0)
  return best === Infinity ? 0 : best
}

/**
 * Every playable voicing of a chord on a neck, best first.
 *
 * The search is a sliding window: for each starting fret, each string may play
 * an open string, one of the chord's notes inside the window, or nothing. That
 * is at most four options per string, so a six-string neck is a few thousand
 * combinations per window and a few tens of thousands overall, which is
 * nothing. The pruning below matters more for the QUALITY of the list than for
 * its speed.
 */
export function voicingsFor(chord: Chord, tuning: Tuning, options: VoicingOptions = {}): Voicing[] {
  const minFret = options.minFret ?? 0
  const maxFret = Math.min(options.maxFret ?? MAX_FRET, MAX_FRET)
  const maxSpan = options.maxSpan ?? DEFAULT_SPAN
  const wantRootInBass = options.rootInBass ?? true
  const limit = options.limit ?? 8

  const allowed = shellPitchClasses(chord, options.shell === true)
  const needed = shellPitchClasses(chord, options.shell === true, true)
  const minStrings = options.minStrings ?? Math.max(3, needed.size)

  const found: Voicing[] = []
  const seen = new Set<string>()

  for (let window = minFret; window + maxSpan <= maxFret + maxSpan && window <= maxFret; window++) {
    /* Candidate frets per string inside this window, plus the open string. */
    const perString: (number | null)[][] = tuning.strings.map((_, string) => {
      const candidates: (number | null)[] = [null]

      if (allowed.has(pitchAt(tuning, string, 0)) && minFret === 0) candidates.push(0)

      for (let fret = Math.max(window, 1); fret <= Math.min(window + maxSpan, maxFret); fret++) {
        if (allowed.has(pitchAt(tuning, string, fret))) candidates.push(fret)
      }

      return candidates
    })

    const shape: Shape = new Array(tuning.strings.length).fill(null)

    const walk = (string: number) => {
      if (found.length > 4000) return
      if (string === tuning.strings.length) {
        consider([...shape])
        return
      }
      for (const fret of perString[string]) {
        shape[string] = fret
        walk(string + 1)
      }
      shape[string] = null
    }

    const consider = (candidate: Shape) => {
      const notes = shapeNotes(tuning, candidate)
      if (notes.length < minStrings) return

      const present = new Set(notes.map((note) => pc(note)))
      for (const pitch of needed) if (!present.has(pitch)) return

      const fretted = candidate.filter((fret): fret is number => fret !== null && fret > 0)
      const position = fretted.length ? Math.min(...fretted) : 0
      const span = fretted.length ? Math.max(...fretted) - position : 0
      if (span > maxSpan) return

      const fingers = fingerCount(candidate)
      if (fingers > MAX_FINGERS) return

      /* Two muted strings in the middle is not a chord anybody plays. */
      if (innerMutes(candidate) > 1) return

      const bass = bassNote(tuning, candidate)
      const rootInBass = bass !== null && pc(bass) === chord.root
      if (wantRootInBass && !rootInBass) return

      const key = candidate.map((fret) => (fret === null ? "x" : fret)).join(",")
      if (seen.has(key)) return
      seen.add(key)

      const partial: Omit<Voicing, "score"> = {
        shape: candidate,
        notes,
        position,
        span,
        fingers,
        rootInBass,
        degrees: degreesOf(chord, notes),
        motionFromPrevious: options.from ? totalMotion(options.from.notes, notes) : undefined,
      }

      found.push({ ...partial, score: scoreVoicing(partial, chord, options) })
    }

    walk(0)
  }

  found.sort((a, b) => b.score - a.score)

  return dedupeByHand(found, chord).slice(0, limit)
}

/**
 * Which degrees are sounding, in pitch order, without repeats.
 *
 * The panel prints this under the chord, and it is the thing that tells a
 * player why one voicing sounds thinner than another: "R 3 b7" and "R 3 5 b7"
 * are both correct and only one of them is a shell.
 */
function degreesOf(chord: Chord, notes: Midi[]): string[] {
  const labels: string[] = []
  const seen = new Set<number>()

  for (const note of notes) {
    const distance = pc(pc(note) - chord.root)
    if (seen.has(distance)) continue
    seen.add(distance)
    const degree = chord.quality.degrees.find((entry) => pc(entry.semitones) === distance)
    labels.push(degree ? degree.label : "?")
  }

  return labels
}

/**
 * The pitch classes a voicing may use, and the ones it must.
 *
 * `shell` is the interesting case and it is the reason this is a function
 * rather than two calls to `chordPitchClasses`. A shell is root, third and
 * seventh: it is defined by what it EXCLUDES, so the fifth and every extension
 * have to leave the allowed set too, or the search will happily find a
 * four-note shape and call it a shell.
 */
function shellPitchClasses(chord: Chord, shell: boolean, requiredOnly = false): Set<number> {
  if (!shell) return requiredOnly ? requiredPitchClasses(chord) : chordPitchClasses(chord)

  const keep = chord.quality.degrees.filter((degree) => {
    const distance = pc(degree.semitones)
    /* Root, any third or suspended fourth, any seventh. Nothing else. */
    return distance === 0 || distance === 3 || distance === 4 || distance === 5 || distance === 10 || distance === 11
  })

  return new Set(keep.map((degree) => pc(chord.root + degree.semitones)))
}

/**
 * Keep the list varied instead of ten shapes one fret apart.
 *
 * A ranked search naturally returns near-duplicates, and a picker offering
 * "root 5 bar at 5" next to "root 5 bar at 6" is offering one idea twice.
 *
 * TWO VOICINGS ARE THE SAME WHEN THE HAND IS IN THE SAME PLACE AND THE SAME
 * DEGREES COME OUT IN THE SAME ORDER, which is narrower than it first looks
 * and the first attempt got it wrong: keying on position and string count
 * alone threw away `x-5-7-5-6-5`, the root-5 Dm7 bar every guitarist knows,
 * because `x-5-0-5-6-5` sits at the same fret with the same five strings
 * ringing. They are not the same chord shape. One doubles the fifth and one
 * doubles the root, and that is audibly the difference between them.
 */
function dedupeByHand(voicings: Voicing[], chord: Chord): Voicing[] {
  const kept: Voicing[] = []
  const seen = new Set<string>()

  for (const voicing of voicings) {
    const degrees = voicing.notes.map((note) => pc(pc(note) - chord.root)).join(",")
    const key = `${voicing.position}:${degrees}`
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(voicing)
  }

  return kept
}

/**
 * One voicing: the best available, optionally led into from another.
 *
 * Returns null rather than something approximate when the neck genuinely
 * cannot hold the chord, which happens in an open tuning far more often than
 * people expect. Saying so is the point: the studio this replaces would have
 * shown a standard-tuning grip under a DADGAD heading.
 */
export function bestVoicing(
  chord: Chord,
  tuning: Tuning,
  options: VoicingOptions = {},
): Voicing | null {
  return voicingsFor(chord, tuning, { ...options, limit: 1 })[0] ?? null
}

/**
 * Voice a whole progression so each chord leads into the next.
 *
 * GREEDY, FORWARD, AND HONEST ABOUT IT. The globally optimal path through a
 * progression is a shortest-path problem over every voicing of every chord,
 * and it is genuinely better; it is also slower and produces shapes a player
 * has to be talked into. Choosing the first chord for playability and then
 * each next one for the smallest move is what a guitarist actually does, and
 * it is what the voice-leading panel is trying to teach.
 */
export function voiceProgression(
  chords: Chord[],
  tuning: Tuning,
  options: VoicingOptions = {},
): (Voicing | null)[] {
  const out: (Voicing | null)[] = []
  let previous: Voicing | null = null

  for (const chord of chords) {
    const voicing = bestVoicing(chord, tuning, { ...options, from: previous })
    out.push(voicing)
    if (voicing) previous = voicing
  }

  return out
}

/** Every note of a shape, for the audio engine. */
export function voicingMidi(tuning: Tuning, shape: Shape): Midi[] {
  return shape
    .map((fret, string) => (fret === null ? null : noteAt(tuning, string, fret)))
    .filter((note): note is Midi => note !== null)
}
