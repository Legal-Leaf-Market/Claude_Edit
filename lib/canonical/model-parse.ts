/**
 * Title parsing for used music gear.
 *
 * Marketplace titles are keyword soup: "Fender Player Stratocaster MIM Electric
 * Guitar Sunburst w/ Gig Bag FREE SHIP L@@K". The job here is to recover the
 * two things that identify the instrument, brand and model, and throw away the
 * condition, bundle, shipping and shouting.
 *
 * This is a direct descendant of the strain-name extractor on the sister sites,
 * and it inherits its bias: be conservative. A wrong model guess merges two
 * different instruments into one canonical row and corrupts the price history
 * that the whole deal engine reads. Returning nothing is recoverable, a bad
 * merge is not.
 */

/* -------------------------------------------------------------------------- */
/*  Brands                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Known brands, longest first at match time so "Music Man" wins over "Man" and
 * "Electro-Harmonix" is never shortened to "Electro". Aliases fold the spelling
 * variants sellers actually type into one canonical name.
 */
const BRAND_ALIASES: Record<string, string[]> = {
  Fender: ["fender"],
  Squier: ["squier", "squire"],
  Gibson: ["gibson"],
  Epiphone: ["epiphone", "epi"],
  Ibanez: ["ibanez"],
  Jackson: ["jackson"],
  Charvel: ["charvel"],
  Kramer: ["kramer"],
  ESP: ["esp", "esp ltd", "ltd"],
  Schecter: ["schecter"],
  "Paul Reed Smith": ["paul reed smith", "prs"],
  Gretsch: ["gretsch"],
  Rickenbacker: ["rickenbacker", "rick"],
  Guild: ["guild"],
  Martin: ["martin", "c.f. martin", "cf martin"],
  Taylor: ["taylor"],
  Takamine: ["takamine"],
  Ovation: ["ovation"],
  Seagull: ["seagull"],
  Godin: ["godin"],
  Breedlove: ["breedlove"],
  Alvarez: ["alvarez"],
  Washburn: ["washburn"],
  Yamaha: ["yamaha"],
  Eastman: ["eastman"],
  Collings: ["collings"],
  Danelectro: ["danelectro", "dano"],
  Supro: ["supro"],
  Harmony: ["harmony"],
  Hofner: ["hofner", "höfner"],
  Hagstrom: ["hagstrom"],
  "Music Man": ["music man", "musicman", "ernie ball music man", "ebmm"],
  "Ernie Ball": ["ernie ball"],
  Peavey: ["peavey"],
  Dean: ["dean"],
  "B.C. Rich": ["b.c. rich", "bc rich"],
  Steinberger: ["steinberger"],

  Marshall: ["marshall"],
  Vox: ["vox"],
  Orange: ["orange amps", "orange amplification"],
  "Mesa Boogie": ["mesa boogie", "mesa/boogie", "mesa-boogie", "mesa"],
  Ampeg: ["ampeg"],
  Blackstar: ["blackstar"],
  "Hughes & Kettner": ["hughes & kettner", "hughes and kettner"],
  Engl: ["engl"],
  Friedman: ["friedman"],
  "Dr. Z": ["dr. z", "dr z"],
  Hartke: ["hartke"],
  Roland: ["roland"],
  Boss: ["boss"],
  "Line 6": ["line 6", "line6"],
  Kemper: ["kemper"],
  "Fractal Audio": ["fractal audio", "fractal"],
  "Positive Grid": ["positive grid"],

  "Electro-Harmonix": ["electro-harmonix", "electro harmonix", "ehx"],
  MXR: ["mxr"],
  "TC Electronic": ["tc electronic", "tc-electronic"],
  Strymon: ["strymon"],
  Eventide: ["eventide"],
  Dunlop: ["dunlop", "jim dunlop"],
  Wampler: ["wampler"],
  JHS: ["jhs pedals", "jhs"],
  Walrus: ["walrus audio", "walrus"],
  "Chase Bliss": ["chase bliss"],
  Keeley: ["keeley"],
  Zvex: ["zvex", "z.vex"],

  Korg: ["korg"],
  Moog: ["moog"],
  Nord: ["nord", "clavia"],
  Kurzweil: ["kurzweil"],
  Casio: ["casio"],
  Alesis: ["alesis"],
  Arturia: ["arturia"],
  "Native Instruments": ["native instruments"],
  Akai: ["akai", "akai professional"],
  Novation: ["novation"],
  Behringer: ["behringer"],
  Elektron: ["elektron"],
  Teenage: ["teenage engineering"],
  Sequential: ["sequential", "dave smith instruments", "dsi"],
  Waldorf: ["waldorf"],
  "Oberheim": ["oberheim"],

  Shure: ["shure"],
  Sennheiser: ["sennheiser"],
  Neumann: ["neumann"],
  AKG: ["akg"],
  "Audio-Technica": ["audio-technica", "audio technica"],
  Rode: ["rode", "røde"],
  Focusrite: ["focusrite"],
  "Universal Audio": ["universal audio", "uad"],
  PreSonus: ["presonus"],
  MOTU: ["motu"],
  Zoom: ["zoom"],
  Tascam: ["tascam"],
  Apogee: ["apogee"],
  SSL: ["solid state logic", "ssl"],
  Neve: ["neve", "ams neve"],
  Warm: ["warm audio"],
  Genelec: ["genelec"],
  KRK: ["krk"],
  Adam: ["adam audio"],
  Yorkville: ["yorkville"],
  QSC: ["qsc"],
  Mackie: ["mackie"],
  JBL: ["jbl"],
  Bose: ["bose"],

  Pearl: ["pearl"],
  Tama: ["tama"],
  Ludwig: ["ludwig"],
  DW: ["dw drums", "drum workshop", "dw"],
  Gretsch_Drums: ["gretsch drums"],
  Sonor: ["sonor"],
  Mapex: ["mapex"],
  Zildjian: ["zildjian", "avedis zildjian"],
  Sabian: ["sabian"],
  Meinl: ["meinl"],
  Paiste: ["paiste"],
  Remo: ["remo"],
  Evans: ["evans"],

  Pioneer: ["pioneer dj", "pioneer"],
  Denon: ["denon dj", "denon"],
  Numark: ["numark"],
  Rane: ["rane"],
  Serato: ["serato"],

  Selmer: ["selmer"],
  Bach: ["bach"],
  Conn: ["conn", "c.g. conn"],
  King: ["king musical"],
  Buffet: ["buffet crampon", "buffet"],
  Jupiter: ["jupiter"],
  Getzen: ["getzen"],

  "D'Addario": ["d'addario", "daddario"],
  Elixir: ["elixir"],
  "Seymour Duncan": ["seymour duncan"],
  DiMarzio: ["dimarzio"],
  Fishman: ["fishman"],
  "L.R. Baggs": ["l.r. baggs", "lr baggs"],
}

