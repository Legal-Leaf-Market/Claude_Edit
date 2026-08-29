"use client"

import { pc, spell } from "@/lib/chords/pitch"
import {
  DOUBLE_INLAY_FRETS,
  INLAY_FRETS,
  noteAt,
  pitchAt,
  type Shape,
  type Tuning,
} from "@/lib/chords/fretboard"
import { degreeLabelFor, type Chord } from "@/lib/chords/quality"

/**
 * THE NECK, DRAWN, WITH EVERY DOT SAYING WHAT IT IS.
 *
 * A chord diagram that only shows dots teaches you a shape. Showing the degree
 * under each dot teaches you the chord, which is the difference between
 * memorising a grip and being able to move it. That was right in the studio
 * this replaces and it is kept.
 *
 * WHAT CHANGED, AND IT IS MOSTLY ABOUT WHO CAN USE IT. The original built the
 * whole neck from divs with `onclick` handlers, including the fret cells,
 * which meant nothing was reachable by keyboard, nothing announced itself to a
 * screen reader, and the arrow keys were bound globally so a reader who
 * scrolled with them changed the chord instead. Here every playable position
 * is a real `<button>` with a real label, and only the positions that are IN
 * the chord are focusable: forty tab stops per string is not access, it is an
 * obstacle.
 *
 * COLOUR IS NOT THE ONLY SIGNAL. The interval is printed on the dot as well as
 * coloured, so the diagram survives being read by somebody who cannot separate
 * the hues, and it survives being printed.
 */

/** Which family a degree belongs to, for colour. Four groups, not twelve. */
function degreeTone(label: string): "root" | "third" | "fifth" | "seventh" | "colour" {
  if (label === "R") return "root"
  if (label === "3" || label === "b3" || label === "4" || label === "2") return "third"
  if (label === "5" || label === "b5" || label === "#5") return "fifth"
  if (label === "7" || label === "b7" || label === "bb7") return "seventh"
  return "colour"
}

export function Fretboard({
  tuning,
  chord,
  shape,
  frets = 15,
  preferFlat,
  onPluck,
}: {
  tuning: Tuning
  chord: Chord
  shape: Shape
  frets?: number
  preferFlat: boolean
  /** Called with a MIDI note when a position is pressed. */
  onPluck?: (midi: number) => void
}) {
  /* Drawn high string at the top, the way a player looks down at the neck,
     while the data stays low-string-first everywhere else. Reversing once, in
     the drawing, is what keeps every other file from having to think about
     it. */
  const strings = [...tuning.strings.keys()].reverse()

  return (
    <div className="ct-board-wrap">
      <div className="ct-board" role="table" aria-label={`Fretboard diagram for ${chord.quality.name}`}>
        <div className="ct-fret-numbers" role="row" aria-hidden="true">
          <span className="ct-string-label" />
          <span className="ct-nut-col">nut</span>
          {Array.from({ length: frets }, (_, index) => index + 1).map((fret) => (
            <span
              key={fret}
              data-inlay={INLAY_FRETS.includes(fret) || DOUBLE_INLAY_FRETS.includes(fret) || undefined}
            >
              {fret}
            </span>
          ))}
        </div>

        {strings.map((string) => {
          const fretted = shape[string]
          const openNote = noteAt(tuning, string, 0)

          return (
            <div className="ct-string" role="row" key={string}>
              <span className="ct-string-label" role="rowheader">
                {spell(pc(openNote), preferFlat)}
              </span>

              {/* The nut column carries the two states a fret cannot: muted,
                  and ringing open. */}
              <span className="ct-nut-col">
                {fretted === null ? (
                  <span className="ct-muted" aria-label={`String ${string + 1} muted`}>
                    &times;
                  </span>
                ) : fretted === 0 ? (
                  <Dot
                    chord={chord}
                    midi={openNote}
                    preferFlat={preferFlat}
                    open
                    onPluck={onPluck}
                    label={`Open ${spell(pc(openNote), preferFlat)}`}
                  />
                ) : (
                  <span className="ct-nut-dash" aria-hidden="true" />
                )}
              </span>

              {Array.from({ length: frets }, (_, index) => index + 1).map((fret) => {
                const active = fretted === fret
                const midi = noteAt(tuning, string, fret)

                return (
                  <span
                    className="ct-fret"
                    key={fret}
                    data-inlay={
                      (INLAY_FRETS.includes(fret) || DOUBLE_INLAY_FRETS.includes(fret)) &&
                      string === Math.floor(tuning.strings.length / 2)
                        ? true
                        : undefined
                    }
                  >
                    {active ? (
                      <Dot
                        chord={chord}
                        midi={midi}
                        preferFlat={preferFlat}
                        onPluck={onPluck}
                        label={`String ${tuning.strings.length - string}, fret ${fret}`}
                      />
                    ) : null}
                  </span>
                )
              })}
            </div>
          )
        })}
      </div>

      <p className="ct-board-caption">
        {/* The shape in the notation everybody writes it in, so it can be
            copied into a chart or a text message. */}
        <span className="ct-mono">
          {shape.map((fret) => (fret === null ? "x" : fret)).join("-")}
        </span>{" "}
        &middot; low string first
      </p>
    </div>
  )
}

function Dot({
  chord,
  midi,
  preferFlat,
  open = false,
  label,
  onPluck,
}: {
  chord: Chord
  midi: number
  preferFlat: boolean
  open?: boolean
  label: string
  onPluck?: (midi: number) => void
}) {
  const pitch = pc(midi)
  const degree = degreeLabelFor(chord, pitch)
  const note = spell(pitch, preferFlat)

  return (
    <button
      type="button"
      className="ct-dot"
      data-tone={degreeTone(degree)}
      data-open={open || undefined}
      onClick={() => onPluck?.(midi)}
      title={`${note}, the ${degree}`}
    >
      <span aria-hidden="true" className="ct-dot-note">
        {note}
      </span>
      <span aria-hidden="true" className="ct-dot-degree">
        {degree}
      </span>
      <span className="sr-only">
        {label}: {note}, the {degree} of the chord. Press to hear it.
      </span>
    </button>
  )
}

/**
 * The four colours, spelled out for the reader.
 *
 * A legend is not decoration on a diagram whose entire meaning is carried by
 * hue and a two-character label.
 */
export function IntervalLegend() {
  const items: { tone: string; label: string; blurb: string }[] = [
    { tone: "root", label: "R", blurb: "the root" },
    { tone: "third", label: "3", blurb: "third, or what replaced it" },
    { tone: "fifth", label: "5", blurb: "fifth, altered or not" },
    { tone: "seventh", label: "7", blurb: "seventh" },
    { tone: "colour", label: "9", blurb: "everything above the seventh" },
  ]

  return (
    <ul className="ct-legend">
      {items.map((item) => (
        <li key={item.tone}>
          <span className="ct-legend-swatch" data-tone={item.tone} aria-hidden="true">
            {item.label}
          </span>
          {item.blurb}
        </li>
      ))}
    </ul>
  )
}
