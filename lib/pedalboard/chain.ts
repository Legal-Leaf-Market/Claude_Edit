/**
 * Signal-chain intelligence for the rig builder.
 *
 * The old builder placed pedals in a row and priced them. That is a shopping
 * list, and every free pedalboard planner already does it. What none of the
 * ones worth comparing against do (Pedal Playground, the Pedaltrain planner,
 * the RockBoard configurator; pedalboard.app does power but not order) is tell
 * you whether the chain you just built is in an order that will actually
 * behave. That is the part a beginner gets wrong and the part a shop assistant
 * would mention, so it belongs here.
 *
 * Two rules govern everything below.
 *
 * FIRST: the conventional order is a convention, not a law. Guitar -> tuner ->
 * filter -> compressor -> drive -> modulation -> delay -> reverb -> amp is
 * where most people start, and every source agrees on it, but fuzz after a
 * wah, delay into distortion and reverb first are all real, deliberate,
 * recorded choices. So this module NEVER blocks, reorders silently or marks a
 * chain wrong. It raises notes, in the site's own voice, and offers a one-click
 * sort the shopper can ignore. Anything stronger would be lying about how
 * settled the question is.
 *
 * SECOND: the power numbers are typical draws by effect type, not the spec of
 * the pedal in front of you. A digital delay is 100mA the way a car is 30mpg:
 * true enough to size a power supply, useless as a guarantee. Every surface
 * that prints one says "estimated" and links out to the maker's own spec,
 * because CLAUDE.md section 8's rule about market prices ("inventing a number
 * from too small a sample is a guess dressed up as a measurement") is the same
 * rule, and it applies to milliamps too.
 */

export const EFFECT_TYPES = [
  "tuner",
  "filter",
  "compressor",
  "drive",
  "eq",
  "pitch",
  "modulation",
  "delay",
  "reverb",
  "volume",
  "looper",
  "utility",
] as const

export type EffectType = (typeof EFFECT_TYPES)[number]

export type EffectMeta = {
  type: EffectType
  label: string
  /** Where this type conventionally sits. Lower runs earlier in the chain. */
  rank: number
  /** Typical current draw in mA. See the second rule in this file's header. */
  typicalMa: number
  /** Colour band on the pedal enclosure, so a board's shape is readable at a glance. */
  hue: string
  /** One line explaining why the conventional position is the conventional position. */
  why: string
}

/**
 * Ranks are spaced by ten so a later insertion (a noise gate, a buffer) has
 * somewhere to go without renumbering the whole list.
 */
export const EFFECTS: Record<EffectType, EffectMeta> = {
  tuner: {
    type: "tuner",
    label: "Tuner",
    rank: 10,
    typicalMa: 40,
    hue: "#8b96a8",
    why: "First, because it needs the cleanest signal it can get to track pitch, and muting here kills the whole rig.",
  },
  filter: {
    type: "filter",
    label: "Wah / filter",
    rank: 20,
    typicalMa: 8,
    hue: "#4ade80",
    why: "Early, so it sweeps a clean signal. After a drive it filters the distortion instead of shaping what feeds it.",
  },
  compressor: {
    type: "compressor",
    label: "Compressor",
    rank: 30,
    typicalMa: 10,
    hue: "#38bdf8",
    why: "Before the gain stages, so it evens out your picking rather than squashing the sustain a drive just added.",
  },
  drive: {
    type: "drive",
    label: "Drive / fuzz",
    rank: 40,
    typicalMa: 12,
    hue: "#ef5350",
    why: "The core of the sound, and everything after it is shaping what the drive produced.",
  },
  eq: {
    type: "eq",
    label: "EQ",
    rank: 50,
    typicalMa: 30,
    hue: "#f0b93c",
    why: "Usually after the gain, to fix what the drive did to the midrange. Before it works too, as a way to push the drive harder.",
  },
  pitch: {
    type: "pitch",
    label: "Pitch / octave",
    rank: 55,
    typicalMa: 100,
    hue: "#fb923c",
    why: "Tracks best on a clean, monophonic signal, which argues for early. Most players run it after the drive anyway because that is where it sounds like the record.",
  },
  modulation: {
    type: "modulation",
    label: "Modulation",
    rank: 60,
    typicalMa: 30,
    hue: "#c678b4",
    why: "After the drive, so the chorus or phaser moves the distorted tone instead of being distorted itself.",
  },
  volume: {
    type: "volume",
    label: "Volume",
    rank: 65,
    typicalMa: 0,
    hue: "#a8a29e",
    why: "After the gain and before the ambience, so swells keep their drive and the delay tails ring out past the fade.",
  },
  delay: {
    type: "delay",
    label: "Delay",
    rank: 70,
    typicalMa: 100,
    hue: "#22d3ee",
    why: "Near the end: it repeats the finished sound. In front of a drive every repeat gets distorted again and turns to mush.",
  },
  reverb: {
    type: "reverb",
    label: "Reverb",
    rank: 80,
    typicalMa: 100,
    hue: "#818cf8",
    why: "Last of the ambience, after delay, so the echoes happen in the room rather than the room being echoed.",
  },
  looper: {
    type: "looper",
    label: "Looper",
    rank: 90,
    typicalMa: 150,
    hue: "#2dd4bf",
    why: "Dead last, so it records everything in front of it exactly as the audience hears it.",
  },
  utility: {
    type: "utility",
    label: "Utility",
    rank: 95,
    typicalMa: 20,
    hue: "#94a3b8",
    why: "Buffers, switchers, talk boxes and DI boxes. Position depends entirely on the job it is doing.",
  },
}

