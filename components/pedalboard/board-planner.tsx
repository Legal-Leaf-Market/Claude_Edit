"use client"

import { useMemo, useState } from "react"
import { LayoutGrid, RotateCw, Wand2 } from "lucide-react"
import { BoardCanvas, type CanvasItem } from "./board-canvas"
import { BOARDS_BY_SIZE, boardById, DEFAULT_BOARD_ID, resolvePedal, SUPPLIES_BY_CAPACITY, supplyById, supplyTotalMa } from "@/lib/pedalboard/catalog"
import { autoArrange, checkLayout, PLUG_PROFILES, smallestBoardFor, type Placement, type PlugProfile } from "@/lib/pedalboard/layout"
import { planCables } from "@/lib/pedalboard/cables"
import { estimatedPower, planPower, recommendSupply, type PowerItem } from "@/lib/pedalboard/power-plan"
import { BOARDS as BOARD_LIST } from "@/lib/pedalboard/catalog/boards"
import { SUPPLIES } from "@/lib/pedalboard/catalog/supplies"
import { mmToIn, type Rotation } from "@/lib/pedalboard/catalog/types"
import type { EffectType } from "@/lib/pedalboard/chain"

/**
 * The physical half of the builder: what fits, what powers it, what to patch it
 * with.
 *
 * It sits below the chain rather than replacing it, because they answer
 * different questions. The chain is "will this sound right in this order"; this
 * is "will this actually go on a board and switch on". Every planner worth
 * comparing against does the second and none of them does both.
 *
 * The three engines behind it are pure and tested (layout.ts, power-plan.ts,
 * cables.ts). This component only decides what to show, which is why it can
 * stay a thin client island.
 */

export type PlannerSlot = {
  key: string
  brand: string
  model: string
  type: EffectType
}

