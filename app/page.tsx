import { MarketClient } from "@/components/market-client"
import { StructuredData } from "@/components/structured-data"
import { getFallbackProducts } from "@/lib/products"
import { getLiveInventory } from "@/lib/aggregator"

// Re-aggregate live store inventory at most every 2 hours.
export const revalidate = 7200

export default async function Home() {
  const live = await getLiveInventory()
  const usingLive = live.products.length > 0
  const products = usingLive ? live.products : getFallbackProducts()

  return (
    <>
      <StructuredData products={products} />
      <MarketClient
        products={products}
        updatedAt={live.cachedAt}
        usingLive={usingLive}
        storeStatus={live.storeStatus}
      />
    </>
  )
}
