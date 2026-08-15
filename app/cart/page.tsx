import type { Metadata } from "next"
import { CartPageContent } from "@/components/cart-page-content"

export const metadata: Metadata = {
  title: "Cart",
  description: "Your Gear Avail cart, grouped by store.",
  robots: { index: false, follow: false },
}

export default function CartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-[var(--cream)] sm:text-3xl">Your cart</h1>
      <CartPageContent />
    </div>
  )
}
