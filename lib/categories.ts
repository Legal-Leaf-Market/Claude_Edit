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
}
