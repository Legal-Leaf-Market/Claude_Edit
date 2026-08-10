import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * /admin has nothing of its own. Operating model is the default landing
 * page; the all-sites rollup lives at /admin/all-sites and is linked from
 * there rather than being a second thing to land on.
 */
export default function AdminIndexPage() {
  redirect("/admin/operating-model")
}
