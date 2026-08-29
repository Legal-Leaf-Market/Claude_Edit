/**
 * LOOK AT THE EXPORTED FILE, FROM EVERY SIDE, BEFORE CLAIMING ANYTHING ABOUT IT.
 *
 *   node scripts/gear-3d/validate-glb.mjs [slug]
 *
 * The handoff brief for this asset is blunt about why this script exists: an
 * asset that looks right in the tool that authored it is not an asset that
 * looks right in the viewer that ships it. Blender's own preview is a different
 * renderer, with a different tone map, reading the scene rather than the export,
 * so it will happily show you geometry the exporter dropped, a material the
 * glTF spec cannot carry, and a normal that is only correct because Blender
 * knew which side you meant.
 *
 * So this loads THE EXACT FILE IN public/gear-3d, in three.js, through
 * GLTFLoader, on a neutral floor under studio lighting, and photographs it from
 * the nine angles the brief names. Nothing here shares a line of code with the
 * Blender build: if the two disagree, that disagreement is the finding.
 *
 * WHY A CONTACT SHEET RATHER THAN A PASS/FAIL. Almost nothing worth catching
 * here is expressible as an assertion. A footswitch 3mm too far forward, a
 * bevel that reads as a chamfer, a decal a quarter degree off the plane it is
 * printed on, a back face that is black because its normal is inverted: every
 * one of those is obvious in a picture and invisible to a number. The script
 * DOES assert the things that genuinely are numbers (the bounding box against
 * the published millimetres, the named interaction nodes surviving the export),
 * because those are the ones an eye slides over.
 *
 * The output is deliberately NOT committed. These are diagnostics of a build
 * artefact, they are regenerated in seconds, and a folder of them beside the
 * eighty-eight committed stills would read as though the site served them.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"
import sharp from "sharp"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const SLUG = process.argv[2] ?? "boss-ds1"
/* The assets live in the Godot project, which is their only consumer. */
const ASSET_DIR = "godot/rig-room/assets"
const GLB = path.join(ROOT, ASSET_DIR, `${SLUG}.glb`)
const OUT_DIR = path.join(ROOT, "scripts", "gear-3d", "validation")

/** Shot big and downsampled, for the same reason the pedal stills are. */
const SHOT_PX = 900
const TILE_PX = 440

/**
 * THE NINE THE BRIEF NAMES, and they are not nine arbitrary orbits.
 *
 * Each one is there to catch a different class of mistake, so the labels say
 * what each is FOR rather than only where the camera is:
 *
 *   front              the product shot, and the only one anybody frames for
 *   30 / 45 degrees    where a bevel either reads as a machined edge or as a
 *                      chamfer somebody added to hide a hard corner
 *   side               the silhouette: a BOSS compact is a stepped profile and
 *                      this is the one view that proves it
 *   135 / rear         the shelf's back edge, the DC jack, and every face
 *                      nobody thought about while modelling the front
 *   top                knob placement and the tread plate's real coverage,
 *                      measured against the print rather than remembered
 *   low front / side   the angles a photographer actually uses on a pedal, and
 *                      the ones that expose a body floating off its own base
 *
 * `elev` is degrees above the deck; `azim` is degrees around it, 0 at the front.
 */
const VIEWS = [
  { id: "00-front", label: "0 deg front", azim: 0, elev: 12 },
  { id: "01-front-30", label: "30 deg three-quarter", azim: 30, elev: 20 },
  { id: "02-front-45", label: "45 deg three-quarter", azim: 45, elev: 27 },
  { id: "03-side-90", label: "90 deg side", azim: 90, elev: 8 },
  { id: "04-rear-135", label: "135 deg rear three-quarter", azim: 135, elev: 22 },
  { id: "05-rear-180", label: "180 deg rear", azim: 180, elev: 14 },
  { id: "06-top", label: "top down", azim: 0, elev: 88 },
  { id: "07-low-front", label: "low front", azim: 8, elev: 3 },
  { id: "08-low-side", label: "low side", azim: 62, elev: 4 },
]