export const EFFECT_ORDER: EffectType[] = [...EFFECT_TYPES].sort(
  (a, b) => EFFECTS[a].rank - EFFECTS[b].rank,
)

/**
 * Keyword table for guessing an effect type from a brand and model string.
 *
 * Ordered most specific first and matched in that order, because the loose
 * patterns would otherwise swallow the tight ones: "Big Muff Pi" contains
 * "muff" but also nothing else, while "Deluxe Memory Man" contains "memory"
 * (delay) and would be missed entirely by a bare "delay" test. Same reasoning
 * as COLUMN_ALIASES in the eBay feed parser: match on names we have actually
 * seen in the data rather than on a clever regex.
 *
 * Every model-number pattern is `\d+` rather than `\d`, and that is not
 * cosmetic. A single `\d` followed by the group's closing `\b` cannot match a
 * multi-digit number at all: "Phase 90" matches "phase 9" and then demands a
 * word boundary before the "0", which does not exist, so the whole pattern
 * fails and the pedal falls through to the default. That silently turned a
 * phaser into a drive, and a Korg SDD-3000 into one as well.
 */
const TYPE_PATTERNS: [EffectType, RegExp][] = [
  [
    "tuner",
    /\b(tuner|polytune|pitchblack|turbo tuner|tu-?\d+|snark|unitune)\b/i,
  ],
  [
    "looper",
    /\b(looper|loop station|ditto|rc-?\d+|infinity loop|boomerang)\b/i,
  ],
  [
    "filter",
    /\b(wah|cry ?baby|auto ?wah|envelope|mu-?tron|q-?tron|filter|talk ?box|vocoder|wh-?10|v846|bassballs)\b/i,
  ],
  [
    "compressor",
    /\b(compressor|comp|sustainer|dyna ?comp|keeley c|cs-?\d+|ross comp|optical comp|limiter)\b/i,
  ],
  [
    "pitch",
    /\b(whammy|octave|octaver|octavia|pitch|harmonis[ez]|pog|micro ?pog|ring ?mod|freeze|drop|superego)\b/i,
  ],
  [
    "modulation",
    /\b(chorus|phaser|phase ?\d+|flanger|flange|tremolo|trem|vibrato|univibe|uni-?vibe|deja ?vibe|rotary|leslie|small ?stone|electric ?mistress|ce-?\d+|bf-?\d+|mistress|panner)\b/i,
  ],
  [
    "reverb",
    /\b(reverb|verb|hall|plate|spring|shimmer|blue ?sky|flint|big ?sky|holy ?grail|cathedral)\b/i,
  ],
  [
    "delay",
    /\b(delay|echo|echoplex|echorec|memory ?man|carbon ?copy|dd-?\d+|dm-?\d+|el ?capistan|timeline|space ?echo|dl4|sdd-?\d+|slapback|tape ?echo)\b/i,
  ],
  [
    "drive",
    /\b(overdrive|distortion|fuzz|drive|screamer|ts-?\d+|ts808|tube ?screamer|muff|rat|klon|centaur|boost|treble ?boost|rangemaster|blues ?driver|bd-?\d+|ds-?\d+|od-?\d+|shredmaster|governor|plexi|preamp|dirt|gain|face)\b/i,
  ],
  ["eq", /\b(eq|equali[sz]er|graphic|parametric|ge-?\d+|band eq)\b/i],
  ["volume", /\b(volume|expression|swell|pedal volume|vp-?\d+)\b/i],
  [
    "utility",
    /\b(buffer|splitter|switcher|junction|di\b|noise ?gate|gate|isolator|loop ?switch|aby|a\/b)\b/i,
  ],
]

/**
 * Best guess at what kind of pedal this is, from whatever text we have.
 *
 * Falls back to "drive" rather than "utility" when nothing matches, because
 * dirt is far and away the most common thing on a board and a wrong guess at
 * the front of the chain is more obviously wrong to the shopper (and so
 * likelier to get corrected) than one parked in a neutral bucket at the end.
 * The type is always overridable in the UI: this is a starting point, not a
 * claim about the pedal.
 */
