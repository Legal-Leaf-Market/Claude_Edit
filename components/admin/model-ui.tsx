"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Solid chart/table surface. The categorical palette was validated against it. */
export const VIZ_SURFACE = "#0a1a29"

export function Section({
  eyebrow,
  title,
  intro,
  children,
  className,
  id,
}: {
  eyebrow?: string
  title: string
  intro?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn("mt-14 scroll-mt-20 sm:mt-20", className)}>
      {eyebrow ? (
        <p className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.25em] text-gold">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-black tracking-tight text-mint sm:text-3xl">{title}</h2>
      {intro ? (
        <div className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
          {intro}
        </div>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function Card({
  children,
  className,
  solid = false,
}: {
  children: ReactNode
  className?: string
  /** Use the opaque viz surface instead of the translucent brand card. */
  solid?: boolean
  }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gold/20",
        solid ? "" : "bg-white/[0.04]",
        className,
      )}
      style={solid ? { background: VIZ_SURFACE } : undefined}
    >
      {children}
    </div>
  )
}

/** Big headline figure. Proportional digits — tabular-nums reads loose at display sizes. */
export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-white/[0.04] p-4">
      <p className="text-[0.65rem] font-black uppercase tracking-widest text-gold">{label}</p>
      <p
        className="mt-1.5 text-2xl font-black leading-none text-mint sm:text-[1.75rem]"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-xs font-medium text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

/**
 * Horizontally scrollable table shell. Wide tables scroll inside their own
 * container so the page body never scrolls sideways.
 */
export function TableShell({
  children,
  caption,
  className,
}: {
  children: ReactNode
  caption?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl border border-gold/20", className)} style={{ background: VIZ_SURFACE }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">{children}</table>
      </div>
      {caption ? (
        <p className="border-t border-gold/15 px-4 py-3 text-xs font-medium leading-relaxed text-muted-foreground">
          {caption}
        </p>
      ) : null}
    </div>
  )
}

export function Th({
  children,
  align = "left",
  className,
  scope = "col",
}: {
  children: ReactNode
  align?: "left" | "right"
  className?: string
  scope?: "col" | "row"
}) {
  return (
    <th
      scope={scope}
      className={cn(
        "whitespace-nowrap border-b border-gold/25 px-3 py-2.5 text-[0.65rem] font-black uppercase tracking-widest text-gold",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = "left",
  className,
  numeric = false,
}: {
  /** Optional so a spacer cell in a totals row can be written as `<Td />`. */
  children?: ReactNode
  align?: "left" | "right"
  className?: string
  numeric?: boolean
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap border-b border-white/[0.06] px-3 py-2 text-foreground/90",
        align === "right" ? "text-right" : "text-left",
        numeric && "tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  )
}

/** Colour chip that carries series identity alongside the text label. */
export function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-[3px] align-middle"
      style={{ background: color }}
    />
  )
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode
  tone?: "muted" | "good" | "warn" | "bad"
}) {
  const tones = {
    muted: "border-white/15 bg-white/[0.06] text-muted-foreground",
    good: "border-lime/30 bg-lime/10 text-lime",
    warn: "border-gold/40 bg-gold/10 text-gold",
    bad: "border-destructive/40 bg-destructive/10 text-destructive",
  } as const
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider",
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

/**
 * Inline numeric input used everywhere a model assumption can be edited.
 * Empty means "unset" so a cleared field falls back to the model default rather
 * than silently becoming zero.
 */
export function NumberInput({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  prefix,
  suffix,
  label,
  className,
  placeholder,
  tone = "default",
}: {
  value: number | null
  onChange: (next: number | null) => void
  step?: number
  min?: number
  max?: number
  prefix?: string
  suffix?: string
  label: string
  className?: string
  placeholder?: string
  tone?: "default" | "actual"
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border px-2 py-1 transition focus-within:border-lime/60 focus-within:ring-2 focus-within:ring-lime/25",
        tone === "actual"
          ? "border-lime/25 bg-lime/[0.07]"
          : "border-white/12 bg-white/[0.06]",
        className,
      )}
    >
      {prefix ? <span className="text-xs font-bold text-muted-foreground">{prefix}</span> : null}
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value === null || Number.isNaN(value) ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value
          if (raw.trim() === "") return onChange(null)
          const parsed = Number(raw)
          onChange(Number.isFinite(parsed) ? parsed : null)
        }}
        className="w-full min-w-0 bg-transparent text-right text-sm font-bold tabular-nums text-mint outline-none placeholder:font-medium placeholder:text-muted-foreground/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix ? <span className="text-xs font-bold text-muted-foreground">{suffix}</span> : null}
    </div>
  )
}
