/**
 * Builds gallery.html: every slide, beside the caption it ships with.
 *
 *   node build.mjs && node gallery.mjs
 *
 * This is the posting tool rather than a portfolio piece. Scroll to a post, look
 * at its slides, copy the caption, paste it into Instagram. So it pairs the two
 * halves that live in different files (the images built from slides.mjs, the
 * captions written in posts.md) into the one view somebody actually works from.
 *
 * It reads the BUILT pages out of html/ rather than importing the renderer,
 * because build.mjs writes files as a side effect of being imported. Extracting
 * the `.slide` element from finished markup keeps the two tools independent, and
 * it guarantees the gallery shows exactly what was rendered to PNG.
 *
 * The output is written for Anthropic's Artifact publisher: no doctype, html,
 * head or body tags, since those get wrapped around it.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { POSTS } from "./slides.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const HTML_DIR = join(HERE, "html")

/* ------------------------------------------------------------------ *
 * The two halves
 * ------------------------------------------------------------------ */

/** The `.slide` element out of a built page, with its wrapper document dropped. */
function slideMarkup(name) {
  const doc = readFileSync(join(HTML_DIR, `${name}.html`), "utf8")
  const start = doc.indexOf('<div class="slide">')
  const end = doc.lastIndexOf("</div></div>")
  if (start < 0 || end < 0) throw new Error(`${name}.html: could not find the slide element`)
  return doc.slice(start, end + "</div></div>".length)
}

/**
 * The slide stylesheet, minus the rules that size the DOCUMENT.
 *
 * html/body are pinned to 1080x1350 for a screenshot, and carrying that into a
 * scrolling page would clip the whole gallery to one slide's worth of viewport.
 */
function slideCss() {
  const css = readFileSync(join(HTML_DIR, "style.css"), "utf8")
  return css.replace(/\nhtml, body \{[^}]*\}\n/, "\n")
}

