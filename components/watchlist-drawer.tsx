"use client"

import { useMemo } from "react"
import {
  ArrowDown,
  ArrowUp,
  Bell,
  ExternalLink,
  MailCheck,
  PackageCheck,
  RefreshCw,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import { type Product } from "@/lib/products"
import { classifyChange, type WatchItem } from "@/lib/use-watchlist"

// Current live snapshot for a saved product, derived from the catalog.
type Current = { price: number; inStock: boolean; ppg: number | null }

export function WatchlistDrawer({
  open,
  onClose,
  items,
  products,
  onRemove,
  onResnapshot,
  onClear,
  isAuthed = false,
  userEmail = null,
}: {
  open: boolean
  onClose: () => void
  items: WatchItem[]
  products: Product[]
  onRemove: (id: string) => void
  onResnapshot: (id: string, next: Current) => void
  onClear: () => void
  isAuthed?: boolean
  userEmail?: string | null
}) {
  // Look up each saved item's CURRENT price/availability in the live catalog so
  // we can show what changed since it was saved.
  const currentById = useMemo(() => {
    const map = new Map<string, Current>()
    for (const p of products) {
      const avail = p.variants.filter((v) => v.available)
      const price = avail.length ? Math.min(...avail.map((v) => v.price)) : p.price
      map.set(p.id, { price, inStock: !p.isSoldOut && avail.length > 0, ppg: p.ppgFloat })
    }
    return map
  }, [products])

  // Sort so the wins (restocks, price drops) float to the top.
  const rank: Record<string, number> = { restock: 0, drop: 1, none: 2, rise: 3, soldout: 4 }
  const rows = useMemo(() => {
    return items
      .map((saved) => {
        const current = currentById.get(saved.id) ?? null
        const { change, delta } = classifyChange(saved, current)
        return { saved, current, change, delta }
      })
      .sort((a, b) => (rank[a.change] ?? 9) - (rank[b.change] ?? 9) || b.saved.savedAt - a.saved.savedAt)
  }, [items, currentById])

  const alertCount = rows.filter((r) => r.change === "drop" || r.change === "restock").length

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-label="Watchlist"
        className={`fixed right-0 top-0 z-[61] flex h-full w-[min(94vw,440px)] flex-col border-l border-gold/30 p-4 shadow-[-18px_0_45px_rgba(0,0,0,0.48)] transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ background: "linear-gradient(160deg,#071423,#0b2138 46%,#0f5132)" }}
      >
        <header className="mb-4 flex items-center justify-between border-b border-gold/25 pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wide">
              <Bell className="h-5 w-5 text-gold" /> Watchlist
            </h2>
            <p className="mt-0.5 text-[0.68rem] uppercase tracking-widest text-gold">
              {alertCount > 0
                ? `${alertCount} price/restock alert${alertCount === 1 ? "" : "s"}`
                : "Track price drops & restocks"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close watchlist"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Account status: guests are told an account is required to receive
            alerts; signed-in users see where alerts will be delivered. */}
        {isAuthed ? (
          <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-lime/30 bg-lime/10 p-3">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-lime" strokeWidth={2.4} />
            <div className="min-w-0 text-xs leading-relaxed text-mint">
              <p className="font-black text-lime">You&apos;re all set for alerts</p>
              <p className="mt-0.5 text-mint/80">
                Price-drop &amp; restock alerts for this list will go to{" "}
                <span className="font-bold text-mint">{userEmail ?? "your account email"}</span>.
                Your watchlist is synced to your account across devices.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-3 rounded-2xl border border-gold/35 bg-gold/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-gold" strokeWidth={2.4} />
              <div className="min-w-0 text-xs leading-relaxed">
                <p className="font-black text-gold">Create a free account to get alerts</p>
                <p className="mt-0.5 text-mint/85">
                  Right now this list lives only on this device. Make an account and we&apos;ll link
                  it to your email so you get notified the moment a saved item drops in price or
                  comes back in stock.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <a
                href="/sign-up?redirect=/?watch=1"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-lime to-gold px-3 py-2.5 text-sm font-black text-navy transition hover:opacity-90"
              >
                <UserPlus className="h-4 w-4" strokeWidth={2.6} /> Create account
              </a>
              <a
                href="/sign-in?redirect=/?watch=1"
                className="inline-flex items-center justify-center rounded-xl border border-gold/40 bg-white/5 px-3 py-2.5 text-sm font-bold text-mint transition hover:bg-white/10"
              >
                Log in
              </a>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-2.5 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your watchlist is empty. Tap the bell on any product to save it — we&apos;ll flag it
              here when the price drops or it comes back in stock.
            </p>
          ) : (
            rows.map(({ saved, current, change, delta }) => (
              <div key={saved.id} className="rounded-2xl border border-gold/20 bg-white/[0.06] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-extrabold leading-tight">{saved.title}</div>
                    <div className="mt-0.5 truncate text-xs text-mint/70">
                      {saved.storeName}
                      {saved.strainName ? ` · ${saved.strainName}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(saved.id)}
                    aria-label="Remove from watchlist"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-mint"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Change banner since the item was saved. */}
                <div className="mt-2">
                  {change === "drop" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 px-2.5 py-1 text-[0.72rem] font-black text-lime">
                      <ArrowDown className="h-3.5 w-3.5" strokeWidth={3} />
                      Price dropped ${Math.abs(delta).toFixed(2)}
                    </span>
                  )}
                  {change === "restock" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 px-2.5 py-1 text-[0.72rem] font-black text-lime">
                      <PackageCheck className="h-3.5 w-3.5" strokeWidth={2.6} />
                      Back in stock
                    </span>
                  )}
                  {change === "rise" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-[0.72rem] font-black text-destructive">
                      <ArrowUp className="h-3.5 w-3.5" strokeWidth={3} />
                      Up ${Math.abs(delta).toFixed(2)}
                    </span>
                  )}
                  {change === "soldout" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-[0.72rem] font-black text-destructive">
                      Sold out now
                    </span>
                  )}
                  {change === "none" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.72rem] font-bold text-muted-foreground">
                      No change yet
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-end justify-between gap-2 text-sm">
                  <div className="text-muted-foreground">
                    <div className="text-[0.66rem] uppercase tracking-wide">Saved at</div>
                    <div className="font-bold text-mint/80">${saved.price.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[0.66rem] uppercase tracking-wide text-muted-foreground">
                      Now
                    </div>
                    <div
                      className={`font-black ${
                        change === "drop" || change === "restock"
                          ? "text-lime"
                          : change === "rise"
                            ? "text-destructive"
                            : "text-foreground"
                      }`}
                    >
                      {current ? `$${current.price.toFixed(2)}` : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={saved.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-lime to-gold px-3 py-2 text-sm font-black text-navy transition hover:opacity-90"
                  >
                    <ExternalLink className="h-4 w-4" strokeWidth={2.6} /> View at store
                  </a>
                  {current && (change === "drop" || change === "rise") && (
                    <button
                      type="button"
                      onClick={() => onResnapshot(saved.id, current)}
                      aria-label="Reset saved price to current"
                      title="Reset baseline to current price"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-mint transition hover:bg-gold/20"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {rows.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
              Alerts compare the live catalog against the price when you saved each item.{" "}
              {isAuthed
                ? "Your watchlist is synced to your account."
                : "Your watchlist is stored on this device until you create an account."}
            </p>
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-xl border border-gold/30 bg-white/5 px-3 py-2.5 text-sm font-bold text-mint transition hover:bg-white/10"
            >
              Clear watchlist
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
