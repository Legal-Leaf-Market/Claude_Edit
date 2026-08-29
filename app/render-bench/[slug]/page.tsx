import { notFound } from "next/navigation"
import { RenderBench } from "@/components/board/render-bench"
import { PEDAL_MODELS } from "@/lib/board/pedal-models"
import { renderSlug } from "@/lib/board/pedal-render"

/**
 * THE BENCH THE OFFLINE RENDERER PHOTOGRAPHS. Not a page anybody visits.
 *
 * `scripts/render-pedal-models.ts` drives a headless browser over this route
 * once per measured model and screenshots the canvas, and the results are
 * committed to `public/pedals`. It exists so the stills come out of the REAL
 * viewer rather than out of a second scene written node-side, which is section
 * 7's "never fork the logic": two renderers means the pedal on the card
 * gradually stops being the pedal in the dialog, and nothing fails when it
 * does.
 *
 * IT FAILS CLOSED, ON AN ENV VAR NOBODY SETS. A reachable route that mounts a
 * canvas on a bare page is exactly the thing section 16 forbids, and "nobody
 * links to it" is not a control: a crawler finds URLs by other means, and a
 * route that answers is a route somebody can hit. So it 404s unless
 * `RENDER_BENCH=1` is in the environment, which is the same shape as
 * `CRON_SECRET` and `ADMIN_PASSCODE`: unset is the expected state and unset
 * means no.
 *
 * WHY NOT `NODE_ENV !== "production"`. Because the renderer needs a real build
 * to photograph. Next's dev server never hydrated this page in a headless
 * browser here (the client never ran, so the canvas never mounted and the
 * script waited on a flag that could not arrive), and chasing that down would
 * be chasing the dev server rather than the pictures. A production build with
 * one variable set is both the thing that works and the thing that matches how
 * the rest of this repo gates a privileged route.
 *
 * `dynamic = "force-dynamic"` so the gate is read per request rather than
 * baked in at build time, when the variable is genuinely absent.
 */
export const dynamic = "force-dynamic"

export default async function RenderBenchPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  if (process.env.RENDER_BENCH !== "1") notFound()

  const { slug } = await params
  if (!PEDAL_MODELS.some((entry) => renderSlug(entry) === slug)) notFound()

  return <RenderBench slug={slug} />
}
