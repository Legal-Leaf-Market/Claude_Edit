import { readFileSync, writeFileSync } from "node:fs"
import { RIGS } from "../lib/rigs/data"
import { isValidMbid, type AlbumCover } from "../lib/rigs/covers"

/**
 * Resolve MusicBrainz release-group ids for the records in lib/rigs/data.ts.
 *
 *   npx tsx scripts/fetch-album-covers.ts            # dry run
 *   npx tsx scripts/fetch-album-covers.ts --write    # rewrites lib/rigs/covers.ts
 *
 * WHY A ONE-OFF SCRIPT IS THE POINT, not a convenience. MusicBrainz's web
 * service is free for NON-COMMERCIAL use, and this site is commercial, so it
 * must never sit on the runtime path. The identifiers it returns are a
 * different matter: MusicBrainz core data is CC0. Resolving them once,
 * offline, and committing the result keeps the service out of production
 * entirely while leaving the site using nothing but CC0 facts and Internet
 * Archive images.
 *
 * If this ever needs to run at any real scale, the honest answer is the
 * database dumps (also CC0) or a commercial plan, not a faster loop.
 *
 * IT RATE LIMITS ITSELF TO ONE REQUEST A SECOND and sends a real user agent,
 * which is what MusicBrainz asks of anybody. Do not lower it.
 */

const API = "https://musicbrainz.org/ws/2"
const USER_AGENT = "GearAvail/1.0 (https://gearavail.com; one-off release-group resolution)"

type SearchResponse = {
  "release-groups"?: {
    id?: string
    title?: string
    score?: number
    "primary-type"?: string
    "artist-credit"?: { name?: string }[]
  }[]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

async function findReleaseGroup(artist: string, record: string): Promise<string | null> {
  const url = new URL(`${API}/release-group`)
  url.searchParams.set("query", `releasegroup:"${record}" AND artist:"${artist}"`)
  url.searchParams.set("fmt", "json")
  url.searchParams.set("limit", "5")

  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" } })
  if (!response.ok) throw new Error(`MusicBrainz returned ${response.status}`)
  const data = (await response.json()) as SearchResponse

  for (const group of data["release-groups"] ?? []) {
    if (!group.id || !isValidMbid(group.id)) continue
    // Title and artist must BOTH match, and an album must actually be an
    // album: a live bootleg or a compilation with the same name is a
    // different record with different artwork.
    if (normalise(group.title ?? "") !== normalise(record)) continue
    const credited = (group["artist-credit"] ?? []).map((c) => normalise(c.name ?? ""))
    if (!credited.some((c) => c === normalise(artist))) continue
    if (group["primary-type"] && group["primary-type"] !== "Album") continue
    return group.id
  }
  return null
}

function render(covers: AlbumCover[]): string {
  const body = covers
    .map(
      (c) => `  {
    rigSlug: ${JSON.stringify(c.rigSlug)},
    record: ${JSON.stringify(c.record)},
    releaseGroupMbid: ${JSON.stringify(c.releaseGroupMbid)},
    fetchedAt: ${JSON.stringify(c.fetchedAt)},
  },`,
    )
    .join("\n")
  return `export const COVERS: AlbumCover[] = [\n${body}\n]`
}

async function main() {
  const write = process.argv.includes("--write")
  const today = new Date().toISOString().slice(0, 10)
  const found: AlbumCover[] = []
  let looked = 0

  for (const rig of RIGS) {
    const records = new Set((rig.records ?? []).map((r) => (typeof r === "string" ? r : r.title)))
    for (const record of records) {
      if (!record) continue
      looked++
      try {
        const mbid = await findReleaseGroup(rig.name, record)
        if (mbid) {
          found.push({ rigSlug: rig.slug, record, releaseGroupMbid: mbid, fetchedAt: today })
          console.log(`  ok    ${rig.slug.padEnd(20)} ${record}`)
        } else {
          console.log(`  skip  ${rig.slug.padEnd(20)} ${record}  (no confident match)`)
        }
      } catch (error) {
        console.log(`  fail  ${rig.slug.padEnd(20)} ${record}  ${error instanceof Error ? error.message : error}`)
      }
      // MusicBrainz asks for one request per second. Do not lower this.
      await sleep(1100)
    }
  }

  console.log(`\n${found.length} of ${looked} records resolved.`)
  if (!write) {
    console.log("Dry run. Re-run with --write to update lib/rigs/covers.ts.")
    return
  }

  const path = "lib/rigs/covers.ts"
  const current = readFileSync(path, "utf8")
  const updated = current.replace(/export const COVERS: AlbumCover\[\] = \[[\s\S]*?\n\]/, render(found))
  if (updated === current) throw new Error("Could not find the COVERS array to replace.")
  writeFileSync(path, updated)
  console.log(`Wrote ${found.length} entries to ${path}. Review the diff before committing.`)
}

main().catch((error) => {
  console.error("[covers] failed:", error)
  process.exit(1)
})