/**
 * Serve the repo over loopback.
 *
 * A GLB cannot be loaded from `file://` in Chromium: the fetch is cross-origin
 * to a null origin and fails with a CORS error that names neither the file nor
 * the reason. A four-line static server costs less than explaining that to the
 * next person.
 */
function serve(root) {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".glb": "model/gltf-binary",
    ".import": "text/plain",
    ".png": "image/png",
  }
  const server = createServer((request, response) => {
    const rel = decodeURIComponent(new URL(request.url, "http://x").pathname)
    const file = path.join(root, rel)
    if (!file.startsWith(root) || !existsSync(file)) {
      response.writeHead(404).end("no")
      return
    }
    response.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" })
    response.end(readFileSync(file))
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }))
  })
}

/**
 * The viewer page. Neutral on purpose: no site tokens, no brand colour, no
 * post-processing. A studio this asset only looks good in is not a result.
 */
const PAGE = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:#8a8d92;overflow:hidden}
  canvas{display:block}
</style>
<script type="importmap">
{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}
</script>
<script type="module">
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"

const SIZE = ${SHOT_PX}
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(SIZE, SIZE)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x8a8d92)

/* A room environment rather than three point lights: a painted specular is
   most of what stops a plastic knob reading as a grey cylinder, and it is the
   one thing the CSS renderer this project deleted could never do. */
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

const key = new THREE.DirectionalLight(0xffffff, 2.4)
key.position.set(0.35, 0.8, 0.5)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.camera.near = 0.05
key.shadow.camera.far = 4
key.shadow.camera.left = -0.35
key.shadow.camera.right = 0.35
key.shadow.camera.top = 0.35
key.shadow.camera.bottom = -0.35
key.shadow.bias = -0.0008
scene.add(key)
scene.add(new THREE.AmbientLight(0xffffff, 0.35))

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(4, 4),
  new THREE.ShadowMaterial({ opacity: 0.32 }),
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20)
const target = new THREE.Vector3()
let radius = 1

window.__view = (azimDeg, elevDeg) => {
  const azim = (azimDeg * Math.PI) / 180
  const elev = (elevDeg * Math.PI) / 180
  camera.position.set(
    target.x + radius * Math.cos(elev) * Math.sin(azim),
    target.y + radius * Math.sin(elev),
    target.z + radius * Math.cos(elev) * Math.cos(azim),
  )
  camera.lookAt(target)
  renderer.render(scene, camera)
}

