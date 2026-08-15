"use client"

import { useMemo, useRef, useState } from "react"
import { formatPrice } from "@/lib/utils"
import type { PricePoint } from "@/lib/deals/history"

/**
 * Observed median asking price over time.
 *
 * One series, so there is no legend box: the heading above already names what
 * is plotted, and a single-swatch legend would just restate it.
 *
 * Specs held to deliberately: 2px line with round joins, a hairline solid grid
 * one step off the surface, an 8px end marker carrying a 2px surface ring so it
 * stays legible where it sits on the line, and a value label on the endpoint
 * ONLY. A number on every point is noise that goes unread.
 *
 * The crosshair and tooltip are not optional polish. An SVG chart in a browser
 * is interactive by nature, and a reader who cannot interrogate a point is
 * stuck guessing between gridlines. The <details> table below carries the same
 * numbers for screen readers and for anyone who wants the actual figures.
 */

/*
 * THE TRACE IS BRASS, AND IT IS THE ONLY BRASS ON THE SITE. When the palette
 * went royal blue and white (CLAUDE.md section 16), gold survived in exactly
 * one role: the signal in a drawing, because a frame and a signal path in one
 * colour stop telling you which line is the data. The sister site's circuit
 * figures make the same split. --chart-signal is defined in globals.css and
 * swaps to the darkened brass on paper, where the bright one drops to 1.8:1.
 *
 * Everything else resolves through the theme tokens: the marker rings punch
 * out of the line in the plate colour the chart actually sits on, and the
 * grid hairline is mixed from the text colour so it is one step off the
 * surface in both themes instead of only in dark.
 */
const SURFACE = "var(--surface)"
const SERIES = "var(--chart-signal)"
const GRID = "color-mix(in srgb, var(--text) 8%, transparent)"
const AXIS_TEXT = "var(--dim)"

type Geometry = {
  width: number
  height: number
  padTop: number
  padRight: number
  padBottom: number
  padLeft: number
}

const GEOMETRY: Geometry = {
  width: 720,
  height: 240,
  padTop: 16,
  // Room for the endpoint label so it is never clipped by the viewBox.
  padRight: 68,
  padBottom: 28,
  padLeft: 56,
}

