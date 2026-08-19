/**
 * Turns html/ into png/, which is what Instagram actually accepts.
 *
 *   node build.mjs && node render.mjs
 *
 * No npm dependency is added for this. The site is a static build over a hand
 * written dataset and it stays that way, so this drives whatever Chromium is
 * already on the machine and crops the result with Node's built in zlib.
 *
 * THREE THINGS HERE LOOK LIKE OVERKILL AND ARE NOT. All three failed quietly
 * rather than loudly, which is the only reason they are worth this much code.
 *
 * 1. --virtual-time-budget. Without it the screenshot can fire before the
 *    base64 font in style.css is parsed and slides come out set in Georgia.
 *    That looks close enough to correct to ship by accident.
 *
 * 2. THE WINDOW IS CALIBRATED, NOT 1080x1350. Chromium reserves vertical space
 *    even headless: asking for 1350 gave a 1263px viewport, so the page
 *    scrolled and the capture stitched a shifted composite with the bottom of
 *    the plate missing. The overhead measured 87px here, but that is a version
 *    detail, so the viewport is probed once and the difference added back.
 *    --headless=new behaves identically, so switching modes is not a fix.
 *
 * 3. THE RESULT IS CROPPED. A screenshot is always the WINDOW height, so
 *    rendering a correct 1350px viewport inside a 1437px window leaves 87px of
 *    background below the slide. Cropping the top 1350 rows is what makes the
 *    file a real 4:5 post rather than a 1080x1437 that Instagram will crop for
 *    us, somewhere we did not choose.
 */

import { execFileSync } from "node:child_process"
import { deflateSync, inflateSync } from "node:zlib"
import {
  existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { globSync } from "node:fs"
import { CANVAS } from "./tokens.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const HTML_DIR = join(HERE, "html")
const PNG_DIR = join(HERE, "png")
const { w: W, h: H } = CANVAS

/* ------------------------------------------------------------------ *
 * Finding a browser
 * ------------------------------------------------------------------ */

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME
  const patterns = [
    "/opt/pw-browsers/chromium-*/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
  ]
  for (const p of patterns) {
    const hits = globSync(p).filter(existsSync).sort()
    if (hits.length) return hits[hits.length - 1]
  }
  for (const c of [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]) {
    if (existsSync(c)) return c
  }
  throw new Error("No Chromium found. Set CHROME= to a browser binary and re-run.")
}

function chrome(bin, args) {
  return execFileSync(
    bin,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--virtual-time-budget=4000",
      ...args,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 },
  )
}

/** Ask the browser how tall the viewport really is at a given window height. */
function measureViewport(bin) {
  const probe = join(HTML_DIR, ".probe.html")
  writeFileSync(
    probe,
    `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
     window.addEventListener('load',()=>{document.title='vh='+window.innerHeight})
     </script></body></html>`,
  )
  try {
    const out = chrome(bin, [`--window-size=${W},${H}`, "--dump-dom", `file://${probe}`])
    const m = out.match(/vh=(\d+)/)
    return m ? Number(m[1]) : null
  } finally {
    rmSync(probe, { force: true })
  }
}

/* ------------------------------------------------------------------ *
 * PNG cropping, in pure Node
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/**
 * Crop a PNG to its top `keep` rows.
 *
 * Un-filters every scanline, keeps the first `keep` of them, and re-encodes
 * with the PAETH filter on every row.
 *
 * That used to be filter 0, on the reasoning that re-filtering would compress
 * better but the files were small enough not to bother. Then the palette gained
 * a radial glow, every row became a smooth ramp instead of a flat run, and
 * unfiltered rows stopped compressing at all: the 85 slides went from 24MB to
 * 66MB and blew the upload limit. Paeth predicts each byte from its left, upper
 * and upper-left neighbours, which is close to free on a gradient and turns the
 * data back into mostly zeroes.
 */
