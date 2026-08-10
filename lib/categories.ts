import { slugify } from "@/lib/canonical/model-parse"

/**
 * The category vocabulary, and the slugs the /used/[category] routes use.
 *
 * Single source of truth: the labels must match exactly what
 * detectCategory() writes into canonical_gear.category, or a route renders an
 * empty page while the listings sit there under a slightly different string.
 */
export const CATEGORIES = [
  "Electric Guitars",
  "Acoustic Guitars",
  "Bass Guitars",
  "Amplifiers",
  "Effects Pedals",
  "Synthesizers",
  "Keyboards & Pianos",
  "Drums & Percussion",
  "Microphones",
  "Recording & Audio",
  "DJ Equipment",
  "Orchestral Strings",
  "Brass & Woodwind",
  "Folk & Traditional",
  "Parts & Accessories",
  "Other",
] as const

export type Category = (typeof CATEGORIES)[number]

const BY_SLUG = new Map<string, Category>(CATEGORIES.map((c) => [slugify(c), c]))

export function categoryFromSlug(slug: string): Category | null {
  return BY_SLUG.get(slug.toLowerCase()) ?? null
}

export function categorySlug(category: string): string {
  return slugify(category)
}

/** Slugs worth generating routes for. "Other" is a bucket, not a destination. */
export function indexableCategories(): { slug: string; label: Category }[] {
  return CATEGORIES.filter((c) => c !== "Other").map((label) => ({
    slug: slugify(label),
    label,
  }))
}

const CATEGORY_RANK = new Map<string, number>(CATEGORIES.map((c, i) => [c, i]))

/**
 * Sort anything keyed by category name into the same priority CATEGORIES is
 * declared in (guitars, amps and pedals first), rather than whatever order a
 * caller happened to produce it in (e.g. raw listing count). Unknown values
 * sort after every known category, stable amongst themselves.
 */
export function sortByCategoryPriority<T extends { value: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ra = CATEGORY_RANK.get(a.value) ?? CATEGORIES.length
    const rb = CATEGORY_RANK.get(b.value) ?? CATEGORIES.length
    return ra - rb
  })
}

/**
 * A "cool" headline per category page, replacing the literal category name
 * as the big on-page title. The <title> tag and breadcrumb still say the
 * literal "Used {category}" for search and orientation; this is purely the
 * expressive layer, so the SEO-bearing text is never lost, only supplemented.
 */
export const CATEGORY_TITLE: Partial<Record<Category, string>> = {
  "Electric Guitars": "The Riff",
  "Acoustic Guitars": "The Woods",
  "Bass Guitars": "Deep Foundations",
  Amplifiers: "Power and Presence",
  "Effects Pedals": "The Chain",
  Synthesizers: "Patina and Parts",
  "Keyboards & Pianos": "Weighted Keys",
  "Drums & Percussion": "The Backbeat",
  Microphones: "True Voice",
  "Recording & Audio": "The Upgrade Cycle",
  "DJ Equipment": "The Blend",
  "Orchestral Strings": "Bow and Bridge",
  "Brass & Woodwind": "The Horn Section",
  "Folk & Traditional": "Wood and Hands",
  "Parts & Accessories": "One Piece at a Time",
}

/**
 * A one-line mood-setting subhead under CATEGORY_TITLE. Distinct from
 * CATEGORY_INTRO below: the intro is a practical buying tip, this is pure
 * voice, meant to make each category page feel like its own track on the
 * same album rather than the same template with the noun swapped.
 */
