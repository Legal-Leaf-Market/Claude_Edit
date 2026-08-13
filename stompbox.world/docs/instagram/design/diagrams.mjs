/**
 * The diagram library.
 *
 * This is the reason the account is worth following: nobody else in this niche
 * draws the circuit. Every function here returns an SVG string sized to the
 * plate's inner width (852px), to be dropped inside a .figure.
 *
 * THE DRAWING RULES, which are the site's colour rules applied to a figure:
 *
 *   structure    lineStrong, 1.5px to 2px. Boxes, axes, ground symbols.
 *   the signal   gold, 3px. The path the guitar takes, and nothing else.
 *   the point    LED green, 3.5px. The one thing the slide is about. Never two.
 *   labels       Jost, dim for structure and text for anything load bearing.
 *
 * A figure with two green things has no point, which is the same failure as a
 * toolbar of eight gold rings.
 */

import { COLOR } from "./tokens.mjs"

const W = 852
const S = COLOR.lineStrong
const G = COLOR.gold
const L = COLOR.led
const D = COLOR.dim

function svg(h, body) {
  return `<svg viewBox="0 0 ${W} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${body}</svg>`
}

/**
 * SVG text does not wrap, so a label longer than the viewBox is silently cut
 * off at the edge. That shipped: four slides went out with half a sentence
 * sliced off the side, and it is invisible in the source because the string
 * looks fine.
 *
 * So the width is estimated and an overflow throws. The estimate is deliberately
 * a slight underestimate, so it catches real overflows rather than bickering
 * about borderline ones. When it fires, the answer is almost always to move the
 * sentence into the slide's `body`, where CSS wraps it for free, and leave the
 * figure with a short tag.
 */
function label(x, y, text, opts = {}) {
  const { size = 24, fill = D, weight = 600, anchor = "middle", spacing = "0.08em" } = opts

  const em = Number.parseFloat(spacing) || 0
  const est = text.length * size * 0.52 + text.length * em * size
  const min = anchor === "start" ? x : anchor === "end" ? x - est : x - est / 2
  const max = anchor === "start" ? x + est : anchor === "end" ? x : x + est / 2
  if (min < 4 || max > W - 4) {
    throw new Error(
      `Label overflows the ${W}px figure: ${JSON.stringify(text)} at x=${x} (${anchor}) ` +
        `spans ${Math.round(min)} to ${Math.round(max)}. Shorten it, or move the sentence ` +
        `into the slide body where it wraps.`,
    )
  }

  return `<text x="${x}" y="${y}" font-family="Jost, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${text}</text>`
}

/** Heavy condensed uppercase, the kicker voice, for labelling half a figure. */
function tag(x, y, text, opts = {}) {
  return label(x, y, text.toUpperCase(), { size: 22, weight: 900, spacing: "0.15em", ...opts })
}

