import { FIGURE, figureFor, type FigureShape, type FigureTrace } from "@/lib/figures"

/**
 * A circuit's behaviour, drawn.
 *
 * SERVER COMPONENT, NO STATE, NO ANIMATION. Section 5 of the design notes is
 * explicit that nothing on this site spins, bounces or glows at idle, because a
 * rack of gear at rest is still. A figure that animated its waveform would also
 * be claiming a motion the caption does not, and would be the only thing on the
 * page competing with the text for attention.
 *
 * THE STROKE LANGUAGE IS THE MARK'S. Stroked polylines, mitred joins, no fills.
 * That is how the wordmark and the enclosure glyph are drawn, so a figure sits
 * in the same visual family as everything around it rather than looking like a
 * chart pasted in from elsewhere.
 *
 * COLOUR CARRIES MEANING, AND ONLY THREE OF THEM DO IT. The dry signal is drawn
 * in the dim text colour and sits back. What the circuit did is drawn in brass,
 * which is this site's accent and is earned here because it is the one thing to
 * look at. A control curve (an oscillator, a treadle position) is drawn in the
 * line colour, dashed, because it is context rather than signal. The LED green
 * is deliberately absent: it means "this is live" everywhere else on the site
 * and nothing in a figure is live.
 */
export function CircuitFigure({
  shape,
  size = "page",
}: {
  shape: FigureShape
  /** `card` drops the caption and the key: a grid of cards wants the shape only. */
  size?: "page" | "card"
}) {
  const figure = figureFor(shape)
  const labelled = figure.traces.filter((t) => t.label)

  if (size === "card") {
    return (
      <div
        className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--chip)] p-2"
        aria-hidden="true"
      >
        <Plot figure={figure} />
      </div>
    )
  }

  return (
    <figure className="surface overflow-hidden p-0">
      {/*
        Capped rather than allowed to fill the column. At full width in a
        1120px measure this drew 460px tall, which made the illustration the
        page and the writing a footnote. It is here to be looked at once and
        then read past.
      */}
      <div className="border-b border-[var(--line)] bg-[var(--chip)] p-4">
        <div className="mx-auto max-w-xl">
          <Plot figure={figure} />
        </div>
      </div>

      <figcaption className="p-5">
        <p className="stencil">{figure.title}</p>
        <p className="mt-2 leading-relaxed text-[var(--text)]">{figure.caption}</p>

        {labelled.length > 1 && (
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {labelled.map((trace) => (
              <li key={trace.label} className="flex items-center gap-2 text-xs text-[var(--dim)]">
                <span
                  aria-hidden="true"
                  className="h-0 w-6 border-t-2"
                  style={{
                    borderColor: strokeFor(trace.role),
                    borderTopStyle: trace.role === "control" ? "dashed" : "solid",
                  }}
                />
                {trace.label}
              </li>
            ))}
          </ul>
        )}

        {/*
          Said once, on every figure that has a caption. These are drawings of a
          described behaviour, not scope traces of a specific unit, and a curve
          that looks measured while being drawn would be the same kind of
          invention as publishing a market price from two listings.
        */}
        <p className="mt-3 text-xs text-[var(--dim)]">
          Drawn to illustrate the description above{figure.xAxis ? `. Horizontal axis: ${figure.xAxis}` : ", not measured from a specific unit"}.
        </p>
      </figcaption>
    </figure>
  )
}

function strokeFor(role: FigureTrace["role"]): string {
  if (role === "output") return "var(--brand-gold)"
  if (role === "control") return "var(--line-strong)"
  return "var(--dim)"
}

function Plot({ figure }: { figure: ReturnType<typeof figureFor> }) {
  return (
    <svg
      viewBox={`0 0 ${FIGURE.width} ${FIGURE.height}`}
      className="block w-full"
      role="img"
      aria-label={`${figure.title}. ${figure.caption}`}
      /* Strokes are specified in grid units and must not be rescaled by the
         viewBox, or a wide figure would draw thinner lines than a narrow one. */
      vectorEffect="non-scaling-stroke"
    >
      {/* Zero. Drawn first and quietly, since it is a reference rather than part
          of the signal, and drawn where zero actually IS for this figure: a
          response curve that never goes negative has its zero on the floor, and
          a mid-height rule under it would be a line meaning nothing. */}
      <line
        x1={0}
        y1={figure.zero === "bottom" ? FIGURE.floor : FIGURE.baseline}
        x2={FIGURE.width}
        y2={figure.zero === "bottom" ? FIGURE.floor : FIGURE.baseline}
        stroke="var(--line)"
        strokeWidth={0.75}
      />

      {/* Where the circuit runs out of room. Only present on the figures where
          clipping IS the subject, so a rail always means something. */}
      {figure.rails?.map((y) => (
        <line
          key={y}
          x1={0}
          y1={y}
          x2={FIGURE.width}
          y2={y}
          stroke="var(--line-strong)"
          strokeWidth={0.75}
          strokeDasharray="3 3"
        />
      ))}

      {/* Input under output, always: the result is the thing to look at, and a
          dry trace drawn on top of it would hide the very difference the figure
          exists to show. */}
      {[...figure.traces]
        .sort((a, b) => order(a.role) - order(b.role))
        .map((trace, index) => (
          <polyline
            key={`${trace.role}-${trace.label ?? index}`}
            points={trace.points.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke={strokeFor(trace.role)}
            strokeWidth={trace.role === "output" ? 2 : 1.25}
            strokeDasharray={trace.role === "control" ? "4 3" : undefined}
            strokeLinejoin="miter"
            strokeLinecap="butt"
            opacity={trace.role === "output" ? 1 : 0.75}
          />
        ))}
    </svg>
  )
}

function order(role: FigureTrace["role"]): number {
  if (role === "control") return 0
  if (role === "input") return 1
  return 2
}
