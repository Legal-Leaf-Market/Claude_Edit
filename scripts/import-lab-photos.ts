/**
 * TAKE THE BENCH'S SHOTS AND WRITE THE REGISTRY.
 *
 *   npx tsx scripts/import-lab-photos.ts            # dry run, reports only
 *   npx tsx scripts/import-lab-photos.ts --write    # rewrites lib/lab/photos.ts
 *
 * Reads `public/lab/manifest.json` plus the image files beside it, resizes and
 * re-encodes each shot, and writes `LAB_PHOTOS`.
 *
 * WHY A SCRIPT RATHER THAN TYPING THE ARRAY. Section 13 of CLAUDE.md already
 * settled this for artist photographs and album art: a hand-typed attribution
 * is how a wrong credit gets published, and a hand-typed identifier is 36
 * characters nobody can check by eye. The same applies here in a way that is
 * cheaper to get wrong and more expensive to notice: file a shot of a DS-1
 * under a DS-2 and the site confidently shows the wrong pedal, on a page
 * somebody is about to spend money from, with nothing failing anywhere.
 *
 * The manifest is what the person at the lightbox fills in, and it holds only
 * what a human genuinely knows: which pedal it is, which unit, which angle.
 * Everything a machine can determine (dimensions, output path, encoding) is
 * determined rather than transcribed.
 *
 * THE BRAND AND MODEL GO THROUGH THE RESOLVER'S VOCABULARY, not through
 * whatever was typed at the bench. `labPhotoForGear` is looked up with the
 * resolved `canonical_gear` brand and model, so a manifest saying "boss" and
 * "ds1" would file a photo nothing can ever find. The check below is the same
 * one `tests/board/pedal-models.test.ts` makes of the model table: an entry
 * nothing can reach reads as coverage and renders for nobody.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"
import type { LabPhoto } from "../lib/lab/photos"

const LAB_DIR = path.join(process.cwd(), "public", "lab")
const MANIFEST = path.join(LAB_DIR, "manifest.json")
const REGISTRY = path.join(process.cwd(), "lib", "lab", "photos.ts")

/** Delivered at 900: a gear page shows these full width on a phone, and the
    cards downsample. Bigger buys nothing a shopper can see. */
const OUT_PX = 900
const WEBP_QUALITY = 78

type ManifestEntry = {
  /** Source file, relative to public/lab. */
  file: string
  brand: string
  model: string
  view: LabPhoto["view"]
  intakeId: string
  shotOn: string
  alt: string
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function main() {
  const write = process.argv.includes("--write")

  if (!existsSync(MANIFEST)) {
    console.log(
      `No manifest at ${path.relative(process.cwd(), MANIFEST)}.\n\n` +
        `That is the expected state until the bench has shot something. Create it as a\n` +
        `JSON array, one object per shot:\n\n` +
        `  [{ "file": "raw/ds1-a4021-34.jpg", "brand": "Boss", "model": "DS-1",\n` +
        `     "view": "three-quarter", "intakeId": "A4021", "shotOn": "2026-09-12",\n` +
        `     "alt": "A Boss DS-1 distortion pedal, orange enclosure, on a white sweep" }]\n\n` +
        `Use the brand and model as the CATALOGUE spells them, not as the box does:\n` +
        `these are looked up with the resolved canonical brand and model, so "boss"\n` +
        `and "ds1" would file a photo nothing can ever find.`,
    )
    return
  }

  let manifest: ManifestEntry[]
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"))
  } catch (error) {
    fail(`The manifest is not valid JSON: ${String(error)}`)
  }
  if (!Array.isArray(manifest)) fail("The manifest must be a JSON array.")

  const rows: LabPhoto[] = []
  const seen = new Set<string>()

  for (const entry of manifest) {
    for (const field of ["file", "brand", "model", "view", "intakeId", "shotOn", "alt"] as const) {
      if (!entry?.[field] || !String(entry[field]).trim()) {
        fail(`Every shot needs a ${field}. Offending entry: ${JSON.stringify(entry)}`)
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.shotOn)) {
      fail(`shotOn must be an ISO date (YYYY-MM-DD), got "${entry.shotOn}".`)
    }

    const source = path.join(LAB_DIR, entry.file)
    if (!existsSync(source)) fail(`No such file: ${path.relative(process.cwd(), source)}`)

    /* One shot per pedal per view per unit. Two files claiming the same slot
       is a mistake at the bench, not a preference to resolve silently. */
    const slot = `${entry.brand}|${entry.model}|${entry.view}|${entry.intakeId}`.toLowerCase()
    if (seen.has(slot)) fail(`Two shots claim the same pedal, view and unit: ${slot}`)
    seen.add(slot)

    const slug = `${entry.brand}-${entry.model}-${entry.intakeId}-${entry.view}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
    const outFile = `${slug}.webp`
    const encoded = await sharp(source)
      .resize(OUT_PX, OUT_PX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()
    const meta = await sharp(encoded).metadata()

    if (write) {
      mkdirSync(LAB_DIR, { recursive: true })
      writeFileSync(path.join(LAB_DIR, outFile), encoded)
    }

    rows.push({
      brand: entry.brand.trim(),
      model: entry.model.trim(),
      src: `/lab/${outFile}`,
      view: entry.view,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      intakeId: entry.intakeId.trim(),
      shotOn: entry.shotOn,
      alt: entry.alt.trim(),
    })
    console.log(`  ${write ? "+" : "="} ${outFile}  ${meta.width}x${meta.height}`)
  }

  const body =
    `export const LAB_PHOTOS: LabPhoto[] = [\n` +
    rows
      .map(
        (r) =>
          `  {\n` +
          `    brand: ${JSON.stringify(r.brand)},\n` +
          `    model: ${JSON.stringify(r.model)},\n` +
          `    src: ${JSON.stringify(r.src)},\n` +
          `    view: ${JSON.stringify(r.view)},\n` +
          `    width: ${r.width},\n` +
          `    height: ${r.height},\n` +
          `    intakeId: ${JSON.stringify(r.intakeId)},\n` +
          `    shotOn: ${JSON.stringify(r.shotOn)},\n` +
          `    alt: ${JSON.stringify(r.alt)},\n` +
          `  },\n`,
      )
      .join("") +
    `]`

  if (!write) {
    console.log(`\n${rows.length} shot(s) read. Re-run with --write to encode and commit them.`)
    return
  }

  const current = readFileSync(REGISTRY, "utf8")
  const start = current.indexOf("export const LAB_PHOTOS: LabPhoto[] = [")
  if (start < 0) fail("Could not find LAB_PHOTOS in the registry. Has it been renamed?")
  const end = current.indexOf("\n]", start) + 2
  writeFileSync(REGISTRY, current.slice(0, start) + body + current.slice(end))
  console.log(`\n${rows.length} photo(s) written into ${path.relative(process.cwd(), REGISTRY)}.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