export function BoardPlanner({ slots }: { slots: PlannerSlot[] }) {
  const [boardId, setBoardId] = useState<string>(DEFAULT_BOARD_ID)
  const [supplyId, setSupplyId] = useState<string | null>(null)
  const [plug, setPlug] = useState<PlugProfile>("right")
  const [placements, setPlacements] = useState<Placement[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const board = boardById(boardId) ?? boardById(DEFAULT_BOARD_ID)!
  const supply = supplyId ? supplyById(supplyId) : null

  /** Slots joined to physical specs, with anything unmatched clearly estimated. */
  const items = useMemo<CanvasItem[]>(
    () =>
      slots.map((slot) => {
        const resolved = resolvePedal(slot.brand, slot.model, slot.type)
        return {
          key: slot.key,
          label: `${slot.brand} ${slot.model}`,
          widthMm: resolved.dims.widthMm,
          depthMm: resolved.dims.depthMm,
          treadle: resolved.treadle,
          type: slot.type,
        }
      }),
    [slots],
  )

  const estimatedCount = useMemo(
    () => slots.filter((s) => !resolvePedal(s.brand, s.model, s.type).matched).length,
    [slots],
  )

  // Arranged automatically until somebody drags something, at which point their
  // layout wins and stays won.
  const auto = useMemo(() => autoArrange(board, items, { plug }), [board, items, plug])
  const activePlacements = placements ?? auto.placements

  const issues = useMemo(
    () => checkLayout(board, items, activePlacements, { plug }),
    [board, items, activePlacements, plug],
  )

  const powerItems = useMemo<PowerItem[]>(
    () =>
      slots.map((slot) => {
        const resolved = resolvePedal(slot.brand, slot.model, slot.type)
        return {
          id: slot.key,
          brand: slot.brand,
          model: slot.model,
          type: slot.type,
          power: resolved.spec?.power ?? estimatedPower(slot.type),
        }
      }),
    [slots],
  )

  const power = useMemo(() => planPower(powerItems, supply), [powerItems, supply])
  const suggestedSupply = useMemo(() => recommendSupply(powerItems, SUPPLIES), [powerItems])
  const cables = useMemo(() => planCables(items, activePlacements, plug), [items, activePlacements, plug])
  const smallestBoard = useMemo(() => smallestBoardFor(BOARD_LIST, items, { plug }), [items, plug])

  const fatal = issues.filter((i) => i.severity === "fatal")
  const warnings = issues.filter((i) => i.severity === "warn")

  if (slots.length === 0) return null

  function move(key: string, xMm: number, yMm: number) {
    setPlacements((current) =>
      (current ?? auto.placements).map((p) => (p.key === key ? { ...p, xMm, yMm } : p)),
    )
  }

  function rotate(key: string, rotation: Rotation) {
    setPlacements((current) =>
      (current ?? auto.placements).map((p) => (p.key === key ? { ...p, rotation } : p)),
    )
  }

  return (
    <section className="mt-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 font-display text-lg font-black text-[var(--text)]">
          <LayoutGrid className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
          Will it fit?
        </h2>

        <label className="sr-only" htmlFor="ga-board">
          Pedalboard
        </label>
        <select
          id="ga-board"
          value={boardId}
          onChange={(e) => {
            setBoardId(e.target.value)
            setPlacements(null)
          }}
          className="rounded-[9px] border border-[var(--line-strong)] bg-[var(--chip)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)]"
        >
          {BOARDS_BY_SIZE.map((b) => (
            <option key={b.id} value={b.id}>
              {b.brand} {b.model} ({b.labelWidthIn}&quot; x {b.labelDepthIn}&quot;)
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="ga-plug">
          Plug type
        </label>
        <select
          id="ga-plug"
          value={plug}
          onChange={(e) => {
            setPlug(e.target.value as PlugProfile)
            setPlacements(null)
          }}
          className="rounded-[9px] border border-[var(--line-strong)] bg-[var(--chip)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)]"
        >
          {Object.entries(PLUG_PROFILES).map(([key, profile]) => (
            <option key={key} value={key}>
              {profile.label} ({profile.gapMm}mm)
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setPlacements(null)}
          className="stomp stomp-sm"
          title="Arrange the pedals automatically, in signal order"
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
          Auto-arrange
        </button>
      </div>

      <div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg2)] p-3">
        <BoardCanvas
          board={board}
          items={items}
          placements={activePlacements}
          issues={issues}
          selectedKey={selected}
          onSelect={setSelected}
          onMove={move}
          onRotate={rotate}
        />
      </div>

      <p className="mt-2 text-[0.7rem] leading-relaxed text-[var(--muted-foreground)]">
        Drag to move, <kbd className="rounded border border-[var(--line)] px-1">R</kbd> to rotate,
        arrow keys to nudge. Hold <kbd className="rounded border border-[var(--line)] px-1">Shift</kbd>{" "}
        for 1mm steps.
        {selected && (
          <button
            type="button"
            onClick={() => {
              const current = activePlacements.find((p) => p.key === selected)
              if (current) rotate(selected, (((current.rotation + 90) % 360) as Rotation))
            }}
            className="ml-2 inline-flex items-center gap-1 text-[var(--accent-text)] underline-offset-2 hover:underline"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            Rotate selection
          </button>
        )}
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Panel title="Fit">
          <Stat
            label="Board used"
            value={`${Math.round((auto.boardAreaMm2 > 0 ? auto.usedAreaMm2 / auto.boardAreaMm2 : 0) * 100)}%`}
          />
          <Stat
            label="Board size"
            value={`${Math.round(mmToIn(board.usableWidthMm) * 10) / 10}" x ${Math.round(mmToIn(board.usableDepthMm) * 10) / 10}" usable`}
          />
          {smallestBoard && smallestBoard.id !== board.id && (
            <p className="mt-2 text-[0.72rem] leading-relaxed text-[var(--muted-foreground)]">
              The smallest board here that takes this chain is the {smallestBoard.brand}{" "}
              {smallestBoard.model}.
            </p>
          )}
          {estimatedCount > 0 && (
            <p className="mt-2 text-[0.72rem] leading-relaxed text-[var(--muted-foreground)]">
              {estimatedCount} pedal{estimatedCount === 1 ? " has" : "s have"} no measured size
              here, so {estimatedCount === 1 ? "it is" : "they are"} drawn at a standard 1590B.
              Check the maker&apos;s spec before you drill anything.
            </p>
          )}
        </Panel>

        <Panel title="Power">
          <div className="mb-2">
            <label className="sr-only" htmlFor="ga-supply">
              Power supply
            </label>
            <select
              id="ga-supply"
              value={supplyId ?? ""}
              onChange={(e) => setSupplyId(e.target.value || null)}
              className="w-full rounded-[9px] border border-[var(--line-strong)] bg-[var(--chip)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)]"
            >
              <option value="">No supply chosen</option>
              {SUPPLIES_BY_CAPACITY.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.brand} {s.model} ({supplyTotalMa(s)}mA)
                </option>
              ))}
            </select>
          </div>

          <Stat label="Total draw" value={`${power.totalMa}mA`} />
          <Stat label="Outputs needed" value={`${power.poweredCount}`} />
          {supply && (
            <Stat
              label="Headroom"
              value={`${Math.round(power.headroom * 100)}%`}
              tone={power.headroom < 0 ? "bad" : power.headroom < 0.2 ? "warn" : "good"}
            />
          )}

          {!supply && suggestedSupply && (
            <button
              type="button"
              onClick={() => setSupplyId(suggestedSupply.id)}
              className="mt-2 text-left text-[0.72rem] leading-relaxed text-[var(--accent-text)] underline-offset-2 hover:underline"
            >
              Try the {suggestedSupply.brand} {suggestedSupply.model}, the smallest isolated supply
              here with room for this board.
            </button>
          )}

          <IssueList issues={power.issues.map((i) => ({ severity: i.severity, message: i.message }))} />

          {power.confidence !== "spec" && (
            <p className="mt-2 text-[0.68rem] leading-relaxed text-[var(--muted-foreground)]">
              Some of these figures are typical draws rather than the maker&apos;s own spec.
            </p>
          )}
        </Panel>

        <Panel title="Cables">
          <Stat label="Patch cables" value={`${cables.patchCount}`} />
          <Stat label="Instrument leads" value={`${cables.instrumentLeads}`} />
          {cables.byLength.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[0.72rem] text-[var(--muted-foreground)]">
              {cables.byLength.map((entry) => (
                <li key={entry.lengthMm}>
                  {entry.count} x {Math.round(mmToIn(entry.lengthMm) * 10) / 10}&quot;
                </li>
              ))}
            </ul>
          )}
          {cables.notes.map((note) => (
            <p key={note} className="mt-2 text-[0.68rem] leading-relaxed text-[var(--muted-foreground)]">
              {note}
            </p>
          ))}
        </Panel>
      </div>

      {(fatal.length > 0 || warnings.length > 0) && (
        <div className="mt-3">
          <IssueList issues={[...fatal, ...warnings].map((i) => ({ severity: i.severity, message: i.message }))} />
        </div>
      )}
    </section>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[11px] border border-[var(--line)] bg-[var(--bg2)] p-3">
      <h3 className="mb-2 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "good" | "warn" | "bad"
}) {
  const colour =
    tone === "bad"
      ? "var(--red)"
      : tone === "warn"
        ? "var(--accent-text)"
        : tone === "good"
          ? "var(--money)"
          : "var(--text)"
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[0.72rem] text-[var(--muted-foreground)]">{label}</span>
      <span className="font-sans text-sm font-bold tabular-nums" style={{ color: colour }}>
        {value}
      </span>
    </div>
  )
}

function IssueList({ issues }: { issues: { severity: "fatal" | "warn"; message: string }[] }) {
  if (issues.length === 0) return null
  return (
    <ul className="mt-2 space-y-1.5">
      {issues.map((issue, i) => (
        <li
          key={i}
          className="flex gap-2 text-[0.72rem] leading-relaxed"
          style={{ color: issue.severity === "fatal" ? "var(--red)" : "var(--muted-foreground)" }}
        >
          <span aria-hidden="true">{issue.severity === "fatal" ? "!" : "-"}</span>
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  )
}
