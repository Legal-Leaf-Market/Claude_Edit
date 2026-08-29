import { pc, type Midi } from "@/lib/chords/pitch"
import type { Tuning } from "@/lib/chords/fretboard"
import { degreeLabelFor, type Chord } from "@/lib/chords/quality"
import type { Voicing } from "@/lib/chords/voicing"

/**
 * WHAT MOVED, AND WHAT THE HAND DID. TWO DIFFERENT QUESTIONS.
 *
 * The studio this replaces answered one question and labelled it the other. It
 * compared FRET NUMBERS ON THE SAME STRING between consecutive chords, called
 * a difference of zero a common tone, and skipped any string that was muted in
 * either chord. Two things go wrong with that, and both matter:
 *
 *   - A string that is muted in one chord and fretted in the next is usually
 *     the biggest event in the change, and it was invisible.
 *   - The same fret on the same string IS a common tone, but so is the same
 *     PITCH found on a different string, and that is most of them. A voicing
 *     that keeps a note by moving it from the D string to the G string was
 *     reported as two moves and no common tone.
 *
 * So both are computed here and both are named. `fingerMoves` is what your
 * hand does and is why one grip feels easier than another. `voiceMoves` is
 * what a listener hears, and it is the thing every claim about good voice
 * leading is actually about.
 */

export type VoiceMove = {
  from: Midi
  to: Midi
  /** Signed semitones. Negative is downward, which matters: see `guideTones`. */
  semitones: number
  /** What the note was in the old chord, and what it becomes in the new one. */
  fromDegree: string
  toDegree: string
}

export type FingerMove = {
  string: number
  from: number | null
  to: number | null
  /** Null when a string is muted at either end: there is no fret distance. */
  frets: number | null
  kind: "held" | "moved" | "added" | "dropped" | "silent"
}

export type VoiceLeading = {
  /** Pitches that survive the change, matched cheapest-first. */
  moves: VoiceMove[]
  /** Notes with nowhere to go, and notes that arrive from nowhere. */
  dropped: Midi[]
  added: Midi[]
  /** Total semitones travelled by the matched voices. Lower is smoother. */
  total: number
  /** Voices that did not move at all. */
  held: number
  /** Moves of one semitone, which is what the whole subject is about. */
  semitoneSteps: number
  /** What the fretting hand does, string by string. */
  fingerMoves: FingerMove[]
  /**
   * The 3rd and 7th specifically, because they are the chord's identity and
   * their motion is the reason a ii-V-I sounds inevitable.
   */
  guideTones: VoiceMove[]
}

/**
 * Match the old chord's pitches to the new one's as cheaply as possible.
 *
 * Exhaustive, because a guitar chord is at most seven notes and the cost of
 * getting this wrong is an explanation that contradicts what a player hears.
 * The leftovers on either side are reported rather than absorbed: a chord that
 * gains a voice has gained one, and saying so is more useful than pretending
 * everything mapped.
 */
function matchVoices(from: Midi[], to: Midi[]): { pairs: [Midi, Midi][]; dropped: Midi[]; added: Midi[] } {
  if (!from.length || !to.length) {
    return { pairs: [], dropped: from.length ? [...from] : [], added: to.length ? [...to] : [] }
  }

  const flipped = from.length > to.length
  const [small, large] = flipped ? [to, from] : [from, to]

  /* Typed explicitly: inferred from `null` alone, TypeScript narrows this to
     `never[]` at the read site and rejects the indexing below. */
  let best: number[] | null = null as number[] | null
  let bestCost = Infinity
  const used = new Array<boolean>(large.length).fill(false)
  const choice = new Array<number>(small.length).fill(-1)

  const walk = (index: number, running: number) => {
    if (running >= bestCost) return
    if (index === small.length) {
      bestCost = running
      best = [...choice]
      return
    }
    for (let i = 0; i < large.length; i++) {
      if (used[i]) continue
      used[i] = true
      choice[index] = i
      walk(index + 1, running + Math.abs(small[index] - large[i]))
      used[i] = false
    }
  }

  walk(0, 0)

  const chosen: number[] = best ?? []
  const pairs: [Midi, Midi][] = chosen.map((largeIndex, smallIndex) =>
    flipped ? [large[largeIndex], small[smallIndex]] : [small[smallIndex], large[largeIndex]],
  )

  const leftover = large.filter((_, index) => !chosen.includes(index))

  return {
    pairs,
    dropped: flipped ? leftover : [],
    added: flipped ? [] : leftover,
  }
}

