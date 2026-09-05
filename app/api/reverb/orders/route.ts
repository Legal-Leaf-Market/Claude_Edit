import { isAdmin } from "@/lib/admin/gate"
import { fetchSoldOrders } from "@/lib/reverb/orders"

/**
 * SALES, ADMIN ONLY, AT EVERY LAYER.
 *
 * Unlike `/api/reverb/shop` there is no public half of this and there never
 * will be. An order is a transaction with a person on the other end of it: it
 * is our margin and their purchase, and neither belongs on an open endpoint.
 *
 * `?debug=1` returns the raw key list and the money-shaped fields of one
 * order, which is how the field names get bound on evidence rather than on a
 * third guess. Everything else returns the normalised rows, which carry money
 * and a listing id and nothing that identifies a buyer.
 */
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Not found", { status: 404 })

  const result = await fetchSoldOrders()

  if (new URL(request.url).searchParams.get("debug") === "1") {
    const raw = result.ok ? (result.raw ?? {}) : {}
    return Response.json(
      {
        ok: result.ok,
        reason: result.ok ? null : result.reason,
        source: result.ok ? result.source : null,
        count: result.ok ? result.orders.length : 0,
        keys: Object.keys(raw).sort(),
        moneyish: Object.fromEntries(
          Object.entries(raw).filter(([key]) =>
            /amount|price|total|discount|shipping|fee|subtotal/i.test(key),
          ),
        ),
        firstNormalised: result.ok ? result.orders[0] : null,
      },
      { headers: { "cache-control": "private, no-store" } },
    )
  }

  if (!result.ok) {
    return Response.json(
      { orders: [], connected: false, reason: result.reason },
      { headers: { "cache-control": "private, no-store" } },
    )
  }

  return Response.json(
    { orders: result.orders, connected: true, source: result.source },
    { headers: { "cache-control": "private, no-store" } },
  )
}
