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

/**
 * The palette is switchable, because the feed and the website do not have to
 * agree and now deliberately do not.
 *
 * `graphite` is the website's own system, lifted from app/globals.css. It is
 * kept rather than deleted: the site still looks like that, and a slide made
 * for a page rather than a feed should still be able to match it.
 *
 * `sapphire` is what the account uses. It is the same design in a different
 * enclosure colour, which is a real thing a pedal is: a candy blue box with a
 * brass silkscreen on it. Everything structural is unchanged, so nothing about
 * the diagrams or the layout knows which palette it is drawing in.
 *
 * Switch with PALETTE=graphite node build.mjs, or edit ACTIVE below.
 */
export const PALETTES = {
  graphite: {
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
    wash1: "rgba(255, 194, 51, 0.055)",
    wash2: "rgba(36, 224, 122, 0.032)",
    /*
     * A KNOB IS DARK ON ANY ENCLOSURE. Deliberately identical across palettes,
     * which is the site's own "metal is a dark object whatever it is standing
     * on" rule applied correctly rather than dropped. Real blue pedals have
     * black knobs, and a blue knob on a blue plate loses its edge entirely.
     */
    knobHi: "#3d454c",
    knob: "#232a2f",
    knobLo: "#141a1e",
  },

  /*
   * Jewel blue. The ground is deep enough that brass still reads as brass on
   * it rather than as mustard, and the plate is the saturated one, so the
   * enclosure is the jewel and the surface it stands on is not competing.
   *
   * The LED stays green. It is the one colour in this system that means
   * something (this is the bit to notice), and a blue-on-blue accent would
   * stop meaning it. Green on deep blue is also the highest-contrast pairing
   * available here, at 9.4:1 on the plate.
   */
  sapphire: {
    bg: "#0b1b33",
    plate: "#123a6b",
    plateLo: "#081428",
    plateHi: "#1e5aa8",
    gold: "#ffc233",
    goldDk: "#e0a51f",
    led: "#24e07a",
    ledDk: "#12b45e",
    text: "#f2f7fd",
    dim: "#a8c0dd",
    line: "#2d4a72",
    lineStrong: "#5b82b8",
    red: "#ff6b61",
    wash1: "rgba(255, 194, 51, 0.06)",
    wash2: "rgba(36, 224, 122, 0.03)",
    /*
     * A KNOB IS DARK ON ANY ENCLOSURE. Deliberately identical across palettes,
     * which is the site's own "metal is a dark object whatever it is standing
     * on" rule applied correctly rather than dropped. Real blue pedals have
     * black knobs, and a blue knob on a blue plate loses its edge entirely.
     */
    knobHi: "#3d454c",
    knob: "#232a2f",
    knobLo: "#141a1e",
  },

  /* Candidates rendered for the owner to choose between. See design/README.md. */
  electric: {
    bg: "#08213f", plate: "#1560bd", plateLo: "#0a2b52", plateHi: "#2f86e8",
    gold: "#ffc233", goldDk: "#e0a51f", led: "#24e07a", ledDk: "#12b45e",
    text: "#f4f9ff", dim: "#b4cde8", line: "#2f5f96", lineStrong: "#6fa3d8",
    red: "#ff6b61",
    wash1: "rgba(255, 194, 51, 0.06)", wash2: "rgba(36, 224, 122, 0.03)",
    knobHi: "#3d454c", knob: "#232a2f", knobLo: "#141a1e",
  },
  royal: {
    bg: "#070f2b", plate: "#1e2f7a", plateLo: "#060b1f", plateHi: "#3a51b8",
    gold: "#ffc233", goldDk: "#e0a51f", led: "#24e07a", ledDk: "#12b45e",
    text: "#f3f4fd", dim: "#aeb6e0", line: "#33407f", lineStrong: "#6470bd",
    red: "#ff6b61",
    wash1: "rgba(255, 194, 51, 0.06)", wash2: "rgba(36, 224, 122, 0.03)",
    knobHi: "#3d454c", knob: "#232a2f", knobLo: "#141a1e",
  },

  /*
   * MIDNIGHT: the blend of royal and sapphire the owner asked for, plus the
   * thing the account's own artwork actually does, which neither candidate had.
   *
   * The reference is not a flat colour. It is a RADIAL GLOW: a saturated blue
   * centre falling off to near-black at the edges, so the artwork sits in a
   * pool of light rather than on a painted panel. `glow` carries that, and the
   * ground token underneath it is nearly black rather than navy, because the
   * corners of the reference are almost unlit.
   */
  midnight: {
    bg: "#070c1c",
    plate: "#183573",
    plateLo: "#070f24",
    plateHi: "#2c56b0",
    gold: "#ffc233",
    goldDk: "#e0a51f",
    led: "#24e07a",
    ledDk: "#12b45e",
    text: "#f2f6fd",
    dim: "#abbbde",
    line: "#304578",
    lineStrong: "#5f79bb",
    red: "#ff6b61",
    wash1: "rgba(255, 194, 51, 0.05)",
    wash2: "rgba(36, 224, 122, 0.028)",
    knobHi: "#3d454c", knob: "#232a2f", knobLo: "#141a1e",
    glow: "radial-gradient(58% 42% at 50% 40%, rgba(43, 92, 226, 0.62) 0%, rgba(24, 53, 115, 0.34) 42%, transparent 72%)",
  },

  /*
   * The same, with the edge in WHITE instead of brass, because the account's
   * own mark and wordmark are white line art on the glow with no gold anywhere.
   * The LED stays green: it is still the only thing that means "lit".
   */
  midnightWhite: {
    bg: "#070c1c",
    plate: "#183573",
    plateLo: "#070f24",
    plateHi: "#2c56b0",
    /* gold is the SIGNAL colour and stays brass. chrome is the frame. */
    gold: "#ffc233",
    goldDk: "#e0a51f",
    chrome: "#ffffff",
    chromeDk: "#c3d2ee",
    led: "#24e07a",
    ledDk: "#12b45e",
    text: "#ffffff",
    dim: "#abbbde",
    line: "#304578",
    lineStrong: "#5f79bb",
    red: "#ff6b61",
    wash1: "rgba(255, 255, 255, 0.05)",
    wash2: "rgba(36, 224, 122, 0.026)",
    knobHi: "#3d454c", knob: "#232a2f", knobLo: "#141a1e",
    glow: "radial-gradient(58% 42% at 50% 40%, rgba(43, 92, 226, 0.62) 0%, rgba(24, 53, 115, 0.34) 42%, transparent 72%)",
  },
}