function line(x1, y1, x2, y2, stroke = S, width = 2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`
}

/** A cable. Gold, because it is carrying the signal. */
function cable(x1, y1, x2, y2) {
  return line(x1, y1, x2, y2, G, 3)
}

function ground(x, y) {
  return [line(x, y, x, y + 16), line(x - 17, y + 16, x + 17, y + 16), line(x - 11, y + 23, x + 11, y + 23), line(x - 5, y + 30, x + 5, y + 30)].join("")
}

/** One diode. `dir` is 1 for anode-to-cathode left to right, -1 for the reverse. */
function diodeH(cx, cy, dir) {
  const s = 12
  return (
    `<path d="M ${cx - s * dir} ${cy - s} L ${cx + s * dir} ${cy} L ${cx - s * dir} ${cy + s} Z" fill="none" stroke="${G}" stroke-width="2.6"/>` +
    line(cx + s * dir, cy - s - 1, cx + s * dir, cy + s + 1, G, 2.6)
  )
}

function diodeV(cx, cy, dir) {
  const s = 12
  return (
    `<path d="M ${cx - s} ${cy - s * dir} L ${cx} ${cy + s * dir} L ${cx + s} ${cy - s * dir} Z" fill="none" stroke="${G}" stroke-width="2.6"/>` +
    line(cx - s - 1, cy + s * dir, cx + s + 1, cy + s * dir, G, 2.6)
  )
}

/**
 * An antiparallel clipping pair, drawn as the two parallel branches it actually
 * is rather than as two diode glyphs sitting on one wire.
 *
 * The main run has to be BROKEN between xL and xR by the caller, because a wire
 * passing straight through the pair would short it out, and a reader who knows
 * that is exactly the reader worth keeping.
 */
function antiparallelH(xL, xR, y, spread = 26) {
  const yU = y - spread
  const yD = y + spread
  const mid = (xL + xR) / 2
  return [
    line(xR, y, xR, yU, G, 3), line(xR, y, xR, yD, G, 3),
    line(xL, y, xL, yU, G, 3), line(xL, y, xL, yD, G, 3),
    line(xL, yU, xR, yU, G, 3), line(xL, yD, xR, yD, G, 3),
    diodeH(mid, yU, -1),
    diodeH(mid, yD, 1),
  ].join("")
}

function antiparallelV(yT, yB, x, spread = 30) {
  const xL = x - spread
  const xR = x + spread
  const mid = (yT + yB) / 2
  return [
    line(x, yT, xL, yT, G, 3), line(x, yT, xR, yT, G, 3),
    line(x, yB, xL, yB, G, 3), line(x, yB, xR, yB, G, 3),
    line(xL, yT, xL, yB, G, 3), line(xR, yT, xR, yB, G, 3),
    diodeV(xL, mid, 1),
    diodeV(xR, mid, -1),
  ].join("")
}

function node(x, y) {
  return `<circle cx="${x}" cy="${y}" r="5.5" fill="${G}"/>`
}

/** An op-amp stage. The triangle everybody recognises. */
function opamp(x, y, w = 118, h = 108) {
  return `<path d="M ${x} ${y} L ${x + w} ${y + h / 2} L ${x} ${y + h} Z" fill="rgba(255,255,255,0.045)" stroke="${S}" stroke-width="2.2"/>`
}

/**
 * Waveform sampler.
 *
 * `shape` is what the stage did to it: a plain sine, a soft round-off, or a
 * hard square-off at the same threshold. Drawing all three from one function is
 * what keeps the soft and hard slides honestly comparable.
 */
function wave(x, y, w, h, cycles, shape, stroke = G, width = 3) {
  const pts = []
  const n = 260
  const thresh = 0.55
  for (let i = 0; i <= n; i++) {
    const p = i / n
    let v = Math.sin(p * cycles * Math.PI * 2)
    if (shape === "soft") v = Math.tanh(v * 2.1) / Math.tanh(2.1)
    else if (shape === "hard") v = Math.max(-thresh, Math.min(thresh, v * 1.9)) / thresh
    else if (shape === "folded") v = Math.abs(v)
    pts.push(`${(x + p * w).toFixed(1)} ${(y + h / 2 - (v * h) / 2).toFixed(1)}`)
  }
  return `<polyline points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`
}

/* ============================================================
   1. Clipping: where the diodes sit, and what comes out
   ============================================================ */

export function clipping(mode) {
  const soft = mode === "soft"
  const parts = []

  if (soft) {
    /*
     * The feedback loop sits well ABOVE the triangle and closes onto a node on
     * the input side. An earlier draft ran it around the triangle at close
     * quarters and the result read as a meaningless gold rectangle with a
     * triangle inside it, which is worse than no diagram.
     */
    const sy = 250
    const nodeIn = 272
    const tap = 540
    const loopY = 120
    parts.push(
      cable(30, sy, 300, sy),
      label(30, sy - 26, "IN", { anchor: "start", size: 22 }),
      opamp(300, sy - 60, 130, 120),
      cable(430, sy, 822, sy),
      label(822, sy - 26, "OUT", { anchor: "end", size: 22 }),
      // up from the output tap, back over the top, down to the summing node
      line(tap, sy, tap, loopY, G, 3),
      line(nodeIn, loopY, nodeIn, sy, G, 3),
      line(tap, loopY, 470, loopY, G, 3),
      line(380, loopY, nodeIn, loopY, G, 3),
      antiparallelH(380, 470, loopY),
      node(tap, sy),
      node(nodeIn, sy),
      `<rect x="336" y="66" width="178" height="108" rx="12" fill="none" stroke="${L}" stroke-width="3.5" stroke-dasharray="9 7"/>`,
      tag(425, 48, "inside the feedback loop", { fill: L }),
    )
  } else {
    const sy = 170
    const tap = 600
    parts.push(
      cable(30, sy, 300, sy),
      label(30, sy - 26, "IN", { anchor: "start", size: 22 }),
      opamp(300, sy - 60, 130, 120),
      cable(430, sy, 822, sy),
      label(822, sy - 26, "OUT", { anchor: "end", size: 22 }),
      // the pair hangs off the output and dumps to ground
      line(tap, sy, tap, 210, G, 3),
      antiparallelV(210, 300, tap),
      line(tap, 300, tap, 330, G, 3),
      node(tap, sy),
      ground(tap, 330),
      `<rect x="516" y="192" width="168" height="126" rx="12" fill="none" stroke="${L}" stroke-width="3.5" stroke-dasharray="9 7"/>`,
      // Left of the network, not above it: above it the signal line runs
      // straight through the words and strikes them out.
      tag(496, 262, "clipped to ground", { fill: L, anchor: "end" }),
    )
  }

  // The payoff: what the wave looks like coming out.
  const wy = soft ? 340 : 400
  parts.push(
    line(30, wy, W - 30, wy, "rgba(255,255,255,0.09)", 1.5),
    wave(330, wy + 24, 330, 112, 2, soft ? "soft" : "hard"),
    tag(160, wy + 84, soft ? "rounded off" : "squared off", { fill: G }),
  )

  return svg(soft ? 500 : 560, parts.join(""))
}

/* ============================================================
   2. Knobs
   ============================================================ */

/**
 * A knob, drawn as a knurled control rather than a circle with a line.
 *
 * `at` is clock position, 7 through 5 the way a pedal is described, so the call
 * site reads the way a player would say it out loud.
 */
function knob(cx, cy, r, at, text, opts = {}) {
  const { lit = false, sub } = opts
  // 7 o'clock is the floor of the sweep, 5 o'clock the ceiling: 270 degrees.
  const frac = ((at - 7 + 12) % 12) / 10
  const ang = (-135 + frac * 270) * (Math.PI / 180)
  const stroke = lit ? L : S
  const ticks = []
  for (let i = 0; i <= 10; i++) {
    const a = (-135 + (i / 10) * 270) * (Math.PI / 180)
    const r1 = r + 9
    const r2 = r + (i % 5 === 0 ? 20 : 15)
    ticks.push(
      line(
        cx + Math.sin(a) * r1, cy - Math.cos(a) * r1,
        cx + Math.sin(a) * r2, cy - Math.cos(a) * r2,
        "rgba(255,255,255,0.22)", 2,
      ),
    )
  }
  // Knurling: short radial strokes around the rim, which is what makes it metal.
  const knurl = []
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2
    knurl.push(
      line(
        cx + Math.sin(a) * (r - 7), cy - Math.cos(a) * (r - 7),
        cx + Math.sin(a) * r, cy - Math.cos(a) * r,
        "rgba(255,255,255,0.1)", 2,
      ),
    )
  }
  return [
    ...ticks,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#knobface)" stroke="${stroke}" stroke-width="2.6"/>`,
    ...knurl,
    line(cx + Math.sin(ang) * (r - 34), cy - Math.cos(ang) * (r - 34), cx + Math.sin(ang) * (r - 6), cy - Math.cos(ang) * (r - 6), lit ? L : COLOR.text, 5),
    label(cx, cy + r + 52, text, { size: 27, weight: 700, fill: lit ? L : COLOR.text, spacing: "0.1em" }),
    sub ? label(cx, cy + r + 84, sub, { size: 23, weight: 500 }) : "",
  ].join("")
}

