"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { boxOf, railContact, type LayoutIssue, type LayoutItem, type Placement } from "@/lib/pedalboard/layout"
import { EFFECTS, type EffectType } from "@/lib/pedalboard/chain"
import { mmToIn, type BoardSpec, type Rotation } from "@/lib/pedalboard/catalog/types"

/**
 * The board, drawn to scale, with the pedals draggable on it.
 *
 * SVG rather than canvas or divs. The whole thing is a coordinate system in
 * millimetres, and SVG lets the viewBox BE that coordinate system: a pedal is
 * placed at its real x and y, and the browser handles scaling to whatever
 * width the layout gives us. With absolutely positioned divs every drag would
 * need a manual pixels-to-mm conversion, and every one of those is somewhere
 * the maths can drift. It also means the board scales cleanly on a phone and
 * prints correctly, both free.
 *
 * DRAGGING USES POINTER EVENTS, not mouse or touch. One code path covers
 * mouse, finger and stylus, and pointer capture means a fast drag that leaves
 * the SVG does not drop the pedal halfway across the board, which is the
 * single most annoying bug these tools have.
 *
 * SNAP IS 5MM. Small enough to place a pedal where you meant, coarse enough
 * that a row comes out straight without fighting you. Hold Shift for 1mm.
 */

export type CanvasItem = LayoutItem & {
  type: EffectType
  /** Slot key of the pedal, so the parent can map back to its own state. */
  key: string
}

const SNAP_MM = 5
const FINE_SNAP_MM = 1

