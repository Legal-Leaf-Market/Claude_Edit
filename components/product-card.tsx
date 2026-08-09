"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Bell, BellRing, Leaf, Plus, ShieldCheck, Store } from "lucide-react"
import {
  DISCOUNT_CODE,
  discountedPrice,
  discountPercent,
  displayStrainName,
  pricePer100mg,
  qualifyingVariants,
  sizeLabel,
  variantBudgetTotal,
  variantShipping,
  type Product,
  type Variant,
  type StrainTag,
} from "@/lib/products"
import type { CartItem } from "@/lib/use-cart"
import { BADGES, type BadgeId } from "@/lib/badges"
import { StrainInfo } from "@/components/strain-info"
import { ProductImage } from "@/components/product-image"
import { CoaModal } from "@/components/coa-modal"

const TAG_STYLES: Record<StrainTag, string> = {
  Sativa: "bg-[#f0a05a]/20 text-[#ffcf9e] border-[#f0a05a]/40",
  Indica: "bg-[#8a6bd6]/20 text-[#d5c6ff] border-[#8a6bd6]/40",
  Hybrid: "bg-lime/15 text-mint border-lime/40",
  Indoor: "bg-jade/25 text-mint border-jade/50",
  Greenhouse: "bg-gold/15 text-gold border-gold/40",
}

// Short gram string, e.g. 0.5 -> "0.5g", 28 -> "28g".
function gramsShort(g: number): string {
  return `${Number(g.toFixed(2))}g`
}

// Always-unique dropdown label that always names WHAT the option is, not just
// how much:
// - weight variants are prefixed with the strain ("Blue Dream · Ounce (28g)")
// - flavor/strain variants show the option plus its weight ("Sour Strawberry · 0.5g")
function variantLabel(v: Variant, strainName = ""): string {
  const strain = strainName.trim()
  const withStrain = (label: string) => (strain ? `${strain} · ${label}` : label)
  // Weighted flower: the option is only a size, so prefix the strain name.
  if (v.weighted && v.grams) return withStrain(sizeLabel(v.grams))
  // Flavor/strain variants: the option label already names the strain/flavor.
  const opt = v.optionLabel || v.title
  if (opt && v.grams) return `${opt} · ${gramsShort(v.grams)}`
  if (opt) return opt
  if (v.grams) return withStrain(sizeLabel(v.grams))
  return strain || "Option"
}

