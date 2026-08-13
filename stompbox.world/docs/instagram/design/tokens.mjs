/**
 * The social visual system: tokens, and the CSS every slide is built on.
 *
 * This is the site's design system at feed scale, not a second design system.
 * Colours are lifted verbatim from app/globals.css. What changes is the type
 * scale (a slide gets about one second, a page gets a reader) and the canvas,
 * which is fixed at 1080x1350 rather than fluid.
 *
 * WHY BRAND GOLD AND LED GREEN CARRY PROSE HERE, when globals.css says they
 * must not. That rule exists because those two hues fail contrast on the light
 * theme's paper: gold is about 1.8:1 on white. Every slide in this system is
 * dark by construction, and on the plate colour they measure 9.0:1 (gold) and
 * 8.3:1 (LED). The rule is about the background, and the background is fixed
 * here, so the reason for it does not reach. See design/README.md.
 */

export const CANVAS = { w: 1080, h: 1350 }

export const COLOR = {
  // Straight from :root in app/globals.css.
  bg: "#2a3136",
  plate: "#232a2f",
  plateLo: "#171c20",
  plateHi: "#3d454c",
  gold: "#ffc233",
  goldDk: "#d99a12",
  led: "#24e07a",
  ledDk: "#12b45e",
  text: "#f2f5f7",
  dim: "#aab4bd",
  line: "#4b555d",
  lineStrong: "#636e77",
  red: "#ff5a52",
}

export const FONT = {
  display: "'Fraunces', Georgia, serif",
  sans: "'Jost', -apple-system, 'Segoe UI', sans-serif",
}

/**
 * The plate inset, and the reason it is not symmetrical.
 *
 * Instagram crops nothing off a 4:5 post, but it lays its own UI over the
 * bottom of a feed item and the caption sits directly under it. So the plate
 * carries more room at the bottom than the top, and the footer line lives
 * inside that extra room rather than fighting it.
 */
export const PLATE = { x: 48, top: 48, bottom: 48, radius: 26 }

/**
 * Font files, base64 inlined by build.mjs.
 *
 * Both are variable fonts, so one file per family covers every weight this
 * system uses and `font-weight: 100 900` on the face is what unlocks them.
 * Jost and Fraunces are both SIL Open Font License, which is what makes
 * committing them here allowed rather than merely convenient.
 */
export const FONT_FILES = [
  { family: "Jost", file: "jost-latin.woff2" },
  { family: "Fraunces", file: "fraunces-latin.woff2" },
]

/**
 * Everything below is one stylesheet, shared by all 85 slides.
 *
 * Sizes are absolute pixels rather than rem or a fluid clamp, because the
 * canvas never changes size. A slide is a poster, not a page.
 */
