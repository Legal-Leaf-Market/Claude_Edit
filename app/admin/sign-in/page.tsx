import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { adminConfigured, isAdmin, passcodeEnabled } from "@/lib/admin"
import { AdminPasscodeForm } from "@/components/admin/admin-passcode-form"

export const metadata: Metadata = { title: "Sign in" }

// The gate reads cookies and env, so it must never be prerendered.
export const dynamic = "force-dynamic"

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect: requested } = await searchParams
  // Only ever bounce to a path on this origin.
  const destination =
    requested && requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/admin/operating-model"

  if (await isAdmin()) redirect(destination)

  const configured = adminConfigured()
  const passcode = passcodeEnabled()

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-gold/20 bg-white/[0.04] p-6">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-gold">
          Admin mode
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-mint">
          This page is private
        </h1>

        {!configured ? (
          <div className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-muted-foreground">
            <p>
              No admin credential is configured on this deployment, so nothing can be unlocked yet.
              The gate fails closed on purpose — an unset variable must not publish the operating
              model.
            </p>
            <p>Set either of these in your Vercel project environment variables, then redeploy:</p>
            <ul className="space-y-2">
              <li className="rounded-lg border border-gold/20 bg-white/[0.05] p-3">
                <code className="text-xs font-black text-lime">ADMIN_PASSCODE</code>
                <span className="mt-1 block text-xs">
                  A long random string. Enter it here to unlock; it also signs the session cookie,
                  so changing it signs everyone out.
                </span>
              </li>
              <li className="rounded-lg border border-gold/20 bg-white/[0.05] p-3">
                <code className="text-xs font-black text-lime">ADMIN_EMAILS</code>
                <span className="mt-1 block text-xs">
                  Comma-separated addresses. Anyone signed in to the site with one of these accounts
                  gets in without a second secret.
                </span>
              </li>
            </ul>
          </div>
        ) : passcode ? (
          <>
            <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
              Enter the admin passcode to open the operating model.
            </p>
            <AdminPasscodeForm redirectTo={destination} />
          </>
        ) : (
          <div className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-muted-foreground">
            <p>
              This deployment grants admin access by account. Sign in with an allowlisted address
              and you'll be brought straight back here.
            </p>
            <Link
              href={`/sign-in?redirect=${encodeURIComponent(destination)}`}
              className="inline-block rounded-lg bg-lime px-4 py-2 text-sm font-black uppercase tracking-wider text-primary-foreground transition hover:bg-lime/85"
            >
              Go to sign in
            </Link>
          </div>
        )}

        <p className="mt-5 border-t border-gold/15 pt-4 text-xs font-medium text-muted-foreground">
          <Link href="/" className="hover:text-lime">
            ← Back to the public site
          </Link>
        </p>
      </div>
    </main>
  )
}