const KNOB_DEFS = `<defs><radialGradient id="knobface" cx="42%" cy="30%" r="78%"><stop offset="0%" stop-color="${COLOR.knobHi}"/><stop offset="62%" stop-color="${COLOR.knob}"/><stop offset="100%" stop-color="${COLOR.knobLo}"/></radialGradient></defs>`

/** One big knob with a sweep arrow, for the reversed-Filter slide. */
export function reversedKnob() {
  const cx = W / 2
  const cy = 176
  const r = 108
  const arc = `<path d="M ${cx + 150} ${cy - 46} A 176 176 0 0 1 ${cx + 128} ${cy + 108}" fill="none" stroke="${L}" stroke-width="4" marker-end="url(#ah)"/>`
  return svg(
    400,
    KNOB_DEFS +
      `<defs><marker id="ah" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto"><path d="M 1 1 L 11 6 L 1 11 z" fill="${L}"/></marker></defs>` +
      knob(cx, cy, r, 12, "FILTER") +
      arc +
      tag(cx + 236, cy + 46, "darker", { fill: L, anchor: "start" }) +
      label(cx, 366, "clockwise rolls treble off", { size: 28, weight: 600, fill: COLOR.text }),
  )
}

/** A row of knobs at named settings. */
export function knobRow(items) {
  const gap = W / (items.length + 1)
  const r = items.length > 2 ? 74 : 92
  return svg(
    r * 2 + 140,
    KNOB_DEFS +
      items
        .map((it, i) => knob(gap * (i + 1), r + 22, r, it.at, it.name, { lit: it.lit, sub: it.sub }))
        .join(""),
  )
}