export function cropTop(file, keep) {
  const buf = readFileSync(file)
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`)

  let pos = 8
  let ihdr = null
  const idat = []
  const passthrough = []

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString("ascii", pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === "IHDR") ihdr = Buffer.from(data)
    else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
    else passthrough.push({ type, data: Buffer.from(data) })
    pos += 12 + len
  }
  if (!ihdr) throw new Error(`${file}: no IHDR`)

  const width = ihdr.readUInt32BE(0)
  const height = ihdr.readUInt32BE(4)
  const depth = ihdr[8]
  const colorType = ihdr[9]
  const interlace = ihdr[12]

  if (height === keep) return { cropped: false, width, height }
  if (height < keep) throw new Error(`${file}: ${height}px tall, cannot crop up to ${keep}`)
  if (depth !== 8) throw new Error(`${file}: bit depth ${depth} unsupported`)
  if (interlace !== 0) throw new Error(`${file}: interlaced PNGs unsupported`)

  const bpp = CHANNELS[colorType]
  if (!bpp) throw new Error(`${file}: colour type ${colorType} unsupported`)
  const stride = width * bpp

  const raw = inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(keep * (stride + 1))
  let prev = Buffer.alloc(stride)

  for (let y = 0; y < keep; y++) {
    const filter = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const row = Buffer.alloc(stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      const x = src[i]
      switch (filter) {
        case 0: row[i] = x; break
        case 1: row[i] = (x + a) & 0xff; break
        case 2: row[i] = (x + b) & 0xff; break
        case 3: row[i] = (x + ((a + b) >> 1)) & 0xff; break
        case 4: row[i] = (x + paeth(a, b, c)) & 0xff; break
        default: throw new Error(`${file}: unknown filter ${filter} on row ${y}`)
      }
    }
    // Re-encode this row with Paeth, against the row above it.
    out[y * (stride + 1)] = 4
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      out[y * (stride + 1) + 1 + i] = (row[i] - paeth(a, b, c)) & 0xff
    }
    prev = row
  }

  const newIhdr = Buffer.from(ihdr)
  newIhdr.writeUInt32BE(keep, 4)

  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", newIhdr),
      ...passthrough.map((p) => chunk(p.type, p.data)),
      chunk("IDAT", deflateSync(out, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  )
  return { cropped: true, width, height: keep }
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

/*
 * Guarded so avatar.mjs can import findChrome/chrome/cropTop without this
 * running 85 renders as a side effect of the import.
 */
const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isEntry) main()

export { findChrome, chrome }

function main() {
const bin = findChrome()
const pages = existsSync(HTML_DIR) ? readdirSync(HTML_DIR).filter((f) => f.endsWith(".html")).sort() : []
if (!pages.length) throw new Error("No html/ pages. Run: node build.mjs")

const viewport = measureViewport(bin)
const windowH = viewport ? H + (H - viewport) : H
if (viewport) console.log(`Viewport was ${viewport}px at a ${H}px window, so asking for ${windowH}px.`)
else console.warn("Could not measure the viewport, using an uncalibrated window.")

console.log(`Rendering ${pages.length} slides with ${bin}`)
rmSync(PNG_DIR, { recursive: true, force: true })
mkdirSync(PNG_DIR, { recursive: true })

const wrong = []
for (const page of pages) {
  const name = page.replace(/\.html$/, "")
  const out = join(PNG_DIR, `${name}.png`)
  chrome(bin, [`--window-size=${W},${windowH}`, `--screenshot=${out}`, `file://${join(HTML_DIR, page)}`])
  const { width, height } = cropTop(out, H)
  if (width !== W || height !== H) wrong.push(`${name}.png is ${width}x${height}`)
}

if (wrong.length) {
  console.error(wrong.map((w) => `  ${w}`).join("\n"))
  throw new Error(`${wrong.length} of ${pages.length} PNGs are not ${W}x${H}`)
}

console.log(`${pages.length} PNGs in png/, all ${W}x${H}`)
}
