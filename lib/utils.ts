import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { storefrontMerchant } from "@/lib/storefronts"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Cents to a display price. Whole dollars drop the ".00" so grids stay scannable. */
export function formatPrice(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null || !Number.isFinite(cents)) return "Price unavailable"
  const dollars = cents / 100
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars)
}

/** A deal margin as a rounded percentage, e.g. 0.243 becomes "24%". */
export function formatMargin(margin: number | null | undefined): string | null {
  if (margin == null || !Number.isFinite(margin) || margin <= 0) return null
  return `${Math.round(margin * 100)}%`
}

/** Relative time for listing ages, in the spelling a shopper would use. */
export function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null

  const seconds = Math.floor((Date.now() - then) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/** Display name for a source. Keep in step with the SOURCES union. */
export function sourceLabel(source: string): string {
  if (source === "ebay") return "eBay"
  if (source === "reverb") return "Reverb"
  if (source === "sweetwater") return "Sweetwater"
  if (source === "gear4music") return "Gear4music"
  if (source === "zzounds") return "zZounds"
  if (source === "fullcompass") return "Full Compass Systems"
  if (source === "pinevillemusic") return "Pineville Music"
  /*
   * Independent storefronts carry their own label on their registry row, so
   * this reads it rather than restating twelve of them. A store added as one
   * row must not need a second edit here to stop showing up as "gokalimba".
   */
  const storefront = storefrontMerchant(source)
  if (storefront) return storefront.label
  if (source === "andertons") return "Andertons Music Company"
  if (source === "americanmusical") return "American Musical Supply"
  if (source === "musiciansfriend") return "Musician's Friend"
  if (source === "nativeinstruments") return "Native Instruments"
  if (source === "fender") return "Fender"
  if (source === "universalaudio") return "Universal Audio"
  if (source === "donner") return "Donner Music"
  if (source === "pluginalliance") return "Plugin Alliance"
  return source
}

export function titleCase(input: string): string {
  return input.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
}

/**
 * Category name to slug. Must stay identical to slugify() in
 * lib/canonical/model-parse.ts, including turning "&" into " and " -- getting
 * that wrong is what left three homepage category links 404ing. Duplicated
 * rather than imported because the filter rail is a client component.
 */
export function slugifyCategory(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