/** Flattened [alias, canonicalBrand] sorted longest alias first. */
const BRAND_LOOKUP: [string, string][] = Object.entries(BRAND_ALIASES)
  .flatMap(([canonical, aliases]) =>
    aliases.map((a) => [a, canonical.replace(/_.*$/, "")] as [string, string]),
  )
  .sort((a, b) => b[0].length - a[0].length)

/**
 * Find a known brand anywhere in a title. Matching is word boundaried so
 * "Boss" does not fire on "Bossa Nova" and "Rick" does not fire on "Rickenbacker
 * -style". Returns null rather than guessing.
 */
export function detectBrand(text: string): string | null {
  if (!text) return null
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9&'./ -]/g, " ").replace(/\s+/g, " ")} `
  for (const [alias, canonical] of BRAND_LOOKUP) {
    // Escape regex metacharacters in aliases like "b.c. rich" and "z.vex".
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`(?:^|[\\s(])${escaped}(?:[\\s),.]|$)`, "i").test(haystack)) {
      return canonical
    }
  }
  return null
}

export function knownBrands(): string[] {
  return Object.keys(BRAND_ALIASES).map((b) => b.replace(/_.*$/, ""))
}

/* -------------------------------------------------------------------------- */
/*  Categories                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Coarse buckets for the category facet. Ordered: the first pattern that
 * matches wins, so the specific forms sit above the generic ones ("bass amp"
 * must beat "bass", "pedal steel" must not be read as an effects pedal).
 */
