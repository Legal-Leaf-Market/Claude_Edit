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
