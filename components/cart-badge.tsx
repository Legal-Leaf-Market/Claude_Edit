"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { useCart } from "@/lib/cart/context"

/** Small client island so the rest of the header can stay a server component. */
export function CartBadge() {
  const { totalCount } = useCart()

  return (
    <Link
      href="/cart"
      aria-label={totalCount > 0 ? `Cart, ${totalCount} items` : "Cart"}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--chrome-dk)] hover:text-[var(--text)]"
    >
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      {totalCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sage-dk)] px-1 text-[10px] font-semibold text-[#04140a]">
          {totalCount > 99 ? "99+" : totalCount}
        </span>
      )}
    </Link>
  )
}
