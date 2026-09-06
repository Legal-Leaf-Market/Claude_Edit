"use client"

import { useState } from "react"
import type { ListingDraft } from "@/lib/db/schema"

/**
 * The editor for one physical unit.
 *
 * WHAT IS GROUPED AND WHY. The gear, the money, and then one block per channel.
 * The channel blocks are last and are visibly separate because they are the
 * only fields whose meaning comes from somebody else's system: a Reverb
 * category UUID is not a fact about the pedal, it is a fact about Reverb. The
 * top of the form is the pedal; the bottom is the paperwork.
 *
 * COST AND THE OFFER FLOOR ARE MARKED AS OURS, on the field itself rather than
 * only in a comment, because the whole risk with those two is somebody assuming
 * they are part of the listing. They are never sent to any channel.
 */

type Props = {
  draft?: ListingDraft
  onSaved?: () => void
}

type Meta = {
  reverb?: { categoryUuid?: string; conditionUuid?: string; shippingProfileId?: string }
  ebay?: {
    categoryId?: string
    conditionId?: string
    merchantLocationKey?: string
    fulfillmentPolicyId?: string
    paymentPolicyId?: string
    returnPolicyId?: string
  }
}

const dollars = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100))
const toCents = (value: string): number | null => {
  const n = Number.parseFloat(value.replace(/[^\d.]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

export function ListingForm({ draft, onSaved }: Props) {
  const meta = (draft?.channelMeta ?? {}) as Meta

  const [form, setForm] = useState({
    sku: draft?.sku ?? "",
    title: draft?.title ?? "",
    brand: draft?.brand ?? "",
    model: draft?.model ?? "",
    condition: draft?.condition ?? "",
    year: draft?.year ?? "",
    finish: draft?.finish ?? "",
    countryOfOrigin: draft?.countryOfOrigin ?? "",
    description: draft?.description ?? "",
    photos: (Array.isArray(draft?.photos) ? (draft.photos as string[]) : []).join("\n"),
    price: dollars(draft?.priceCents),
    cost: dollars(draft?.costCents),
    shipping: dollars(draft?.shippingCents),
    offerFloor: dollars(draft?.offerFloorCents),
    acceptsOffers: draft?.acceptsOffers ?? true,
    localPickup: draft?.localPickup ?? false,
    notes: draft?.notes ?? "",
    reverbCategoryUuid: meta.reverb?.categoryUuid ?? "",
    reverbConditionUuid: meta.reverb?.conditionUuid ?? "",
    reverbShippingProfileId: meta.reverb?.shippingProfileId ?? "",
    ebayCategoryId: meta.ebay?.categoryId ?? "",
    ebayConditionId: meta.ebay?.conditionId ?? "",
    ebayMerchantLocationKey: meta.ebay?.merchantLocationKey ?? "",
    ebayFulfillmentPolicyId: meta.ebay?.fulfillmentPolicyId ?? "",
    ebayPaymentPolicyId: meta.ebay?.paymentPolicyId ?? "",
    ebayReturnPolicyId: meta.ebay?.returnPolicyId ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState("")

  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    setSaving(true)
    setNote("")
    const body = {
      id: draft?.id,
      sku: form.sku.trim(),
      title: form.title.trim(),
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      condition: form.condition.trim() || null,
      year: form.year.trim() || null,
      finish: form.finish.trim() || null,
      countryOfOrigin: form.countryOfOrigin.trim() || null,
      description: form.description.trim() || null,
      photos: form.photos.split("\n").map((s) => s.trim()).filter(Boolean),
      priceCents: toCents(form.price),
      costCents: toCents(form.cost),
      shippingCents: toCents(form.shipping),
      offerFloorCents: toCents(form.offerFloor),
      acceptsOffers: form.acceptsOffers,
      localPickup: form.localPickup,
      notes: form.notes.trim() || null,
      channelMeta: {
        reverb: {
          categoryUuid: form.reverbCategoryUuid.trim() || undefined,
          conditionUuid: form.reverbConditionUuid.trim() || undefined,
          shippingProfileId: form.reverbShippingProfileId.trim() || undefined,
        },
        ebay: {
          categoryId: form.ebayCategoryId.trim() || undefined,
          conditionId: form.ebayConditionId.trim() || undefined,
          merchantLocationKey: form.ebayMerchantLocationKey.trim() || undefined,
          fulfillmentPolicyId: form.ebayFulfillmentPolicyId.trim() || undefined,
          paymentPolicyId: form.ebayPaymentPolicyId.trim() || undefined,
          returnPolicyId: form.ebayReturnPolicyId.trim() || undefined,
        },
      },
    }

    try {
      const res = await fetch("/api/admin/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setNote(data.error ?? `Saved nothing: the server answered ${res.status}.`)
        return
      }
      setNote("Saved.")
      onSaved?.()
      setTimeout(() => window.location.reload(), 600)
    } catch {
      setNote("The request did not get through. Nothing was saved.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <Section title="The pedal">
        <Row>
          <Field label="SKU" hint="Ours. The join key on every channel." value={form.sku} onChange={set("sku")} />
          <Field label="Condition" value={form.condition} onChange={set("condition")} placeholder="Excellent" />
        </Row>
        <Field label="Title" value={form.title} onChange={set("title")} wide />
        <Row>
          <Field label="Brand" value={form.brand} onChange={set("brand")} />
          <Field label="Model" value={form.model} onChange={set("model")} />
        </Row>
        <Row>
          <Field label="Year" value={form.year} onChange={set("year")} />
          <Field label="Finish" value={form.finish} onChange={set("finish")} />
          <Field label="Country of origin" value={form.countryOfOrigin} onChange={set("countryOfOrigin")} />
        </Row>
        <Area
          label="Description"
          hint="The single field worth the most on both marketplaces."
          value={form.description}
          onChange={set("description")}
          rows={7}
        />
        <Area
          label="Photo URLs"
          hint="One per line, in the order they should appear."
          value={form.photos}
          onChange={set("photos")}
          rows={4}
        />
      </Section>

      <Section title="Money">
        <Row>
          <Field label="Price" prefix="$" value={form.price} onChange={set("price")} />
          <Field label="Shipping" prefix="$" value={form.shipping} onChange={set("shipping")} />
        </Row>
        <Row>
          <Field
            label="Cost"
            prefix="$"
            hint="OURS. Never sent to any channel."
            value={form.cost}
            onChange={set("cost")}
          />
          <Field
            label="Offer floor"
            prefix="$"
            hint="OURS. The least we will take. Never sent."
            value={form.offerFloor}
            onChange={set("offerFloor")}
          />
        </Row>
        <div className="flex flex-wrap gap-4 pt-1">
          <Check label="Accepts offers" checked={form.acceptsOffers} onChange={set("acceptsOffers")} />
          <Check label="Local pickup" checked={form.localPickup} onChange={set("localPickup")} />
        </div>
      </Section>

      <Section title="Reverb" hint="Reverb's own ids, from its taxonomy rather than ours.">
        <Row>
          <Field label="Category UUID" value={form.reverbCategoryUuid} onChange={set("reverbCategoryUuid")} />
          <Field label="Condition UUID" value={form.reverbConditionUuid} onChange={set("reverbConditionUuid")} />
        </Row>
        <Field
          label="Shipping profile id"
          hint="Optional. With one set, the shipping price above is not sent."
          value={form.reverbShippingProfileId}
          onChange={set("reverbShippingProfileId")}
          wide
        />
      </Section>

      <Section title="eBay" hint="The three policies and the location must already exist in your eBay account.">
        <Row>
          <Field label="Category id" value={form.ebayCategoryId} onChange={set("ebayCategoryId")} />
          <Field label="Condition id" value={form.ebayConditionId} onChange={set("ebayConditionId")} placeholder="3000" />
          <Field
            label="Merchant location key"
            value={form.ebayMerchantLocationKey}
            onChange={set("ebayMerchantLocationKey")}
          />
        </Row>
        <Row>
          <Field label="Fulfillment policy id" value={form.ebayFulfillmentPolicyId} onChange={set("ebayFulfillmentPolicyId")} />
          <Field label="Payment policy id" value={form.ebayPaymentPolicyId} onChange={set("ebayPaymentPolicyId")} />
          <Field label="Return policy id" value={form.ebayReturnPolicyId} onChange={set("ebayReturnPolicyId")} />
        </Row>
      </Section>

      <Section title="Notes" hint="Ours. Never leaves this page.">
        <Area label="" value={form.notes} onChange={set("notes")} rows={3} />
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !form.sku.trim() || !form.title.trim()}
          className="rounded border border-[var(--edge)] bg-[var(--panel)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving..." : draft ? "Save changes" : "Create listing"}
        </button>
        {note ? <span className="text-sm text-[var(--text-dim)]">{note}</span> : null}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-[var(--edge)] bg-[var(--panel)] p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--text-faint)]">
        {title}
      </h3>
      {hint ? <p className="mt-0.5 text-xs text-[var(--text-dim)]">{hint}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

function Field({
  label, value, onChange, hint, placeholder, prefix, wide,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  placeholder?: string
  prefix?: string
  wide?: boolean
}) {
  return (
    <label className={"block " + (wide ? "sm:col-span-2 lg:col-span-3" : "")}>
      <span className="block text-xs font-semibold text-[var(--text-dim)]">{label}</span>
      <span className="mt-1 flex items-center gap-1 rounded border border-[var(--edge)] bg-[var(--sunk)] px-2">
        {prefix ? <span className="text-sm text-[var(--text-faint)]">{prefix}</span> : null}
        <input
          className="w-full bg-transparent py-2 text-sm outline-none"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
      {hint ? <span className="mt-0.5 block text-[11px] text-[var(--text-faint)]">{hint}</span> : null}
    </label>
  )
}

function Area({
  label, value, onChange, hint, rows,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  rows: number
}) {
  return (
    <label className="block">
      {label ? <span className="block text-xs font-semibold text-[var(--text-dim)]">{label}</span> : null}
      <textarea
        className="mt-1 w-full rounded border border-[var(--edge)] bg-[var(--sunk)] p-2 text-sm outline-none"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="block text-[11px] text-[var(--text-faint)]">{hint}</span> : null}
    </label>
  )
}

function Check({
  label, checked, onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
