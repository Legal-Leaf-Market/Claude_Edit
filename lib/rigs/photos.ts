/**
 * Artist photographs, from Wikimedia Commons.
 *
 * WHY COMMONS AND NOTHING ELSE. Press photos are copyrighted and agency shots
 * (Getty, AP) are licensed per use, which is why section 13 chose monograms in
 * the first place. Commons is different in kind: everything hosted there is
 * freely licensed, and the licence is machine-readable through the API. It is
 * the one source where a commercial site can use a photograph of a named
 * musician without asking anybody.
 *
 * "Freely licensed" is not "free of obligations". CC-BY and CC-BY-SA both
 * require attribution, and getting the author or the licence wrong is a
 * licence violation rather than a typo. So two rules govern this file:
 *
 *   1. NO ATTRIBUTION, NO IMAGE. `isRenderable` below is the gate, and the
 *      component falls back to the monogram rather than rendering a photo it
 *      cannot credit. That is a structural guarantee, not a promise: an entry
 *      missing an author or a licence simply never displays.
 *
 *   2. THE DATA IS MACHINE-COPIED, NEVER TYPED. Every field in PHOTOS comes
 *      from `scripts/fetch-artist-photos.ts`, which reads Commons' own
 *      `extmetadata` and writes this file. Hand-editing an attribution here is
 *      how a wrong credit gets published, so do not: fix the script or fix the
 *      file on Commons, then re-run it.
 *
 * WHY NOT FETCH AT RENDER TIME. Attribution has to be right on every view, and
 * a lookup that can fail is a lookup that will eventually render a photo with
 * no credit under it. Committing the data means the attribution ships with the
 * image or neither does.
 */

export type PhotoLicence = {
  /** Short name exactly as Commons states it, e.g. "CC BY-SA 4.0". */
  name: string
  /** Canonical licence deed URL. */
  url: string
  /** True for public domain and CC0, where attribution is courtesy not duty. */
  publicDomain: boolean
}

export type ArtistPhoto = {
  /** Rig slug from lib/rigs/data.ts, so this joins on something stable. */
  rigSlug: string
  /** Commons file title, including the "File:" prefix. */
  file: string
  /** Direct image URL on upload.wikimedia.org. */
  url: string
  width: number
  height: number
  /** Author or photographer, as Commons states them, tags stripped. */
  author: string
  licence: PhotoLicence
  /** The Commons file page, which the credit links to. */
  sourceUrl: string
  /** When the script last read this, so staleness is visible. */
  fetchedAt: string
}

/**
 * The photographs, written by scripts/fetch-artist-photos.ts.
 *
 * EMPTY UNTIL THAT SCRIPT IS RUN, deliberately. Commons is not reachable from
 * the environment this was built in, and inventing plausible filenames and
 * credits would produce exactly the confident-looking wrong attribution this
 * whole file exists to prevent. An empty registry renders monograms, which is
 * the behaviour the site has today and is correct rather than broken.
 */
export const PHOTOS: ArtistPhoto[] = []

const BY_SLUG = new Map(PHOTOS.map((p) => [p.rigSlug, p]))

/**
 * Is this entry complete enough to display?
 *
 * The gate that makes rule 1 structural. A public domain image needs no author
 * and everything else does, so a CC-BY photo with an empty author is dropped
 * rather than shown uncredited.
 */
export function isRenderable(photo: ArtistPhoto): boolean {
  if (!photo.url || !photo.sourceUrl) return false
  if (!photo.licence?.name || !photo.licence?.url) return false
  if (!photo.licence.publicDomain && !photo.author.trim()) return false
  return true
}

export function photoForRig(rigSlug: string): ArtistPhoto | null {
  const photo = BY_SLUG.get(rigSlug)
  return photo && isRenderable(photo) ? photo : null
}

/**
 * The credit line, in the form the licence actually asks for: who made it,
 * under what, and where it came from.
 */
export function creditLine(photo: ArtistPhoto): string {
  if (photo.licence.publicDomain) {
    return photo.author.trim()
      ? `${photo.author}, ${photo.licence.name}, via Wikimedia Commons`
      : `${photo.licence.name}, via Wikimedia Commons`
  }
  return `${photo.author}, ${photo.licence.name}, via Wikimedia Commons`
}

/**
 * Licences we accept.
 *
 * Commons hosts only free files, so this is belt and braces rather than the
 * main defence: a file whose licence string does not look like one of these
 * has probably been read wrongly, and dropping it costs one photograph.
 *
 * Non-commercial and no-derivatives variants are NOT here and must not be
 * added. This site runs on affiliate revenue, so a CC BY-NC image is not
 * usable however freely it is offered.
 */
export const ACCEPTED_LICENCE_PATTERNS = [
  /^cc0/i,
  /^cc[ -]by(?![ -]*n[cd])/i,
  /^public domain/i,
  /^pd[ -]/i,
]

export function licenceIsAcceptable(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  // Explicitly reject the two that look free and are not, before the
  // permissive patterns get a chance to match something like "CC BY-NC-SA".
  if (/n[cd]\b|noncommercial|no[ -]?deriv/i.test(trimmed)) return false
  return ACCEPTED_LICENCE_PATTERNS.some((p) => p.test(trimmed))
}
