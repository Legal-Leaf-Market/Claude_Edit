import type { Metadata } from "next"
import Link from "next/link"
import { isAdmin } from "@/lib/admin"
import { AdminSignOut } from "@/components/admin/admin-sign-out"

/**
 * Everything under /admin is private working material. Keep it out of every
 * index, and out of the sitemap (which lists public routes only).
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin()

  return (
    // The public site paints a full-bleed paisley behind everything, which is
    // right for a landing page and wrong for a dense document. Lay an almost
    // opaque navy over it so long-form text and table rules stay legible, with
    // just enough transparency to keep the texture.
    <div
      className="min-h-dvh"
      style={{
        background:
          "linear-gradient(180deg, rgba(4,16,27,0.955) 0%, rgba(6,21,33,0.975) 100%)",
      }}
    >
      <header className="border-b border-gold/20 bg-navy/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="text-sm font-black tracking-tight text-mint hover:text-lime">
            Legal-Leaf Market
          </Link>
          <span className="rounded-full border border-lime/40 bg-lime/10 px-2.5 py-0.5 text-[0.6rem] font-black uppercase tracking-widest text-lime">
            Admin mode
          </span>
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
            Private · not indexed
          </span>
          {admin ? (
            <div className="ml-auto">
              <AdminSignOut />
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  )
}