export function css(fontFaces) {
  return `
${fontFaces}

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: ${CANVAS.w}px;
  height: ${CANVAS.h}px;
  overflow: hidden;
  background: ${COLOR.bg};
}

/*
 * The ground. A studio seamless, lit rather than switched off, with the same
 * crosshatch texture the site puts on its panels at the same low opacity. It
 * is invisible as a texture and it stops 1080x1350 of flat hex reading as a
 * default background.
 */
.slide {
  position: relative;
  width: ${CANVAS.w}px;
  height: ${CANVAS.h}px;
  background-color: ${COLOR.bg};
  background-image:
    radial-gradient(120% 80% at 50% 0%, rgba(255, 194, 51, 0.055), transparent 60%),
    radial-gradient(100% 70% at 50% 100%, rgba(36, 224, 122, 0.032), transparent 60%),
    repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(-45deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 4px);
  font-family: ${FONT.sans};
  color: ${COLOR.text};
}

/*
 * The enclosure. One hairline brass border and one silkscreen line inside it,
 * exactly as a pedal is printed and exactly what components/ui/stomp.tsx does.
 * The gradient runs light at the top to dark at the bottom, which is the whole
 * reason it reads as a machined object rather than a rectangle.
 */
.plate {
  position: absolute;
  left: ${PLATE.x}px;
  right: ${PLATE.x}px;
  top: ${PLATE.top}px;
  bottom: ${PLATE.bottom}px;
  border-radius: ${PLATE.radius}px;
  border: 2px solid ${COLOR.gold};
  background: linear-gradient(180deg, ${COLOR.plateHi} -40%, ${COLOR.plate} 34%, ${COLOR.plateLo} 128%);
  box-shadow: 0 18px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  padding: 74px 66px 0 66px;
}

/* The silkscreen line. Low opacity gold, inset, and it never touches the border. */
.plate::before {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: ${PLATE.radius - 7}px;
  border: 1.5px solid rgba(255, 194, 51, 0.26);
  pointer-events: none;
}

.body-area { flex: 1; display: flex; flex-direction: column; min-height: 0; }

/* Vertically centred, for a statement slide with nothing else on it. */
.body-area.centre { justify-content: center; }

/* ---------- type ---------- */

/*
 * The hook. Fraunces 900, and large enough to be read at the size a feed
 * actually renders rather than the size this file is previewed at.
 */
.hook {
  font-family: ${FONT.display};
  font-weight: 900;
  font-size: 92px;
  line-height: 1.04;
  letter-spacing: -0.02em;
  color: ${COLOR.text};
}
.hook.small { font-size: 74px; }
.hook.tiny { font-size: 62px; }

/* The heading on a mechanism slide, under the kicker. */
.heading {
  font-family: ${FONT.display};
  font-weight: 900;
  font-size: 58px;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

/*
 * The kicker. Heavy condensed uppercase, the same voice the site's rack panel
 * uses. Gold, because a label is an edge case of an edge: it outlines what the
 * slide is about without filling anything.
 */
.kicker {
  font-family: ${FONT.sans};
  font-weight: 900;
  font-size: 29px;
  text-transform: uppercase;
  letter-spacing: 0.19em;
  color: ${COLOR.gold};
  margin-bottom: 26px;
}
.kicker.led { color: ${COLOR.led}; }

.body {
  font-family: ${FONT.sans};
  font-weight: 400;
  font-size: 37px;
  line-height: 1.44;
  color: ${COLOR.text};
}
.body.dim { color: ${COLOR.dim}; }
.body + .body { margin-top: 26px; }

/* The one lit thing. Used for the answer, never for decoration. */
.lit { color: ${COLOR.led}; font-weight: 500; }
.brass { color: ${COLOR.gold}; font-weight: 500; }

/* A hairline rule, gold, muted. Separates a hook from what follows it. */
.rule {
  height: 2px;
  background: linear-gradient(90deg, ${COLOR.gold}, rgba(255,194,51,0.08));
  border: 0;
  margin: 34px 0;
  flex: none;
}

/* ---------- the numbered reference list, for the chain slide ---------- */

.order { display: flex; flex-direction: column; gap: 0; }
.order-row {
  display: flex;
  align-items: baseline;
  gap: 22px;
  padding: 11px 0;
  border-bottom: 1.5px solid rgba(255,255,255,0.07);
}
.order-row:last-child { border-bottom: 0; }
.order-n {
  font-family: ${FONT.sans};
  font-weight: 900;
  font-size: 25px;
  color: ${COLOR.goldDk};
  min-width: 46px;
  letter-spacing: 0.06em;
}
.order-name { font-family: ${FONT.sans}; font-weight: 500; font-size: 39px; }
.order-row.muted .order-name { color: ${COLOR.dim}; }
.order-row.on .order-name { color: ${COLOR.led}; font-weight: 700; }
.order-row.on .order-n { color: ${COLOR.led}; }
/* The ends of the chain, which are not pedals and should not read as numbered. */
.order-row.end .order-name {
  font-family: ${FONT.display};
  font-weight: 900;
  font-size: 33px;
  color: ${COLOR.dim};
  letter-spacing: 0.02em;
}

/* ---------- two panel compare ---------- */

.compare { display: flex; flex-direction: column; gap: 30px; }
.pane {
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 30px 32px;
  background: rgba(0,0,0,0.16);
}
.pane-label {
  font-family: ${FONT.sans};
  font-weight: 900;
  font-size: 25px;
  text-transform: uppercase;
  letter-spacing: 0.17em;
  color: ${COLOR.gold};
  margin-bottom: 16px;
}
.pane .body { font-size: 33px; line-height: 1.4; }

/* ---------- diagram box ---------- */

.figure { margin: 8px 0 4px; flex: none; }
.figure svg { display: block; width: 100%; height: auto; }
.caption {
  font-family: ${FONT.sans};
  font-weight: 500;
  font-size: 27px;
  color: ${COLOR.dim};
  margin-top: 18px;
  letter-spacing: 0.01em;
}

/* ---------- the footer that runs on every slide ---------- */

.foot {
  flex: none;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1.5px solid rgba(255,255,255,0.08);
  margin-top: 22px;
}
.foot .who {
  display: flex;
  align-items: center;
  gap: 15px;
  font-family: ${FONT.sans};
  font-weight: 600;
  font-size: 27px;
  color: ${COLOR.dim};
  letter-spacing: 0.03em;
}
/* The LED, at the size it is on the mark. It is the only lit thing down here. */
.foot .led {
  width: 13px; height: 13px; border-radius: 50%;
  background: ${COLOR.led};
  box-shadow: 0 0 12px rgba(36,224,122,0.55);
  flex: none;
}
.foot .num {
  font-family: ${FONT.sans};
  font-weight: 700;
  font-size: 25px;
  color: ${COLOR.dim};
  letter-spacing: 0.12em;
}
`
}
