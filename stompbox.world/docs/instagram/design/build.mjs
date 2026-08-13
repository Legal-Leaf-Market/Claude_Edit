/**
 * Writes one 1080x1350 HTML page per slide, plus a contact sheet.
 *
 * WHY HTML AND NOT SVG ALL THE WAY DOWN. Text wrapping. A carousel slide is
 * mostly prose, and hand-rolling line breaks in SVG text means re-measuring
 * every time a word changes, which is exactly the kind of chore that stops
 * anybody editing the copy. CSS wraps text for free. The diagrams stay SVG
 * because they are drawings, and they sit inline inside the page.
 *
 * The fonts are base64 inlined, so a page renders identically with no network
 * and the whole folder keeps working when Google Fonts is unreachable.
 *
 *   node build.mjs        writes html/ and sheet.html
 *   node render.mjs       turns html/ into png/ with whatever Chromium is around
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { css, FONT_FILES, COLOR } from "./tokens.mjs"
import { POSTS, CHAIN, SLIDE_COUNT } from "./slides.mjs"
import { chainBlocks } from "./diagrams.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const HTML_DIR = join(HERE, "html")

/** One @font-face per family, weight 100 to 900 because both are variable. */
function fontFaces() {
  return FONT_FILES.map(({ family, file }) => {
    const b64 = readFileSync(join(HERE, "fonts", file)).toString("base64")
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`
  }).join("\n")
}

/**
 * The mark, drawn rather than typeset, same geometry as app/icon.svg with the
 * knobs and the inner footswitch ring the favicon build drops. At this size
 * they are the detail that stops it reading as a plain rounded rectangle.
 */
function markLarge(px = 268) {
  return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" role="img" aria-label="stompbox.world">
    <rect x="19" y="3" width="62" height="94" rx="10" fill="${COLOR.plate}" stroke="${COLOR.gold}" stroke-width="4"/>
    <rect x="24.5" y="8.5" width="51" height="83" rx="6.5" fill="none" stroke="${COLOR.gold}" stroke-opacity="0.28" stroke-width="1.4"/>
    <circle cx="50" cy="15.5" r="3.3" fill="${COLOR.led}"/>
    <circle cx="34" cy="36" r="6.4" fill="none" stroke="${COLOR.gold}" stroke-opacity="0.4" stroke-width="1.6"/>
    <circle cx="66" cy="36" r="6.4" fill="none" stroke="${COLOR.gold}" stroke-opacity="0.4" stroke-width="1.6"/>
    <circle cx="50" cy="68" r="14" fill="${COLOR.plateLo}" stroke="${COLOR.gold}" stroke-width="3.4"/>
    <circle cx="50" cy="68" r="8.6" fill="none" stroke="${COLOR.gold}" stroke-opacity="0.34" stroke-width="1.4"/>
  </svg>`
}

function orderList(lit) {
  let n = 0
  return `<div class="order">${CHAIN.map((row) => {
    if (row.end) {
      return `<div class="order-row end"><span class="order-n"></span><span class="order-name">${row.name}</span></div>`
    }
    n += 1
    const cls = lit ? (row.name === lit ? " on" : " muted") : ""
    return `<div class="order-row${cls}"><span class="order-n">${String(n).padStart(2, "0")}</span><span class="order-name">${row.name}</span></div>`
  }).join("")}</div>`
}

/** Body copy, one or two paragraphs. The second is dimmed so the first leads. */
function bodies(slide) {
  return [slide.body, slide.body2]
    .filter(Boolean)
    .map((t, i) => `<p class="body${i ? " dim" : ""}">${t}</p>`)
    .join("")
}

function chainCompareHtml(chains) {
  const one = (c) =>
    `<div><div class="pane-label" style="margin-bottom:2px">${c.label}</div>${chainBlocks(c.blocks, {
      caption: c.caption,
      height: 250,
    })}</div>`
  return `<div style="display:flex;flex-direction:column;gap:26px">${one(chains.a)}${one(chains.b)}</div>`
}

function content(slide) {
  switch (slide.kind) {
    case "mark":
      return {
        centre: true,
        html: `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:52px">
          ${markLarge()}
          <div class="hook" style="max-width:760px">${slide.hook}</div>
        </div>`,
      }

    case "statement":
      return { centre: true, html: `<div class="hook">${slide.hook}</div>` }

    case "closer":
      return {
        centre: true,
        html: `<hr class="rule" style="max-width:190px;margin:0 0 40px"/><div class="hook small">${slide.hook}</div>`,
      }

    case "mechanism":
      return { centre: true, html: `<div class="kicker">${slide.kicker}</div>${bodies(slide)}` }

    /*
     * Figure slides are centred too. Top-aligning them left a third of the
     * plate empty under the body copy on every diagram slide, which read as a
     * layout that had run out rather than one with air in it.
     */
    case "figure":
      return {
        centre: true,
        html: `<div class="kicker">${slide.kicker}</div>
          <div class="figure">${slide.fig()}</div>
          ${bodies(slide)}`,
      }

    case "compareChain":
      return {
        centre: true,
        html: `<div class="kicker">${slide.kicker}</div>
          <div class="figure">${chainCompareHtml(slide.chains)}</div>`,
      }

    case "compare":
      return {
        centre: true,
        html: `<div class="kicker">${slide.kicker}</div>
          <div class="compare">${slide.panes
            .map((p) => `<div class="pane"><div class="pane-label">${p.label}</div><p class="body">${p.body}</p></div>`)
            .join("")}</div>`,
      }

    case "order":
      return { centre: true, html: `<div class="kicker">${slide.kicker}</div>${orderList(slide.lit)}` }

    default:
      throw new Error(`Unknown slide kind: ${slide.kind}`)
  }
}

/*
 * The stylesheet is written ONCE and linked, rather than inlined into all 85
 * pages. Inlining it put the base64 fonts in every file and turned 85 slides
 * into 7.6MB of mostly the same bytes.
 *
 * The fonts stay base64 inside that one file rather than becoming relative
 * URLs to fonts/, because a font fetched over file:// is subject to CORS and
 * silently falls back to Georgia. A data: URI has no origin to check, so the
 * page renders correctly when opened directly in a browser and not only under
 * the render script's flags.
 */
function page(slide, post, index) {
  const { centre, html } = content(slide)
  const total = post.slides.length
  const num = total > 1 ? `${index + 1} / ${total}` : ""
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${post.id}.${index + 1} ${post.title}</title>
<link rel="stylesheet" href="style.css"></head>
<body><div class="slide"><div class="plate">
<div class="body-area${centre ? " centre" : ""}">${html}</div>
<div class="foot">
  <span class="who"><span class="led"></span>stompbox.world</span>
  <span class="num">${num}</span>
</div>
</div></div></body></html>`
}

/**
 * A contact sheet, so the queue can be judged as a grid the way a profile is.
 *
 * Real 1080x1350 pages in iframes at quarter scale rather than the PNGs, so it
 * works straight after build.mjs with no render step.
 */
function sheet(names) {
  const cards = names
    .map(
      (n) =>
        `<figure><div class="frame"><iframe src="html/${n}.html" scrolling="no" loading="lazy"></iframe></div><figcaption>${n}</figcaption></figure>`,
    )
    .join("")
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>stompbox.world: slide contact sheet</title>
<style>
  body{margin:0;padding:34px;background:#1a1f23;color:#f2f5f7;font-family:system-ui,sans-serif}
  h1{font-size:20px;font-weight:700;margin:0 0 6px}
  p.note{color:#aab4bd;font-size:14px;margin:0 0 26px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:26px}
  figure{margin:0}
  .frame{width:270px;height:337px;overflow:hidden;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.5)}
  .frame iframe{width:1080px;height:1350px;border:0;display:block;
                transform:scale(0.25);transform-origin:top left}
  figcaption{font-size:12px;color:#aab4bd;margin-top:8px;letter-spacing:.05em}
</style></head>
<body>
<h1>stompbox.world: ${names.length} slides across ${POSTS.length} posts</h1>
<p class="note">Each frame is a real 1080x1350 render at quarter scale. Judge the grid, not the slide.</p>
<div class="grid">${cards}</div>
</body></html>`
}

rmSync(HTML_DIR, { recursive: true, force: true })
mkdirSync(HTML_DIR, { recursive: true })
writeFileSync(join(HTML_DIR, "style.css"), css(fontFaces()))

const names = []
for (const post of POSTS) {
  post.slides.forEach((slide, i) => {
    const name = `${post.id}-${i + 1}`
    writeFileSync(join(HTML_DIR, `${name}.html`), page(slide, post, i))
    names.push(name)
  })
}

writeFileSync(join(HERE, "sheet.html"), sheet(names))

const written = readdirSync(HTML_DIR).filter((f) => f.endsWith(".html")).length
if (written !== SLIDE_COUNT) throw new Error(`Wrote ${written} pages, expected ${SLIDE_COUNT}`)
console.log(`${written} slides across ${POSTS.length} posts, plus sheet.html`)
