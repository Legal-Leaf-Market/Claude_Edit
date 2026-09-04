import type { JsonLd } from "@/lib/seo/structured-data"

/**
 * ONE WAY TO PUT STRUCTURED DATA ON A PAGE.
 *
 * Every builder in `lib/seo/structured-data.ts` can return null when the page
 * has nothing true to say, and the whole point of that is lost if each call
 * site has to remember to check. So this takes the nulls: pass it whatever the
 * builders returned and the ones that declined simply do not render.
 *
 * `dangerouslySetInnerHTML` is required here rather than chosen. React escapes
 * text children, and an escaped `&` or `<` inside JSON-LD makes the block
 * unparseable, which fails silently: the markup is present, looks right in the
 * page source, and every validator rejects it.
 *
 * The `<` in any string value is escaped by hand for the one case that matters:
 * a value containing `</script>` would close this tag early and put the rest of
 * the JSON into the document as markup. Product names come from feeds, so that
 * is external text.
 */
export function JsonLdScript({ data }: { data: (JsonLd | null | undefined)[] }) {
  const blocks = data.filter((entry): entry is JsonLd => Boolean(entry))
  if (!blocks.length) return null

  return (
    <>
      {blocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(block).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  )
}
