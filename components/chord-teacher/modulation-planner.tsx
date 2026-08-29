"use client"

import { useMemo, useState } from "react"
import { spell } from "@/lib/chords/pitch"
import type { Tuning } from "@/lib/chords/fretboard"
import { shapeToString } from "@/lib/chords/fretboard"
import { chordSymbol, type Chord } from "@/lib/chords/quality"
import { allKeys, keyName, keyPrefersFlats, type Key, type Mode } from "@/lib/chords/key"
import { STRATEGIES, notesGainedAndLost, planModulation, type Strategy } from "@/lib/chords/modulation"
import { voiceProgression } from "@/lib/chords/voicing"

/**
 * GETTING FROM ONE KEY TO ANOTHER.
 *
 * The panel that the whole rewrite is really for. Its predecessor had the same
 * two dropdowns, the same five strategies and a paragraph of explanation, and
 * it read NEITHER DROPDOWN: every strategy returned the same four hard-coded
 * grips with the chosen names pasted over the labels, and then asserted that
 * Am7 was the vi of the source key and the ii of the target. True for C to G.
 * False for every other pair on offer, silently, in a confident voice, on a
 * page somebody is learning from.
 *
 * Everything here is computed for the pair in front of you, including the
 * cases where the answer is that the strategy does not apply. That last part
 * is the point: a planner that always produces a chain is a planner that is
 * guessing exactly where you needed it not to be.
 */
export function ModulationPlanner({
  tuning,
  startFrom,
  shell,
  onLoad,
}: {
  tuning: Tuning
  /** The key the studio is currently in, so the panel opens somewhere sensible. */
  startFrom: Key
  shell: boolean
  onLoad: (chords: Chord[], into: Key) => void
}) {
  const [mode, setMode] = useState<Mode>(startFrom.mode)
  const [from, setFrom] = useState<number>(startFrom.tonic)
  const [to, setTo] = useState<number>((startFrom.tonic + 7) % 12)
  const [strategy, setStrategy] = useState<Strategy>("pivot")

  const fromKey: Key = { tonic: from, mode }
  const toKey: Key = { tonic: to, mode }

  const plan = useMemo(
    () => planModulation(fromKey, toKey, strategy),
    [fromKey.tonic, fromKey.mode, toKey.tonic, toKey.mode, strategy],
  )

  const voiced = useMemo(
    () => voiceProgression(plan.steps.map((step) => step.chord), tuning, { shell }),
    [plan, tuning, shell],
  )

  const flats = keyPrefersFlats(toKey)
  const changes = useMemo(() => notesGainedAndLost(fromKey, toKey), [fromKey.tonic, fromKey.mode, toKey.tonic, toKey.mode])

  return (
    <div className="panel ct-mod" id="change-key">
      <div className="ct-mod-head">
        <div>
          <h3 className="ct-h3">Change key</h3>
          <p className="ct-sub">
            Pick two keys and a route. Everything below, including the reasoning, is worked out for
            this pair.
          </p>
        </div>

        <span className="ct-shared" title="Scale notes the two keys have in common">
          {plan.shared}/7 notes in common
        </span>
      </div>

      <div className="ct-mod-controls">
        <label className="ct-field">
          <span>From</span>
          <select className="rotary" value={from} onChange={(event) => setFrom(Number(event.target.value))}>
            {allKeys(mode).map((entry) => (
              <option key={entry.tonic} value={entry.tonic}>
                {keyName(entry)}
              </option>
            ))}
          </select>
        </label>

        <label className="ct-field">
          <span>To</span>
          <select className="rotary" value={to} onChange={(event) => setTo(Number(event.target.value))}>
            {allKeys(mode).map((entry) => (
              <option key={entry.tonic} value={entry.tonic}>
                {keyName(entry)}
              </option>
            ))}
          </select>
        </label>

        <label className="ct-field">
          <span>Mode</span>
          <select className="rotary" value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
            <option value="major">major</option>
            <option value="minor">minor</option>
          </select>
        </label>

        <label className="ct-field ct-field-wide">
          <span>Route</span>
          <select
            className="rotary"
            value={strategy}
            onChange={(event) => setStrategy(event.target.value as Strategy)}
          >
            {STRATEGIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/*
        WHAT THE EAR IS TRACKING. Naming the notes that arrive and leave is the
        thing that makes "closely related" concrete rather than a word: C to G
        gains one note and loses one, C to F# swaps five.
      */}
      {changes.gained.length || changes.lost.length ? (
        <p className="ct-sub ct-changes">
          {changes.gained.length ? (
            <>
              Arriving: <span className="ct-mono">{changes.gained.map((note) => spell(note, flats)).join(" ")}</span>.{" "}
            </>
          ) : null}
          {changes.lost.length ? (
            <>
              Leaving:{" "}
              <span className="ct-mono">
                {changes.lost.map((note) => spell(note, keyPrefersFlats(fromKey))).join(" ")}
              </span>
              .
            </>
          ) : null}
        </p>
      ) : null}

      {plan.steps.length ? (
        <>
          <ol className="ct-chain">
            {plan.steps.map((step, index) => (
              <li key={index}>
                <span className="ct-chain-numerals">
                  {/* An en dash, not an em dash: house rule 17, and this is a data
                      cell rather than punctuation either way. */}
                  {step.numeralFrom ?? "\u2013"} <span aria-hidden="true">/</span>{" "}
                  {step.numeralTo ?? "\u2013"}
                </span>
                <span className="ct-chain-symbol">{chordSymbol(step.chord, flats)}</span>
                <span className="ct-mono ct-chain-shape">
                  {voiced[index] ? shapeToString(voiced[index]!.shape) : "no shape"}
                </span>
                <span className="ct-chain-role">{step.role}</span>
              </li>
            ))}
          </ol>

          <p className="ct-note">{plan.note}</p>

          <button
            type="button"
            className="stomp stomp-sm"
            onClick={() => onLoad(plan.steps.map((step) => step.chord), toKey)}
          >
            Put this on the neck
          </button>
        </>
      ) : (
        /*
          NO CHAIN, AND THE REASON. This is the branch its predecessor could not
          reach, because it had no idea whether the route it was drawing existed.
        */
        <p className="ct-note ct-refusal">{plan.note}</p>
      )}

      <p className="ct-sub">
        The numerals under each chord read <em>what the old key calls it</em> then{" "}
        <em>what the new key calls it</em>. A dash means that key has no name for it, which is
        exactly what makes a chord foreign.
      </p>
    </div>
  )
}
