import { CATEGORIES, type Category } from "@/lib/categories"

/**
 * The merchant's own category, mapped onto ours.
 *
 * WHY THIS EXISTS. Category used to be inferred from the listing title alone,
 * by detectCategory() in model-parse.ts. On a retail feed whose titles read
 * "Boss DS-1 Distortion Pedal" that works. On a peer marketplace it mostly does
 * not: measured against twenty-five real pedal titles, twenty-two landed in
 * "Other" and a Keeley Compressor Plus landed in Recording & Audio. A pedal in
 * "Other" is not on /used/effects-pedals, so it is not in liveModels(), so it
 * is not on the guide's shelf either, and nothing anywhere errors.
 *
 * Meanwhile every feed reader here already declared an alias for the merchant's
 * own category column and not one of them stored it. Reverb publishes "Effects
 * and Pedals / Fuzz" next to the title it was being guessed from. This is
 * section 3's rule that an explicit field beats an inferred one, applied to a
 * field we were throwing away.
 *
 * IT RETURNS null, NEVER "Other". Null means "the merchant did not tell us
 * something we recognise", and the caller falls back to the title parse. Every
 * unrecognised path answering "Other" would be worse than the guess it
 * replaced, and it would do it confidently.
 *
 * THE LAST SEGMENT IS TRIED FIRST, then each parent in turn. Merchant
 * taxonomies run general to specific ("Pro Audio / Outboard Gear /
 * Compressors"), so the leaf carries the most information. The parent is the
 * safety net, and it is what makes the ambiguity rule below work.
 *
 * AMBIGUOUS WORDS ARE DELIBERATELY IN NO PATTERN AT ALL. "Compressor",
 * "reverb", "delay", "EQ", "preamp" and "tuner" name a pedal and a rack unit
 * equally well, and a segment holding one of them cannot be classified on its
 * own. Rather than guess, they match nothing and the parent segment decides:
 * "Effects and Pedals / Compressors" resolves on "Effects and Pedals", and
 * "Pro Audio / Outboard Gear / Compressors" on "Outboard Gear". Adding
 * `compressor` to the pedal pattern to catch the first would silently take the
 * second with it, which is the mistake the title parser already makes.
 */

/** Path separators feeds actually use. Comma is excluded: "Guitars, Basses" is one segment. */
const SEPARATORS = /[/>|»→]|::/

/**
 * Ordered. The first pattern matching a segment wins, so read this as a
 * priority list rather than a set. The order carries real decisions:
 *
 * - Parts sits first, and every pattern in it names a part, so "Guitar Parts"
 *   and "Bass Guitar Strings" resolve to parts while "Electric Guitars" does
 *   not reach it.
 *   "Strings" in that pattern is plural and refuses a leading digit, because
 *   "Bass Guitars / 4-String" is a bass rather than a packet of strings and
 *   the singular form is how it announced itself.
 * - Headphone amps sit above Amplifiers, because "Headphone Amps" is studio
 *   gear that would otherwise read as an amplifier on the word "amps".
 * - Amplifiers sits above Bass Guitars, so "Bass Amps" is an amp rather than a
 *   bass. "Bass Guitars" holds no amp word, so it still falls through.
 * - The mixed "Keyboards and Synths" department is named explicitly, above
 *   both halves it could match, because either answer alone is a coin flip.
 */
const FEED_PATTERNS: [Category, RegExp][] = [
  ["Parts & Accessories", /\b(parts?|pickups?|tuning machines?|tuning pegs?|machine heads?|(?<![\d-])strings\b|straps?|cases?|gig bags?|stands?|cables?|picks?|plectrums?|capos?|hardware|bridges?|nuts? and saddles?|fretboards?|knobs?|accessor)/i],
  ["Recording & Audio", /\bheadphones?\b/i],
  ["Amplifiers", /\b(amplifiers?|amps?|amp heads?|cabinets?|cabs?|combo amps?|speaker cabs?)\b/i],
  ["Effects Pedals", /\b(effects?[\s&/-]*(and\s*)?pedals?|guitar pedals?|bass pedals?|stomp ?boxe?s?|pedal ?boards?|overdrives?|distortions?|fuzz|wah|phasers?|flangers?|octaves?|loopers?|multi[\s-]?effects?|pitch shifters?|ring modulators?|talk ?box)/i],
  ["Keyboards & Pianos", /\bkeyboards?\b[\s&/-]*(and\s*)?\bsynths?/i],
  ["Synthesizers", /\b(synths?|synthesi[sz]ers?|eurorack|modular|drum machines?|samplers?|grooveboxe?s?|sequencers?)\b/i],
  ["Keyboards & Pianos", /\b(keyboards?|pianos?|organs?|rhodes|wurlitzer|clavinet|workstations?)\b/i],
  ["Drums & Percussion", /\b(drums?|percussion|cymbals?|snares?|hi-?hats?|drum ?heads?|congas?|bongos?|djembe|cajon)\b/i],
  ["Bass Guitars", /\b(bass guitars?|electric bass|upright bass|double bass|basses)\b/i],
  ["Acoustic Guitars", /\b(acoustic guitars?|acoustic-?electric|classical guitars?|nylon string|dreadnought|resonators?)\b/i],
  ["Electric Guitars", /\b(electric guitars?|solid ?body|semi-?hollow|hollow ?body|guitars?)\b/i],
  ["DJ Equipment", /\b(dj\b|turntables?|cdj|lighting)\b/i],
  ["Orchestral Strings", /\b(violins?|violas?|cellos?|fiddles?|orchestral strings?)\b/i],
  ["Brass & Woodwind", /\b(brass|woodwinds?|trumpets?|trombones?|saxophones?|sax\b|clarinets?|flutes?|oboes?|bassoons?|french horns?|tubas?)\b/i],
  ["Folk & Traditional", /\b(folk|banjos?|mandolins?|ukuleles?|harmonicas?|accordions?|dulcimers?|sitars?)\b/i],
  ["Microphones", /\b(microphones?|mics?)\b/i],
  ["Recording & Audio", /\b(pro audio|recording|live sound|audio interfaces?|studio monitors?|outboard|rack|\bpa\b|di boxe?s?|converters?|patchbays?|home audio|mixing consoles?)\b/i],
]

const VALID = new Set<string>(CATEGORIES)

function matchSegment(segment: string): Category | null {
  for (const [category, pattern] of FEED_PATTERNS) {
    if (pattern.test(segment)) return category
  }
  return null
}

/**
 * Map a merchant's own category string onto our vocabulary, or null when it
 * says nothing we recognise.
 *
 * Accepts a full path ("Effects and Pedals / Fuzz"), a single Shopify
 * product_type ("Effects Pedal"), or a CJ CATEGORY column, and is deliberately
 * tolerant about which separator the feed uses.
 */
export function categoryFromFeed(raw: string | null | undefined): Category | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // A feed that already speaks our vocabulary (a promoted capture, a fixture)
  // needs no interpretation.
  if (VALID.has(trimmed) && trimmed !== "Other") return trimmed as Category

  const segments = trimmed
    .split(SEPARATORS)
    .map((s) => s.trim())
    .filter(Boolean)

  // Leaf first, then each parent. See the ambiguity note above: this is what
  // lets an unclassifiable leaf defer to the department it sits in.
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const hit = matchSegment(segments[i])
    if (hit) return hit
  }

  // No separator we recognise, or a path whose segments each said nothing.
  return segments.length > 1 ? null : matchSegment(trimmed)
}