export function inferEffectType(brand: string, model: string, category?: string | null): EffectType {
  if (category && !/effects?\s*pedals?/i.test(category)) {
    // Anything that is not a pedal at all (a cable, a power supply, a case)
    // has no place in the order rules and should not be guessed into one.
    if (/power|supply|cable|case|bag|patch/i.test(`${brand} ${model} ${category}`)) return "utility"
  }
  const haystack = `${brand} ${model}`
  for (const [type, pattern] of TYPE_PATTERNS) {
    if (pattern.test(haystack)) return type
  }
  return "drive"
}

export type ChainItem = {
  /** Stable identity for the slot. The canonical gear slug where there is one. */
  key: string
  brand: string
  model: string
  type: EffectType
}

export type ChainNote = {
  /** Which slot the note is about, by key, so the UI can highlight it. */
  key: string
  severity: "note" | "flag"
  message: string
}

export type ChainAnalysis = {
  notes: ChainNote[]
  /** True when the chain already runs in the conventional order. */
  inConventionalOrder: boolean
  /** The same items sorted conventionally. Offered, never applied automatically. */
  suggested: ChainItem[]
}

/**
 * Compare a chain against the conventional order and describe the differences.
 *
 * Only the differences worth mentioning. An out-of-order pair whose ranks are
 * adjacent (an EQ before a pitch shifter, say) is not worth a line of copy, so
 * the threshold is a gap of two full positions in EFFECT_ORDER. Below that the
 * page stays quiet, which is what keeps the notes meaning something when they
 * do appear.
 */
export function analyzeChain(items: ChainItem[]): ChainAnalysis {
  const notes: ChainNote[] = []

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const current = items[i]
    const prevRank = EFFECTS[prev.type].rank
    const currentRank = EFFECTS[current.type].rank
    if (currentRank >= prevRank) continue

    const positionGap =
      EFFECT_ORDER.indexOf(prev.type) - EFFECT_ORDER.indexOf(current.type)
    if (positionGap < 2) continue

    notes.push({
      key: current.key,
      severity: "note",
      message: `${current.brand} ${current.model} (${EFFECTS[current.type].label.toLowerCase()}) sits after ${prev.brand} ${prev.model}. ${EFFECTS[current.type].why}`,
    })
  }

  // Two specific pairings worth calling out by name, because they change the
  // sound so much that a player who did not mean to do it will want to know,
  // and a player who did meant it and will scroll past.
  const tunerIndex = items.findIndex((i) => i.type === "tuner")
  if (tunerIndex > 0) {
    notes.push({
      key: items[tunerIndex].key,
      severity: "flag",
      message:
        "Your tuner is not first. It will still work, but it tracks noticeably worse downstream of a drive or a modulation pedal, and muting mid-chain leaves everything in front of it still making noise.",
    })
  }

  const firstDrive = items.findIndex((i) => i.type === "drive")
  const lastDelayOrReverb = items.reduce(
    (last, item, index) => (item.type === "delay" || item.type === "reverb" ? index : last),
    -1,
  )
  if (firstDrive > -1 && lastDelayOrReverb > -1 && lastDelayOrReverb < firstDrive) {
    notes.push({
      key: items[lastDelayOrReverb].key,
      severity: "flag",
      message:
        "Delay or reverb is running into your drive, so every repeat gets distorted again. That is a real sound (shoegaze lives there) but it is muddy by default, and most players put the ambience last instead.",
    })
  }

  const suggested = [...items].sort((a, b) => EFFECTS[a.type].rank - EFFECTS[b.type].rank)
  const inConventionalOrder = items.every((item, i) => item.key === suggested[i].key)

  return { notes, inConventionalOrder, suggested }
}

export type PowerEstimate = {
  totalMa: number
  /** Isolated outputs needed, which is one per pedal: shared outputs are what cause the noise. */
  outputsNeeded: number
  /** How many draw enough to want their own high-current output. */
  highDrawCount: number
  /** A supply size that clears the total with headroom, in mA. */
  recommendedSupplyMa: number
}

/** Anything over this typically wants its own output rather than a daisy chain. */
const HIGH_DRAW_MA = 90

/**
 * Size a power supply for a board.
 *
 * The headroom multiplier is 1.5 rather than 1.0 for two reasons: these are
 * typical draws and a specific pedal can be well over its type's typical, and
 * a supply run at its exact rating sags. Rounding up to the next 100mA on top
 * of that matches how supplies are actually sold.
 */
export function estimatePower(items: ChainItem[]): PowerEstimate {
  const totalMa = items.reduce((sum, item) => sum + EFFECTS[item.type].typicalMa, 0)
  const highDrawCount = items.filter((item) => EFFECTS[item.type].typicalMa >= HIGH_DRAW_MA).length
  return {
    totalMa,
    outputsNeeded: items.filter((item) => EFFECTS[item.type].typicalMa > 0).length,
    highDrawCount,
    recommendedSupplyMa: Math.max(100, Math.ceil((totalMa * 1.5) / 100) * 100),
  }
}
