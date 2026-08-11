import { NextResponse, type NextRequest } from "next/server"
import { matchPedalsByName } from "@/lib/pedalboard/queries"
import { rigChainOrder, rigFromSlug } from "@/lib/rigs"

export const dynamic = "force-dynamic"

/**
 * GET /api/pedalboard/rig?slug=david-gilmour
 *
 * Turns a documented rig into board slots, matching each pedal against the
 * live catalogue as it goes. Every pedal comes back whether or not it matched,
 * because an unmatched one is still part of the rig and still occupies a slot
 * (see the note on matchPedalsByName in lib/pedalboard/queries.ts).
 *
 * The match runs on every request rather than being baked into the dataset, so
 * a rig link shared today starts showing real listings the moment a feed that
 * carries those pedals comes online, with no edit to the rig data.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? ""
  const rig = rigFromSlug(slug)
  if (!rig) {
    return NextResponse.json({ error: "No such rig." }, { status: 404 })
  }

  const pedals = rigChainOrder(rig)
  const matches = await matchPedalsByName(
    pedals.map((p) => ({ brand: p.brand, model: p.model })),
  ).catch(() => [])

  const slots = pedals.map((pedal, index) => {
    const matched = matches[index]?.matched ?? null
    return {
      // An off-catalogue slot still needs a stable key for React and for the
      // chain notes. Brand and model make one that survives a reorder.
      key: matched?.slug ?? `off:${pedal.brand}:${pedal.model}`,
      brand: pedal.brand,
      model: pedal.model,
      // The curated type wins over the guess from the name: the dataset was
      // written by hand and knows a talk box is not an overdrive.
      type: pedal.type,
      slug: matched?.slug ?? null,
      imageUrl: matched?.imageUrl ?? null,
      marketPriceCents: matched?.marketPriceCents ?? null,
      sampleSize: matched?.sampleSize ?? 0,
      bySource: [],
      loading: Boolean(matched),
      role: pedal.role,
    }
  })

  return NextResponse.json({
    rig: { slug: rig.slug, name: rig.name, context: rig.context },
    slots,
  })
}
