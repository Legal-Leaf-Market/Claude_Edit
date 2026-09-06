import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/admin/gate"

/**
 * The index, and it exists because the admin tree stopped being one page.
 *
 * This used to redirect straight to the operating model, which was right while
 * that was the only thing here. There are now six, they are reached from
 * nowhere but memory, and the cost of that showed up as somebody asking which
 * URL the projections were at. A page that lists what exists is cheaper than
 * remembering.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
}

const PAGES: { href: string; title: string; blurb: string }[] = [
  {
    href: "/admin/listings",
    title: "Listings",
    blurb:
      "One record per physical unit, pushed to Reverb and eBay when it is ready. The place a listing gets written.",
  },
  {
    href: "/admin/inventory",
    title: "Inventory",
    blurb:
      "What we paid, what we are asking, and what is left after fees. Live from the Reverb shop, so cost and price cannot disagree.",
  },
  {
    href: "/admin/outreach",
    title: "Outreach",
    blurb:
      "Paste a Marketplace listing, price the lot from real comps, and write the three messages. The tool we work from.",
  },
  {
    href: "/admin/outreach/review",
    title: "Outreach review",
    blurb: "The 103 messages already sent, by seller, and who is worth going back to.",
  },
  {
    href: "/admin/operating-model",
    title: "Operating model",
    blurb:
      "The 24-month affiliate revenue projection, July 2026 to June 2028, with the merchant-by-merchant table.",
  },
  {
    href: "/admin/all-sites",
    title: "All sites",
    blurb: "The same model across Gear Avail and its three sister sites.",
  },
]

export default async function AdminIndexPage() {
  if (!(await isAdmin())) redirect("/admin/sign-in?next=" + encodeURIComponent("/admin"))

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-black uppercase tracking-wide">Admin</h1>
      <p className="mt-2 max-w-[62ch] text-sm text-[var(--text-dim)]">
        Everything behind the passcode. None of it is indexed and none of it is linked from the
        public site.
      </p>

      <div className="mt-6 space-y-2">
        {PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="block rounded border border-[var(--edge)] bg-[var(--panel)] p-4 transition-colors hover:border-[var(--chrome-dk)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-bold">{page.title}</span>
              <code className="text-xs text-[var(--text-faint)]">{page.href}</code>
            </div>
            <p className="mt-1 text-sm text-[var(--text-dim)]">{page.blurb}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
