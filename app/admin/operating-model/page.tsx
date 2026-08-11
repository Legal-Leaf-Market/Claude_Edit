import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { OperatingModelDashboard } from "@/components/admin/operating-model-dashboard"
import { isAdmin } from "@/lib/admin/gate"
import { MaintenanceButton } from "@/components/admin/maintenance-button"

// Checked server-side before a single byte of the model goes out; an
// unauthenticated request gets a redirect, not a page that merely hides the
// numbers with CSS. Never cached, since it reads a cookie.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Operating model",
  robots: { index: false, follow: false, nocache: true },
}

export default async function OperatingModelPage() {
  if (!(await isAdmin())) {
    redirect(`/admin/sign-in?redirect=${encodeURIComponent("/admin/operating-model")}`)
  }

  return (
    <>
      {/*
        Housekeeping sits above the projection because it is the thing an
        admin actually comes here to DO. The dashboard below is a thing to
        read, and a job that has to be run by hand should not be underneath
        two screens of charts.
      */}
      <div className="shell pt-6">
        <MaintenanceButton />
      </div>
      <OperatingModelDashboard />
    </>
  )
}