export function ProductCard({
  product,
  budget,
  minGrams,
  avgPpg,
  badges = [],
  crossStore,
  onCompareStrain,
  saved = false,
  onToggleSave,
  onAdd,
  onCheckoutStore,
  priority = false,
}: {
  product: Product
  budget: number
  minGrams: number
  avgPpg?: number
  badges?: BadgeId[]
  saved?: boolean
  onToggleSave?: (product: Product) => void
  crossStore?: {
    strainName: string
    storeCount: number
    cheapestStore: string
    cheapestTotal: number
    thisTotal: number
    isCheapest: boolean
    savings: number
  }
  onCompareStrain?: (strain: string) => void
  onAdd: (item: Omit<CartItem, "qty">) => void
  onCheckoutStore: (storeName: string) => void
  priority?: boolean
}) {
  const filtersActive = minGrams > 0 || budget > 0

  // Only ever show IN-STOCK options in the dropdown so we never raise a
  // shopper's hopes with a sold-out size. When a quantity/budget filter is
  // active, `qualifyingVariants` already restricts to available variants.
  const shownVariants: Variant[] = useMemo(
    () =>
      filtersActive
        ? qualifyingVariants(product, minGrams, budget)
        : product.variants.filter((v) => v.available),
    [product, minGrams, budget, filtersActive],
  )

  const [selectedId, setSelectedId] = useState<string>(
    () => (shownVariants[0] ?? product.variants[0])?.variantId,
  )
  const [coaOpen, setCoaOpen] = useState(false)

  // Keep the selection valid as the visible options change with the filters.
  useEffect(() => {
    if (!shownVariants.some((v) => v.variantId === selectedId)) {
      const next = shownVariants[0]
      if (next) setSelectedId(next.variantId)
    }
  }, [shownVariants, selectedId])

  // Fall back to the first raw variant only for display when nothing is in
  // stock (the whole product is sold out and the Add button stays disabled).
  const hasStock = shownVariants.length > 0
  const variant =
    shownVariants.find((v) => v.variantId === selectedId) ??
    shownVariants[0] ??
    product.variants[0]
  const ppg = variant.grams ? variant.price / variant.grams : null

  // Potency-adjusted value: the product's best $/g translated into cost per
  // 100mg of active cannabinoid. This is the honest cross-listing comparison —
  // a cheap $/g at low potency can lose to a pricier, stronger gram.
  const valuePer100mg = pricePer100mg(product.ppgFloat, product.potencyPct)

  // The strain to look up: when the selected variant is a flavor/strain option
  // (e.g. "Sour Strawberry" on a rosin vape) that IS the strain, so prefer it
  // over the title-extracted name (which would be "Live Rosin"). For weighted
  // flower variants the product-level strain name is correct.
  const selectedFlavor = !variant.weighted ? (variant.optionLabel || "").trim() : ""
  // Guarantee a strain label on EVERY card: prefer the selected flavor, then the
  // strict strain, then a lenient display-only fallback derived from the title.
  // `displayStrainName` already returns the strict name when one exists.
  const cardStrain = product.strainName || displayStrainName(product.title)
  const strainQuery = selectedFlavor || cardStrain

  const budgetActive = budget > 0
  const total = variantBudgetTotal(product, variant)
  // Discount applied via DISCOUNT_CODE (10% everyone, 20% Black Tie). `total`
  // already reflects it; these drive the strikethrough + savings display.
  const pct = discountPercent(product.storeName)
  const netPrice = discountedPrice(product.storeName, variant.price)
  const ship = variantShipping(product, netPrice)
  const left = budget - total

  // Low-stock urgency: few in-stock sizes remaining (and not fully sold out).
  const availableCount = product.variants.filter((v) => v.available).length
  const lowStock = !product.isSoldOut && availableCount > 0 && availableCount <= 2

  // Legal-Leaf Pick: our curated recommendation, awarded centrally via badges.
  const showPick = badges.includes("pick") && !product.isSoldOut && hasStock

  // Colorful chips to render in the badge row (low-stock has its own UI below).
  const rowBadges = badges.filter((b) => BADGES[b].inRow)

  // The pick was earned by the product's BEST (lowest) $/g across its sizes, so
  // the blurb quotes that margin — not the currently-selected variant's ppg,
  // which could be a small pack that reads as barely below average.
  const pickPctBelow =
    avgPpg && product.ppgFloat && product.ppgFloat < avgPpg
      ? Math.min(55, Math.round((1 - product.ppgFloat / avgPpg) * 100))
      : 0

  return (
    <>
    <article
      className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white/[0.055] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)] ${
        product.isSoldOut ? "opacity-70" : ""
      } ${
        showPick
          ? "border-gold/60 ring-2 ring-gold/50 hover:border-gold/80"
          : "border-gold/20 hover:border-gold/40"
      }`}
    >
      {product.isSoldOut && (
        <span className="absolute bottom-3 left-3 z-20 rounded-full bg-destructive/90 px-3 py-1 text-xs font-black uppercase tracking-wide text-navy">
          Sold Out
        </span>
      )}

      {onToggleSave && (
        <button
          type="button"
          onClick={() => onToggleSave(product)}
          aria-pressed={saved}
          aria-label={saved ? "Remove from watchlist" : "Save to watchlist for price alerts"}
          title={saved ? "Saved — watching for price drops & restocks" : "Watch price & restocks"}
          className={`absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition ${
            saved
              ? "border-gold/70 bg-gold/25 text-gold"
              : "border-gold/40 bg-navy/70 text-mint hover:bg-navy/90"
          }`}
        >
          {saved ? (
            <BellRing className="h-4 w-4" strokeWidth={2.6} />
          ) : (
            <Bell className="h-4 w-4" strokeWidth={2.4} />
          )}
        </button>
      )}

      <div className="relative aspect-square w-full bg-black">
        <ProductImage
          src={product.imageUrl || "/placeholder.svg"}
          alt={product.title}
          priority={priority}
        />
        <span className="absolute left-3 top-3 rounded-full border border-gold/40 bg-navy/70 px-3 py-1 text-[0.68rem] font-black uppercase tracking-wide text-mint backdrop-blur">
          {product.storeName}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {rowBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rowBadges.map((b) => (
              <span
                key={b}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.62rem] font-black uppercase tracking-wide shadow-sm ${BADGES[b].chipClass}`}
              >
                {b === "pick" && <Leaf className="h-3 w-3" strokeWidth={2.8} />}
                {BADGES[b].label}
              </span>
            ))}
          </div>
        )}

        {product.extractedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.extractedTags.map((t) => (
              <span
                key={t}
                className={`rounded-full border px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide ${TAG_STYLES[t]}`}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <h3 className="text-base font-extrabold leading-snug">
          {strainQuery ? (
            <StrainInfo name={strainQuery}>{product.title}</StrainInfo>
          ) : (
            <span className="text-pretty">{product.title}</span>
          )}
        </h3>

        {showPick && (
          <div className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gradient-to-r from-lime/10 to-gold/10 px-3 py-2">
            <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-lime" strokeWidth={2.4} />
            <p className="text-[0.72rem] font-semibold leading-tight text-mint">
              <span className="font-black text-lime">Legal-Leaf Pick.</span> Best value we found —
              lowest $/g in its class
              {pickPctBelow ? `, ${pickPctBelow}% under the category average` : ""}. Lab-tested with
              a COA on file.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-black text-lime">
            {product.price ? `Starts at $${product.price.toFixed(2)}` : "N/A"}
          </div>
          {product.ppgDisplay && (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-1 text-xs font-black text-gold">
              {product.ppgDisplay}
            </span>
          )}
        </div>

        {/* Potency-adjusted value — the true apples-to-apples price. Only shown
            when the listing advertises a lab potency we can trust. */}
        {valuePer100mg != null && product.potencyPct != null && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-3 py-1.5">
            <span className="text-[0.66rem] font-black uppercase tracking-wide text-[#7fe9f5]">
              True value
            </span>
            <span className="text-sm font-black text-mint">
              ${valuePer100mg.toFixed(2)}
              <span className="text-[0.7rem] font-bold text-muted-foreground">/100mg</span>
              <span className="ml-1.5 text-[0.7rem] font-bold text-[#7fe9f5]">
                @ {product.potencyPct}%
              </span>
            </span>
          </div>
        )}

        {/* Same-strain cross-store comparison — the aggregator's core promise:
            is this the best price on THIS exact strain? Tapping opens an
            all-stores, best-value view of the strain. */}
        {crossStore && crossStore.storeCount > 1 && onCompareStrain && (
          <button
            type="button"
            onClick={() => onCompareStrain(crossStore.strainName)}
            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
              crossStore.isCheapest
                ? "border-lime/50 bg-lime/10 hover:bg-lime/15"
                : "border-[#a855f7]/40 bg-[#a855f7]/10 hover:bg-[#a855f7]/15"
            }`}
          >
            <span className="flex items-center gap-2">
              <ArrowLeftRight
                className={`h-4 w-4 shrink-0 ${crossStore.isCheapest ? "text-lime" : "text-[#d8b4fe]"}`}
                strokeWidth={2.6}
              />
              <span className="text-[0.72rem] font-bold leading-tight text-mint">
                {crossStore.isCheapest ? (
                  <>
                    <span className="font-black text-lime">Best price</span> across{" "}
                    {crossStore.storeCount} stores
                  </>
                ) : (
                  <>
                    <span className="font-black text-[#d8b4fe]">
                      Save ${crossStore.savings.toFixed(2)}
                    </span>{" "}
                    at {crossStore.cheapestStore}
                  </>
                )}
                <br />
                <span className="text-[0.66rem] font-semibold text-muted-foreground">
                  Compare all {crossStore.storeCount} stores carrying this strain
                </span>
              </span>
            </span>
            <span className="shrink-0 text-[0.66rem] font-black uppercase tracking-wide text-gold">
              Compare
            </span>
          </button>
        )}

        {budgetActive && (
          <div
            className={`rounded-xl border px-3 py-2 text-[0.72rem] font-bold leading-tight ${
              left >= 0
                ? "border-gold/30 bg-gold/10 text-mint"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            Budget fit: <strong className="text-lime">${total.toFixed(2)}</strong> total
            <br />
            <span className="font-medium text-muted-foreground">
              {variantLabel(variant, cardStrain)} ${variant.price.toFixed(2)} + est. ship{" "}
              {ship === 0 ? "FREE" : `$${ship.toFixed(2)}`} ·{" "}
              {left >= 0 ? `$${left.toFixed(2)} left` : `$${Math.abs(left).toFixed(2)} over`}
            </span>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 rounded-xl border border-gold/15 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[0.66rem] font-black uppercase tracking-widest text-gold">
              {filtersActive ? `Matching sizes (${shownVariants.length})` : "In-stock sizes"}
            </label>
            {lowStock && (
              <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wide text-destructive">
                Only {availableCount} size{availableCount === 1 ? "" : "s"} left
              </span>
            )}
          </div>
          {hasStock ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-gold/25 bg-navy/60 px-3 py-2 text-sm font-semibold text-mint outline-none focus:border-lime"
            >
              {shownVariants.map((v) => (
                <option key={v.variantId} value={v.variantId}>
                  {variantLabel(v, cardStrain)} — ${v.price.toFixed(2)}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
              Currently sold out
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="flex items-baseline gap-1.5">
              <span className="text-xl font-black">${netPrice.toFixed(2)}</span>
              <span className="text-sm font-semibold text-muted-foreground line-through">
                ${variant.price.toFixed(2)}
              </span>
            </span>
            <span className={`text-sm font-bold ${ppg ? "text-lime" : "text-muted-foreground"}`}>
              {ppg ? `$${ppg.toFixed(2)}/g` : "— /g"}
            </span>
          </div>

          {/* Always-on landed cost so the "starts at" price isn't misleading. The
              total already includes the DISCOUNT_CODE savings. */}
          {variant.available && (
            <div className="flex flex-col gap-1">
              <p className="text-[0.72rem] font-semibold text-muted-foreground">
                <span className="text-mint">≈ ${total.toFixed(2)}</span> out the door
                <span className="text-muted-foreground/80">
                  {" "}
                  (incl. est. ship {ship === 0 ? "FREE" : `$${ship.toFixed(2)}`})
                </span>
              </p>
              <p className="flex items-center gap-1.5 text-[0.7rem] font-bold text-lime">
                <span className="rounded-full bg-lime/15 px-2 py-0.5 font-black">{pct}% OFF</span>
                <span className="text-mint">
                  code <span className="font-black tracking-wide text-gold">{DISCOUNT_CODE}</span>{" "}
                  applied
                </span>
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={!variant.available}
            onClick={() =>
              onAdd({
                key: `${product.storeName}:${variant.variantId}`,
                storeName: product.storeName,
                storeType: product.storeType,
                cartBaseUrl: product.cartBaseUrl,
                variantId: variant.variantId,
                productId: product.nativeId,
                title: product.title,
                label: variantLabel(variant, cardStrain),
                price: variant.price,
              })
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-lime to-gold px-3 py-2.5 text-sm font-black text-navy transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> Add to Legal-Leaf Cart
          </button>

          <button
            type="button"
            onClick={() => onCheckoutStore(product.storeName)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-bold text-mint transition hover:bg-gold/20"
          >
            <Store className="h-3.5 w-3.5" /> Checkout with cart at {product.storeName}
          </button>

          <button
            type="button"
            onClick={() => setCoaOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 text-[0.66rem] font-semibold text-muted-foreground transition hover:text-mint"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-lime" />
            Lab-tested hemp · view COA
          </button>
        </div>
      </div>
    </article>

      <CoaModal
        open={coaOpen}
        onClose={() => setCoaOpen(false)}
        storeName={product.storeName}
        strainName={strainQuery}
        productLink={product.link}
      />
    </>
  )
}