/* ============================================================
   3. Signal chains
   ============================================================ */

/**
 * Pedal blocks in a row, guitar to amp.
 *
 * `blocks` is a list of { name, lit, noise }. `noise` draws a hiss shape over
 * the block, sized by how much of it there is, which is the whole argument on
 * the noise gate slide.
 */
export function chainBlocks(blocks, opts = {}) {
  // The default has to clear the caption baseline. At 210 the caption was drawn
  // outside the viewBox and every one of them silently vanished.
  const { caption, height = 250 } = opts
  const n = blocks.length
  const pad = 24
  const bw = Math.min(176, (W - pad * 2 - (n - 1) * 30) / n)
  const gapx = (W - pad * 2 - n * bw) / (n - 1 || 1)
  const by = 56
  const bh = 108
  const parts = []

  blocks.forEach((b, i) => {
    const x = pad + i * (bw + gapx)
    const isEnd = b.end
    if (isEnd) {
      parts.push(
        label(x + bw / 2, by + bh / 2 + 10, b.name, { size: 27, weight: 700, fill: D, spacing: "0.04em" }),
      )
    } else {
      parts.push(
        `<rect x="${x}" y="${by}" width="${bw}" height="${bh}" rx="13" fill="url(#plateface)" stroke="${b.lit ? L : G}" stroke-width="${b.lit ? 3.2 : 2}"/>`,
        `<rect x="${x + 6}" y="${by + 6}" width="${bw - 12}" height="${bh - 12}" rx="8" fill="none" stroke="rgba(255,194,51,0.2)" stroke-width="1.2"/>`,
        `<circle cx="${x + bw / 2}" cy="${by + 22}" r="4.6" fill="${b.lit ? L : "rgba(36,224,122,0.3)"}"/>`,
      )
      // Names are short enough to sit on one or two lines; two is common.
      const words = b.name.split(" ")
      const lines = words.length > 1 && bw < 168 ? [words[0], words.slice(1).join(" ")] : [b.name]
      lines.forEach((ln, k) =>
        parts.push(
          label(x + bw / 2, by + 62 + k * 27 - (lines.length - 1) * 12, ln, {
            size: 24, weight: 700, fill: b.lit ? L : COLOR.text, spacing: "0.03em",
          }),
        ),
      )
    }
    if (i < n - 1) {
      const x2 = pad + (i + 1) * (bw + gapx)
      parts.push(cable(x + bw, by + bh / 2, x2, by + bh / 2))
    }
    if (b.noise) {
      // Hiss, drawn as jitter. Amplitude is the point being made.
      const amp = b.noise
      const pts = []
      for (let k = 0; k <= 46; k++) {
        const px = x + (k / 46) * bw
        const py = by - 26 - (Math.sin(k * 2.7) * amp + Math.sin(k * 5.3) * amp * 0.6)
        pts.push(`${px.toFixed(1)} ${py.toFixed(1)}`)
      }
      parts.push(
        `<polyline points="${pts.join(" ")}" fill="none" stroke="${COLOR.red}" stroke-width="2.4" stroke-linejoin="round"/>`,
      )
    }
  })

  if (caption) parts.push(label(W / 2, by + bh + 52, caption, { size: 26, weight: 600 }))

  return svg(
    height,
    // Palette-driven, not hardcoded. These were graphite hex and stayed grey
    // when the palette moved, so the pedals on the board no longer matched the
    // board they were standing on.
    `<defs><linearGradient id="plateface" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${COLOR.plateHi}"/><stop offset="40%" stop-color="${COLOR.plate}"/><stop offset="100%" stop-color="${COLOR.plateLo}"/></linearGradient></defs>` +
      parts.join(""),
  )
}