const CATEGORY_PATTERNS: [string, RegExp][] = [
  ["Amplifiers", /\b(amp head|amplifier|combo amp|\bamp\b|cabinet|\bcab\b|speaker cab|head\b.*\bwatt)\b/i],
  ["Effects Pedals", /\b(pedal board|pedalboard|overdrive|distortion pedal|fuzz|chorus pedal|delay pedal|reverb pedal|wah|compressor pedal|stompbox|multi-?effects|\bpedal\b)\b/i],
  ["Synthesizers", /\b(synth|synthesizer|analog synth|modular|eurorack|drum machine|sampler|groovebox|sequencer)\b/i],
  ["Keyboards & Pianos", /\b(keyboard|digital piano|stage piano|electric piano|workstation|organ|rhodes|wurlitzer|clavinet|\bpiano\b)\b/i],
  ["Drums & Percussion", /\b(drum kit|drum set|snare|cymbal|hi-?hat|ride\b|crash\b|tom\b|kick drum|bass drum|djembe|cajon|congas?|bongos?|percussion|drumhead)\b/i],
  ["Bass Guitars", /\b(bass guitar|electric bass|precision bass|jazz bass|\bp-?bass\b|\bj-?bass\b|upright bass|double bass|\b\d-?string bass\b)\b/i],
  ["Acoustic Guitars", /\b(acoustic guitar|acoustic-?electric|dreadnought|parlor guitar|classical guitar|nylon string|resonator|12-?string acoustic)\b/i],
  ["Electric Guitars", /\b(electric guitar|stratocaster|telecaster|les paul|\bsg\b|jazzmaster|jaguar|mustang|explorer|flying v|semi-?hollow|hollow ?body|\bstrat\b|\btele\b)\b/i],
  ["Microphones", /\b(microphone|\bmic\b|condenser|dynamic mic|ribbon mic|shotgun mic|lavalier)\b/i],
  ["Recording & Audio", /\b(audio interface|preamp|compressor|mixer|mixing console|studio monitor|monitors?\b|converter|patchbay|outboard|rack unit|\bdaw\b)\b/i],
  ["DJ Equipment", /\b(turntable|\bdj\b|controller\b.*\bdj|cdj|mixer\b.*\bdj|scratch)\b/i],
  ["Orchestral Strings", /\b(violin|viola|cello|fiddle|\bbow\b.*\bstring)\b/i],
  ["Brass & Woodwind", /\b(trumpet|trombone|saxophone|\bsax\b|clarinet|flute|oboe|bassoon|french horn|tuba|euphonium|cornet)\b/i],
  ["Folk & Traditional", /\b(banjo|mandolin|ukulele|\buke\b|harmonica|accordion|dulcimer|sitar|bouzouki)\b/i],
  ["Parts & Accessories", /\b(pickup|tuner|capo|strings?\b|strap|gig bag|hard case|\bcase\b|stand\b|cable|bridge|tuning pegs?|nut\b|fretboard|knobs?)\b/i],
]

export function detectCategory(text: string): string {
  if (!text) return "Other"
  for (const [name, re] of CATEGORY_PATTERNS) {
    if (re.test(text)) return name
  }
  return "Other"
}

/* -------------------------------------------------------------------------- */
/*  Model extraction                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Words and phrases that are never part of a model name. Grouped by why they
 * appear so the list stays maintainable, and matched with word boundaries so a
 * legitimate model containing one of these strings survives.
 */
