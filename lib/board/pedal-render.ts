import { modelFor, PEDAL_MODELS, type PedalModel } from "@/lib/board/pedal-models"
import { labPhotoForGear, type LabPhoto } from "@/lib/lab/photos"

/**
 * THE MEASURED MODELS, PHOTOGRAPHED ONCE AND SERVED AS PICTURES.
 *
 * `components/board/pedal-viewer-3d.tsx` draws a real pedal and it looks like
 * one, and until now the only way to see it was to load an artist rig, hover a
 * pedal and hit a 32px icon. Meanwhile every card on `/used/effects-pedals`
 * whose listing carries no photo rendered as a grey rectangle with a
 * broken-image glyph, which is most of them: marketplace CDN URLs expire, and a
 * used-gear feed is full of rows that never had an image in the first place.
 *
 * So the same scene is run offline, once, and the result is committed
 * (`scripts/render-pedal-models.ts`). What the card shows is not a second
 * drawing of the pedal, it is a photograph OF THE MODEL IN THE DIALOG, which is
 * section 7's "never fork the logic" applied to a picture: a separate
 * node-side scene would drift, and then the thing on the card would stop being
 * the thing you pick up.
 *
 * WHY THIS DOES NOT BREACH SECTION 16's "no canvas outside the dialog". Nothing
 * here renders a canvas. The output is a WebP in `<img>`, so the page stays
 * indexable, tabbable, screen-reader reachable and able to carry `/go`, which
 * is the whole of what that rule protects. The harness route that produces them
 * 404s outside development and is never linked.
 *
 * AND IT IS A DRAWING, WHICH IS SAID RATHER THAN IMPLIED. A render standing in
 * for a photograph is a claim about what arrived in the post, so every surface
 * that uses one marks it. The measured model says what its shape tells you; it
 * does not say the seller's unit is this colour, this clean, or complete. That
 * is the same instinct as `p3d-truth` in the inspector and as refusing to
 * publish a market price under `MIN_SAMPLE_SIZE`.
 */

/** Where the committed stills live, relative to `public/`. */
export const RENDER_DIR = "pedals"

/**
 * The extension the renderer writes and the pages ask for.
 *
 * WebP rather than PNG because these carry alpha and land on cards in two
 * themes, and a lossless PNG of a 1024px pedal is roughly five times the size
 * for a picture nobody is going to pixel-peep. Eighty-eight of them live in
 * this repository, so the difference is the difference between a few hundred
 * kilobytes and eight megabytes of committed binary.
 */
export const RENDER_EXT = "webp"

/**
 * A stable filename for one model.
 *
 * Maker AND name, because the name alone collides the moment two brands ship a
 * "Compressor" (Keeley and Ross both do). Derived rather than hand-assigned so
 * a new model cannot arrive without one, and pinned unique by a test: two
 * models sharing a slug would silently serve one pedal's picture for the other,
 * which is the same failure mode as a loose match pattern.
 */
export function renderSlug(model: Pick<PedalModel, "maker" | "name">): string {
  const part = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  return `${part(model.maker)}--${part(model.name)}`
}

/** The public path of one model's still. */
export function renderPath(model: Pick<PedalModel, "maker" | "name">): string {
  return `/${RENDER_DIR}/${renderSlug(model)}.${RENDER_EXT}`
}

/**
 * The still for a brand and model, or null when nobody has measured that pedal.
 *
 * NULL IS THE COMMON ANSWER AND THE CORRECT ONE. There are 88 measured models
 * and a catalogue with rather more than 88 products in it, so most listings get
 * nothing here and keep the plain placeholder. The alternative, loosening the
 * match until something always answers, is exactly what section 18 forbids:
 * a loose pattern does not miss, it prints one pedal's picture on another
 * pedal's card, on a page somebody is about to spend money from.
 *
 * It goes through `modelFor`, so it inherits that narrowing rather than
 * restating it, and a DD-2 keeps getting the DD-2.
 */
export function renderForGear(
  brand: string | null | undefined,
  model: string | null | undefined,
): { src: string; name: string; maker: string } | null {
  if (!brand || !model) return null

  const found = modelFor({ maker: brand, name: model } as Parameters<typeof modelFor>[0])
  if (!found) return null

  return { src: renderPath(found), name: found.name, maker: found.maker }
}

/**
 * Every model that has a still, for the test that walks `public/pedals`.
 *
 * Exported as the list rather than as a set of paths because the failure worth
 * naming is "this MODEL has no picture", and the model's name is what somebody
 * reads in the assertion.
 */
export function renderedModels(): PedalModel[] {
  return PEDAL_MODELS
}

/**
 * BOTH FALLBACKS AT ONCE, IN THEIR ORDER.
 *
 * `labPhotoForGear` and `renderForGear` take the same resolved brand and model
 * and answer the same question ("what do we show when the seller gave us
 * nothing?"), so asking for them separately at nine call sites is nine places
 * for the ORDER to be got wrong, and getting it wrong means a drawing shown in
 * front of a photograph of the real object.
 */
export function fallbackImageryFor(
  brand: string | null | undefined,
  model: string | null | undefined,
): { labPhoto: LabPhoto | null; modelled: { src: string; name: string; maker: string } | null } {
  return { labPhoto: labPhotoForGear(brand, model), modelled: renderForGear(brand, model) }
}