/** Two chains stacked, for an A against B comparison. */
export function chainCompare(a, b) {
  const one = chainBlocks(a.blocks, { caption: a.caption, height: 196 })
  const two = chainBlocks(b.blocks, { caption: b.caption, height: 196 })
  return `<div style="display:flex;flex-direction:column;gap:22px">
    <div><div style="font-family:Jost,sans-serif;font-weight:900;font-size:22px;letter-spacing:.15em;color:${G};margin-bottom:4px">${a.label.toUpperCase()}</div>${one}</div>
    <div><div style="font-family:Jost,sans-serif;font-weight:900;font-size:22px;letter-spacing:.15em;color:${G};margin-bottom:4px">${b.label.toUpperCase()}</div>${two}</div>
  </div>`
}

/* ============================================================
   4. Frequency response curves
   ============================================================ */

function axes(h, opts = {}) {
  const { lowLabel = "LOW", highLabel = "HIGH" } = opts
  return [
    line(58, h - 46, W - 30, h - 46, "rgba(255,255,255,0.16)", 1.5),
    line(58, 16, 58, h - 46, "rgba(255,255,255,0.16)", 1.5),
    label(64, h - 16, lowLabel, { size: 20, anchor: "start", spacing: "0.14em" }),
    label(W - 34, h - 16, highLabel, { size: 20, anchor: "end", spacing: "0.14em" }),
  ].join("")
}

function curve(fn, h, stroke = G, width = 3.4) {
  const pts = []
  for (let i = 0; i <= 240; i++) {
    const p = i / 240
    const v = fn(p) // 0 at floor, 1 at ceiling
    pts.push(`${(58 + p * (W - 92)).toFixed(1)} ${(h - 46 - v * (h - 78)).toFixed(1)}`)
  }
  return `<polyline points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`
}

/** A mid scoop, the Big Muff tone stack at noon. */
export function midScoop() {
  const h = 340
  const f = (p) => 0.78 - 0.62 * Math.exp(-Math.pow((p - 0.46) / 0.17, 2))
  const dipX = 58 + 0.46 * (W - 92)
  return svg(
    h,
    axes(h) +
      curve(f, h) +
      line(dipX, h - 46 - 0.16 * (h - 78), dipX, 44, L, 3, "") +
      `<circle cx="${dipX}" cy="${h - 46 - 0.16 * (h - 78)}" r="7" fill="${L}"/>` +
      tag(dipX, 32, "the hole", { fill: L }) +
      label(dipX + 132, h - 118, "a vocal and a snare", { size: 23, anchor: "start", weight: 600 }),
  )
}

/** Phaser notches, shallow or deep, which is the Color switch. */
export function notches(deep) {
  const h = 320
  const d = deep ? 0.66 : 0.3
  const f = (p) =>
    0.72 -
    d * Math.exp(-Math.pow((p - 0.31) / 0.055, 2)) -
    d * Math.exp(-Math.pow((p - 0.68) / 0.075, 2)) +
    (deep ? 0.16 * Math.exp(-Math.pow((p - 0.5) / 0.09, 2)) : 0)
  return svg(
    h,
    axes(h) +
      curve(f, h, deep ? L : G) +
      tag(W / 2, 30, deep ? "colour on: deeper, and a peak between" : "colour off: two shallow notches", {
        fill: deep ? L : G,
      }),
  )
}

/** A resonant bandpass at three treadle positions: one shape, moved. */
export function bandpassSweep() {
  const h = 336
  const peaks = [0.2, 0.45, 0.74]
  const body = peaks
    .map((c, i) =>
      curve((p) => 0.14 + 0.74 * Math.exp(-Math.pow((p - c) / 0.072, 2)), h, i === 1 ? L : "rgba(255,194,51,0.5)", i === 1 ? 3.6 : 2.6),
    )
    .join("")
  return svg(
    h,
    axes(h, { lowLabel: "400 Hz", highLabel: "2 kHz" }) +
      body +
      // No sentence along the bottom: the axis ticks already live on that
      // baseline and the two sat on top of each other.
      tag(W / 2, 28, "the same curve, moved", { fill: L }),
  )
}

