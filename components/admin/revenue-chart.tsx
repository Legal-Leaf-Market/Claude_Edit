"use client"

import { useMemo, useState } from "react"
import type { MonthRow } from "@/lib/admin/engine"
import { money } from "@/lib/admin/engine"

const PAD = { top: 14, right: 16, bottom: 36, left: 58 }
const PLOT_HEIGHT = 280
const MIN_WIDTH = 560

function compactMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return `$${Math.round(n)}`
}

function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0]
  const rough = max / target
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * magnitude)
  const step = candidates.find((c) => c >= rough) ?? candidates[candidates.length - 1]
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

/** Hand-rolled inline SVG, no charting library, matching the sister sites' own chart. */
export function RevenueChart({ months, color }: { months: MonthRow[]; color: string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const width = MIN_WIDTH
  const plotWidth = width - PAD.left - PAD.right
  const height = PAD.top + PLOT_HEIGHT + PAD.bottom

  const { peak, ticks, maxY, xAt, yAt } = useMemo(() => {
    const peak = Math.max(...months.map((m) => m.revenue), 1)
    const ticks = niceTicks(peak)
    const maxY = ticks[ticks.length - 1]
    const xAt = (i: number) => PAD.left + (plotWidth * i) / Math.max(1, months.length - 1)
    const yAt = (v: number) => PAD.top + PLOT_HEIGHT * (1 - v / maxY)
    return { peak, ticks, maxY, xAt, yAt }
  }, [months, plotWidth])

  const areaPoints = useMemo(() => {
    const top = months.map((m, i) => `${xAt(i)},${yAt(m.revenue)}`)
    const bottom = [`${xAt(months.length - 1)},${yAt(0)}`, `${xAt(0)},${yAt(0)}`]
    return [...top, ...bottom].join(" ")
  }, [months, xAt, yAt])

  const linePoints = useMemo(() => months.map((m, i) => `${xAt(i)},${yAt(m.revenue)}`).join(" "), [months, xAt, yAt])

  const hitWidth = plotWidth / Math.max(1, months.length - 1)
  const hovered = hoverIndex !== null ? months[hoverIndex] : null

  function moveHover(delta: number) {
    setHoverIndex((prev) => {
      const base = prev ?? months.length - 1
      return Math.min(months.length - 1, Math.max(0, base + delta))
    })
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          role="img"
          tabIndex={0}
          aria-label={`Monthly revenue, ${months[0].label} to ${months[months.length - 1].label}. Full figures are in the tables below.`}
          className="min-w-[560px] outline-none"
          onMouseLeave={() => setHoverIndex(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault()
              moveHover(1)
            } else if (e.key === "ArrowLeft") {
              e.preventDefault()
              moveHover(-1)
            } else if (e.key === "Escape") {
              setHoverIndex(null)
            }
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotWidth}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text x={PAD.left - 10} y={yAt(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--muted-foreground)">
                {compactMoney(t)}
              </text>
            </g>
          ))}

          <polygon points={areaPoints} fill={color} fillOpacity={0.25} />
          <polyline points={linePoints} fill="none" stroke={color} strokeWidth={2} />

          <line
            x1={PAD.left}
            x2={PAD.left + plotWidth}
            y1={PAD.top + PLOT_HEIGHT}
            y2={PAD.top + PLOT_HEIGHT}
            stroke="var(--border)"
            strokeWidth={1}
          />

          {months.map(
            (m, i) =>
              (i % 3 === 0 || i === months.length - 1) && (
                <text
                  key={m.index}
                  x={xAt(i)}
                  y={PAD.top + PLOT_HEIGHT + 18}
                  textAnchor={i === months.length - 1 ? "end" : i === 0 ? "start" : "middle"}
                  fontSize={11}
                  fill="var(--muted-foreground)"
                >
                  {m.label}
                </text>
              ),
          )}

          {hoverIndex !== null && (
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PAD.top}
              y2={PAD.top + PLOT_HEIGHT}
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1}
            />
          )}

          {months.map((m, i) => (
            <rect
              key={m.index}
              x={xAt(i) - hitWidth / 2}
              y={PAD.top}
              width={hitWidth}
              height={PLOT_HEIGHT}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
            />
          ))}
        </svg>
      </div>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-[var(--border)] bg-[#0f0c0a] px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(xAt(hoverIndex!) + 14, 8), width - 160) }}
        >
          <p className="font-semibold text-[var(--cream)]">{hovered.label}</p>
          <p className="text-[var(--muted-foreground)]">
            {money(hovered.revenue)} · {hovered.sessions.toLocaleString()} sessions
          </p>
        </div>
      )}

      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Hover, or focus the chart and use ← →, for a month-by-month breakdown. Peak month on this
        scale: {money(maxY)}.
      </p>
    </div>
  )
}
