import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/admin/gate"
import { fetchShopListings, type ShopListing } from "@/lib/reverb/shop"
import { fetchSoldOrders } from "@/lib/reverb/orders"

/**
 * WHAT WE PAID, WHAT WE ARE ASKING, AND WHAT IS LEFT AFTER FEES.
 *
 * The shop pages answer "what is for sale". This answers the only question
 * that decides whether the next buy happens, and it answers it from Reverb
 * rather than from a spreadsheet: `seller_cost` is already on every listing,
 * so cost and price live in one place and cannot disagree.
 *
 * ADMIN ONLY, AND SERVER RENDERED. Cost never crosses to the browser as data:
 * this page is HTML by the time it leaves. The public endpoint projects cost
 * away entirely (see `toPublic`), so the two surfaces cannot be confused.
 *
 * EVERY FIGURE IS ARITHMETIC ON REVERB'S OWN CENTS. Nothing here is a seed, an
 * estimate or a book price, which is what separates this page from
 * /buymyboard: those numbers are guesses about somebody else's gear, and
 * these are facts about ours. A row with no cost recorded says so and is left
 * out of the totals rather than counted as free, which is the same rule the
 * quote tool follows for a pedal it cannot price.
 */
export const dynamic = "force-dynamic"

const FEE_RATE = 0.085

const money = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Row = ShopListing & { netCents: number | null; marginCents: number | null; marginPct: number | null }

function withMargin(row: ShopListing): Row {
  const net = row.priceCents === null ? null : Math.round(row.priceCents * (1 - FEE_RATE))
  const margin = net === null || row.costCents === null ? null : net - row.costCents
  const pct = margin === null || !row.costCents ? null : (margin / row.costCents) * 100
  return { ...row, netCents: net, marginCents: margin, marginPct: pct }
}

export default async function InventoryPage() {
  if (!(await isAdmin())) redirect("/admin/sign-in?next=" + encodeURIComponent("/admin/inventory"))

  /* Three reads, in parallel: live stock, sold stock (for its cost), and the
     orders that say what each one actually went for. */
  const [result, soldStock, orders] = await Promise.all([
    fetchShopListings(),
    fetchShopListings("sold"),
    fetchSoldOrders(),
  ])

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-2xl font-black uppercase tracking-wide">Inventory</h1>
        <p className="mt-4 text-[var(--text-dim)]">
          The Reverb shop did not answer, so there is nothing to report rather than something to
          doubt. It said: {result.reason}
        </p>
      </main>
    )
  }

  const rows = result.listings.map(withMargin)
  const priced = rows.filter((r) => r.costCents !== null && r.netCents !== null)
  const noCost = rows.length - priced.length

  const totalCost = priced.reduce((n, r) => n + (r.costCents ?? 0), 0)
  const totalAsk = priced.reduce((n, r) => n + (r.priceCents ?? 0), 0)
  const totalNet = priced.reduce((n, r) => n + (r.netCents ?? 0), 0)
  const totalMargin = totalNet - totalCost
  const marginPct = totalCost ? (totalMargin / totalCost) * 100 : null

  const tiles: [string, string, string][] = [
    ["Cost of goods", money(totalCost), `${priced.length} of ${rows.length} with a cost recorded`],
    ["Asking", money(totalAsk), "before fees"],
    ["After fees", money(totalNet), `${(FEE_RATE * 100).toFixed(1)}% taken off`],
    ["Margin if it all sells", money(totalMargin), marginPct === null ? "" : `${marginPct.toFixed(0)}% on cost`],
  ]

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-2xl font-black uppercase tracking-wide">Inventory</h1>
      <p className="mt-2 max-w-[64ch] text-sm text-[var(--text-dim)]">
        Live from the Reverb shop. Cost is whatever is in each listing&apos;s seller cost field, so
        the only way a number here is wrong is if that field is.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, note]) => (
          <div key={label} className="rounded border border-[var(--edge)] bg-[var(--panel)] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--text-faint)]">
              {label}
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums">{value}</div>
            {note ? <div className="mt-0.5 text-xs text-[var(--text-dim)]">{note}</div> : null}
          </div>
        ))}
      </div>

      {noCost > 0 ? (
        <p className="mt-4 rounded border border-[var(--edge)] border-l-2 border-l-[var(--warn)] bg-[var(--sunk)] p-3 text-sm text-[var(--text-dim)]">
          <b className="text-[var(--text)]">{noCost}</b> {noCost === 1 ? "listing has" : "listings have"} no
          seller cost recorded in Reverb, so {noCost === 1 ? "it is" : "they are"} left out of the totals
          rather than counted as free. Add the cost on Reverb and it appears here.
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded border border-[var(--edge)]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--panel-2)] text-[10px] uppercase tracking-[.12em] text-[var(--text-faint)]">
              <th className="p-2.5 text-left">Pedal</th>
              <th className="p-2.5 text-right">Cost</th>
              <th className="p-2.5 text-right">Asking</th>
              <th className="p-2.5 text-right">After fees</th>
              <th className="p-2.5 text-right">Margin</th>
              <th className="p-2.5 text-right">On cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--edge)]">
                <td className="p-2.5">
                  <a href={row.url} target="_blank" rel="noopener" className="hover:underline">
                    {row.title}
                  </a>
                  {row.sku ? (
                    <span className="ml-2 text-[10px] uppercase tracking-widest text-[var(--text-faint)]">
                      {row.sku}
                    </span>
                  ) : null}
                </td>
                <td className="p-2.5 text-right tabular-nums">
                  {row.costCents === null ? (
                    <span className="text-[var(--warn)]">not set</span>
                  ) : (
                    money(row.costCents)
                  )}
                </td>
                <td className="p-2.5 text-right tabular-nums">
                  {row.priceCents === null ? "" : money(row.priceCents)}
                </td>
                <td className="p-2.5 text-right tabular-nums text-[var(--text-dim)]">
                  {row.netCents === null ? "" : money(row.netCents)}
                </td>
                <td className="p-2.5 text-right font-semibold tabular-nums">
                  {row.marginCents === null ? "" : money(row.marginCents)}
                </td>
                <td className="p-2.5 text-right tabular-nums text-[var(--text-dim)]">
                  {row.marginPct === null ? "" : row.marginPct.toFixed(0) + "%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SoldSection
        orders={orders.ok ? orders.orders : []}
        connected={orders.ok}
        reason={orders.ok ? null : orders.reason}
        costs={
          new Map(
            (soldStock.ok ? soldStock.listings : [])
              .filter((row) => row.costCents !== null)
              .map((row) => [row.id, row.costCents as number]),
          )
        }
      />

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--text-faint)]">
        Margin is the asking price less {(FEE_RATE * 100).toFixed(1)}% in fees, less cost. It is what
        the lot makes if every pedal sells at the price it is listed at, which is the optimistic end:
        it counts no discounts, no offers accepted and no shipping you absorb. Sold prices and
        discounts live in Reverb&apos;s orders API rather than on a listing, so they are not on this
        page yet, and the sold table below is where they land once they are.
      </p>
    </main>
  )
}

