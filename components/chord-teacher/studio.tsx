"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from "lucide-react"
import { pc, spell, type PitchClass } from "@/lib/chords/pitch"
import { TUNINGS, shapeToString, tuningById } from "@/lib/chords/fretboard"
import { chordFormula, chordSymbol, type Chord } from "@/lib/chords/quality"
import { allKeys, keyName, keyPrefersFlats, numeralIn, type Key } from "@/lib/chords/key"
import { PROGRESSIONS, chordsOf, keyOf } from "@/lib/chords/progressions"
import { voicingsFor, voiceProgression, type Voicing } from "@/lib/chords/voicing"
import { analyseVoiceLeading, describeFingerWork, describeVoiceLeading } from "@/lib/chords/voice-leading"
import { REHARMS } from "@/lib/chords/reharm"
import { PluckSynth } from "@/lib/chords/audio"
import { Fretboard, IntervalLegend } from "@/components/chord-teacher/fretboard"
import { ModulationPlanner } from "@/components/chord-teacher/modulation-planner"

/**
 * THE STUDIO.
 *
 * Everything on this page is computed from `lib/chords/*`: the shapes come out
 * of a search over the neck, the analysis measures the pitches it actually
 * produced, and the prose about a modulation is written about the two keys in
 * the dropdowns. That is the whole difference from the tool this replaces,
 * where the shapes were typed, the analysis compared fret numbers, and the
 * modulation planner read neither dropdown.
 *
 * ONE CONSEQUENCE WORTH STATING: the tuning selector now works. Choose DADGAD
 * and every shape on the page is re-found for DADGAD, because there was never
 * a stored grip to be wrong.
 */
