import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/admin/gate"
import { OUTREACH_DATA } from "@/lib/outreach/data"

/**
 * WHAT THE OUTREACH BATCH CONTAINED, AND WHAT IT IS WORTH.
 *
 * The tool next door writes the messages. This reads the batch back: 103
 * listings priced against the same book table the tool quotes from, ranked by
 * what the identified pedals are worth against what is being asked.
 *
 * THE HONEST LIMIT IS STATED ON THE PAGE RATHER THAN BURIED. The export has no
 * outcome column, so nothing here can say which openers get replies, which is
 * the question worth the most. Saying that plainly beats a page that looks
 * like conversion analysis and is not.
 *
 * AND EVERY BOOK FIGURE IS A FLOOR. It counts only pedals the table has a
 * price for; the rest are named and left out rather than guessed at, the same
 * rule the quote tool follows for a pedal it cannot price.
 */
export const dynamic = "force-dynamic"

const FEE_RATE = 0.085
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US")

export default async function OutreachReviewPage() {
  if (!(await isAdmin())) {
    redirect("/admin/sign-in?next=" + encodeURIComponent("/admin/outreach/review"))
  }

  const { rows, freq, states, mv, source, generated } = OUTREACH_DATA
  const real = rows.filter((r) => r.real && typeof r.ask === "number")
  const asks = real.map((r) => r.ask as number).sort((a, b) => a - b)
  const median = asks.length ? asks[Math.floor(asks.length / 2)] : 0
  const totalAsk = asks.reduce((a, b) => a + b, 0)
  const stale = rows.filter((r) => typeof r.days === "number" && r.days > 90).length
  const noPrice = rows.length - real.length
  const noPedal = rows.filter((r) => r.named.length === 0).length

  const candidates = real
    .filter((r) => r.nP >= 2 && r.book > 0)
    .map((r) => ({ ...r, ratio: r.book / (r.ask as number) }))
    .sort((a, b) => b.ratio - a.ratio)
  const over = candidates.filter((r) => r.ratio >= 1)
  const unpricedNamed = candidates.reduce((n, r) => n + (r.named.length - r.nP), 0)

  const gaps = freq.filter(([name]) => typeof (mv as Record<string, unknown>)[name] !== "number")
  const stMax = states[0]?.[1] ?? 1
  const fqMax = freq[0]?.[1] ?? 1

  const tiles: [string, string, string, boolean][] = [
    ["Messages sent", String(rows.length), "one per seller", false],
    ["Pipeline asked", usd(totalAsk), `${real.length} with a real price`, false],
    ["Median ask", usd(median), "half are under this", false],
    ["Replies logged", "0", "the export records no outcome", true],
  ]

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-2xl font-black uppercase tracking-wide">Outreach review</h1>
      <p className="mt-2 max-w-[68ch] text-sm text-[var(--text-dim)]">
        {source}, priced against the same book table the outreach tool quotes from. Generated{" "}
        {generated}. Seller names, profile links and descriptions are stripped before this data
        reaches the repository, so nothing personal is stored here.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, note, flag]) => (
          <div
            key={label}
            className={
              "rounded border border-[var(--edge)] bg-[var(--panel)] p-4" +
              (flag ? " border-l-2 border-l-[var(--warn)]" : "")
            }
          >
            <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--text-faint)]">
              {label}
            </div>
            <div className={"mt-1 text-2xl font-black tabular-nums" + (flag ? " text-[var(--warn)]" : "")}>
              {value}
            </div>
            <div className="text-xs text-[var(--text-dim)]">{note}</div>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-black uppercase tracking-wide">The one thing missing</h2>
        <div className="mt-2 rounded border border-[var(--edge)] border-l-2 border-l-[var(--warn)] bg-[var(--panel)] p-4 text-sm text-[var(--text-dim)]">
          <p>
            <b className="text-[var(--text)]">There is no outcome column.</b> The export records who
            was messaged, what they were selling and for how much. It does not record who replied,
            who ignored it, who sold, or at what price. So the question worth the most money here,{" "}
            <b className="text-[var(--text)]">which openers get answers</b>, cannot be asked of this
            data at all.
          </p>
          <p className="mt-2">
            Everything below is about the pipeline: what is out there and what it is worth. That is
            useful and it is not the same thing as knowing what works. Three fields on the next
            batch, replied, bought and price paid, turn this into a measurement.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-black uppercase tracking-wide">The buy list</h2>
        <p className="mt-1 max-w-[72ch] text-sm text-[var(--text-dim)]">
          Ranked by identified book value against asking price. Book counts <b>only</b> pedals the
          table prices, so every figure is a floor: {unpricedNamed} more pedals were named across
          these listings with no book price yet.{" "}
          <b className="text-[var(--accent-text)]">{over.length}</b> are already worth more than they
          ask on the identified pedals alone.
        </p>
        <div className="mt-3 overflow-x-auto rounded border border-[var(--edge)]">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--panel-2)] text-[10px] uppercase tracking-[.12em] text-[var(--text-faint)]">
                <th className="p-2.5 text-left">Listing</th>
                <th className="p-2.5 text-left">Where</th>
                <th className="p-2.5 text-right">Asking</th>
                <th className="p-2.5 text-right">Book</th>
                <th className="p-2.5 text-right">Ratio</th>
                <th className="p-2.5 text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              {candidates.slice(0, 20).map((row, i) => (
                <tr
                  key={row.url || i}
                  className={"border-t border-[var(--edge)]" + (row.ratio >= 1 ? " bg-[rgba(63,224,124,.07)]" : "")}
                >
                  <td className="p-2.5">
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noopener" className="hover:underline">
                        {row.t}
                      </a>
                    ) : (
                      row.t
                    )}
                    <div className="mt-1">
                      {row.named.slice(0, 4).map((n) => (
                        <span
                          key={n}
                          className="mr-1 inline-block rounded-full border border-[var(--edge)] px-2 py-0.5 text-[9px] uppercase tracking-widest text-[var(--text-faint)]"
                        >
                          {n}
                        </span>
                      ))}
                      {row.named.length > 4 ? (
                        <span className="text-[9px] uppercase tracking-widest text-[var(--text-faint)]">
                          +{row.named.length - 4}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-2.5 text-xs text-[var(--text-dim)]">{row.loc}</td>
                  <td className="p-2.5 text-right tabular-nums">{usd(row.ask as number)}</td>
                  <td className="p-2.5 text-right tabular-nums">{usd(row.book)}</td>
                  <td
                    className={
                      "p-2.5 text-right tabular-nums" +
                      (row.ratio >= 1 ? " font-semibold text-[var(--accent-text)]" : "")
                    }
                  >
                    {row.ratio.toFixed(2)}x
                  </td>
                  <td className="p-2.5 text-right tabular-nums text-[var(--text-dim)]">
                    {row.days}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <Bars
          title="Where the gear is"
          note="Two thirds of everything messaged is in one state. Either a real concentration worth a driving route, or a bias in whatever built the list."
          data={states.slice(0, 8).map(([k, v]) => [k, v] as [string, number])}
          max={stMax}
        />
        <Bars
          title="What is being offered"
          note="Counted once per listing, across all 103."
          data={freq.slice(0, 10).map(([k, v]) => [k, v] as [string, number])}
          max={fqMax}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-black uppercase tracking-wide">Next</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--text-dim)]">
          <li>
            <b className="text-[var(--text)]">Add an outcome column</b> to whatever produces the
            export. Replied, bought, price paid.
          </li>
          <li>
            <b className="text-[var(--text)]">Price the {gaps.length} gap entries.</b> The two
            commonest matches are brand catch-alls with no book price, which is the single biggest
            pricing hole here. {noPedal} listings mention no pedal the table knows at all.
          </li>
          <li>
            <b className="text-[var(--text)]">Work the {stale} stale listings.</b> Up for more than
            90 days is the clearest motivated-seller signal in the file.
          </li>
          <li>
            <b className="text-[var(--text)]">{noPrice} have no usable price</b> (placeholders like
            $1 and $12,345). Those are &quot;make me an offer&quot; and want their own queue.
          </li>
        </ul>
      </section>

      <p className="mt-8 max-w-[76ch] border-t border-[var(--edge)] pt-4 text-xs text-[var(--text-faint)]">
        <b>On pricing these from your own sales.</b> The shop holds roughly one listing per product,
        and a market value needs a sample. Publishing a median off a single sale is the error the
        gear pages refuse to make, so the figures above come from the book table rather than from
        what you have sold. Once the same pedal has gone three or four times, your own sold prices
        are the better source and this page should read {""}
        <a href="/admin/inventory" className="underline">the inventory</a> instead.
      </p>
    </main>
  )
}

/**
 * ONE SERIES, ONE HUE, NO LEGEND. Magnitude by category with a single measure
 * needs no categorical palette and so has no colourblind separation problem to
 * solve: the label carries the identity and the bar carries only the size.
 */
function Bars({
  title,
  note,
  data,
  max,
}: {
  title: string
  note: string
  data: [string, number][]
  max: number
}) {
  return (
    <section>
      <h2 className="text-lg font-black uppercase tracking-wide">{title}</h2>
      <p className="mt-1 max-w-[52ch] text-sm text-[var(--text-dim)]">{note}</p>
      <div className="mt-3 flex flex-col gap-1.5">
        {data.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(90px,150px)_1fr_36px] items-center gap-2.5">
            <span className="truncate text-[13px]" title={label}>
              {label}
            </span>
            <span className="h-4 overflow-hidden rounded-[3px] bg-[var(--sunk)]">
              <span
                className="block h-full rounded-r-[3px] bg-[var(--metal-hi)]"
                style={{ width: Math.max(1.5, (value / max) * 100) + "%" }}
              />
            </span>
            <span className="text-right text-[13px] tabular-nums text-[var(--text-dim)]">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
