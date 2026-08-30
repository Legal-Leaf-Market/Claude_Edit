/**
 * EVERY MEASURED PEDAL, AS A GLB, OUT OF THE RENDERER THAT ALREADY DRAWS IT.
 *
 *   npm run build
 *   RENDER_BENCH=1 npx next start -p 3000     # in one terminal
 *   node scripts/gear-3d/export-models-glb.mjs   # in another
 *
 * Writes `godot/rig-room/assets/<slug>.glb` for each entry in PEDAL_MODELS.
 *
 * WHY THE BROWSER, AGAIN. The rig room needs meshes and Godot cannot author
 * one; something has to build the geometry. There are two candidates and only
 * one of them is allowed: hand-model eighty-eight pedals in Blender, which is
 * section 7's fork done once per pedal and a job nobody finishes, or export
 * the models this repository ALREADY describes in millimetres, through the one
 * renderer that already turns them into geometry. The stills took the second
 * road for the same reason and the argument is unchanged: what ships is the
 * object the inspector draws, not a second drawing of it.
 *
 * So this drives the same `/render-bench/<slug>` the still photographer drives,
 * and instead of screenshotting the canvas it hands `window.__benchScene` to
 * three.js's own GLTFExporter. One description of a pedal, one renderer, two
 * outputs: a picture for the website and a mesh for the game.
 *
 * THE NAMES ARE THE POINT, NOT A BONUS. `gear_rig.gd` in the Godot project
 * binds by node name: CONTROL_<LABEL> becomes a knob it can turn,
 * PEDAL_FOOTSWITCH_<n> a switch it can stomp, LED_<n> a lamp the switch
 * lights. The viewer names those groups, so a pedal arrives in the game with
 * its controls already wired and NO per-product script, which is the whole
 * reason the rig room can grow past one pedal.
 *
 * WHAT IT DOES NOT EXPORT. The studio, the ground plane and the lamps. The
 * scene handed over is the pedal's own group: a game brings its own room, and
 * a GLB carrying somebody else's lighting is a bug that only shows up once it
 * is standing next to a second one.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { chromium } from "playwright-core"
import { PEDAL_MODELS } from "../../lib/board/pedal-models.ts"
import { renderSlug } from "../../lib/board/pedal-render.ts"

const BASE = (process.env.BENCH_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "")
const OUT_DIR = path.join(process.cwd(), "godot", "rig-room", "assets")
const GEAR_DIR = path.join(process.cwd(), "godot", "rig-room", "gear")

/**
 * The room's shelf: which pedals are committed and placed.
 *
 * The exporter writes all eighty-nine; the assets folder ignores all but
 * these. Eighty-nine GLBs is 60MB, because a knurled knob is two dozen small
 * meshes and every pedal carries three of them. Twelve is 5MB, and it is a
 * room rather than a warehouse. A different twelve is this list, a re-run, and
 * a line in world/room.gd: the same two files and one line the README promises.
 */
const ROOM = new Set([
  "boss--ds-1-distortion",
  "boss--bd-2-blues-driver",
  "boss--ge-7-equalizer",
  "ibanez--ts9-tube-screamer",
  "electro-harmonix--big-muff-pi",
  "electro-harmonix--deluxe-memory-man",
  "dunlop--cry-baby",
  "dunlop--fuzz-face",
  "mxr--phase-90",
  "proco--rat-2",
  "line-6--dl4-delay-modeler",
  "tc-electronic--hall-of-fame-2",
])

/** A GearDefinition, written from the model rather than typed twice. */
function tres(model, slug, sizeMM) {
  const [w, h, d] = sizeMM.map((n) => Math.round(n * 10) / 10)
  return `[gd_resource type="Resource" load_steps=2 format=2]

[ext_resource path="res://gear/gear_definition.gd" type="Script" id=1]

; WRITTEN BY scripts/gear-3d/export-models-glb.mjs. The millimetres are the
; EXPORTED mesh's own rather than the catalogue's, because gear_rig.gd checks
; the two against each other at load and a figure typed by hand would only be
; checking itself. Edit lib/board/pedal-models.ts and re-export.
[resource]
script = ExtResource( 1 )
id = "${slug}"
manufacturer = "${model.maker.replace(/"/g, "")}"
model = "${model.name.replace(/"/g, "")}"
category = "${model.style}"
width_mm = ${w}
depth_mm = ${d}
height_mm = ${h}
inspect_distance = 0.0
`
}

/** Node names the rig room binds to. Reported per pedal so a model that
    exports with no controls is visible here rather than in the game. */
const BINDABLE = /^(CONTROL_|PEDAL_|LED_|TOGGLE_|SOCKET_)/

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(GEAR_DIR, { recursive: true })

  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"))
  const models = only.length
    ? PEDAL_MODELS.filter((m) => only.some((a) => renderSlug(m).includes(a)))
    : PEDAL_MODELS

  const probe = await fetch(`${BASE}/render-bench/${renderSlug(models[0])}`).catch(() => null)
  if (!probe || !probe.ok) {
    console.error(
      `The bench is not answering at ${BASE}. Build, then serve it with the gate open:\n\n` +
        `  npm run build && RENDER_BENCH=1 npx next start -p 3000\n`,
    )
    process.exitCode = 1
    return
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-proxy-server"],
  })

  let written = 0
  let unchanged = 0
  const noControls = []

  try {
    const context = await browser.newContext({ viewport: { width: 480, height: 480 } })
    for (const model of models) {
      const slug = renderSlug(model)
      const page = await context.newPage()
      page.on("pageerror", (e) => console.warn(`  ! ${slug}: ${String(e).slice(0, 140)}`))
      try {
        await page.goto(`${BASE}/render-bench/${slug}`, { waitUntil: "domcontentloaded" })
        await page.waitForFunction(() => window.__benchReady === true && window.__benchScene, undefined, {
          timeout: 60_000,
        })

        /* The page owns the export, because it owns the three.js bundle: a
           bare "three" specifier cannot be resolved from an evaluated
           snippet, and shipping a second copy of three to resolve it would
           be a second renderer by the back door. */
        const result = await page.evaluate(() => window.__benchExportGlb())

        const glb = Buffer.from(result.b64, "base64")
        const file = path.join(OUT_DIR, `${slug}.glb`)
        const bindable = result.names.filter((n) => BINDABLE.test(n))
        if (!bindable.length) noControls.push(slug)

        /* The resource travels with the mesh, so a pedal is never half added. */
        if (ROOM.has(slug)) {
          writeFileSync(path.join(GEAR_DIR, `${slug}.tres`), tres(model, slug, result.sizeMM))
        }

        /* Byte comparison is honest here, unlike the stills: this is a
           deterministic serialisation of deterministic geometry, with no
           lossy encoder in the way. */
        if (existsSync(file) && readFileSync(file).equals(glb)) {
          unchanged += 1
          console.log(`  = ${slug}`)
        } else {
          writeFileSync(file, glb)
          written += 1
          const [w, h, d] = result.sizeMM.map((n) => Math.round(n))
          console.log(
            `  + ${slug}  ${w}x${d}x${h}mm  ${Math.round(glb.length / 1024)}kB  ` +
              `${bindable.length} bindable`,
          )
        }
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n${written} written, ${unchanged} unchanged, ${models.length} models`)
  if (noControls.length) {
    /* Not fatal: a pedal with no controls is a legitimate thing to look at and
       pick up. But it is worth naming, because the usual cause is a model that
       lost its knobs rather than one that never had any. */
    console.log(`\nNo bindable controls in: ${noControls.join(", ")}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
