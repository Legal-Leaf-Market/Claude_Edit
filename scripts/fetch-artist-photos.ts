import { writeFileSync } from "node:fs"
import { RIGS } from "../lib/rigs/data"
import { licenceIsAcceptable, type ArtistPhoto } from "../lib/rigs/photos"

/**
 * Fill lib/rigs/photos.ts from Wikimedia Commons.
 *
 *   npx tsx scripts/fetch-artist-photos.ts            # dry run, prints findings
 *   npx tsx scripts/fetch-artist-photos.ts --write    # rewrites the data file
 *
 * WHY A SCRIPT RATHER THAN A RUNTIME LOOKUP. Attribution has to be correct on
 * every single view, and a network call that can fail is a call that will
 * eventually render a photograph with no credit under it. Committing the data
 * means the credit ships with the image or neither does.
 *
 * WHY A SCRIPT RATHER THAN TYPING THE DATA. Every field written here is copied
 * verbatim out of Commons' own `extmetadata`. Nobody, human or model, invents
 * an author or a licence, which is the failure mode that turns a nice feature
 * into a licence violation.
 *
 * IT IS DELIBERATELY CONSERVATIVE. It takes the FIRST search result whose
 * licence is on the accept list, and skips the artist entirely when there is
 * none. A missing photograph shows the monogram the site already draws; a
 * wrong photograph shows the wrong person's face on a page about their gear.
 * Skipping is the cheap failure.
 *
 * REVIEW WHAT IT WRITES. Commons search is a text search over file titles and
 * descriptions, so it can return a photograph of the wrong person with the
 * right name, or a picture of a plaque rather than a player. The dry run
 * prints every file it would use, and that list is meant to be read.
 */

const API = "https://commons.wikimedia.org/w/api.php"
const USER_AGENT = "GearAvail/1.0 (https://gearavail.com; artist photo credits)"

type SearchResponse = { query?: { search?: { title: string }[] } }

type ImageInfoResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string
        imageinfo?: {
          url?: string
          descriptionurl?: string
          width?: number
          height?: number
          extmetadata?: Record<string, { value?: string }>
        }[]
      }
    >
  }
}

async function api<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API)
  for (const [k, v] of Object.entries({ format: "json", origin: "*", ...params })) {
    url.searchParams.set(k, v)
  }
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } })
  if (!response.ok) throw new Error(`Commons ${params.action} returned ${response.status}`)
  return (await response.json()) as T
}

/** Commons puts HTML in extmetadata. Credits are plain text. */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function findPhoto(artist: string, rigSlug: string): Promise<ArtistPhoto | null> {
  const search = await api<SearchResponse>({
    action: "query",
    list: "search",
    srsearch: `${artist} musician`,
    srnamespace: "6", // File: only
    srlimit: "8",
  })

  for (const hit of search.query?.search ?? []) {
    if (!/\.(jpe?g|png)$/i.test(hit.title)) continue

    const info = await api<ImageInfoResponse>({
      action: "query",
      titles: hit.title,
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: "480",
    })

    const page = Object.values(info.query?.pages ?? {})[0]
    const image = page?.imageinfo?.[0]
    const meta = image?.extmetadata ?? {}
    if (!image?.url) continue

    const licenceName = stripHtml(meta.LicenseShortName?.value ?? "")
    if (!licenceIsAcceptable(licenceName)) continue

    const author = stripHtml(meta.Artist?.value ?? "")
    const publicDomain = /^cc0|^public domain|^pd[ -]/i.test(licenceName)
    if (!publicDomain && !author) continue

    return {
      rigSlug,
      file: hit.title,
      url: image.url,
      width: image.width ?? 0,
      height: image.height ?? 0,
      author,
      licence: {
        name: licenceName,
        url: stripHtml(meta.LicenseUrl?.value ?? "") || "https://commons.wikimedia.org/wiki/Commons:Licensing",
        publicDomain,
      },
      sourceUrl: image.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(hit.title)}`,
      fetchedAt: new Date().toISOString().slice(0, 10),
    }
  }

  return null
}

function render(photos: ArtistPhoto[]): string {
  const body = photos
    .map(
      (p) => `  {
    rigSlug: ${JSON.stringify(p.rigSlug)},
    file: ${JSON.stringify(p.file)},
    url: ${JSON.stringify(p.url)},
    width: ${p.width},
    height: ${p.height},
    author: ${JSON.stringify(p.author)},
    licence: {
      name: ${JSON.stringify(p.licence.name)},
      url: ${JSON.stringify(p.licence.url)},
      publicDomain: ${p.licence.publicDomain},
    },
    sourceUrl: ${JSON.stringify(p.sourceUrl)},
    fetchedAt: ${JSON.stringify(p.fetchedAt)},
  },`,
    )
    .join("\n")

  return `export const PHOTOS: ArtistPhoto[] = [\n${body}\n]`
}

async function main() {
  const write = process.argv.includes("--write")
  const found: ArtistPhoto[] = []

  for (const rig of RIGS) {
    try {
      const photo = await findPhoto(rig.name, rig.slug)
      if (photo) {
        found.push(photo)
        console.log(`  ok    ${rig.slug.padEnd(22)} ${photo.file}  [${photo.licence.name}] ${photo.author}`)
      } else {
        console.log(`  skip  ${rig.slug.padEnd(22)} no freely licensed photo found`)
      }
    } catch (error) {
      console.log(`  fail  ${rig.slug.padEnd(22)} ${error instanceof Error ? error.message : error}`)
    }
    // Commons asks for courtesy over volume. This runs once, so waiting is free.
    await new Promise((r) => setTimeout(r, 400))
  }

  console.log(`\n${found.length} of ${RIGS.length} rigs have a usable photograph.`)
  console.log("READ THE LIST ABOVE before writing: a text search can return the right name and the wrong person.")

  if (!write) {
    console.log("\nDry run. Re-run with --write to update lib/rigs/photos.ts.")
    return
  }

  const path = "lib/rigs/photos.ts"
  const { readFileSync } = await import("node:fs")
  const current = readFileSync(path, "utf8")
  const updated = current.replace(/export const PHOTOS: ArtistPhoto\[\] = \[[\s\S]*?\n\]/, render(found))
  if (updated === current) throw new Error("Could not find the PHOTOS array to replace.")
  writeFileSync(path, updated)
  console.log(`\nWrote ${found.length} entries to ${path}. Review the diff before committing.`)
}

main().catch((error) => {
  console.error("[photos] failed:", error)
  process.exit(1)
})