/** The DS-1's single tone sweep: one control between two filters. */
export function toneSweep() {
  const h = 330
  const dark = (p) => 0.72 - 0.5 / (1 + Math.exp(-(0.34 - p) * 14)) * -1 - 0.62 * (1 / (1 + Math.exp(-(p - 0.4) * 12)))
  const bright = (p) => 0.16 + 0.62 * (1 / (1 + Math.exp(-(p - 0.44) * 12)))
  return svg(
    h,
    axes(h) +
      curve((p) => Math.max(0.06, dark(p)), h, "rgba(255,194,51,0.55)", 2.8) +
      curve(bright, h, "rgba(255,194,51,0.55)", 2.8) +
      curve((p) => 0.42 - 0.2 * Math.exp(-Math.pow((p - 0.45) / 0.13, 2)), h, L, 3.4) +
      tag(150, 34, "dark end", { fill: D }) +
      tag(W - 150, 34, "bright end", { fill: D }) +
      tag(W / 2, 64, "one sweep between them", { fill: L }),
  )
}

/* ============================================================
   5. Delay repeats
   ============================================================ */

/** Five repeats. `darkening` also loses top end, which is the whole comparison. */
export function repeats(darkening) {
  const h = 300
  const parts = [line(40, h - 58, W - 40, h - 58, "rgba(255,255,255,0.12)", 1.5)]
  const n = 6
  for (let i = 0; i < n; i++) {
    const x = 52 + i * 134
    const amp = Math.pow(0.68, i)
    // Darkening is drawn as the wave losing its cycles, which is what losing
    // high end looks like on a waveform.
    const cycles = darkening ? Math.max(1, 4 - i * 0.62) : 4
    const op = darkening ? Math.max(0.28, 1 - i * 0.15) : 1
    parts.push(
      `<g opacity="${op.toFixed(2)}">${wave(x, h - 58 - (amp * 150) / 2, 112, amp * 150, cycles, "sine", i === 0 ? COLOR.text : G, 2.8)}</g>`,
    )
    parts.push(label(x + 56, h - 26, i === 0 ? "dry" : `${i}`, { size: 21, weight: 700, fill: i === 0 ? COLOR.text : D }))
  }
  parts.push(
    tag(W / 2, 26, darkening ? "each repeat darker than the last" : "the tenth carries what the first did", {
      fill: darkening ? G : L,
    }),
  )
  return svg(h, parts.join(""))
}

/* ============================================================
   6. Voltage rails: the charge pump argument
   ============================================================ */

export function rails() {
  const h = 400
  /*
   * The rails are the point, so they are drawn as hard lines the wave either
   * fits inside or flattens against. The labels sit clear of the wave rather
   * than over it: the first draft put the tag inside the rails and the red text
   * landed on top of the clipped waveform it was describing.
   */
  const box = (x, w, top, bot, name, tall) => {
    const mid = (top + bot) / 2
    const hue = tall ? L : COLOR.red
    return [
      line(x, top, x + w, top, hue, 3),
      line(x, bot, x + w, bot, hue, 3),
      wave(x + 16, mid - 72, w - 32, 144, 1.6, tall ? "sine" : "hard", G, 3),
      tag(x + w / 2, top - 22, tall ? "room to swing" : "ran out of room", { fill: hue }),
      label(x + w / 2, bot + 46, name, { size: 25, weight: 700, fill: tall ? L : COLOR.text }),
    ].join("")
  }
  return svg(
    h,
    box(64, 328, 168, 288, "9V supply", false) + box(464, 328, 96, 336, "after the charge pump", true),
  )
}

/* ============================================================
   7. Rectification: where the octave comes from
   ============================================================ */