/*
 * CHROME AND SIGNAL ARE TWO DIFFERENT COLOURS, and separating them is the whole
 * reason this pair exists.
 *
 *   chrome  the frame: plate border, silkscreen, kickers, labels, pane titles
 *   gold    the SIGNAL: cables, diodes, waveforms, response curves
 *
 * They used to be one token, which meant matching the account's white line art
 * would have turned the guitar signal white as well, and the signal path being
 * the one gold thing in a drawing is what makes the drawings readable.
 *
 * A palette that does not set chrome gets its own gold, so every palette written
 * before the split behaves exactly as it did.
 */
for (const p of Object.values(PALETTES)) {
  p.chrome = p.chrome ?? p.gold
  p.chromeDk = p.chromeDk ?? p.goldDk
}

const ACTIVE = process.env.PALETTE || "midnightWhite"
if (!PALETTES[ACTIVE]) {
  throw new Error(`Unknown PALETTE ${ACTIVE}. Pick one of: ${Object.keys(PALETTES).join(", ")}`)
}

export const PALETTE_NAME = ACTIVE
export const COLOR = PALETTES[ACTIVE]

/*
 * The display face is BLOCKY, not the site's serif.
 *
 * The account's wordmark is heavy angular capitals with chamfered corners, so
 * the slides use a face from that family rather than the Fraunces the website
 * sets its headings in. The site and the feed are allowed to differ here: the
 * logo is the brand and the page is the writing, and the owner asked for the
 * feed to match the logo.
 *
 * Fraunces is kept and still loaded, because the order list's guitar and amp
 * rows use it to mark the ends of the chain as not-a-pedal.
 */
export const FONT = {
  display: "'Chakra Petch', 'Jost', sans-serif",
  serif: "'Fraunces', Georgia, serif",
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
  { family: "Chakra Petch", file: "chakra-latin.woff2" },
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
  /*
   * NO CROSSHATCH ON A GLOW PALETTE, for two reasons that happen to agree. The
   * reference is a smooth pool of light and the weave fights it. And a 1px
   * diagonal pattern across 1080x1350 is high-frequency noise that PNG cannot
   * predict: it was most of an 870KB slide, and dropping it took the 85 slides
   * from 76MB to a size that fits in one upload.
   */
  background-image:
    ${COLOR.glow
      ? COLOR.glow
      : `radial-gradient(120% 80% at 50% 0%, ${COLOR.wash1}, transparent 60%),
    radial-gradient(100% 70% at 50% 100%, ${COLOR.wash2}, transparent 60%),
    repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(-45deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 4px)`};
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
  border: 2px solid ${COLOR.chrome};
  /* On a glow palette the plate is TRANSLUCENT, so the pool of light behind it
     reads through instead of being covered by a painted panel. That is what the
     account's own artwork does: the art sits in the light rather than on a box. */
  background: ${COLOR.glow
    ? `linear-gradient(180deg, color-mix(in srgb, ${COLOR.plateHi} 30%, transparent) -40%, color-mix(in srgb, ${COLOR.plate} 26%, transparent) 34%, color-mix(in srgb, ${COLOR.plateLo} 62%, transparent) 128%)`
    : `linear-gradient(180deg, ${COLOR.plateHi} -40%, ${COLOR.plate} 34%, ${COLOR.plateLo} 128%)`};
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
  border: 1.5px solid color-mix(in srgb, ${COLOR.chrome} 26%, transparent);
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
/*
 * Uppercase, because the face is a display cap face and sentence case wastes
 * it. Caps set visually larger at the same point size, so the size comes DOWN
 * from the serif's 92px rather than staying put.
 */
.hook {
  font-family: ${FONT.display};
  font-weight: 700;
  font-size: 68px;
  line-height: 1.08;
  letter-spacing: 0.005em;
  text-transform: uppercase;
  color: ${COLOR.text};
}
.hook.small { font-size: 56px; }
.hook.tiny { font-size: 48px; }

/* The heading on a mechanism slide, under the kicker. */
.heading {
  font-family: ${FONT.display};
  font-weight: 700;
  text-transform: uppercase;
  font-size: 46px;
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
  color: ${COLOR.chrome};
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
  background: linear-gradient(90deg, ${COLOR.chrome}, transparent);
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
  color: ${COLOR.chromeDk};
  min-width: 46px;
  letter-spacing: 0.06em;
}
.order-name { font-family: ${FONT.sans}; font-weight: 500; font-size: 39px; }
.order-row.muted .order-name { color: ${COLOR.dim}; }
.order-row.on .order-name { color: ${COLOR.led}; font-weight: 700; }
.order-row.on .order-n { color: ${COLOR.led}; }
/* The ends of the chain, which are not pedals and should not read as numbered. */
.order-row.end .order-name {
  font-family: ${FONT.serif};
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
  color: ${COLOR.chrome};
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