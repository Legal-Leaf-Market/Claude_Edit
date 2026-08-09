import type { Product } from "@/lib/products"
import {
  buildItemListSchema,
  buildOrganizationSchema,
  buildWebsiteSchema,
} from "@/lib/structured-data"

/**
 * Emits JSON-LD structured data into the server-rendered HTML so crawlers and
 * AI shopping surfaces see it without executing client JS. Rendered from the
 * server page component.
 */
export function StructuredData({ products }: { products: Product[] }) {
  const graphs = [
    buildWebsiteSchema(),
    buildOrganizationSchema(),
    buildItemListSchema(products),
  ]
  return (
    <>
      {graphs.map((schema, i) => (
        <script
          // eslint-disable-next-line react/no-danger
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  )
}