export function BoardCanvas({
  board,
  items,
  placements,
  issues,
  selectedKey,
  onSelect,
  onMove,
  onRotate,
  showRuler = true,
}: {
  board: BoardSpec
  items: CanvasItem[]
  placements: Placement[]
  issues: LayoutIssue[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  onMove: (key: string, xMm: number, yMm: number) => void
  onRotate: (key: string, rotation: Rotation) => void
  showRuler?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ key: string; dxMm: number; dyMm: number } | null>(null)
  const [fine, setFine] = useState(false)

  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items])
  const placementByKey = useMemo(() => new Map(placements.map((p) => [p.key, p])), [placements])

  /** Slot keys the checker has something to say about, and how loudly. */
  const issueByKey = useMemo(() => {
    const map = new Map<string, "fatal" | "warn">()
    for (const issue of issues) {
      if (!issue.key) continue
      if (issue.severity === "fatal" || !map.has(issue.key)) map.set(issue.key, issue.severity)
    }
    return map
  }, [issues])

  // Shift for fine placement. Tracked on the window because the key can be
  // pressed before the pointer enters the board.
  useEffect(() => {
    const down = (e: KeyboardEvent) => e.key === "Shift" && setFine(true)
    const up = (e: KeyboardEvent) => e.key === "Shift" && setFine(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  /** Client pixels to board millimetres, via the SVG's own screen matrix. */
  const toMm = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const local = point.matrixTransform(ctm.inverse())
    return { x: local.x, y: local.y }
  }, [])

  const snap = fine ? FINE_SNAP_MM : SNAP_MM

  function onPointerDown(e: React.PointerEvent, key: string) {
    const placement = placementByKey.get(key)
    const local = toMm(e.clientX, e.clientY)
    if (!placement || !local) return

    e.preventDefault()
    // Capture on the element that received the event, so a fast drag that
    // leaves the board keeps delivering moves instead of dropping the pedal.
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    onSelect(key)
    setDrag({ key, dxMm: local.x - placement.xMm, dyMm: local.y - placement.yMm })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return
    const local = toMm(e.clientX, e.clientY)
    const item = byKey.get(drag.key)
    if (!local || !item) return

    const placement = placementByKey.get(drag.key)
    const rotation = placement?.rotation ?? 0
    const w = rotation === 90 || rotation === 270 ? item.depthMm : item.widthMm
    const d = rotation === 90 || rotation === 270 ? item.widthMm : item.depthMm

    const rawX = local.x - drag.dxMm
    const rawY = local.y - drag.dyMm

    // Clamped to the board, then snapped. Clamping first means dragging past
    // the edge parks the pedal against it rather than refusing to move.
    const x = Math.round(Math.min(Math.max(0, rawX), board.usableWidthMm - w) / snap) * snap
    const y = Math.round(Math.min(Math.max(0, rawY), board.usableDepthMm - d) / snap) * snap
    onMove(drag.key, x, y)
  }

  function endDrag(e: React.PointerEvent) {
    if (!drag) return
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    setDrag(null)
  }

  /** Keyboard nudging, so the board is usable without a pointer at all. */
  function onKeyDown(e: React.KeyboardEvent, key: string) {
    const placement = placementByKey.get(key)
    const item = byKey.get(key)
    if (!placement || !item) return

    const step = e.shiftKey ? FINE_SNAP_MM : SNAP_MM
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }

    if (moves[e.key]) {
      e.preventDefault()
      const [dx, dy] = moves[e.key]
      const { widthMm, depthMm } = rotatedSize(item, placement.rotation)
      onMove(
        key,
        Math.min(Math.max(0, placement.xMm + dx), board.usableWidthMm - widthMm),
        Math.min(Math.max(0, placement.yMm + dy), board.usableDepthMm - depthMm),
      )
      return
    }

    if (e.key === "r" || e.key === "R") {
      e.preventDefault()
      onRotate(key, (((placement.rotation + 90) % 360) as Rotation))
    }
  }

  const padMm = 14
  const viewBox = `${-padMm} ${-padMm} ${board.usableWidthMm + padMm * 2} ${board.usableDepthMm + padMm * 2}`

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className="w-full touch-none select-none"
      style={{ aspectRatio: `${board.usableWidthMm + padMm * 2} / ${board.usableDepthMm + padMm * 2}` }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={(e) => e.target === e.currentTarget && onSelect(null)}
      role="application"
      aria-label={`${board.brand} ${board.model} layout. Select a pedal, then use the arrow keys to move it and R to rotate.`}
    >
      <defs>
        <linearGradient id="ga-board-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--surface-2)" />
          <stop offset="100%" stopColor="var(--bg2)" />
        </linearGradient>
      </defs>

      {/* The board itself. */}
      <rect
        x={0}
        y={0}
        width={board.usableWidthMm}
        height={board.usableDepthMm}
        rx={6}
        fill="url(#ga-board-face)"
        stroke="var(--line-strong)"
        strokeWidth={1.5}
      />

      {/* Rails, drawn because a pedal has to land on one. Seeing them is what
          makes an off-rail warning make sense rather than look arbitrary. */}
      {board.rails.map((rail, i) => (
        <rect
          key={i}
          x={0}
          y={rail.offsetMm}
          width={board.usableWidthMm}
          height={rail.depthMm}
          fill="var(--metal)"
          opacity={board.rails.length === 1 ? 0.35 : 0.62}
        />
      ))}

      {showRuler && <Ruler board={board} />}

      {items.map((item) => {
        const placement = placementByKey.get(item.key)
        if (!placement) return null

        const box = boxOf(item, placement)
        const w = box.x1 - box.x0
        const d = box.y1 - box.y0
        const hue = EFFECTS[item.type].hue
        const severity = issueByKey.get(item.key)
        const selected = selectedKey === item.key
        const supported = railContact(board, box).rails > 0

        return (
          <g
            key={item.key}
            transform={`translate(${box.x0} ${box.y0})`}
            onPointerDown={(e) => onPointerDown(e, item.key)}
            onKeyDown={(e) => onKeyDown(e, item.key)}
            tabIndex={0}
            role="button"
            aria-label={`${item.label}, at ${Math.round(placement.xMm)} by ${Math.round(placement.yMm)} millimetres${severity ? ", has a layout problem" : ""}`}
            className="cursor-grab focus:outline-none active:cursor-grabbing"
            style={{ pointerEvents: "all" }}
          >
            <rect
              width={w}
              height={d}
              rx={3}
              fill={`color-mix(in srgb, ${hue} 22%, var(--metal))`}
              stroke={
                severity === "fatal"
                  ? "var(--red)"
                  : selected
                    ? "var(--brand-gold)"
                    : severity === "warn"
                      ? "var(--brand-gold)"
                      : hue
              }
              strokeWidth={selected || severity ? 2 : 1.2}
              strokeDasharray={supported ? undefined : "4 3"}
            />
            {/* A footswitch, so the pedal reads as a pedal at a glance and the
                front edge is obvious when it is rotated. */}
            <circle cx={w / 2} cy={d - Math.min(11, d * 0.18)} r={Math.min(4.5, d * 0.075)} fill="var(--metal-lo)" stroke={hue} strokeWidth={0.8} />
            <text
              x={w / 2}
              y={Math.min(13, d * 0.3)}
              textAnchor="middle"
              fill="var(--text)"
              style={{ fontSize: Math.max(6, Math.min(9, w / 7)), fontWeight: 700 }}
            >
              {shortLabel(item.label, w)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function rotatedSize(item: LayoutItem, rotation: Rotation) {
  return rotation === 90 || rotation === 270
    ? { widthMm: item.depthMm, depthMm: item.widthMm }
    : { widthMm: item.widthMm, depthMm: item.depthMm }
}

/**
 * Truncate to what will actually fit across the pedal at this scale.
 *
 * Roughly six millimetres per character at the font size above. Overflowing
 * text on a 39mm mini pedal is worse than no text, since it spills onto the
 * pedal beside it and makes the layout look wrong when it is fine.
 */
function shortLabel(label: string, widthMm: number): string {
  const max = Math.max(3, Math.floor(widthMm / 5))
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`
}

/**
 * An inch scale along the top and bottom edges.
 *
 * Inches rather than millimetres because boards are sold in them everywhere,
 * including outside the US: a Pedaltrain Classic 2 is "24 inch" in every shop
 * on earth. The engine works in millimetres and the ruler translates, which is
 * the same split the catalogue uses.
 */
function Ruler({ board }: { board: BoardSpec }) {
  const inches = Math.floor(mmToIn(board.usableWidthMm))
  const ticks = Array.from({ length: inches + 1 }, (_, i) => i)

  return (
    <g aria-hidden="true">
      {ticks.map((inch) => {
        const x = inch * 25.4
        const major = inch % 6 === 0
        return (
          <g key={inch}>
            <line
              x1={x}
              y1={-6}
              x2={x}
              y2={major ? -12 : -9}
              stroke="var(--line-strong)"
              strokeWidth={0.6}
            />
            {major && (
              <text
                x={x}
                y={-14}
                textAnchor="middle"
                fill="var(--dim)"
                style={{ fontSize: 7, fontWeight: 600 }}
              >
                {inch}&quot;
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
