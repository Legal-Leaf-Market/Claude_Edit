import type { Metadata } from "next"
import { AlertsClient } from "@/components/alerts-client"
import { env } from "@/lib/env"

export const metadata: Metadata = {
  title: "Price alerts",
  description:
    "Save a search with a price ceiling and get an email or a Discord ping when matching used gear is listed below it.",
  robots: { index: false, follow: true },
}

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-[var(--cream)]">Price alerts</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)]">
        Tell us what you are hunting for and the most you want to pay. We check every time new
        listings land, usually within the hour, and only ever tell you about a listing once.
      </p>

      {!env.auth.isConfigured ? (
        <div className="panel mt-8 p-6">
          <p className="text-sm text-[var(--cream)]">Alerts are not available on this deployment.</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Accounts need BETTER_AUTH_SECRET to be set. Search and price comparison work without
            it, so everything else on the site is unaffected.
          </p>
        </div>
      ) : (
        <AlertsClient />
      )}
    </div>
  )
}
