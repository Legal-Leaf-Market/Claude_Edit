"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/* A field is a hole routed into the panel; a <select> is a plate with a rotary
   behind it. Both are the shared vocabulary from globals.css rather than a
   bordered rectangle, so a form does not read as the one part of the site
   nobody dressed. */
const inputClass = "plate h-10 w-full px-3 text-sm"
const selectClass = "rotary h-10 w-full"
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--cream)]"

export function MerchantLeadForm() {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("pending")
    setError(null)

    const form = new FormData(event.currentTarget)
    const payload = {
      shopName: String(form.get("shopName") ?? "").trim(),
      contactName: String(form.get("contactName") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim() || undefined,
      location: String(form.get("location") ?? "").trim() || undefined,
      hasOnlineCatalog: String(form.get("hasOnlineCatalog") ?? "unsure"),
      existingLink: String(form.get("existingLink") ?? "").trim() || undefined,
      message: String(form.get("message") ?? "").trim() || undefined,
      referredBy: String(form.get("referredBy") ?? "owner"),
      // Honeypot: left blank by real visitors, since it is visually hidden.
      website: String(form.get("website") ?? ""),
    }

    try {
      const res = await fetch("/api/merchant-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Something went wrong. Try again in a moment.")
        setStatus("error")
        return
      }
      setStatus("done")
    } catch {
      setError("Something went wrong. Try again in a moment.")
      setStatus("error")
    }
  }

  if (status === "done") {
    return (
      <div className="panel p-6 text-center">
        <p className="text-base font-medium text-[var(--cream)]">Thanks, that's in the queue.</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          A real person reads every one of these. We'll follow up by email to talk through what
          getting listed would actually look like for this shop.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="shopName" className={labelClass}>
            Shop name
          </label>
          <input id="shopName" name="shopName" required maxLength={200} className={inputClass} />
        </div>
        <div>
          <label htmlFor="location" className={labelClass}>
            City / state (optional)
          </label>
          <input id="location" name="location" maxLength={200} className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contactName" className={labelClass}>
            Your name
          </label>
          <input id="contactName" name="contactName" required maxLength={200} className={inputClass} />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone (optional)
          </label>
          <input id="phone" name="phone" type="tel" maxLength={30} className={inputClass} />
        </div>
        <div>
          <label htmlFor="referredBy" className={labelClass}>
            You are
          </label>
          <select id="referredBy" name="referredBy" defaultValue="owner" className={selectClass}>
            <option value="owner">The shop owner</option>
            <option value="customer">A customer, suggesting this shop</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="hasOnlineCatalog" className={labelClass}>
          Does the shop sell online today?
        </label>
        <select
          id="hasOnlineCatalog"
          name="hasOnlineCatalog"
          defaultValue="unsure"
          className={selectClass}
        >
          <option value="yes">Yes, we have an online store</option>
          <option value="pos-only">We use a point-of-sale system, but no real website</option>
          <option value="no">No, everything is in person only</option>
          <option value="unsure">Not sure / let's talk about it</option>
        </select>
        <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
          Gear Avail reads real inventory, not marketing pages, so we need some way to see what is
          actually in stock. An existing online store works. A point-of-sale system alone often
          does not, though some (Shopify POS's low-cost Starter plan, for one) can add a minimal
          product-and-checkout page without a full website. If nothing here sounds familiar, pick
          "not sure" and we'll figure it out together.
        </p>
      </div>

      <div>
        <label htmlFor="existingLink" className={labelClass}>
          Website, social page, or POS link (optional)
        </label>
        <input id="existingLink" name="existingLink" maxLength={500} className={inputClass} />
      </div>

      <div>
        <label htmlFor="message" className={labelClass}>
          Anything else we should know? (optional)
        </label>
        <textarea
          id="message"
          name="message"
          maxLength={2000}
          rows={4}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {/* Honeypot: hidden from real visitors via CSS, not just off-screen positioning. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this blank</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}

      <Button type="submit" disabled={status === "pending"} className="w-full">
        {status === "pending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Send
      </Button>

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        This starts a conversation, not an automatic listing. No commitment either way.
      </p>
    </form>
  )
}