export function rectify() {
  const h = 320
  const panes = [
    { t: "the note", shape: "sine", cycles: 2 },
    { t: "folded up", shape: "folded", cycles: 2 },
    { t: "twice the peaks", shape: "folded", cycles: 2, lit: true },
  ]
  const parts = []
  panes.forEach((p, i) => {
    const x = 20 + i * 278
    parts.push(
      `<rect x="${x}" y="40" width="252" height="180" rx="14" fill="rgba(0,0,0,0.2)" stroke="${p.lit ? L : "rgba(255,255,255,0.1)"}" stroke-width="${p.lit ? 2.6 : 1.5}"/>`,
      line(x + 16, 130, x + 236, 130, "rgba(255,255,255,0.14)", 1.5),
      wave(x + 16, 60, 220, 140, p.cycles, p.shape, p.lit ? L : G, 3),
      label(x + 126, 258, p.t, { size: 24, weight: 700, fill: p.lit ? L : COLOR.text }),
    )
    if (i < 2) {
      parts.push(
        label(x + 264, 138, "›", { size: 46, fill: G, weight: 400 }),
      )
    }
  })
  parts.push(tag(W / 2, 300, "no pitch tracker anywhere in that", { fill: D }))
  return svg(h, parts.join(""))
}

/* ============================================================
   8. Compression envelope
   ============================================================ */

export function envelope() {
  const h = 330
  const base = h - 60
  const uncomp = (p) => (p < 0.045 ? p / 0.045 : Math.exp(-(p - 0.045) * 4.2))
  const comp = (p) => (p < 0.09 ? (p / 0.09) * 0.56 : 0.56 * Math.exp(-(p - 0.09) * 1.5))
  const draw = (fn, stroke, width) => {
    const pts = []
    for (let i = 0; i <= 240; i++) {
      const p = i / 240
      pts.push(`${(58 + p * (W - 100)).toFixed(1)} ${(base - fn(p) * 216).toFixed(1)}`)
    }
    return `<polyline points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`
  }
  return svg(
    h,
    line(58, base, W - 34, base, "rgba(255,255,255,0.16)", 1.5) +
      draw(uncomp, "rgba(255,255,255,0.34)", 2.6) +
      draw(comp, L, 3.6) +
      label(214, 46, "how you picked it", { size: 22, weight: 600, fill: "rgba(255,255,255,0.5)" }) +
      tag(470, base - 92, "attack flattened", { fill: L, anchor: "start" }) +
      tag(470, base - 52, "tail lifted", { fill: L, anchor: "start" }) +
      label(W / 2, h - 14, "and the noise floor comes up with the tail", { size: 23, weight: 600 }),
  )
}

/* ============================================================
   9. The Uni-Vibe: a lamp, and stages that do not match
   ============================================================ */

export function lampVibe() {
  const h = 380
  const parts = []
  // The lamp, and the light on the cells. The lamp is the only lit thing.
  parts.push(
    `<circle cx="110" cy="118" r="34" fill="rgba(36,224,122,0.14)" stroke="${L}" stroke-width="3"/>`,
    `<circle cx="110" cy="118" r="13" fill="${L}"/>`,
    label(110, 196, "lamp", { size: 24, weight: 700, fill: L }),
    label(110, 226, "thermal lag", { size: 21, weight: 500 }),
  )
  for (let i = 0; i < 4; i++) {
    const a = -0.5 + i * 0.33
    parts.push(line(110 + Math.cos(a) * 44, 118 + Math.sin(a) * 44, 110 + Math.cos(a) * 96, 118 + Math.sin(a) * 96, "rgba(36,224,122,0.4)", 2))
  }
  // Four stages, deliberately different sizes: the parts are not matched.
  const sizes = [96, 78, 108, 86]
  sizes.forEach((s, i) => {
    const x = 262 + i * 148
    const y = 118 - s / 2
    parts.push(
      `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="10" fill="rgba(255,255,255,0.04)" stroke="${S}" stroke-width="2"/>`,
      label(x + s / 2, 118 + 6, `${i + 1}`, { size: 26, weight: 900, fill: D, spacing: "0" }),
      `<circle cx="${x - 26}" cy="118" r="5" fill="rgba(36,224,122,0.5)"/>`,
    )
  })
  parts.push(tag(560, 232, "four stages, none of them matched", { fill: G }))
  // The modulation shape: lopsided rather than a clean sine.
  const pts = []
  for (let i = 0; i <= 240; i++) {
    const p = i / 240
    const v = Math.sin(p * Math.PI * 4 + Math.sin(p * Math.PI * 4) * 0.8)
    pts.push(`${(40 + p * (W - 80)).toFixed(1)} ${(320 - v * 44).toFixed(1)}`)
  }
  parts.push(
    `<polyline points="${pts.join(" ")}" fill="none" stroke="${L}" stroke-width="3.4" stroke-linejoin="round"/>`,
    tag(W / 2, h - 8, "heavier on one side than the other", { fill: L }),
  )
  return svg(h, parts.join(""))
}

