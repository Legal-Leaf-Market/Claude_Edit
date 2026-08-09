"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ModelResult, SiteKey } from "@/lib/operating-model"
import { money } from "@/lib/operating-model"
import { Swatch, VIZ_SURFACE } from "@/components/admin/model-ui"

const PAD = { top: 14, right: 124, bottom: 36, left: 58 }
const PLOT_HEIGHT = 300
const MIN_WIDTH = 560

const GRID = "rgba(255,255,255,0.08)"
const AXIS_INK = "#9fb9aa"

function compactMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return `$${Math.round(n)}`
}

/** Round the axis maximum up to a readable step (1 / 2 / 2.5 / 5 × 10ⁿ). */
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

export function RevenueChart({ model }: { model: ModelResult }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(880)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(MIN_WIDTH, entry.contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const series = model.order
  const months = model.sites[series[0]].months

  const { stacks, ticks, maxY, plotWidth, xAt, yAt } = useMemo(() => {
    const stacks = months.map((_, i) => {
      let running = 0
      const bands = series.map((key) => {
        const value = model.sites[key].months[i].revenue
        const band = { key, value, from: running, to: running + value }
        running += value
        return band
      })
      return { total: running, bands }
    })
    const peak = Math.max(...stacks.map((s) => s.total), 1)
    const ticks = niceTicks(peak)
    const maxY = ticks[ticks.length - 1]
    const plotWidth = Math.max(1, width - PAD.left - PAD.right)
    const xAt = (i: number) => PAD.left + (plotWidth * i) / Math.max(1, months.length - 1)
    const yAt = (v: number) => PAD.top + PLOT_HEIGHT * (1 - v / maxY)
    return { stacks, ticks, maxY, plotWidth, xAt, yAt }
  }, [model, months, series, width])

  const height = PAD.top + PLOT_HEIGHT + PAD.bottom

  /** Right-gutter labels for the final month, nudged apart so they never collide. */
  const endLabels = useMemo(() => {
    const last = stacks[stacks.length - 1]
    const raw = last.bands
      .map((b) => ({
        key: b.key,
        value: b.value,
        y: yAt((b.from + b.to) / 2),
        height: yAt(b.from) - yAt(b.to),
      }))
      .filter((l) => l.value > 0)
      .sort((a, b) => a.y - b.y)
    const MIN_GAP = 30
    for (let i = 1; i < raw.length; i += 1) {
      if (raw[i].y - raw[i - 1].y < MIN_GAP) raw[i].y = raw[i - 1].y + MIN_GAP
    }
    const overflow = raw.length ? raw[raw.length - 1].y - (PAD.top + PLOT_HEIGHT) : 0
    if (overflow > 0) for (const l of raw) l.y -= overflow
    return raw
  }, [stacks, yAt])

  const move = useCallback(
    (delta: number) => {
      setHover((h) => {
        const next = (h === null ? months.length - 1 : h) + delta
        return Math.min(months.length - 1, Math.max(0, next))
      })
    },
    [months.length],
  )

  const active = hover === null ? null : stacks[hover]

  return (
    <div className="rounded-2xl border border-gold/20" style={{ background: VIZ_SURFACE }}>
      {/* Legend is always present — identity is never carried by colour alone. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 pt-4">
        {series.map((key) => (
          <span key={key} className="flex items-center gap-1.5 text-xs font-bold text-foreground/85">
            <Swatch color={model.sites[key].profile.color} />
            {model.sites[key].profile.shortName}
          </span>
        ))}
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          Stacked — the top edge is total monthly revenue
        </span>
      </div>

      <div ref={wrapRef} className="relative overflow-x-auto px-2 pb-2 pt-2">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Monthly revenue by site, ${months[0].label} to ${months[months.length - 1].label}. Full figures are in the monthly tables below.`}
          tabIndex={0}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-lime/40"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); move(1) }
            else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1) }
            else if (e.key === "Escape") setHover(null)
          }}
          onMouseLeave={() => setHover(null)}
        >
          {/* recessive solid hairline grid */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotWidth}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke={GRID}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={yAt(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="tabular-nums"
                fontSize={11}
                fill={AXIS_INK}
              >
                {compactMoney(t)}
              </text>
            </g>
          ))}

          {/* stacked bands, bottom series first */}
          {series.map((key, si) => {
            const top = stacks.map((s, i) => `${xAt(i)},${yAt(s.bands[si].to)}`)
            const bottom = stacks
              .map((s, i) => `${xAt(i)},${yAt(s.bands[si].from)}`)
              .reverse()
            return (
              <polygon
                key={key}
                points={[...top, ...bottom].join(" ")}
                fill={model.sites[key].profile.color}
                fillOpacity={0.9}
              />
            )
          })}

          {/* 2px surface gap between stacked segments — a spacer, not a border */}
          {series.slice(1).map((key, si) => (
            <polyline
              key={`gap-${key}`}
              points={stacks.map((s, i) => `${xAt(i)},${yAt(s.bands[si].to)}`).join(" ")}
              fill="none"
              stroke={VIZ_SURFACE}
              strokeWidth={2}
            />
          ))}

          {/* x axis */}
          <line
            x1={PAD.left}
            x2={PAD.left + plotWidth}
            y1={PAD.top + PLOT_HEIGHT}
            y2={PAD.top + PLOT_HEIGHT}
            stroke={GRID}
            strokeWidth={1}
          />
          {months.map((m, i) =>
            i % 3 === 0 || i === months.length - 1 ? (
              <text
                key={m.label}
                x={xAt(i)}
                y={PAD.top + PLOT_HEIGHT + 18}
                textAnchor={i === months.length - 1 ? "end" : i === 0 ? "start" : "middle"}
                fontSize={11}
                fill={AXIS_INK}
              >
                {m.label}
              </text>
            ) : null,
          )}

          {/* direct end labels — selective, in the gutter so nothing is clipped */}
          {endLabels.map((l) => (
            <text
              key={l.key}
              x={PAD.left + plotWidth + 10}
              y={l.y}
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={700}
              fill={model.sites[l.key as SiteKey].profile.color}
            >
              {model.sites[l.key as SiteKey].profile.shortName} {money(l.value)}
            </text>
          ))}

          {/* crosshair */}
          {hover !== null ? (
            <line
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={PAD.top}
              y2={PAD.top + PLOT_HEIGHT}
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1}
            />
          ) : null}

          {/* generous hover targets: one full-height column per month */}
          {months.map((m, i) => {
            const w = plotWidth / Math.max(1, months.length - 1)
            return (
              <rect
                key={`hit-${m.label}`}
                x={xAt(i) - w / 2}
                y={PAD.top}
                width={w}
                height={PLOT_HEIGHT}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
              />
            )
          })}
        </svg>

        {active ? (
          <div
            role="status"
            className="pointer-events-none absolute top-4 z-10 w-52 rounded-xl border border-gold/30 p-3 shadow-xl"
            style={{
              background: "#0d2334",
              left: Math.min(
                Math.max(xAt(hover!) + 14, 8),
                Math.max(width - 220, 8),
              ),
            }}
          >
            <p className="mb-2 text-[0.65rem] font-black uppercase tracking-widest text-gold">
              {months[hover!].label}
            </p>
            {[...active.bands].reverse().map((b) => (
              <div key={b.key} className="flex items-center justify-between gap-2 py-0.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/85">
                  <Swatch color={model.sites[b.key].profile.color} />
                  {model.sites[b.key].profile.shortName}
                </span>
                <span className="text-xs font-bold tabular-nums text-mint">{money(b.value)}</span>
              </div>
            ))}
            <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-white/10 pt-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-gold">Total</span>
              <span className="text-sm font-black tabular-nums text-mint">
                {money(active.total)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <p className="border-t border-gold/15 px-4 py-3 text-xs font-medium leading-relaxed text-muted-foreground">
        Hover, or focus the chart and use ← →, for a month-by-month breakdown. Every value here is
        also in the monthly tables below. Peak month on this scale: {money(maxY)}.
      </p>
    </div>
  )
}
