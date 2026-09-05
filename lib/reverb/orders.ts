import { env } from "@/lib/env"

/**
 * WHAT ACTUALLY SOLD, AND FOR HOW MUCH.
 *
 * The listings API answers "what are we asking". This answers "what did we
 * get", which is a different number every time an offer is accepted or a
 * discount is given, and it is the one that decides whether the model works.
 *
 * ORDERS ARE NOT LISTINGS, AND THE DIFFERENCE IS PRIVACY. An order carries a
 * buyer: a name, an address, a payment. None of that is any of this site's
 * business and none of it is normalised here. What comes out is the money and
 * the link back to our own listing, and nothing that identifies a person. The
 * reader is admin-only at every layer above it too, which is belt and braces
 * rather than either one alone.
 *
 * SAME CARVE-OUT AS `shop.ts`. Section 2 bans the Reverb API for building the
 * catalogue because it is scoped to managing your own shop. Reading our own
 * sales is that scope exactly. Nothing here reaches `marketplace_listings`, a
 * median or a deal badge.
 *
 * THE ENDPOINT IS A LIST, FOR THE THIRD TIME, and for the third time because
 * it could not be verified from the machine this was written on. Twice now
 * that has been the right call: the listings endpoint landed on the first
 * candidate, and the price field turned out not to be the problem at all. A
 * single wrong guess ships a page of zeroes that looks like a slow month.
 */

export type SoldOrder = {
  id: string
  listingId: string | null
  title: string
  /** What the buyer actually paid for the item, after any discount. */
  soldCents: number | null
  /** What it was listed at, when the order records it separately. */
  listedCents: number | null
  /** Positive when the buyer paid less than the listing price. */
  discountCents: number | null
  shippingCents: number | null
  totalCents: number | null
  soldAt: string | null
  status: string | null
}

export type OrdersResult =
  | { ok: true; orders: SoldOrder[]; source: string; raw?: Record<string, unknown> }
  | { ok: false; reason: string }

const ENDPOINTS = [
  "https://api.reverb.com/api/my/orders/selling/all?per_page=100",
  "https://api.reverb.com/api/my/orders/selling?per_page=100",
  "https://api.reverb.com/api/my/orders/selling/paid?per_page=100",
]

/** Reverb reports money as an object with cents on it. Cents is the only
 *  field worth doing arithmetic in. */
function cents(value: unknown): number | null {
  if (!value || typeof value !== "object") return null
  const money = value as Record<string, unknown>
  if (typeof money.amount_cents === "number") return money.amount_cents
  if (typeof money.amount === "string") {
    const n = Number(money.amount)
    return Number.isFinite(n) ? Math.round(n * 100) : null
  }
  return null
}

function pick(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const found = cents(raw[key])
    if (found !== null) return found
  }
  return null
}

function normalize(raw: Record<string, unknown>): SoldOrder | null {
  const id = raw.order_number ?? raw.id
  if (id === undefined || id === null) return null

  const listing = (raw.listing ?? {}) as Record<string, unknown>
  const title =
    typeof raw.title === "string" ? raw.title
      : typeof listing.title === "string" ? listing.title
        : ""

  /* Named alternatives rather than one guess: Reverb's order payload has
     changed shape over the years and the wrong single key reads as a sale of
     nothing rather than as a missing field. */
  const sold = pick(raw, ["amount_product", "amount_product_subtotal", "subtotal", "price"])
  const listed = pick(raw, ["listing_price", "amount_product_original", "original_price"])
  const shipping = pick(raw, ["shipping", "amount_shipping"])
  const total = pick(raw, ["total", "amount_total"])

  const explicit = pick(raw, ["discount", "amount_discount"])
  const derived = listed !== null && sold !== null && listed > sold ? listed - sold : null

  return {
    id: String(id),
    listingId:
      raw.listing_id !== undefined && raw.listing_id !== null ? String(raw.listing_id)
        : listing.id !== undefined && listing.id !== null ? String(listing.id)
          : null,
    title,
    soldCents: sold,
    listedCents: listed,
    discountCents: explicit ?? derived,
    shippingCents: shipping,
    totalCents: total,
    soldAt:
      typeof raw.created_at === "string" ? raw.created_at
        : typeof raw.paid_at === "string" ? raw.paid_at : null,
    status:
      typeof raw.status === "string" ? raw.status
        : typeof raw.state === "string" ? raw.state : null,
  }
}

export async function fetchSoldOrders(): Promise<OrdersResult> {
  const { token } = env.reverbShop
  if (!token) return { ok: false, reason: "REVERB_SHOP_TOKEN is not set" }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/hal+json",
    "Content-Type": "application/hal+json",
    "Accept-Version": "3.0",
  }

  const failures: string[] = []
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { headers, cache: "no-store" })
      if (!res.ok) {
        /* Status only. A body can quote the request back, and the request
           carries the bearer token. */
        failures.push(`${new URL(url).pathname} -> ${res.status}`)
        continue
      }
      const body = (await res.json()) as Record<string, unknown>
      const rows = Array.isArray(body.orders) ? body.orders
        : Array.isArray(body.results) ? body.results : []
      const orders = rows
        .map((row) => normalize(row as Record<string, unknown>))
        .filter((order): order is SoldOrder => order !== null)
      if (orders.length) {
        return {
          ok: true,
          orders,
          source: new URL(url).pathname,
          raw: rows[0] as Record<string, unknown>,
        }
      }
      failures.push(`${new URL(url).pathname} -> 200, no orders`)
    } catch (error) {
      failures.push(`${new URL(url).pathname} -> ${(error as Error).message}`)
    }
  }
  return { ok: false, reason: failures.join("; ") || "no endpoint answered" }
}
