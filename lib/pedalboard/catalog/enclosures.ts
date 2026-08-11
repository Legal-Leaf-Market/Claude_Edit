import type { Enclosure, EnclosureId } from "./types"

/**
 * Standard enclosures.
 *
 * Most pedals ever made sit in one of about a dozen boxes. Hammond's die-cast
 * range (1590A through 1590XX) covers the boutique world almost entirely, and
 * the big manufacturers each have one or two house sizes they reuse across
 * decades: a Boss compact has had the same footprint since 1977.
 *
 * That is what makes a to-scale planner tractable without measuring ten
 * thousand pedals. A pedal whose enclosure is known has dimensions that are
 * known, marked `source: "enclosure"` rather than `"maker"` so the UI can be
 * honest that the figure came from the box rather than from a spec sheet. The
 * difference is a couple of millimetres of powder coat, which matters to
 * nobody, and saying so anyway costs nothing.
 *
 * It is also the answer to "my pedal isn't in your list". Picking 1590B off a
 * menu is faster than typing three numbers and is right far more often than a
 * guess, so the custom-pedal path leads with these.
 *
 * HEIGHTS INCLUDE KNOBS. The raw Hammond height is the box alone, which is not
 * the number that decides whether a case lid closes. Every height here is to
 * the top of typical hardware, which is why they run 15 to 20mm over the
 * castings' published figures.
 */
export const ENCLOSURES: Record<EnclosureId, Enclosure> = {
  "1590A": {
    id: "1590A",
    label: "Hammond 1590A (mini)",
    dims: { widthMm: 39, depthMm: 93, heightMm: 48, source: "enclosure" },
    examples: "Most mini pedals: Xotic, MXR Mini, Mooer, Wampler Tumnus",
  },
  "1590B": {
    id: "1590B",
    label: "Hammond 1590B (standard)",
    dims: { widthMm: 64, depthMm: 121, heightMm: 54, source: "enclosure" },
    examples: "The default boutique box: JHS, Walrus, Chase Bliss, Keeley",
  },
  "125B": {
    id: "125B",
    label: "Hammond 125B (tall standard)",
    dims: { widthMm: 66, depthMm: 121, heightMm: 58, source: "enclosure" },
    examples: "A 1590B with more room inside. Wampler, Earthquaker",
  },
  "1590BB": {
    id: "1590BB",
    label: "Hammond 1590BB (wide)",
    dims: { widthMm: 94, depthMm: 119, heightMm: 56, source: "enclosure" },
    examples: "Two-footswitch boutique pedals, bigger drives",
  },
  "1590XX": {
    id: "1590XX",
    label: "Hammond 1590XX (extra wide)",
    dims: { widthMm: 121, depthMm: 145, heightMm: 60, source: "enclosure" },
    examples: "Multi-footswitch and larger digital pedals",
  },
  "boss-compact": {
    id: "boss-compact",
    label: "Boss compact",
    dims: { widthMm: 73, depthMm: 129, heightMm: 59, source: "maker" },
    examples: "Every Boss compact since 1977, and the Ibanez TS shape is close",
  },
  "boss-200": {
    id: "boss-200",
    label: "Boss 200 series",
    dims: { widthMm: 101, depthMm: 138, heightMm: 63, source: "maker" },
    examples: "DD-200, RV-200, MD-200, EQ-200",
  },
  "boss-500": {
    id: "boss-500",
    label: "Boss 500 series",
    dims: { widthMm: 170, depthMm: 138, heightMm: 62, source: "maker" },
    examples: "DD-500, RV-500, MD-500",
  },
  "ehx-nano": {
    id: "ehx-nano",
    label: "Electro-Harmonix Nano",
    dims: { widthMm: 70, depthMm: 115, heightMm: 55, source: "enclosure" },
    examples: "Soul Food, Nano Big Muff, Small Clone",
  },
  "ehx-xo": {
    id: "ehx-xo",
    label: "Electro-Harmonix XO",
    dims: { widthMm: 89, depthMm: 121, heightMm: 54, source: "enclosure" },
    examples: "Micro POG, Holy Grail, Small Stone",
  },
  "ehx-large": {
    id: "ehx-large",
    label: "Electro-Harmonix large box",
    dims: { widthMm: 146, depthMm: 121, heightMm: 55, source: "enclosure" },
    examples: "Big Muff Pi, POG2. The famous board hog",
  },
  "mxr-compact": {
    id: "mxr-compact",
    label: "MXR compact",
    dims: { widthMm: 60, depthMm: 112, heightMm: 51, source: "enclosure" },
    examples: "Phase 90, Dyna Comp, Carbon Copy, Micro Amp",
  },
  "mxr-mini": {
    id: "mxr-mini",
    label: "MXR mini",
    dims: { widthMm: 42, depthMm: 93, heightMm: 48, source: "enclosure" },
    examples: "Phase 95, Sugar Drive, and the rest of the mini line",
  },
  "strymon-compact": {
    id: "strymon-compact",
    label: "Strymon compact",
    dims: { widthMm: 102, depthMm: 114, heightMm: 45, source: "maker" },
    examples: "El Capistan, Flint, blueSky, Deco, Sunset, Riverside",
  },
  "strymon-large": {
    id: "strymon-large",
    label: "Strymon large",
    dims: { widthMm: 171, depthMm: 133, heightMm: 46, source: "maker" },
    examples: "TimeLine, BigSky, Mobius, Volante",
  },
  "wah-treadle": {
    id: "wah-treadle",
    label: "Wah treadle",
    dims: { widthMm: 102, depthMm: 254, heightMm: 64, source: "enclosure" },
    examples: "Cry Baby, Vox V847, and everything shaped like them",
  },
  "volume-treadle": {
    id: "volume-treadle",
    label: "Volume treadle",
    dims: { widthMm: 95, depthMm: 254, heightMm: 64, source: "enclosure" },
    examples: "Ernie Ball VP Jr and similar",
  },
}

export const ENCLOSURE_LIST: Enclosure[] = Object.values(ENCLOSURES)

/**
 * Enclosures ordered smallest footprint first, which is the order the custom
 * pedal picker shows them in. Area rather than either dimension alone, since
 * "which of these is bigger" is genuinely ambiguous between a tall narrow box
 * and a short wide one.
 */
export const ENCLOSURES_BY_SIZE: Enclosure[] = [...ENCLOSURE_LIST].sort(
  (a, b) => a.dims.widthMm * a.dims.depthMm - b.dims.widthMm * b.dims.depthMm,
)
