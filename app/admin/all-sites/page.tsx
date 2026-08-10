import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AllSitesDashboard } from "@/components/admin/all-sites-dashboard"
import { isAdmin } from "@/lib/admin/gate"

// Same gate as /admin/operating-model: checked server-side before a single
// byte of the model goes out.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "All sites",
  robots: { index: false, follow: false, nocache: true },
}

export default async function AllSitesPage() {
  if (!(await isAdmin())) {
    redirect(`/admin/sign-in?redirect=${encodeURIComponent("/admin/all-sites")}`)
  }

  return <AllSitesDashboard />
}