export function PriceHistoryChart({ points }: { points: PricePoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const model = useMemo(() => buildModel(points), [points])

  if (!model) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        Not enough price history yet. We record a point whenever a listing&apos;s price moves, so
        this chart fills in as the market moves.
      </p>
    )
  }

  const { scaled, yTicks, xTicks, min, max } = model
  const active = hoverIndex == null ? null : scaled[hoverIndex]
  const last = scaled[scaled.length - 1]

  /** Map a pointer position to the nearest data point. */
  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // The SVG scales to its container, so convert the client x back into
    // viewBox units before searching. Using raw client px silently mis-targets
    // on every screen whose width is not exactly the viewBox width.
    const viewX = ((event.clientX - rect.left) / rect.width) * GEOMETRY.width
    let nearest = 0
    let bestDistance = Infinity
    for (let i = 0; i < scaled.length; i++) {
      const distance = Math.abs(scaled[i].x - viewX)
      if (distance < bestDistance) {
        bestDistance = distance
        nearest = i
      }
    }
    setHoverIndex(nearest)
  }

  return (
    <figure className="price-chart m-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${GEOMETRY.width} ${GEOMETRY.height}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Median asking price over time, from ${formatPrice(min)} to ${formatPrice(max)}. The full figures are in the table below the chart.`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {/* Gridlines and y-axis ticks. Recessive: hairline, solid, one step off surface. */}
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={GEOMETRY.padLeft}
              x2={GEOMETRY.width - GEOMETRY.padRight}
              y1={tick.y}
              y2={tick.y}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={GEOMETRY.padLeft - 10}
              y={tick.y + 4}
              textAnchor="end"
              fontSize={11}
              fill={AXIS_TEXT}
            >
              {tick.label}
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <text
            key={tick.x}
            x={tick.x}
            y={GEOMETRY.height - 8}
            textAnchor="middle"
            fontSize={11}
            fill={AXIS_TEXT}
          >
            {tick.label}
          </text>
        ))}

        {/* Area wash at ~10%, then the line on top. */}
        <path d={model.areaPath} fill={SERIES} fillOpacity={0.1} />
        <path
          d={model.linePath}
          fill="none"
          stroke={SERIES}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crosshair for the hovered point. */}
        {active && (
          <g pointerEvents="none">
            <line
              x1={active.x}
              x2={active.x}
              y1={GEOMETRY.padTop}
              y2={GEOMETRY.height - GEOMETRY.padBottom}
              stroke={SERIES}
              strokeOpacity={0.45}
              strokeWidth={1}
            />
            <circle cx={active.x} cy={active.y} r={4.5} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
          </g>
        )}

        {/* Endpoint marker and its direct label: the only value written on the plot. */}
        <circle cx={last.x} cy={last.y} r={4.5} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
        <text
          x={last.x + 10}
          y={last.y + 4}
          fontSize={12}
          fontWeight={600}
          fill="var(--text)"
        >
          {formatPrice(last.point.medianCents)}
        </text>
      </svg>

      {/* Tooltip lives outside the SVG so it can use normal text styling. */}
      <div className="mt-1 min-h-[1.25rem] text-xs text-[var(--muted-foreground)]" aria-live="polite">
        {active ? (
          <span>
            <span className="font-medium text-[var(--cream)]">
              {formatPrice(active.point.medianCents)}
            </span>{" "}
            median across {active.point.listingCount}{" "}
            {active.point.listingCount === 1 ? "listing" : "listings"} on{" "}
            {formatDate(active.point.date)}
          </span>
        ) : (
          <span>Hover the chart for the median on any day.</span>
        )}
      </div>

      <figcaption className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
        Median asking price across the listings Gear Avail had on file each day. These are asking
        prices, not confirmed sale prices.
      </figcaption>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-[var(--accent-text)]">
          View the figures as a table
        </summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Median asking price by day</caption>
            <thead className="sticky top-0 bg-[var(--popover)] text-[var(--muted-foreground)]">
              <tr>
                <th scope="col" className="py-1 pr-4 font-medium">Date</th>
                <th scope="col" className="py-1 pr-4 font-medium">Median price</th>
                <th scope="col" className="py-1 font-medium">Listings</th>
              </tr>
            </thead>
            <tbody className="text-[var(--cream)]">
              {points.map((point) => (
                <tr key={point.date} className="border-t border-[var(--border)]">
                  <td className="py-1 pr-4">{formatDate(point.date)}</td>
                  <td className="py-1 pr-4">{formatPrice(point.medianCents)}</td>
                  <td className="py-1">{point.listingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

/* -------------------------------------------------------------------------- */
/*  Scales                                                                    */
/* -------------------------------------------------------------------------- */

type ScaledPoint = { x: number; y: number; point: PricePoint }

function buildModel(points: PricePoint[]) {
  // One point is not a trend. Below two we show the explanatory copy instead of
  // a chart that implies more knowledge than we have.
  if (points.length < 2) return null

  const values = points.map((p) => p.medianCents)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  // Pad a flat series so it renders as a line through the middle rather than
  // collapsing onto the axis and dividing by zero.
  const pad = rawMax === rawMin ? Math.max(rawMax * 0.1, 100) : (rawMax - rawMin) * 0.15
  // Snap the domain outwards to a clean step so every gridline lands on a round
  // number. Without this the ticks come out as $46 / $48 / $50 / $51, which
  // reads as an arithmetic error rather than a scale.
  const { min, max, step } = niceDomain(Math.max(0, rawMin - pad), rawMax + pad)

  const plotWidth = GEOMETRY.width - GEOMETRY.padLeft - GEOMETRY.padRight
  const plotHeight = GEOMETRY.height - GEOMETRY.padTop - GEOMETRY.padBottom

  const xFor = (index: number) =>
    GEOMETRY.padLeft + (index / (points.length - 1)) * plotWidth
  const yFor = (value: number) =>
    GEOMETRY.padTop + plotHeight - ((value - min) / (max - min)) * plotHeight

  const scaled: ScaledPoint[] = points.map((point, index) => ({
    x: xFor(index),
    y: yFor(point.medianCents),
    point,
  }))

  const linePath = scaled
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ")

  const baseline = GEOMETRY.padTop + plotHeight
  const areaPath = `${linePath} L${scaled[scaled.length - 1].x.toFixed(2)},${baseline} L${scaled[0].x.toFixed(2)},${baseline} Z`

  // Walk the domain in whole steps so every label is a clean money value.
  const yTicks: { value: number; y: number; label: string }[] = []
  for (let value = min; value <= max + step / 2; value += step) {
    yTicks.push({ value, y: yFor(value), label: compactPrice(value) })
  }

  // At most five date ticks so labels never collide on a phone.
  const xTickStride = Math.max(1, Math.ceil(points.length / 5))
  const xTicks = points
    .map((point, index) => ({ index, point }))
    .filter(({ index }) => index % xTickStride === 0 || index === points.length - 1)
    .map(({ index, point }) => ({ x: xFor(index), label: formatShortDate(point.date) }))

  return { scaled, linePath, areaPath, yTicks, xTicks, min, max }
}

/**
 * Expand a raw range to one whose gridlines fall on round numbers.
 *
 * Steps are drawn from the 1 / 2 / 2.5 / 5 / 10 family scaled by a power of
 * ten, which is what makes the labels read as money ($40, $45, $50) instead of
 * as arbitrary fractions of the data range.
 */
function niceDomain(rawMin: number, rawMax: number, targetTicks = 4) {
  const span = Math.max(rawMax - rawMin, 1)
  const roughStep = span / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalized = roughStep / magnitude
  const niceMultiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  const step = niceMultiplier * magnitude

  return {
    min: Math.max(0, Math.floor(rawMin / step) * step),
    max: Math.ceil(rawMax / step) * step,
    step,
  }
}

function compactPrice(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(dollars >= 10_000 ? 0 : 1)}k`
  // Keep the cents on a sub-dollar step, or a cheap pedal's ticks all round to
  // the same label and the axis looks broken.
  if (!Number.isInteger(dollars)) return `$${dollars.toFixed(2)}`
  return `$${dollars}`
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}