/** Caption and alt text for a post, read out of the queue. */
function copyFor(id) {
  const md = readFileSync(join(HERE, "..", "posts.md"), "utf8")
  const section = md.split(/^## /m).find((s) => s.startsWith(`${id}.`))
  if (!section) throw new Error(`posts.md has no post ${id}`)
  const caption = section.match(/\*\*Caption\*\*\s*\n+```\n([\s\S]*?)\n```/)?.[1]
  const alt = section.match(/\*\*Alt text:\*\*\s*([\s\S]*?)(?:\n\n|\n---)/)?.[1]
  if (!caption) throw new Error(`post ${id} has no caption block in posts.md`)
  return { caption: caption.trim(), alt: (alt ?? "").replace(/\s+/g, " ").trim() }
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

/*
 * PALETTE. The site's own tokens, one step darker on the ground so a slide
 * reads as an object standing on a surface rather than blending into it. Single
 * theme on purpose: the design system's first rule is that metal is a dark
 * object whatever it is standing on, and putting these slides on paper would
 * break the one thing it insists on. Every colour is painted explicitly so the
 * page holds on either host background.
 */
const GALLERY_CSS = `
  /* The publisher owns <body>. Painting it is what stops the page ending in the
     host's own ground, which showed as a white band under the last post. */
  html, body { background: #15191c; }

  .g-root {
    --g-ground: #15191c;
    --g-ground-2: #1a1f23;
    --g-edge: #2e363c;
    --g-brass: #ffc233;
    --g-brass-dim: #d99a12;
    --g-led: #24e07a;
    --g-ink: #f2f5f7;
    --g-dim: #aab4bd;
    background: var(--g-ground);
    color: var(--g-ink);
    font-family: 'Jost', system-ui, sans-serif;
    min-height: 100vh;
    padding: 0 0 96px;
    overflow-x: hidden;
  }

  .g-root *, .g-root *::before, .g-root *::after { box-sizing: border-box; }

  .g-wrap { max-width: 1180px; margin: 0 auto; padding: 0 clamp(14px, 4vw, 28px); }

  /* --- masthead --- */
  .g-head { padding: 64px 0 40px; border-bottom: 1px solid var(--g-edge); }
  .g-eyebrow {
    font-size: 13px; font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.22em; color: var(--g-brass); margin-bottom: 18px;
  }
  .g-title {
    font-family: 'Fraunces', Georgia, serif; font-weight: 900;
    font-size: clamp(38px, 6vw, 66px); line-height: 1.02; letter-spacing: -0.02em;
    text-wrap: balance; margin-bottom: 20px;
  }
  .g-lede { font-size: 18px; line-height: 1.6; color: var(--g-dim); max-width: 62ch; }
  .g-lede strong { color: var(--g-ink); font-weight: 600; }
  .g-stats { display: flex; flex-wrap: wrap; gap: 34px; margin-top: 34px; }
  .g-stat-n {
    font-family: 'Fraunces', Georgia, serif; font-weight: 900; font-size: 34px;
    color: var(--g-brass); font-variant-numeric: tabular-nums;
  }
  .g-stat-l {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.16em; color: var(--g-dim); margin-top: 4px;
  }

  /* --- one post --- */
  .g-post { padding: 52px 0; border-bottom: 1px solid var(--g-edge); }
  .g-post-head { display: flex; align-items: baseline; gap: 18px; margin-bottom: 6px; }
  .g-num {
    font-size: 13px; font-weight: 900; letter-spacing: 0.16em;
    color: var(--g-brass-dim); font-variant-numeric: tabular-nums; flex: none;
  }
  .g-post-title {
    font-family: 'Fraunces', Georgia, serif; font-weight: 900;
    font-size: clamp(24px, 3vw, 33px); line-height: 1.14; letter-spacing: -0.01em;
    text-wrap: balance;
  }
  .g-meta {
    font-size: 13px; font-weight: 600; color: var(--g-dim);
    letter-spacing: 0.05em; margin: 0 0 26px 0;
  }

  /*
   * The slides scroll sideways in their own strip, which is also how a carousel
   * is read on the platform. Each frame is a real 1080x1350 render at a quarter
   * scale, not an image of one.
   */
  /*
   * THE FRAME WIDTH IS A VARIABLE, AND THE SCALE IS DERIVED FROM IT.
   *
   * A slide is laid out at its real 1080x1350 and scaled down, and a transformed
   * element still occupies its untransformed size, so the scale and the frame
   * have to agree exactly or the slide either overflows its frame or floats
   * inside it. Deriving one from the other is what makes the frame free to
   * change per breakpoint. 1350/1080 is 1.25, hence the height.
   */
  .g-strip {
    display: flex; gap: 14px; overflow-x: auto; padding-bottom: 14px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .g-frame {
    /*
     * THE SCALE IS THE VARIABLE, and the frame size is derived from it. The
     * other way round does not work: --fw of 340px makes the scale
     * calc(340px / 1080), which is a LENGTH, and scale() takes a unitless
     * number, so the declaration is dropped and the slide renders at its full
     * 1080px inside a 340px frame. It fails silently and looks like a zoomed-in
     * crop. CSS cannot divide a length by a length, so a vw-based frame width
     * cannot produce a ratio at all: the breakpoints set a plain number.
     */
    --s: 0.25;
    width: calc(1080px * var(--s));
    height: calc(1350px * var(--s));
    flex: none; overflow: hidden;
    border-radius: 10px; scroll-snap-align: start;
    box-shadow: 0 8px 26px rgba(0,0,0,0.5);
  }
  .g-frame .slide {
    transform: scale(var(--s));
    transform-origin: top left;
  }

  /* --- caption --- */
  .g-copy { margin-top: 26px; display: grid; gap: 14px; }
  .g-cap {
    background: var(--g-ground-2); border: 1px solid var(--g-edge);
    border-left: 2px solid var(--g-brass); border-radius: 4px;
    padding: 22px 24px; font-size: 15.5px; line-height: 1.62;
    color: var(--g-ink); white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .g-alt { font-size: 13.5px; line-height: 1.55; color: var(--g-dim); }
  .g-alt b {
    color: var(--g-brass-dim); font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.14em; font-size: 11px;
  }
  .g-btn {
    justify-self: start; font: inherit; font-size: 13px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--g-dim); background: transparent;
    border: 1px solid var(--g-edge); border-radius: 3px;
    padding: 9px 16px; cursor: pointer;
    transition: color 120ms linear, border-color 120ms linear;
  }
  .g-btn:hover { color: var(--g-brass); border-color: var(--g-brass); }
  .g-btn:focus-visible { outline: 2px solid var(--g-brass); outline-offset: 2px; }
  .g-btn[data-done="1"] { color: var(--g-led); border-color: var(--g-led); }

  .g-foot { padding: 46px 0 0; font-size: 14px; line-height: 1.6; color: var(--g-dim); }
  .g-foot b { color: var(--g-ink); font-weight: 600; }

  /*
   * PHONE. One slide very nearly fills the width, with a sliver of the next
   * showing so the row reads as swipeable, and the whole page is guaranteed not
   * to scroll sideways. A 270px frame on a 390px screen was legible but tiny,
   * and the carousel is the thing worth looking at.
   */
  @media (max-width: 640px) {
    /* 0.30 is 324px wide, which clears a 360px screen with its padding and
       still leaves a sliver of the next slide showing. */
    .g-frame { --s: 0.30; }
    .g-head { padding: 40px 0 28px; }
    .g-lede { font-size: 16.5px; }
    .g-stats { gap: 22px 26px; }
    .g-post { padding: 38px 0; }
    .g-cap { padding: 18px 18px; font-size: 15px; }
    .g-post-head { gap: 12px; }
  }

  /* Small phones: 0.26 is 281px, which still fits a 320px screen. */
  @media (max-width: 380px) {
    .g-frame { --s: 0.26; }
  }

  @media (prefers-reduced-motion: reduce) {
    .g-btn { transition: none; }
    .g-strip { scroll-snap-type: none; }
  }
`

const posts = POSTS.map((post) => {
  const { caption, alt } = copyFor(post.id)
  const built = readdirSync(HTML_DIR)
    .filter((f) => f.startsWith(`${post.id}-`) && f.endsWith(".html"))
    .sort((a, b) => Number(a.split("-")[1].split(".")[0]) - Number(b.split("-")[1].split(".")[0]))
    .map((f) => f.replace(/\.html$/, ""))

  const n = built.length
  return `
  <article class="g-post" id="post-${post.id}">
    <div class="g-post-head">
      <span class="g-num">${post.id}</span>
      <h2 class="g-post-title">${esc(post.title)}</h2>
    </div>
    <p class="g-meta">${n === 1 ? "Single image" : `Carousel, ${n} slides`}</p>
    <div class="g-strip">${built.map((name) => `<div class="g-frame">${slideMarkup(name)}</div>`).join("")}</div>
    <div class="g-copy">
      <div class="g-cap" id="cap-${post.id}">${esc(caption)}</div>
      <button class="g-btn" type="button" data-cap="cap-${post.id}">Copy caption</button>
      <p class="g-alt"><b>Alt text</b><br>${esc(alt)}</p>
    </div>
  </article>`
}).join("")

const slideCount = POSTS.reduce((a, p) => a + p.slides.length, 0)

const page = `<title>The stompbox.world Queue</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${slideCss()}
${GALLERY_CSS}
</style>

<div class="g-root">
  <div class="g-wrap">
    <header class="g-head">
      <p class="g-eyebrow">Instagram, @stomp_box_world</p>
      <h1 class="g-title">The circuit, not the adjective</h1>
      <p class="g-lede">
        Every slide and every caption for the first ${POSTS.length} posts, ready to publish.
        Each frame below is a <strong>real 1080x1350 render</strong> at quarter scale rather
        than a picture of one, so what you see is what gets posted. Captions are written to
        paste straight in.
      </p>
      <div class="g-stats">
        <div><div class="g-stat-n">${POSTS.length}</div><div class="g-stat-l">Posts</div></div>
        <div><div class="g-stat-n">${slideCount}</div><div class="g-stat-l">Slides</div></div>
        <div><div class="g-stat-n">8</div><div class="g-stat-l">Weeks at 3 a week</div></div>
        <div><div class="g-stat-n">0</div><div class="g-stat-l">Artist credits</div></div>
      </div>
    </header>
${posts}
    <footer class="g-foot">
      <p>
        <b>Order matters.</b> These are in publishing order, not pedal order. A profile opens
        as a three wide grid, so posts 01 to 09 are the whole first impression and they cover
        the range on purpose: the manifesto, then the chain order, then the surprises.
      </p>
    </footer>
  </div>
</div>

<script>
  document.querySelectorAll(".g-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = document.getElementById(btn.dataset.cap).textContent
      try {
        await navigator.clipboard.writeText(text)
        btn.textContent = "Copied"
      } catch {
        // Clipboard access can be refused, and a button that lies is worse than
        // one that tells you to do it yourself.
        const range = document.createRange()
        range.selectNodeContents(document.getElementById(btn.dataset.cap))
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
        btn.textContent = "Selected, press copy"
      }
      btn.dataset.done = "1"
      setTimeout(() => {
        btn.textContent = "Copy caption"
        delete btn.dataset.done
      }, 2400)
    })
  })
</script>
`

writeFileSync(join(HERE, "gallery.html"), page)
console.log(`gallery.html: ${POSTS.length} posts, ${slideCount} slides, ${(page.length / 1024 / 1024).toFixed(2)}MB`)
