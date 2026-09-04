import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/admin/gate"
import { OUTREACH_HTML } from "./document"

/**
 * THE OUTREACH TOOL, BEHIND THE PASSCODE.
 *
 * WHY IT LIVES UNDER /admin RATHER THAN UNDER /stompbox. It needs the admin
 * gate, and `tests/stompbox/boundary.test.ts` forbids the guide's tree from
 * importing admin code at all. That rule is the only thing standing where a
 * separate credential-free Vercel project used to, so the answer is to move
 * the page to the gate rather than to carry the gate into the guide, or worse
 * to reimplement HMAC session checking beside it as a second copy.
 *
 * The URL is unchanged: middleware maps `stompbox.world/outreach` here, so
 * what a person types and what the code is called can differ without either
 * having to bend.
 *
 * IT FAILS CLOSED, like every other gate here. No passcode configured means
 * nobody gets in, ever, rather than everybody. That is `CRON_SECRET`'s rule
 * and `ADMIN_PASSCODE`'s, and it matters more here than on a dashboard: this
 * page carries what we pay for gear and the scripts we send sellers.
 *
 * NOINDEX SURVIVES THE MOVE. A crawler reaching it now gets the sign-in page
 * anyway, but the header is cheap and defence in depth is the point.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdmin())) {
    redirect("/admin/sign-in?next=" + encodeURIComponent("/admin/outreach"))
  }

  return new Response(OUTREACH_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      /* Private, and never held by a shared cache: this is one person's
         session seeing a page nobody else may. */
      "cache-control": "private, no-store",
    },
  })
}
