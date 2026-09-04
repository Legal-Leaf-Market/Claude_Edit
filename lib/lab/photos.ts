/**
 * OUR OWN PHOTOGRAPHS, OF PEDALS THAT WENT THROUGH OUR HANDS.
 *
 * The briefing's strongest asset, and the answer to a problem this site has
 * had since it launched. Every listing without a seller photo falls back to a
 * measured RENDER, which is honest but is still a drawing, and on
 * /used/effects-pedals that was most of the page. A photograph of the actual
 * object, shot on our own bench, beats a drawing on every axis that matters
 * and carries no licence question at all: we owned the pedal and we took the
 * picture.
 *
 * WHERE IT SITS IN THE ORDER, AND WHY IT IS NOT FIRST.
 *
 *   1. the seller's own photo    it is the unit being bought
 *   2. OUR photograph            a real pedal, but a DIFFERENT unit
 *   3. the measured render       a drawing, and it says so
 *   4. the category silhouette   a true thing about the kind of gear
 *
 * The seller's photo wins because it shows the actual item for sale, scratches
 * and all. Ours is a real object rather than a model, so it beats the render;
 * but it is not the unit in the listing, and a shopper who assumes otherwise
 * has been misled about what arrives in the post. So it is LABELLED, exactly
 * as `ModelledRender` labels itself. Same rule and same reason: a picture that
 * quietly stands in for the thing being sold is a claim about condition,
 * colour and completeness that nobody actually made.
 *
 * NO PROVENANCE, NO PHOTO. `isPublishable` is the gate, and it is structural
 * rather than a promise: an entry that cannot say which unit it is and when it
 * was shot simply never renders. That is the same guarantee
 * `lib/rigs/photos.ts` makes about attribution, for the same reason. A photo
 * we cannot account for is one we cannot defend if somebody asks whether it is
 * really ours.
 *
 * MACHINE-WRITTEN, NEVER TYPED. Every row here comes from
 * `scripts/import-lab-photos.ts`, which reads the bench manifest and the files
 * on disk. Hand-editing an intake id is how a photo of one pedal ends up filed
 * under another, and nothing would ever fail.
 */

export type LabPhoto = {
  /** Brand and model as the resolver knows them, so this joins on the same
      strings `renderForGear` matches. Never a listing title. */
  brand: string
  model: string
  /** Path under /public, e.g. "/lab/boss-ds-1-a4021.webp". */
  src: string
  /** Which angle. A gut shot is not a substitute for a top-down on a card. */
  view: "top" | "three-quarter" | "side" | "back" | "guts"
  width: number
  height: number
  /**
   * OUR intake reference for the physical unit, not the manufacturer's serial.
   *
   * Deliberately not the serial: that is a real identifier of a real object
   * which will have an owner after us, and publishing one next to
   * "photographed at our HQ" says more than a picture needs to. The intake id
   * is ours, means nothing to anybody else, and is enough to find the unit in
   * our own records.
   */
  intakeId: string
  /** ISO date the shot was taken. */
  shotOn: string
  /** What is in frame, for the alt attribute. */
  alt: string
}

/**
 * The photographs, written by scripts/import-lab-photos.ts.
 *
 * EMPTY UNTIL THAT SCRIPT IS RUN, deliberately, and an empty registry is a
 * fully supported state: every card falls through to the render exactly as it
 * does today. Inventing plausible filenames here would put broken images on a
 * live site, which is worse than the drawing it was meant to replace.
 */
export const LAB_PHOTOS: LabPhoto[] = []

/** A photo may only render if it can account for itself. */
export function isPublishable(photo: LabPhoto): boolean {
  if (!photo.src.startsWith("/lab/")) return false
  if (!photo.brand.trim() || !photo.model.trim()) return false
  if (!photo.intakeId.trim() || !photo.shotOn.trim()) return false
  if (!Number.isFinite(photo.width) || !Number.isFinite(photo.height)) return false
  if (photo.width <= 0 || photo.height <= 0) return false
  return true
}

function key(brand: string, model: string): string {
  return `${brand.trim().toLowerCase()} ${model.trim().toLowerCase()}`
}

/**
 * PREFERRED VIEWS, IN ORDER, and a gut shot is never one of them.
 *
 * A card is a small square and the reader is deciding whether this is the
 * pedal they mean. A three-quarter says that fastest; a top-down says it next.
 * The inside of an enclosure is genuinely useful on a gear page and actively
 * misleading as a thumbnail, so it is excluded here rather than ranked last:
 * "last" becomes "only" the moment it is the sole photo of that pedal.
 */
const CARD_VIEWS: LabPhoto["view"][] = ["three-quarter", "top", "side", "back"]

const BY_GEAR = new Map<string, LabPhoto[]>()
for (const photo of LAB_PHOTOS) {
  if (!isPublishable(photo)) continue
  const k = key(photo.brand, photo.model)
  const list = BY_GEAR.get(k)
  if (list) list.push(photo)
  else BY_GEAR.set(k, [photo])
}

/**
 * Our best card photograph of this instrument, if we have shot one.
 *
 * Takes the RESOLVED brand and model rather than a listing title, for the same
 * reason `renderForGear` does: a title reading "DS-1 bundle w/ cables" is not
 * a picture of a DS-1, and going through the resolver means this inherits its
 * judgement instead of inventing a second, looser one.
 */
export function labPhotoForGear(
  brand: string | null | undefined,
  model: string | null | undefined,
): LabPhoto | null {
  if (!brand || !model) return null
  const found = BY_GEAR.get(key(brand, model))
  if (!found?.length) return null
  for (const view of CARD_VIEWS) {
    const match = found.find((photo) => photo.view === view)
    if (match) return match
  }
  return null
}

/** Every publishable photo of an instrument, for a gear page's gallery. */
export function labPhotosForGear(
  brand: string | null | undefined,
  model: string | null | undefined,
): LabPhoto[] {
  if (!brand || !model) return []
  return BY_GEAR.get(key(brand, model)) ?? []
}
