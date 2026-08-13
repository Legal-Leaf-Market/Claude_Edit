/**
 * The profile photo: avatar.png, 1080x1080.
 *
 *   node avatar.mjs
 *
 * The full build of the mark rather than the favicon build in app/icon.svg. A
 * profile photo renders around 110px, which is big enough for the knobs and the
 * inner footswitch ring to give it something; those are dropped from the favicon
 * only because they smudge at 16px.
 *
 * NO OUTER BORDER, and that is the one thing this file exists to get right.
 * Every slide sits on a plate with a brass edge, and copying that here would put
 * a hairline rectangle inside a circular crop, which reads as a mistake. So the
 * enclosure IS the subject and the ground is plain. The mark is sized to sit
 * well inside the inscribed circle, since the square corners are never seen.
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { COLOR } from "./tokens.mjs"
import { findChrome, chrome, cropTop } from "./render.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const SIZE = 1080
const MARK = 620

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>avatar</title><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${SIZE}px; height: ${SIZE}px; overflow: hidden; background: ${COLOR.bg}; }
  .a {
    width: ${SIZE}px; height: ${SIZE}px;
    display: flex; align-items: center; justify-content: center;
    background-color: ${COLOR.bg};
    background-image:
      radial-gradient(75% 60% at 50% 32%, rgba(255,194,51,0.075), transparent 62%),
      repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(-45deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 4px);
  }
</style></head>
<body><div class="a">
  <svg viewBox="0 0 100 100" width="${MARK}" height="${MARK}" role="img" aria-label="stompbox.world">
    <rect x="19" y="3" width="62" height="94" rx="10" fill="${COLOR.plate}" stroke="${COLOR.chrome}" stroke-width="4"/>
    <rect x="24.5" y="8.5" width="51" height="83" rx="6.5" fill="none" stroke="${COLOR.chrome}" stroke-opacity="0.28" stroke-width="1.4"/>
    <circle cx="50" cy="15.5" r="3.3" fill="${COLOR.led}"/>
    <circle cx="34" cy="36" r="6.4" fill="none" stroke="${COLOR.chrome}" stroke-opacity="0.4" stroke-width="1.6"/>
    <circle cx="66" cy="36" r="6.4" fill="none" stroke="${COLOR.chrome}" stroke-opacity="0.4" stroke-width="1.6"/>
    <circle cx="50" cy="68" r="14" fill="${COLOR.plateLo}" stroke="${COLOR.chrome}" stroke-width="3.4"/>
    <circle cx="50" cy="68" r="8.6" fill="none" stroke="${COLOR.chrome}" stroke-opacity="0.34" stroke-width="1.4"/>
  </svg>
</div></body></html>`

mkdirSync(join(HERE, "html"), { recursive: true })
const page = join(HERE, "html", "avatar.html")
writeFileSync(page, html)

const bin = findChrome()

/*
 * Same calibration as render.mjs, for the same reason: the viewport is shorter
 * than the window Chromium was asked for, and a screenshot is the window. So
 * measure the overhead, render that much taller, and crop back to square.
 */
const probePage = join(HERE, "html", ".avatar-probe.html")
writeFileSync(
  probePage,
  `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
   window.addEventListener('load',()=>{document.title='vh='+window.innerHeight})
   </script></body></html>`,
)
const viewport = Number(
  chrome(bin, [`--window-size=${SIZE},${SIZE}`, "--dump-dom", `file://${probePage}`]).match(
    /vh=(\d+)/,
  )?.[1] ?? SIZE,
)
const windowH = SIZE + (SIZE - viewport)

const out = join(HERE, "avatar.png")
chrome(bin, [`--window-size=${SIZE},${windowH}`, `--screenshot=${out}`, `file://${page}`])
const { width, height } = cropTop(out, SIZE)
if (width !== SIZE || height !== SIZE) throw new Error(`avatar.png is ${width}x${height}`)

console.log(`avatar.png, ${SIZE}x${SIZE} (viewport was ${viewport} at a ${SIZE} window)`)
