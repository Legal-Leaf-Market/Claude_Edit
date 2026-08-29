/**
 * PHOTOGRAPH EVERY MEASURED PEDAL, ONCE, AND COMMIT THE RESULT.
 *
 *   npm run build
 *   RENDER_BENCH=1 npx next start -p 3000    # in one terminal
 *   npm run render:pedals                    # in another
 *
 * Drives a headless browser over `/render-bench/<slug>` for each entry in
 * `PEDAL_MODELS` and writes `public/pedals/<slug>.webp`. Run it when a model is
 * added or its geometry changes; the output is checked in, so nobody who is not
 * editing the models ever needs to run it, and no deploy depends on it.
 *
 * WHY A BROWSER RATHER THAN A NODE-SIDE SCENE. The point of these stills is
 * that they are the SAME pedal the inspector shows, drawn by the same
 * component with the same materials and the same lighting. A second scene
 * assembled in node would be a fork of the renderer (section 7), and the way
 * that fork announces itself is not an error: it is a card whose picture
 * quietly stops matching the object you pick up on the board.
 *
 * WHY A BUILD RATHER THAN THE DEV SERVER. `/render-bench` fails closed on
 * `RENDER_BENCH=1`, because a reachable route that mounts a bare canvas is the
 * thing section 16 exists to prevent and "unlinked" is not a control. A real
 * build is also the only thing that reliably hydrates in a headless browser
 * here; under `next dev` the client never ran, the canvas never mounted, and
 * the script sat waiting on a readiness flag that could not arrive.
 *
 * DETERMINISM IS THE WHOLE JOB. These are committed binaries: if two runs of an
 * unchanged model produce two different files, every run dirties the tree and
 * the diff stops meaning anything, which is how nobody notices the run that
 * DID change a pedal. So the viewer's idle drift and its orbit controls are
 * both off (`still`), and the script waits for the picture to stop changing
 * rather than sleeping a fixed time and hoping.
 *
 * SwiftShader is a software rasteriser and it is not bit-identical to a GPU, so
 * a run on different hardware can differ in the last bit of a gradient. That is
 * why the writer compares DECODED PIXELS and leaves the file alone when nothing
 * meaningful moved, rather than comparing the encoded bytes.
 */

import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import { chromium, type Browser, type Page } from "playwright-core"
import sharp from "sharp"
import { PEDAL_MODELS } from "../lib/board/pedal-models"
import { RENDER_DIR, RENDER_EXT, renderSlug } from "../lib/board/pedal-render"

/** Where the bench is being served. Overridable because 3000 is a busy port. */
const BASE = (process.env.BENCH_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "")

/**
 * Shot at 1024 and written at 640.
 *
 * Rendering above the delivered size and downsampling is what gets clean edges
 * off a rasteriser with no multisampling worth the name: the chrome ring on a
 * footswitch is a two-pixel arc at delivery size and it looks like a staircase
 * if it was drawn there. 640 is comfortably more than the ~460 CSS pixels the
 * widest card gives it, with a 2x screen in mind.
 */
const SHOT_PX = 1024
const OUT_PX = 512

/** Quality: alpha kept, and lossy is fine for a soft-lit object with no text
    smaller than a silkscreen legend already rendered at 1024. Eighty-eight of
    these live in the repository, so the encoder is asked to work for it. */
const WEBP_QUALITY = 66

const OUT_DIR = path.join(process.cwd(), "public", RENDER_DIR)

/**
 * Wait for the scene to stop moving.
 *
 * Two identical screenshots in a row, which covers the three things that are
 * genuinely slow and genuinely variable: the dynamic import resolving, shader
 * compilation on first draw, and the PMREM pass that turns the drawn studio
 * into an environment map. A fixed sleep long enough for the worst of those on
 * a cold cache is long enough to make the whole run take twenty minutes.
 */
async function waitForStill(page: Page, label: string): Promise<Buffer> {
  await page.waitForFunction(() => window.__benchReady === true, undefined, { timeout: 60_000 })
  /* THE VIEWPORT, NOT THE CANVAS ELEMENT. An element screenshot is of the
     element's box as composited, so it happily includes anything drawn over it,
     and it scrolls a box taller than the window into view rather than failing.
     The bench covers the viewport exactly, so the viewport IS the frame. */

  let previous = ""
  let shot: Buffer | null = null

  for (let attempt = 0; attempt < 40; attempt++) {
    shot = await page.screenshot({ omitBackground: true })
    const digest = createHash("sha1").update(shot).digest("hex")
    if (digest === previous) return shot
    previous = digest
    await page.waitForTimeout(250)
  }

  if (!shot) throw new Error(`${label}: never produced a frame`)
  console.warn(`  ! ${label}: still moving after 10s, taking the last frame`)
  return shot
}

