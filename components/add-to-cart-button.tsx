"use client"

import { ShoppingCart, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart, type CartItem } from "@/lib/cart/context"

export function AddToCartButton({ item }: { item: Omit<CartItem, "qty"> }) {
  const { addItem, removeItem, isInCart } = useCart()
  const inCart = isInCart(item.listingId)

  return (
    <Button
      type="button"
      variant={inCart ? "subtle" : "outline"}
      size="sm"
      className="w-full"
      onClick={() => (inCart ? removeItem(item.listingId) : addItem(item))}
    >
      {inCart ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          In GA Cart
        </>
      ) : (
        <>
          <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
          Add to GA Cart
        </>
      )}
    </Button>
  )
}

/**
 * THE CART, AS A KNOB BESIDE THE WAY OUT.
 *
 * A search grid used to carry two full-width bars per card, one of them a
 * saturated green gradient, which made twenty identical shouts and no
 * hierarchy: section 16 reserves the LED for things that are lit and says
 * plainly that full chrome is earned by ONE primary action per view. Going out
 * to the shop is that action. Putting something in the cart is a second, minor
 * one, and a second bar of the same width said the opposite.
 *
 * So it is an icon control, which is what this design system already calls a
 * knob, and it keeps its full name for a screen reader and in the tooltip.
 * Added state is the LED language again: lit means it is in.
 */
export function AddToCartKnob({ item }: { item: Omit<CartItem, "qty"> }) {
  const { addItem, removeItem, isInCart } = useCart()
  const inCart = isInCart(item.listingId)
  const label = inCart ? `Take ${item.title} out of the GA Cart` : `Add ${item.title} to the GA Cart`

  return (
    <button
      type="button"
      onClick={() => (inCart ? removeItem(item.listingId) : addItem(item))}
      aria-pressed={inCart}
      title={inCart ? "In the GA Cart" : "Add to the GA Cart"}
      className="knob h-10 w-10 flex-none"
    >
      {inCart ? (
        <Check className="h-4 w-4 text-[var(--brand-led)]" aria-hidden="true" />
      ) : (
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </button>
  )
}
