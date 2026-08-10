import type { Metadata } from "next"
import { MerchantLeadForm } from "@/components/merchant-lead-form"

export const metadata: Metadata = {
  title: "Get Your Shop Listed",
  description:
    "Own an independent music gear shop, or know one that should be on Gear Avail? Tell us about it.",
  alternates: { canonical: "/list-your-shop" },
}

export default function ListYourShopPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-black text-[var(--cream)] sm:text-3xl">
        Get your shop listed on Gear Avail
      </h1>
      <p className="mt-3 text-base leading-relaxed text-[var(--muted-foreground)]">
        Own a shop, or know a local one that belongs here? Either way, start below. This is a real
        conversation with a person, not an automatic signup, and it never costs the shop anything
        to be listed.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
        The short version of what we need: some way to read what is actually in stock, not a
        marketing page. An existing online store is the easiest path. A point-of-sale system by
        itself usually is not enough on its own, though a few (Shopify POS's low-cost Starter plan
        is one) can add a minimal product-and-checkout page without building a full website. If
        none of that sounds familiar, that is completely fine: say so below and we will work out
        the best path together.
      </p>

      <div className="mt-8">
        <MerchantLeadForm />
      </div>
    </div>
  )
}