const MODEL_NOISE = [
  // condition and provenance
  "mint condition", "near mint", "excellent condition", "very good condition",
  "good condition", "fair condition", "used", "pre-?owned", "preowned",
  "second hand", "\\bnew\\b", "\\bnos\\b", "open box", "\\bb-?stock\\b",
  "refurbished", "refurb", "\\bas-?is\\b", "for parts", "not working",
  "\\brepair\\b", "\\bproject\\b", "\\brelic\\b", "road worn",
  // marketing shouting
  "free ship(?:ping)?", "fast ship(?:ping)?", "ships? free", "\\bl@@k\\b",
  "\\bwow\\b", "\\brare\\b", "\\bhtf\\b", "hard to find", "\\bvintage\\b",
  "collectible", "\\bclean\\b", "\\bnice\\b", "\\bbeautiful\\b", "\\bgorgeous\\b",
  "\\bstunning\\b", "\\bkiller\\b", "\\bamazing\\b", "\\bexcellent\\b",
  "\\bgreat\\b", "\\bawesome\\b", "\\bsuper\\b", "must see", "no reserve",
  "\\bsale\\b", "\\bdeal\\b", "lowest price", "best offer", "\\bobo\\b",
  "\\bauthentic\\b", "\\bgenuine\\b", "\\boriginal\\b", "\\bofficial\\b",
  // bundle and extras
  "with case", "w/ case", "w/case", "\\bincludes?\\b", "\\bbundle\\b",
  "\\bpackage\\b", "gig bag", "hard ?shell", "hardshell", "\\bhsc\\b",
  "\\bohsc\\b", "case included", "\\bextras?\\b", "\\bfreebies?\\b",
  "\\bbonus\\b", "\\bcables?\\b", "power supply", "\\bpsu\\b", "\\bmanual\\b",
  // country of manufacture
  "\\bmij\\b", "made in japan", "\\bmim\\b", "made in mexico", "\\bmia\\b",
  "made in usa", "\\busa made\\b", "made in korea", "\\bmik\\b",
  "made in china", "\\bmic\\b", "made in indonesia", "\\bcij\\b",
  "crafted in japan", "\\bjapan\\b", "\\bmexico\\b", "\\bkorea\\b",
  "\\bindonesia\\b", "\\bchina\\b", "\\bgermany\\b", "\\bengland\\b", "\\buk\\b",
  // generic product form words that describe rather than name
  "electric guitar", "acoustic guitar", "bass guitar", "\\bguitar\\b",
  "\\bbass\\b", "\\bamplifier\\b", "\\bamp head\\b", "combo amp",
  "effects? pedal", "\\bpedal\\b", "\\bsynthesizer\\b", "\\bsynth\\b",
  "\\bkeyboard\\b", "\\bmicrophone\\b", "\\bmic\\b", "audio interface",
  "\\bdrum kit\\b", "\\bdrum set\\b", "\\bsnare drum\\b", "\\bcymbal\\b",
  "\\binstrument\\b", "\\bmodule\\b", "\\bunit\\b",
  // shipping and commerce leftovers
  "\\blot\\b", "\\bset of\\b", "\\bpair\\b", "\\bqty\\b", "\\bea\\b",
  "\\bship(?:s|ped|ping)?\\b", "\\bwarranty\\b", "\\breturns?\\b",
  "\\bauction\\b", "buy it now", "\\bbin\\b",
]

const MODEL_NOISE_RE = new RegExp(`(?:${MODEL_NOISE.join("|")})`, "gi")

/** Colour and finish words: real descriptors, but never the model itself. */
const FINISH_RE =
  /\b(sunburst|tobacco burst|cherry ?burst|honey ?burst|3-?tone|2-?tone|black|white|blonde|butterscotch|natural|walnut|mahogany|candy apple|lake placid|olympic|surf green|sonic blue|daphne blue|fiesta red|shell pink|seafoam|silver ?sparkle|gold ?top|goldtop|wine red|ebony|ivory|cream|matte|gloss|satin|nitro|poly)\b/gi