/* ============================================================
   10. Chorus and vibrato: one mixer, one input removed
   ============================================================ */

export function mixer(dryCrossed) {
  const h = 330
  const mx = 560
  const my = 150
  const parts = [
    // dry path
    cable(40, 78, mx - 60, 78),
    label(40, 54, "DRY", { anchor: "start", size: 23, weight: 700, fill: dryCrossed ? COLOR.red : COLOR.text }),
    // delayed path
    cable(40, 222, 250, 222),
    `<rect x="250" y="182" width="188" height="80" rx="12" fill="rgba(255,255,255,0.04)" stroke="${S}" stroke-width="2"/>`,
    label(344, 230, "BBD, wobbling", { size: 23, weight: 700, fill: COLOR.text }),
    cable(438, 222, mx - 60, 222),
    // the mixer
    `<path d="M ${mx - 60} 40 L ${mx + 40} 116 L ${mx + 40} 184 L ${mx - 60} 260 Z" fill="rgba(255,255,255,0.045)" stroke="${S}" stroke-width="2.2"/>`,
    label(mx - 10, 156, "MIX", { size: 22, weight: 700, fill: D }),
    cable(mx + 40, 150, W - 40, 150),
    label(W - 40, 126, "OUT", { anchor: "end", size: 22 }),
  ]
  if (dryCrossed) {
    parts.push(
      line(210, 42, 300, 114, COLOR.red, 4),
      line(300, 42, 210, 114, COLOR.red, 4),
      tag(mx + 60, 300, "no dry signal left", { fill: L }),
    )
  } else {
    parts.push(tag(mx + 60, 300, "the wobble beats the original", { fill: L }))
  }
  return svg(h, parts.join(""))
}

/* ============================================================
   11. The room, and what happens when you reverse it
   ============================================================ */

export function room(reversed) {
  const h = 340
  const parts = []
  if (!reversed) {
    // One room, everything inside it.
    parts.push(
      `<rect x="60" y="40" width="${W - 120}" height="216" rx="18" fill="rgba(36,224,122,0.06)" stroke="${L}" stroke-width="3"/>`,
      tag(W / 2, 26, "one room", { fill: L }),
    )
    for (let i = 0; i < 5; i++) {
      const x = 130 + i * 138
      const amp = Math.pow(0.7, i)
      parts.push(wave(x, 148 - (amp * 120) / 2, 96, amp * 120, 2, "sine", i === 0 ? COLOR.text : G, 2.8))
    }
    parts.push(tag(W / 2, 300, "every repeat in the same space", { fill: L }))
  } else {
    // The room itself repeated, which never happens.
    for (let i = 0; i < 4; i++) {
      const x = 52 + i * 200
      const op = Math.pow(0.68, i)
      parts.push(
        `<g opacity="${op.toFixed(2)}"><rect x="${x}" y="60" width="164" height="160" rx="14" fill="rgba(255,90,82,0.06)" stroke="${COLOR.red}" stroke-width="2.6"/>${wave(x + 26, 106, 112, 68, 2, "sine", G, 2.6)}</g>`,
      )
    }
    parts.push(
      tag(W / 2, 40, "the room, repeated", { fill: COLOR.red }),
      tag(W / 2, 292, "which never happens acoustically", { fill: COLOR.red }),
    )
  }
  return svg(h, parts.join(""))
}

/* ============================================================
   12. Guitar volume, for the fuzz slide
   ============================================================ */

/**
 * The guitar's own volume control, rolled back, which is the whole test.
 *
 * An earlier draft set the instruction as four lines of text beside the knob
 * and two of them ran off the edge. The instruction is prose, so it lives in
 * the slide body now and this draws the control and nothing else.
 */
export function guitarVolume() {
  return svg(
    340,
    KNOB_DEFS +
      knob(W / 2, 150, 108, 10, "GUITAR VOLUME", { lit: true }) +
      tag(W / 2, 316, "roll it back", { fill: L, size: 26 }),
  )
}
