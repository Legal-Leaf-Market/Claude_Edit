# Product cards for shared links: patch for legal-leafmarket.com

These two files belong in the **legal-leaf-market/code_backup** repo, not this one.
They are staged here because this session only had read access to that repo.

| File here | Goes to |
|---|---|
| `api-share.js` | `api/share.js` |
| `vercel.json.patch` | apply to `vercel.json` (adds one rewrite) |
| `test-share.mjs` | wherever you keep test scripts; it imports `../api-share.js` |

## The problem it solves

Pasting a product link into an Instagram DM produced the same generic card every
time: "Legal-Leaf Market: Compare Legal Hemp Deals by Price Per Gram" with
`/og-image.png`. Two reasons, both structural:

1. **There was no per-product URL to paste.** `vercel.json` routes only the static
   pages. Products are rendered client side from `/api/products`, and the only
   deep link anywhere in the front end is `#admin`.
2. **Link-preview crawlers do not run JavaScript.** Instagram, Facebook and the
   rest read the og: tags in the HTML the server returns. Every page ships the
   same site-level tags, so a client-rendered product view cannot produce a
   product card no matter what the link looks like.

## What it adds

`/p/<product-id>` server renders one product: og:title with the name, size and
price, og:description with the price per gram and the store, og:image set to the
product's own photo, `og:type=product`, and `twitter:card=summary_large_image`.
That is what makes the DM render a real product card.

It does not re-run the scrape. It fetches the site's own `/api/products`, which is
already CDN cached, so a warm hit is one cheap request rather than twenty store
scrapes. The route itself is cached `s-maxage=600` with a long
`stale-while-revalidate`.

Optional `?s=<index>` picks a specific size row, same semantics as choosing a size
on a product card. Default is the cheapest size with a real price, so the card
never advertises a number the shopper cannot get.

## It follows the existing flow, and adds no new one

One action on the page, **Add to cart**, which:

- writes to the same `ll_cart` localStorage key `consumables.html` uses,
- pushes the identical item shape `addToCart()` pushes, field for field:
  `id, name, store, storeKey, domain, cartDomain, platform, ref, refLink, coupon, url, price, size, variantId, cur`,
- fires the same `LL.track('add_to_cart', ...)` event,
- then sends them to `/consumables#cart`, where the existing drawer and per-store
  checkout take over.

**Affiliate references are carried, not rebuilt.** `ref`, `refLink`, `coupon` and
the ref-stamped `url` all travel on the cart item, so `storeCheckoutUrl()` builds
the outbound link exactly as it does for any other item. The test proves this by
extracting the real `storeCheckoutUrl` out of `consumables.html` and running it
against the cart item this page produces:

```
https://thcaking.com/cart/4411:1?discount=JACOBKENNEDY&ref=coffeeandajoint
```

No vendor button, no email capture, no second checkout path. The vendor is reached
through the cart, the way it is everywhere else on the site.

## Security note

Product names, image URLs and product URLs all originate in third-party store
feeds, and this page writes them into server-rendered HTML. So:

- everything goes through `esc()` for both element text and quoted attributes,
- image and link URLs pass `httpsOnly()`, which drops anything that is not really
  https rather than sanitising it into something plausible, so a poisoned feed row
  cannot smuggle `javascript:` into an href,
- the cart item JSON embedded in the page has every `<` escaped to `<`, so a
  product name containing `</script>` cannot close the script tag.

The test suite includes a deliberately hostile feed row covering each of these.

## Tests

```
node test-share.mjs
```

Stubs `fetch` with product rows in the real shape, then checks the og: tags a
crawler would read, that exactly one primary action exists and it is Add to cart,
that no vendor button or capture flow crept in, that affiliate refs and the coupon
survive into a real checkout URL, that `?s=` selects a size, that the hostile row
is neutralised, and that a dead id 404s with a noindex fallback card.

## Two things to decide

- **Indexing.** These pages are currently indexable and self-canonical. Thousands
  of thin product pages can be an SEO liability, so consider either adding them to
  the sitemap deliberately as real product pages, or disallowing `/p/` in
  `robots.txt` and treating them purely as share links.
- **Preview caching.** Meta's crawler caches a URL's preview. If a card ever
  renders wrong, re-scrape it in the Facebook Sharing Debugger rather than waiting
  it out. UTM tags make each week's URL distinct anyway, which sidesteps most of it.
