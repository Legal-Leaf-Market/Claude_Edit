import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
  if (source === "folkcraft") return "Folkcraft Instruments"
  if (source === "acousticguitar") return "Acoustic Guitar"
  if (source === "jamstik") return "Jamstik"
  if (source === "jacksonaudio") return "Jackson Audio"
  if (source === "eminencedigital") return "Eminence Digital"
  if (source === "hazeguitar") return "Haze Guitar"
  if (source === "eartguitar") return "EART Guitar"
  if (source === "playwithauthority") return "Play With Authority"
  if (source === "puresmusic") return "Pures Music"
  if (source === "squaver") return "Squaver"
  if (source === "easonmusicstore") return "Eason Music Store"
  if (source === "gokalimba") return "Go Kalimba"
  return source
}

export function titleCase(input: string): string {
  return input.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
}