const MODEL_STOPWORDS = new Set([
  "the", "a", "an", "and", "with", "w", "for", "of", "in", "on", "to", "by",
  "my", "your", "our", "this", "that", "plus", "or",
])

/**
 * Pull a model guess out of a title, given the brand we already identified.
 *
 * Strategy: cut everything before and including the brand, then strip noise,
 * finish words and stray punctuation, then keep the first run of words that
 * still looks like a name. Model names in this market are short (one to four
 * tokens: "Stratocaster", "Les Paul Standard", "SM58", "Juno-106"), so a long
 * leftover is a description that slipped through and is rejected.
 */
export function extractModel(title: string, brand: string | null): string {
  if (!title) return ""

  let working = String(title)
    .replace(/[–—]/g, "-")
    .replace(/[(){}\[\]"]/g, " ")

  // Drop everything up to and including the brand mention, so "Fender American
  // Professional II Stratocaster" starts at "American".
  if (brand) {
    for (const alias of BRAND_ALIASES[brand] ?? [brand.toLowerCase()]) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const re = new RegExp(`^.*?\\b${escaped}\\b`, "i")
      if (re.test(working)) {
        working = working.replace(re, " ")
        break
      }
    }
  }

  const cleaned = working
    .replace(MODEL_NOISE_RE, " ")
    .replace(FINISH_RE, " ")
    // Years: informative for a listing, wrong for a canonical model row.
    .replace(/\b(19|20)\d{2}(?:'?s)?\b/g, " ")
    // Prices and weights that ride along in titles.
    .replace(/\$\s?\d[\d,.]*/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s?(?:lbs?|kg|oz|watts?|\bw\b|ohms?)\b/gi, " ")
    .replace(/[^a-zA-Z0-9'\-/. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const words = cleaned.split(" ").filter(Boolean)
  const kept: string[] = []
  for (const word of words) {
    const lower = word.toLowerCase().replace(/[.]+$/, "")
    if (MODEL_STOPWORDS.has(lower)) {
      // A stopword after we have something is the start of a descriptive tail.
      if (kept.length) break
      continue
    }
    // Single stray letters are parsing debris, except a lone digit-letter model
    // designator like "V" in "Flying V" which we let through when it follows text.
    if (word.length < 2 && !(kept.length && /^[a-zA-Z0-9]$/.test(word))) continue
    kept.push(word)
    if (kept.length >= 4) break
  }

  const model = kept.join(" ").trim()
  if (model.length < 2) return ""
  // A result with no letters at all is a serial number or a size, not a model.
  if (!/[a-zA-Z]/.test(model)) return ""
  return model
}

/** Title case that leaves known all-caps designators alone. */
export function titleCaseModel(model: string): string {
  return model.replace(/\S+/g, (token) => {
    if (/^[A-Z0-9][A-Z0-9-]*$/.test(token) && token.length <= 6) return token
    if (/\d/.test(token)) return token.toUpperCase()
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
  })
}

/* -------------------------------------------------------------------------- */
/*  Slugs                                                                     */
/* -------------------------------------------------------------------------- */

export function slugify(input: string): string {
  return String(input)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
}

export function gearSlug(brand: string, model: string): string {
  const base = slugify(`${brand} ${model}`)
  return base || slugify(brand) || "gear"
}

/* -------------------------------------------------------------------------- */
/*  Combined parse                                                            */
/* -------------------------------------------------------------------------- */

export type ParsedGear = {
  brand: string | null
  model: string
  category: string
}

/**
 * Best-effort identity for a listing. `brandHint` is the marketplace's own
 * brand field, which beats anything we can read out of the title.
 */
export function parseGearFromTitle(title: string, brandHint?: string | null): ParsedGear {
  const hinted = brandHint?.trim() ? detectBrand(brandHint) ?? brandHint.trim().slice(0, 100) : null
  const brand = hinted ?? detectBrand(title)
  const model = titleCaseModel(extractModel(title, brand))
  return { brand, model, category: detectCategory(title) }
}