/**
 * WHAT ACTUALLY HAPPENED, as opposed to what we hoped would.
 *
 * The table above is the optimistic end: every pedal at its asking price with
 * nobody haggling. This one is the realised end, and the gap between them is
 * the single most useful number here, because it is the one the next buy
 * should be sized on.
 *
 * NOT CONNECTED IS A STATE AND IT SAYS SO. An empty sold table under a heading
 * reads as a month with no sales, which is a very different thing from an
 * endpoint nobody has bound yet.
 */
function SoldSection({
  orders,
  connected,
  reason,
  costs,
}: {
  orders: import("@/lib/reverb/orders").SoldOrder[]
  connected: boolean
  reason: string | null
  costs: Map<string, number>
}) {
  if (!connected) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-black uppercase tracking-wide">Sold</h2>
        <p className="mt-2 max-w-[70ch] rounded border border-[var(--edge)] border-l-2 border-l-[var(--warn)] bg-[var(--sunk)] p-3 text-sm text-[var(--text-dim)]">
          The orders endpoint has not answered yet, so there is nothing here rather than a table of
          zeroes that would read as a month with no sales. It said: {reason}
        </p>
      </section>
    )
  }
  if (!orders.length) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-black uppercase tracking-wide">Sold</h2>
        <p className="mt-2 text-sm text-[var(--text-dim)]">Nothing sold yet.</p>
      </section>
    )
  }

  const rows = orders.map((order) => {
    const cost = order.listingId ? (costs.get(order.listingId) ?? null) : null
    const net = order.soldCents === null ? null : Math.round(order.soldCents * (1 - FEE_RATE))
    const margin = net === null || cost === null ? null : net - cost
    return { order, cost, net, margin }
  })

  const withCost = rows.filter((r) => r.margin !== null)
  const gross = rows.reduce((n, r) => n + (r.order.soldCents ?? 0), 0)
  const discounts = rows.reduce((n, r) => n + (r.order.discountCents ?? 0), 0)
  const realised = withCost.reduce((n, r) => n + (r.margin ?? 0), 0)

  return (
    <section className="mt-8">
      <h2 className="text-lg font-black uppercase tracking-wide">Sold</h2>
      <p className="mt-1 text-sm text-[var(--text-dim)]">
        {rows.length} {rows.length === 1 ? "sale" : "sales"}, {money(gross)} taken
        {discounts > 0 ? `, ${money(discounts)} given away in discounts` : ", no discounts given"}
        {withCost.length ? `, ${money(realised)} realised after fees and cost` : ""}.
      </p>
      <div className="mt-3 overflow-x-auto rounded border border-[var(--edge)]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--panel-2)] text-[10px] uppercase tracking-[.12em] text-[var(--text-faint)]">
              <th className="p-2.5 text-left">Pedal</th>
              <th className="p-2.5 text-right">Listed</th>
              <th className="p-2.5 text-right">Sold for</th>
              <th className="p-2.5 text-right">Discount</th>
              <th className="p-2.5 text-right">Cost</th>
              <th className="p-2.5 text-right">Realised</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, cost, margin }) => (
              <tr key={order.id} className="border-t border-[var(--edge)]">
                <td className="p-2.5">{order.title || order.id}</td>
                <td className="p-2.5 text-right tabular-nums text-[var(--text-dim)]">
                  {order.listedCents === null ? "" : money(order.listedCents)}
                </td>
                <td className="p-2.5 text-right tabular-nums">
                  {order.soldCents === null ? "" : money(order.soldCents)}
                </td>
                <td className="p-2.5 text-right tabular-nums text-[var(--warn)]">
                  {order.discountCents ? money(order.discountCents) : ""}
                </td>
                <td className="p-2.5 text-right tabular-nums">
                  {cost === null ? <span className="text-[var(--warn)]">not set</span> : money(cost)}
                </td>
                <td className="p-2.5 text-right font-semibold tabular-nums">
                  {margin === null ? "" : money(margin)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
