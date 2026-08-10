# Product cards for shared links: patch for legal-leafmarket.com

**Merged.** These landed on `code_backup` `main` (merge commit `563f7f7`, plus
`2c4211f`), so the copies here are a reference, not a pending change.

| File here | Goes to |
|---|---|
| `api-share.js` | `api/share.js` |
| `vercel.json.patch` | apply to `vercel.json` (adds one rewrite) |
| `test-share.mjs` | wherever you keep test scripts; it imports `../api-share.js` |

## /p/pick, the self-updating weekly pick

`/p/pick` resolves the best-value ounce under $50 from the live feed on every
request, so there is no weekly step where a product id gets pasted into a link and
no stored choice that can go stale or sell out. Point a permanent short link at it
once and the pick rotates itself.

It ranks size rows rather than products, because a product's headline price per
gram usually comes from a quarter pound. The weight window is a **band** (25 to
40g), not a floor, and a test is what forced that: with a floor alone a quarter
pound at $45 wins a "best ounce under $50" query outright, since 112g clears a 28g
floor and $45 clears the cap. The card would then read "4oz $45" under a message
promising an ounce.

Overridable per request: `?max=` price cap, `?g=` / `?gmax=` the weight band,
`?category=` a different category, `?category=any` to drop the filter. If the pick
ever comes up empty, `?category=any` is the first thing to try, since the likeliest
cause is the classifier labelling an ounce as something other than THCA Flower.

An empty result answers 200 with a plain "nothing qualifies right now" and no cart
button, rather than 404 or a fabricated pick. A link already sitting in someone's
DM should not break because the feed has nothing cheap this week.

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
