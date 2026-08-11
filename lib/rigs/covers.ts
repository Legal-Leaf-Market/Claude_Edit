/**
 * Album covers, from the Cover Art Archive.
 *
 * WHY THIS IS NOT BLOCKED THE WAY I SAID IT WAS. Section 13 records that
 * MusicBrainz is off limits because its web service is free for
 * non-commercial use only. That is true of the SERVICE and not of the DATA:
 * MusicBrainz core data, including release-group identifiers, is CC0. So the
 * live web service stays off the runtime path, and the identifiers below are
 * resolved ONCE by a script and committed, exactly like the artist photos.
 *
 * Covers themselves then come from coverartarchive.org, which is served by the
 * Internet Archive and carries no such restriction.
 *
 * WHAT THIS DOES NOT CLAIM. The Cover Art Archive does not grant rights in the
 * artwork, and album covers remain the copyright of their rights holders. A
 * thumbnail beside editorial text about which pedals made the record is the
 * ordinary practice of every music publication and a solid fair dealing
 * argument, but it is a judgement for a lawyer rather than a fact this file
 * can assert. That is why covers are SMALL, always captioned with the record
 * they depict, and never used decoratively away from writing about that
 * record.
 *
 * THE SIZE IS DELIBERATE. `front-250` is the 250px thumbnail. It is what the
 * page needs, and a thumbnail is materially easier to defend than a full
 * resolution scan that could substitute for the artwork itself.
 */

export type AlbumCover = {
  /** Rig slug from lib/rigs/data.ts. */
  rigSlug: string
  /** The record's title, as it appears in the rig data, so the join is checkable. */
  record: string
  /** MusicBrainz release-group MBID. CC0 data. */
  releaseGroupMbid: string
  fetchedAt: string
}

/**
 * Written by scripts/fetch-album-covers.ts.
 *
 * EMPTY UNTIL THAT SCRIPT IS RUN. MusicBrainz was unreachable from the
 * environment this was built in, and a hand-typed MBID is a 36 character
 * string nobody can check by eye: a wrong one silently shows a different
 * album's artwork, which is worse than showing none.
 */
export const COVERS: AlbumCover[] = []

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidMbid(value: string): boolean {
  return UUID.test(value.trim())
}

const BY_KEY = new Map(COVERS.map((c) => [`${c.rigSlug}::${c.record.toLowerCase()}`, c]))

export function coverFor(rigSlug: string, record: string): AlbumCover | null {
  const found = BY_KEY.get(`${rigSlug}::${record.toLowerCase()}`)
  return found && isValidMbid(found.releaseGroupMbid) ? found : null
}

/**
 * The thumbnail URL.
 *
 * Built rather than stored because the Archive redirects to whatever file is
 * currently the front cover, so a stored direct URL would rot while this one
 * keeps working.
 */
export function coverUrl(cover: AlbumCover, size: 250 | 500 = 250): string {
  return `https://coverartarchive.org/release-group/${cover.releaseGroupMbid}/front-${size}`
}

/** Where a reader can check the record this claims to be. */
export function releaseGroupUrl(cover: AlbumCover): string {
  return `https://musicbrainz.org/release-group/${cover.releaseGroupMbid}`
}