export function analyseVoiceLeading(
  fromChord: Chord,
  fromVoicing: Voicing,
  toChord: Chord,
  toVoicing: Voicing,
): VoiceLeading {
  const { pairs, dropped, added } = matchVoices(fromVoicing.notes, toVoicing.notes)

  const moves: VoiceMove[] = pairs.map(([a, b]) => ({
    from: a,
    to: b,
    semitones: b - a,
    fromDegree: degreeLabelFor(fromChord, pc(a)),
    toDegree: degreeLabelFor(toChord, pc(b)),
  }))

  const fingerMoves: FingerMove[] = fromVoicing.shape.map((fret, string) => {
    const next = toVoicing.shape[string] ?? null
    if (fret === null && next === null) {
      return { string, from: null, to: null, frets: null, kind: "silent" }
    }
    if (fret === null) return { string, from: null, to: next, frets: null, kind: "added" }
    if (next === null) return { string, from: fret, to: null, frets: null, kind: "dropped" }
    return {
      string,
      from: fret,
      to: next,
      frets: next - fret,
      kind: next === fret ? "held" : "moved",
    }
  })

  return {
    moves,
    dropped,
    added,
    total: moves.reduce((sum, move) => sum + Math.abs(move.semitones), 0),
    held: moves.filter((move) => move.semitones === 0).length,
    semitoneSteps: moves.filter((move) => Math.abs(move.semitones) === 1).length,
    fingerMoves,
    guideTones: moves.filter(
      (move) => isGuide(fromChord, move.from) || isGuide(toChord, move.to),
    ),
  }
}

/** A third or a seventh of its own chord: the two notes that decide quality. */
function isGuide(chord: Chord, note: Midi): boolean {
  const distance = pc(pc(note) - chord.root)
  return [3, 4, 10, 11].includes(distance)
}

/**
 * One sentence about how smooth the change is, in the tool's own voice.
 *
 * DERIVED FROM THE NUMBERS RATHER THAN WRITTEN ALONGSIDE THEM, which is the
 * difference between a description and a caption. The old studio's prose was
 * typed once per progression and stayed the same when the voicings changed
 * under it, so pressing "shell" left a paragraph on screen describing notes
 * that were no longer sounding.
 */
export function describeVoiceLeading(analysis: VoiceLeading): string {
  const { held, semitoneSteps, total, moves } = analysis

  if (!moves.length) return "Nothing to compare yet."

  const average = total / moves.length
  const character =
    average <= 0.6
      ? "About as smooth as this gets"
      : average <= 1.4
        ? "Smooth"
        : average <= 2.6
          ? "A real move, but a controlled one"
          : "A jump"

  const parts = [
    `${character}: ${total} semitone${total === 1 ? "" : "s"} across ${moves.length} voice${moves.length === 1 ? "" : "s"}`,
  ]
  if (held) parts.push(`${held} held`)
  if (semitoneSteps) parts.push(`${semitoneSteps} moving by a half step`)
  if (analysis.added.length) parts.push(`${analysis.added.length} voice added`)
  if (analysis.dropped.length) parts.push(`${analysis.dropped.length} voice dropped`)

  return `${parts.join(", ")}.`
}

/** What the fretting hand has to do, for the panel beside the diagram. */
export function describeFingerWork(analysis: VoiceLeading, tuning: Tuning): string {
  const moved = analysis.fingerMoves.filter((move) => move.kind === "moved")
  const held = analysis.fingerMoves.filter((move) => move.kind === "held")
  const changed = analysis.fingerMoves.filter(
    (move) => move.kind === "added" || move.kind === "dropped",
  )

  if (!moved.length && !changed.length) {
    return "The hand does not move at all: every string keeps its fret."
  }

  const bits: string[] = []
  if (held.length) bits.push(`${held.length} string${held.length === 1 ? "" : "s"} stay put`)
  if (moved.length) {
    const biggest = Math.max(...moved.map((move) => Math.abs(move.frets ?? 0)))
    bits.push(
      `${moved.length} refret${moved.length === 1 ? "s" : ""}, the largest by ${biggest} fret${biggest === 1 ? "" : "s"}`,
    )
  }
  if (changed.length) {
    bits.push(`${changed.length} string${changed.length === 1 ? "" : "s"} come in or drop out`)
  }

  return `${bits.join(", ")}. ${tuning.strings.length} strings on the neck.`
}