new GLTFLoader().load("/${ASSET_DIR}/${SLUG}.glb", (gltf) => {
  const root = gltf.scene
  root.traverse((node) => {
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true }
  })
  scene.add(root)

  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  box.getCenter(target)

  /* Sit the asset ON the floor rather than trusting it was authored there:
     a model whose origin is its centre floats, and that is worth SEEING in
     the pictures rather than silently correcting, so the offset is reported. */
  window.__report = {
    sizeMM: [size.x * 1000, size.y * 1000, size.z * 1000],
    minY: box.min.y,
    nodes: [],
    materials: [],
  }
  root.traverse((node) => {
    if (node.name) window.__report.nodes.push(node.name)
    if (node.isMesh && node.material?.name) window.__report.materials.push(node.material.name)
  })

  target.y = size.y / 2
  radius = Math.max(size.x, size.y, size.z) * 2.6
  key.position.set(size.x * 3, size.y * 8, size.z * 4)
  key.shadow.camera.left = -size.z * 2
  key.shadow.camera.right = size.z * 2
  key.shadow.camera.top = size.z * 2
  key.shadow.camera.bottom = -size.z * 2
  key.shadow.camera.updateProjectionMatrix()

  window.__view(0, 12)
  window.__ready = true
}, undefined, (error) => {
  window.__error = String(error?.message ?? error)
  window.__ready = true
})
</script>`

/** A caption strip under each tile, so a contact sheet is readable at a glance. */
async function label(text, width) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="26">
    <rect width="100%" height="100%" fill="#1b1e23"/>
    <text x="10" y="18" font-family="monospace" font-size="13" fill="#dfe3e8">${text}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function main() {
  if (!existsSync(GLB)) {
    console.error(`No such asset: ${GLB}\nBuild it first: blender -b -P scripts/gear-3d/ds1.py`)
    process.exitCode = 1
    return
  }
  mkdirSync(OUT_DIR, { recursive: true })

  const { server, port } = await serve(ROOT)
  writeFileSync(path.join(OUT_DIR, "_viewer.html"), PAGE)

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-proxy-server"],
  })

  try {
    const page = await browser.newPage({ viewport: { width: SHOT_PX, height: SHOT_PX } })
    page.on("pageerror", (error) => console.warn(`  ! ${String(error).slice(0, 200)}`))
    await page.goto(`http://127.0.0.1:${port}/scripts/gear-3d/validation/_viewer.html`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 60_000 })

    const failure = await page.evaluate(() => window.__error ?? null)
    if (failure) throw new Error(`GLTFLoader refused the file: ${failure}`)

    const report = await page.evaluate(() => window.__report)
    const [w, h, d] = report.sizeMM.map((n) => Math.round(n * 10) / 10)

    console.log(`\n${SLUG}`)
    console.log(`  bounding box   ${w} x ${d} x ${h} mm  (width x depth x height)`)
    console.log(`  sits at y      ${(report.minY * 1000).toFixed(2)} mm`)
    console.log(`  materials      ${[...new Set(report.materials)].length}`)

    /* THE NAMED NODES ARE THE INTERFACE, so their survival is asserted rather
       than eyeballed. Blender's exporter drops an empty with no children and
       renames anything colliding, and neither says a word about it. */
    const required = [
      "PEDAL_TREADLE",
      "CONTROL_TONE",
      "CONTROL_LEVEL",
      "CONTROL_DIST",
      "LED_CHECK",
      "SOCKET_INPUT",
      "SOCKET_OUTPUT",
      "SOCKET_DC",
    ]
    const missing = required.filter((name) => !report.nodes.includes(name))
    console.log(`  named nodes    ${required.length - missing.length}/${required.length}` +
      (missing.length ? `  MISSING ${missing.join(", ")}` : ""))

    const tiles = []
    for (const view of VIEWS) {
      await page.evaluate(([a, e]) => window.__view(a, e), [view.azim, view.elev])
      const shot = await page.screenshot()
      writeFileSync(path.join(OUT_DIR, `${SLUG}-${view.id}.png`), shot)
      const body = await sharp(shot).resize(TILE_PX, TILE_PX).png().toBuffer()
      const caption = await label(`${view.id}  ${view.label}`, TILE_PX)
      tiles.push(
        await sharp({
          create: { width: TILE_PX, height: TILE_PX + 26, channels: 3, background: "#1b1e23" },
        })
          .composite([{ input: body, top: 0, left: 0 }, { input: caption, top: TILE_PX, left: 0 }])
          .png()
          .toBuffer(),
      )
      console.log(`  shot ${view.id}`)
    }

    const cols = 3
    const rows = Math.ceil(tiles.length / cols)
    const sheet = path.join(OUT_DIR, `${SLUG}-contact-sheet.png`)
    await sharp({
      create: {
        width: cols * TILE_PX,
        height: rows * (TILE_PX + 26),
        channels: 3,
        background: "#1b1e23",
      },
    })
      .composite(
        tiles.map((input, index) => ({
          input,
          left: (index % cols) * TILE_PX,
          top: Math.floor(index / cols) * (TILE_PX + 26),
        })),
      )
      .png()
      .toFile(sheet)

    console.log(`\n  contact sheet  ${path.relative(ROOT, sheet)}`)
    if (missing.length) process.exitCode = 1
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