export function ChordStudio() {
  const [progressionId, setProgressionId] = useState(PROGRESSIONS[1].id)
  const [tonic, setTonic] = useState<PitchClass>(0)
  const [tuningId, setTuningId] = useState("standard")
  const [shell, setShell] = useState(false)
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [bpm, setBpm] = useState(76)
  const [audioOn, setAudioOn] = useState(false)
  const [reharmNote, setReharmNote] = useState<string | null>(null)

  /**
   * The chords, held in state rather than derived, because reharmonisation
   * replaces one of them and that edit has to survive a re-render. Choosing a
   * preset or a key rebuilds the list from the preset, which is also what
   * discards the edits, and that is the behaviour you want: the tritone sub
   * you applied to a ii-V-I in C is not a thing to carry into a blues in Eb.
   */
  const preset = useMemo(
    () => PROGRESSIONS.find((entry) => entry.id === progressionId) ?? PROGRESSIONS[0],
    [progressionId],
  )
  const [chords, setChords] = useState<Chord[]>(() => chordsOf(PROGRESSIONS[1], 0))

  useEffect(() => {
    setChords(chordsOf(preset, tonic))
    setActive(0)
    setReharmNote(null)
  }, [preset, tonic])

  const tuning = useMemo(() => tuningById(tuningId), [tuningId])
  const key: Key = useMemo(() => keyOf(preset, tonic), [preset, tonic])
  const flats = keyPrefersFlats(key)

  /**
   * Voiced as a sequence, so each chord is chosen for the smallest move from
   * the one before it. That is the subject of the page, so it is the default
   * rather than an option.
   */
  const led = useMemo(() => voiceProgression(chords, tuning, { shell }), [chords, tuning, shell])

  /** The player's own choice for a chord, when they have picked an alternative. */
  const [overrides, setOverrides] = useState<Record<number, Voicing>>({})
  useEffect(() => setOverrides({}), [chords, tuning, shell])

  const voicings = useMemo(
    () => led.map((voicing, index) => overrides[index] ?? voicing),
    [led, overrides],
  )

  const chord = chords[active] ?? chords[0]
  const voicing = voicings[active] ?? null

  /* Alternatives for the chord in front of you, led into from the one before
     so the list is ordered by what actually follows well. */
  const alternatives = useMemo(
    () =>
      chord
        ? voicingsFor(chord, tuning, {
            shell,
            from: active > 0 ? voicings[active - 1] : null,
            limit: 6,
          })
        : [],
    [chord, tuning, shell, active, voicings],
  )

  /* ------------------------------------------------------------------ */
  /*  Sound                                                             */
  /* ------------------------------------------------------------------ */

  const synth = useRef<PluckSynth | null>(null)
  if (synth.current === null && typeof window !== "undefined") synth.current = new PluckSynth()

  useEffect(() => () => synth.current?.dispose(), [])

  const enableAudio = useCallback(async () => {
    const ok = await synth.current?.start()
    setAudioOn(Boolean(ok))
    return Boolean(ok)
  }, [])

  const strum = useCallback(
    (target: Voicing | null) => {
      if (!target || !audioOn) return
      synth.current?.strum(target.notes)
    },
    [audioOn],
  )

  const goTo = useCallback(
    (index: number) => {
      const next = ((index % chords.length) + chords.length) % chords.length
      setActive(next)
      setReharmNote(null)
      strum(voicings[next] ?? null)
    },
    [chords.length, strum, voicings],
  )

  /**
   * The transport.
   *
   * Two beats a chord, which is how these are counted when somebody plays
   * them at you. The interval is rebuilt when the tempo changes rather than
   * being scaled, because a running timer that changes period mid-cycle drifts
   * audibly.
   */
  useEffect(() => {
    if (!playing) return
    const period = (60 / bpm) * 1000 * 2
    const id = window.setInterval(() => {
      setActive((current) => {
        const next = (current + 1) % chords.length
        strum(voicings[next] ?? null)
        return next
      })
    }, period)
    return () => window.clearInterval(id)
  }, [playing, bpm, chords.length, strum, voicings])

  /**
   * KEYBOARD, SCOPED TO THIS PANEL.
   *
   * The tool this replaces bound the arrow keys to `window`, so a reader
   * scrolling the page with the keyboard changed the chord under them and
   * space bar played a chord instead of scrolling. Handling it on the section
   * means it works when you are using the studio and stays out of the way when
   * you are reading the page around it.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.target instanceof HTMLElement) {
      const tag = event.target.tagName
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      goTo(active + 1)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      goTo(active - 1)
    } else if (event.key === " ") {
      event.preventDefault()
      strum(voicing)
    }
  }

  /* ------------------------------------------------------------------ */

  const analysis = useMemo(() => {
    const next = voicings[(active + 1) % voicings.length]
    const nextChord = chords[(active + 1) % chords.length]
    if (!voicing || !next || !nextChord || chords.length < 2) return null
    return analyseVoiceLeading(chord, voicing, nextChord, next)
  }, [voicing, voicings, chords, chord, active])

  const applyReharm = (id: string) => {
    const operation = REHARMS.find((entry) => entry.id === id)
    if (!operation || !chord) return
    const result = operation.apply(chord, key)
    setReharmNote(result.why)
    if (!result.chord) return

    setChords((current) => {
      const next = [...current]
      if (id === "secondary") next.splice(active, 0, result.chord!)
      else next[active] = result.chord!
      return next
    })
  }

  const loadModulation = (incoming: Chord[], into: Key) => {
    setChords(incoming)
    setOverrides({})
    setActive(0)
    setReharmNote(
      `Loaded a route into ${keyName(into)}. The shapes below were found for it, led into each other for the smallest move.`,
    )
  }

  if (!chord) return null

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section className="ct" onKeyDown={onKeyDown} aria-label="Chord and voice leading studio">
      {/* ---------------------------------------------------------------- */}
      {/*  What you are looking at                                         */}
      {/* ---------------------------------------------------------------- */}
      <div className="ct-bar">
        <label className="ct-field">
          <span>Progression</span>
          <select
            className="rotary"
            value={progressionId}
            onChange={(event) => setProgressionId(event.target.value)}
          >
            {PROGRESSIONS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="ct-field">
          <span>In the key of</span>
          <select
            className="rotary"
            value={tonic}
            onChange={(event) => setTonic(Number(event.target.value) as PitchClass)}
          >
            {allKeys(preset.key.mode).map((entry) => (
              <option key={entry.tonic} value={entry.tonic}>
                {keyName(entry)}
              </option>
            ))}
          </select>
        </label>

        <label className="ct-field">
          <span>Tuning</span>
          <select
            className="rotary"
            value={tuningId}
            onChange={(event) => setTuningId(event.target.value)}
          >
            {TUNINGS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="ct-check">
          <input
            type="checkbox"
            className="led-check"
            checked={shell}
            onChange={(event) => setShell(event.target.checked)}
          />
          <span>
            Shells only
            <em>root, third and seventh, nothing else</em>
          </span>
        </label>

        <button
          type="button"
          className="stomp stomp-sm ct-audio"
          onClick={() => (audioOn ? setAudioOn(false) : void enableAudio())}
          aria-pressed={audioOn}
        >
          {audioOn ? (
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {audioOn ? "Sound on" : "Turn sound on"}
        </button>
      </div>

      <p className="ct-blurb">{preset.blurb}</p>

      {/* ---------------------------------------------------------------- */}
      {/*  The progression                                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="ct-transport">
        <button type="button" className="knob knob-sm" onClick={() => goTo(active - 1)} title="Previous chord">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Previous chord</span>
        </button>
        <button
          type="button"
          className="stomp stomp-sm"
          aria-pressed={playing}
          onClick={async () => {
            if (!playing && !audioOn) await enableAudio()
            setPlaying((current) => !current)
          }}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {playing ? "Stop" : "Play it through"}
        </button>
        <button type="button" className="knob knob-sm" onClick={() => goTo(active + 1)} title="Next chord">
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Next chord</span>
        </button>

        <label className="ct-tempo">
          <span>Tempo</span>
          <input
            type="range"
            min={40}
            max={160}
            value={bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
          />
          <span className="ct-mono">{bpm}</span>
        </label>
      </div>

      <ol className="ct-strip">
        {chords.map((entry, index) => {
          const numeral = preset.chords[index]?.numeral ?? numeralIn(key, entry) ?? ""
          return (
            <li key={`${index}-${chordSymbol(entry, flats)}`}>
              <button
                type="button"
                className="ct-card"
                data-active={index === active || undefined}
                onClick={() => goTo(index)}
              >
                <span className="ct-card-numeral">{numeral || " "}</span>
                <span className="ct-card-symbol">{chordSymbol(entry, flats)}</span>
                <span className="ct-mono ct-card-shape">
                  {voicings[index] ? shapeToString(voicings[index]!.shape) : "no shape found"}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* ---------------------------------------------------------------- */}
      {/*  The chord itself                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="ct-main">
        <div className="ct-neck panel">
          <div className="ct-neck-head">
            <div>
              <h3>{chordSymbol(chord, flats)}</h3>
              <p>
                {chord.quality.name} &middot; <span className="ct-mono">{chordFormula(chord)}</span>
              </p>
            </div>
            <IntervalLegend />
          </div>

          {voicing ? (
            <Fretboard
              tuning={tuning}
              chord={chord}
              shape={voicing.shape}
              preferFlat={flats}
              onPluck={(midi) => {
                if (audioOn) synth.current?.pluck(midi)
              }}
            />
          ) : (
            /*
             * A REAL "NO". Open tunings genuinely cannot hold some chords with
             * the root in the bass inside a four-fret span, and the honest
             * answer is to say which constraint could not be met rather than
             * to show a shape from a different tuning, which is what the tool
             * this replaces did on every tuning but standard.
             */
            <p className="ct-nothing">
              No voicing of {chordSymbol(chord, flats)} fits on {tuning.name} with the root in the
              bass inside a four-fret span. That is a fact about this tuning rather than a failure
              to look: the search covered every position on the neck. Try another tuning, or turn
              shells on, which drops the fifth and frees a string.
            </p>
          )}

          {voicing ? (
            <dl className="ct-facts">
              <div>
                <dt>Sounding</dt>
                <dd className="ct-mono">{voicing.degrees.join(" ")}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd className="ct-mono">
                  {voicing.notes.map((note) => spell(pc(note), flats)).join(" ")}
                </dd>
              </div>
              <div>
                <dt>Hand</dt>
                <dd>
                  {voicing.position === 0
                    ? "open position"
                    : `${voicing.fingers} finger${voicing.fingers === 1 ? "" : "s"} at fret ${voicing.position}`}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="ct-side">
          <div className="panel">
            <h4 className="ct-h4">What to notice</h4>
            <p className="ct-note">
              {preset.chords[active]?.note ??
                "A chord you added. The analysis below still measures what it does."}
            </p>
          </div>

          <div className="panel">
            <h4 className="ct-h4">Other shapes for this chord</h4>
            <p className="ct-sub">
              Found by searching the neck, ranked by how little the hand moves from the chord
              before it.
            </p>
            <ul className="ct-voicings">
              {alternatives.map((option) => {
                const chosen =
                  voicing && shapeToString(option.shape) === shapeToString(voicing.shape)
                return (
                  <li key={shapeToString(option.shape)}>
                    <button
                      type="button"
                      className="ct-voicing"
                      data-active={chosen || undefined}
                      onClick={() => {
                        setOverrides((current) => ({ ...current, [active]: option }))
                        strum(option)
                      }}
                    >
                      <span className="ct-mono">{shapeToString(option.shape)}</span>
                      <span className="ct-voicing-meta">
                        {option.position === 0 ? "open" : `fret ${option.position}`} &middot;{" "}
                        {option.degrees.join(" ")}
                        {option.motionFromPrevious != null
                          ? ` · ${option.motionFromPrevious} semitone${option.motionFromPrevious === 1 ? "" : "s"} to get here`
                          : ""}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="panel">
            <h4 className="ct-h4">Change the chord</h4>
            <div className="ct-reharms">
              {REHARMS.map((operation) => (
                <button
                  key={operation.id}
                  type="button"
                  className="stomp stomp-sm stomp-plain"
                  title={operation.blurb}
                  onClick={() => applyReharm(operation.id)}
                >
                  {operation.name}
                </button>
              ))}
            </div>
            {/*
              THE REFUSAL IS THE FEATURE. Press "tritone sub" on a major
              seventh and this says why there is nothing to substitute, rather
              than replacing the chord with an unrelated one the way the tool
              this came from did.
            */}
            {reharmNote ? <p className="ct-note ct-reharm-note">{reharmNote}</p> : null}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  What moves                                                      */}
      {/* ---------------------------------------------------------------- */}
      {analysis && chords.length > 1 ? (
        <div className="panel ct-leading">
          <h4 className="ct-h4">
            {chordSymbol(chord, flats)} to{" "}
            {chordSymbol(chords[(active + 1) % chords.length], flats)}
          </h4>
          <p className="ct-note">{describeVoiceLeading(analysis)}</p>

          <ul className="ct-moves">
            {analysis.moves
              .slice()
              .sort((a, b) => a.from - b.from)
              .map((move, index) => (
                <li key={index} data-still={move.semitones === 0 || undefined}>
                  <span className="ct-mono">
                    {spell(pc(move.from), flats)} → {spell(pc(move.to), flats)}
                  </span>
                  <span className="ct-move-degrees">
                    {move.fromDegree} becomes {move.toDegree}
                  </span>
                  <span className="ct-move-distance">
                    {move.semitones === 0
                      ? "holds"
                      : `${move.semitones > 0 ? "up" : "down"} ${Math.abs(move.semitones)}`}
                  </span>
                </li>
              ))}
          </ul>

          {analysis.guideTones.length ? (
            <p className="ct-sub">
              The guide tones, which are the notes that decide what each chord is:{" "}
              {analysis.guideTones
                .map(
                  (move) =>
                    `the ${move.fromDegree} ${
                      move.semitones === 0
                        ? "stays put and becomes the"
                        : `moves ${Math.abs(move.semitones)} to become the`
                    } ${move.toDegree}`,
                )
                .join(", ")}
              .
            </p>
          ) : null}

          <p className="ct-sub">{describeFingerWork(analysis, tuning)}</p>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/*  Getting somewhere else                                          */}
      {/* ---------------------------------------------------------------- */}
      <ModulationPlanner
        tuning={tuning}
        startFrom={key}
        onLoad={loadModulation}
        shell={shell}
      />
    </section>
  )
}