export const CATEGORY_KICKER: Partial<Record<Category, string>> = {
  "Electric Guitars":
    "Where prices shift by the hour and the same model costs differently every day.",
  "Acoustic Guitars":
    "Condition and case inclusion shape the value here as much as the model name does.",
  "Bass Guitars":
    "They move slower through markets, which means more time to negotiate and more genuine bargains to find.",
  Amplifiers:
    "Weight matters here: factor shipping into the cost, or hunt local where the best deals live.",
  "Effects Pedals": "Prices stay tight here, which makes real bargains obvious and worth the look.",
  Synthesizers:
    "Service history shapes the sound and the value; a maintained vintage synth often beats a neglected newer model.",
  "Keyboards & Pianos": "Steep depreciation in the first years means real value for those buying used.",
  "Drums & Percussion": "Shells and cymbals are sold separately; the exact configuration shapes the value completely.",
  Microphones: "They hold value well and ship cheaply, but verify authenticity on the most famous models.",
  "Recording & Audio":
    "Studio upgrades drive constant turnover, which means competitive prices and deep selection for you.",
  "DJ Equipment": "Great mixing demands gear that responds exactly as your hands intend.",
  "Orchestral Strings": "Where classical tradition meets the player seeking their instrument's voice.",
  "Brass & Woodwind": "Every valve and reed carries its own voice and history.",
  "Folk & Traditional": "Folk instruments are as much about heritage as they are about sound.",
  "Parts & Accessories": "Every part you choose shapes how your instrument feels and sounds.",
}

/** Short blurb per category. Real copy beats a templated sentence for indexing. */
export const CATEGORY_INTRO: Partial<Record<Category, string>> = {
  "Electric Guitars":
    "Used electric guitars move faster than any other category, and the same model can swing hundreds of dollars between marketplaces on the same day. Every live listing below is matched to its exact model so you are comparing like for like.",
  "Acoustic Guitars":
    "Acoustic prices depend heavily on condition and whether a case is included, so check the condition badge before comparing two listings on price alone.",
  "Bass Guitars":
    "Used basses tend to sit longer than guitars, which means more room to negotiate and more genuinely underpriced listings.",
  Amplifiers:
    "Amps are heavy, so shipping cost and local pickup matter more here than anywhere else. Use the delivery filter to see only what can actually reach you.",
  "Effects Pedals":
    "Pedals are the easiest gear to buy used: small, cheap to ship, and hard to damage. Prices cluster tightly, so anything well below market is worth a close look.",
  Synthesizers:
    "Vintage synth prices are driven by servicing history as much as by model. A serviced unit at a higher price is often the better buy.",
  "Keyboards & Pianos":
    "Digital pianos depreciate steeply in their first two years, which makes the used market unusually good value here.",
  "Drums & Percussion":
    "Shells and cymbals are usually listed separately, so compare the exact configuration before assuming two listings are the same kit.",
  Microphones:
    "Studio microphones hold value well and are cheap to ship. Watch for counterfeits on the most cloned models by buying from listings with real photos.",
  "Recording & Audio":
    "Interfaces and outboard gear turn over quickly as studios upgrade, so the used market here is deep and prices are competitive.",
  "DJ Equipment":
    "Turntables and mixers rarely come as matched pairs, so you are assembling your rig piece by piece from different sources. Check connector types and electrical specs between components: mixing incompatible standards will leave you with gear that will not integrate.",
  "Orchestral Strings":
    "Orchestral strings live or die by setup and maintenance, so a documented luthier history can be worth more than a lower price from an unknown source. Check whether the listing includes a professional bow and case, since many omit them, which means your true cost is higher than the advertised price.",
  "Brass & Woodwind":
    "Repairs on brass and reeds require specialized technicians, so a documented service history is often worth a price premium over a cheaper neglected instrument. Many listings omit the mouthpiece entirely, so check carefully, since your actual cost is higher than the advertised price without one.",
  "Folk & Traditional":
    "Folk instruments are handcrafted one by one, so maker reputation and construction quality matter far more than the model name. Check the wood for cracks and past repairs, and look for documented maker marks: the voice of a well-built traditional instrument is worth the search.",
  "Parts & Accessories":
    "Parts and accessories let you customize and repair without full-price replacements, but incompatibility will waste your money. Bridges, pickups, tuning machines, and hardware are usually model-specific, so verify that a part actually fits your instrument before buying.",
}