/**
 * Has the picture actually changed? Decoded pixels, with a hair of tolerance.
 *
 * Byte equality on the encoded file is useless: a lossy encoder run twice over
 * pixels that differ in one channel of one texel writes a different file. So
 * this decodes both and compares.
 *
 * THE THRESHOLD IS MEASURED, AND THE FIRST ONE WAS WRONG BY A FACTOR OF THREE.
 * It was set to 1.5 on the assumption that a software rasteriser drifts between
 * runs and that anything smaller than a visible edit would fall under it. Both
 * halves were wrong, and the way it announced itself was a real change reported
 * as "unchanged": shrinking this tuner's display by a quarter and moving it 4mm
 * back was swallowed whole, and the file on disk stayed the old one.
 *
 * The actual numbers, measured on this renderer:
 *
 *   two runs of an UNCHANGED model      avg channel difference 0.0000, max 0
 *   display 25% smaller, moved 4mm      avg 0.52 at 64px, 0.69 at 128px
 *
 * SwiftShader is deterministic here, so the noise floor is zero and the
 * smallest edit worth noticing is half a unit. 0.05 sits an order of magnitude
 * clear of both: it will not rewrite 89 files because a different machine's
 * rasteriser rounds differently, and it cannot miss a moved control.
 *
 * 128px rather than 64: the same cost to a rounding error, twice the signal
 * from a small part like an LED or a legend.
 */
const SAME_PICTURE_TOLERANCE = 0.05

async function looksTheSame(a: Buffer, b: Buffer): Promise<boolean> {
  const raw = (buffer: Buffer) =>
    sharp(buffer).resize(128, 128, { fit: "fill" }).ensureAlpha().raw().toBuffer()


  const [left, right] = await Promise.all([raw(a), raw(b)])
  if (left.length !== right.length) return false

  let total = 0
  for (let i = 0; i < left.length; i++) total += Math.abs(left[i] - right[i])
  return total / left.length < SAME_PICTURE_TOLERANCE
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const only = process.argv.slice(2).filter((arg) => !arg.startsWith("-"))
  const models = only.length
    ? PEDAL_MODELS.filter((model) => only.some((arg) => renderSlug(model).includes(arg)))
    : PEDAL_MODELS

  if (!models.length) {
    console.error(`No model matched ${only.join(", ")}`)
    process.exitCode = 1
    return
  }

  /* Fail with the real reason rather than 88 timeouts in a row. */
  const probe = await fetch(`${BASE}/render-bench/${renderSlug(models[0])}`).catch(() => null)
  if (!probe || !probe.ok) {
    console.error(
      `The bench is not answering at ${BASE}. Build, then serve it with the gate open:\n\n` +
        `  npm run build && RENDER_BENCH=1 npx next start -p 3000\n\n` +
        `That variable is the gate: without it the route 404s, deliberately, everywhere.\n` +
        `Set BENCH_URL if you serve it somewhere other than ${BASE}.`,
    )
    process.exitCode = 1
    return
  }

  let browser: Browser | null = null
  let written = 0
  let unchanged = 0

  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      /* SwiftShader by name: a machine with no GPU otherwise gets a context
         that reports success and draws nothing, and the symptom is 88
         transparent files rather than an error. */
      /* And no proxy: everything this loads is on loopback, and an outbound
         proxy in the environment answers 403 for a same-origin chunk, which
         arrives as a page that renders its shell and never hydrates. */
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--no-proxy-server",
      ],
    })

    const context = await browser.newContext({
      viewport: { width: SHOT_PX / 2, height: SHOT_PX / 2 },
      deviceScaleFactor: 2,
    })

    for (const model of models) {
      const slug = renderSlug(model)
      const page = await context.newPage()
      page.on("pageerror", (error) => console.warn(`  ! ${slug}: ${String(error).slice(0, 160)}`))

      try {
        await page.goto(`${BASE}/render-bench/${slug}`, { waitUntil: "domcontentloaded" })
        const shot = await waitForStill(page, slug)

        /*
         * TRIMMED, THEN FITTED. The bench frames every pedal in a square and
         * almost no pedal is square, so a Cry Baby arrives as a wide object
         * with a third of the file spent on transparent sky. Trimming to what
         * was actually drawn makes the picture smaller AND makes it fill its
         * tile, and section 16 already settled that these are portraits rather
         * than rulers: the millimetres are printed in words next to them.
         */
        const encoded = await sharp(shot)
          .trim({ threshold: 1 })
          .resize(OUT_PX, OUT_PX, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY, alphaQuality: 80, effort: 6 })
          .toBuffer()

        const file = path.join(OUT_DIR, `${slug}.${RENDER_EXT}`)
        if (existsSync(file) && (await looksTheSame(readFileSync(file), encoded))) {
          unchanged += 1
          console.log(`  = ${slug}`)
        } else {
          writeFileSync(file, encoded)
          written += 1
          console.log(`  + ${slug} (${Math.round(encoded.length / 1024)}kB)`)
        }
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser?.close()
  }

  console.log(`\n${written} written, ${unchanged} unchanged, ${models.length} models`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
