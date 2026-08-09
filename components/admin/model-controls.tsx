"use client"

import { useRef } from "react"
import type { ScenarioKey, SiteAssumptions, SiteKey } from "@/lib/operating-model"
import { ASSUMPTION_FIELDS, SCENARIOS, SCENARIO_ORDER, SITE_PROFILES } from "@/lib/operating-model-data"
import { Card, NumberInput, Swatch } from "@/components/admin/model-ui"
import { cn } from "@/lib/utils"

export function ScenarioPicker({
  scenario,
  onChange,
}: {
  scenario: ScenarioKey
  onChange: (next: ScenarioKey) => void
}) {
  const active = SCENARIOS[scenario]
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Scenario"
        className="inline-flex rounded-xl border border-gold/25 bg-white/[0.04] p-1"
      >
        {SCENARIO_ORDER.map((key) => {
          const selected = key === scenario
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(key)}
              className={cn(
                "rounded-lg px-5 py-1.5 text-sm font-black uppercase tracking-wider transition",
                selected
                  ? "bg-lime text-primary-foreground"
                  : "text-muted-foreground hover:text-mint",
              )}
            >
              {SCENARIOS[key].label}
            </button>
          )
        })}
      </div>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
        <span className="font-black text-mint">{active.headline}.</span> {active.detail}
      </p>
      <p className="mt-2 text-xs font-medium text-muted-foreground">
        The scenario multiplies the assumptions below — it does not replace them. Edit a number and
        all three scenarios move with it.
      </p>
    </div>
  )
}

export function AssumptionsPanel({
  getValue,
  setValue,
}: {
  getValue: (site: SiteKey, field: keyof SiteAssumptions) => number
  setValue: (site: SiteKey, field: keyof SiteAssumptions, next: number | null) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {SITE_PROFILES.map((profile) => (
        <Card key={profile.key} className="p-4">
          <div className="mb-3">
            <p className="flex items-center gap-2 text-base font-black text-mint">
              <Swatch color={profile.color} />
              {profile.name}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{profile.tagline}</p>
            <p className="mt-0.5 text-xs font-bold text-gold">{profile.domain}</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {ASSUMPTION_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-wider text-muted-foreground">
                  {field.label}
                </span>
                <NumberInput
                  label={`${profile.name} — ${field.label}`}
                  step={field.step}
                  value={getValue(profile.key, field.key)}
                  onChange={(v) => setValue(profile.key, field.key, v)}
                />
              </label>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

export function DataActions({
  onExport,
  onImport,
  onReset,
  savedLabel,
}: {
  onExport: () => void
  onImport: (file: File) => void
  onReset: () => void
  savedLabel: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const button =
    "rounded-lg border border-gold/30 bg-white/[0.06] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-mint transition hover:border-gold/60 hover:bg-white/[0.1]"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={button} onClick={onExport}>
        Export
      </button>
      <button type="button" className={button} onClick={() => fileRef.current?.click()}>
        Import
      </button>
      <button
        type="button"
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-destructive transition hover:bg-destructive/20"
        onClick={() => {
          if (
            window.confirm(
              "Reset every assumption and every actual you have entered? This cannot be undone.",
            )
          ) {
            onReset()
          }
        }}
      >
        Reset all
      </button>
      <span className="text-xs font-medium text-muted-foreground">{savedLabel}</span>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImport(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
