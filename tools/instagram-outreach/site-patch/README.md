# Product cards for shared links: patch for legal-leafmarket.com

**Merged.** These landed on `code_backup` `main` (merge commit `563f7f7`, plus
`2c4211f`), so the copies here are a reference, not a pending change.

| File here | Goes to |
|---|---|
| `api-share.js` | `api/share.js` |
| `vercel.json.patch` | apply to `vercel.json` (adds one rewrite) |
| `test-share.mjs` | wherever you keep test scripts; it imports `../api-share.js` |

## /p/pick, the self-updating weekly pick

`/p/pick` resolves an ounce under $50 from the live feed on every request, so
there is no weekly step where a product id gets pasted into a link and no stored
choice that can go stale or sell out. Point a permanent short link at it once and
the pick rotates itself.

Among the qualifying rows it leads with the **dearest**, the one closest to the
cap, rather than the cheapest per gram. This flipped on 10 Aug 2026: the cheapest
qualifying row was a $20 ounce, and as the first thing a stranger sees in a DM it
read as bargain bin and made the offer look worse than it was. The cap is treated
as a budget to spend rather than a ceiling to hide under. It is not a value claim
and nothing in the copy makes one: the card shows size, price and price per gram,
and the DM says "an ounce under $50", not "the best value we could find".

It ranks size rows rather than products, because a product's headline price per
gram usually comes from a quarter pound. The weight window is a **band** (25 to
40g), not a floor, and a test is what forced that: with a floor alone a quarter
pound at $45 clears a 28g floor and clears the cap, so the card would read
"4oz $45" under a message promising an ounce. Ranking by price makes the band
matter more, not less, since an over-weight row no longer has to be cheap per
gram to reach the top of the list.

### The mix: 6 THCa, 3 trim, 1 CBD

Ranking alone gave the slideshow to trim, structurally rather than by chance: trim
is the cheapest thing per gram, so within a fixed budget it is always the most
weight available, and "dearest inside the cap" put trim ounces at the top of the
list. Ten slides of offcuts is not a shop window.

So the pool is **composed** rather than taken off the top of one ranking
(`POOL_MIX`): six THCa, three trim, one CBD, each bucket filled dearest-first from
its own rows, in that order, so slide one and the shared card are always a
whole-bud THCa ounce.

THCa alone may **repeat a listing**, and only after every distinct listing has been
used. A multi-strain ounce sold at four prices then fills two or three slides with a
different row selected on each, which is a real second option (different strain,
different price) rather than padding. Trim and CBD are caps, not targets: they never
repeat, and a feed with fewer than the cap just yields a shorter pool. Nothing
backfills across buckets, since the whole point is that trim cannot expand into the
space THCa leaves.

Buckets come from `bucketOf`: trim wins over the cannabinoid, then CBD off the
classifier's own `cannabinoid` field (`products.js` maps cbd/cbg/cbn/hemp to `CBD`),
then THCa, with an absent field meaning THCa exactly as it does there. The D8/HHC/
THCP family belongs to none of the three and is left out rather than quietly counted
as THCa.

### Trim and CBD are declared on the card

Carrying trim is fine, letting somebody work it out after paying is not, so a **red
banner** states it: on the front of the card over the photo, on the back above the
size dropdown, and as the first sentence of the og:description so it travels with
the link rather than waiting for the page to be opened. A **blue banner** does the
same for CBD, saying it is non-psychoactive; that one is information rather than a
warning about getting less than was advertised, which is why it is not red. A CBD
trim ounce is both things at once and shows both, stacked, since neither sentence
covers the other.

Each banner names the weight ("this 1oz is trim/shake, not whole buds") because that
is a sentence a shopper checks against what they think they are buying, where a bare
"trim" is a word they skim past next to a photo of buds. The weight follows the
dropdown along with the flag.

Detection is word-boundary, never a substring, and the reason is in the live ids:
Black Tie sells both `thca-flower-trim-shake` and
`grape-milkshake-greenhouse-thca-flower`, and a substring test brands that second
one, a whole-bud strain, as shake. Checked against every id in `coa-blacktie.js`,
`coa-data.js` and `coa-thcaking.js`. Do not loosen it without re-checking those.

It is evaluated per **row** as well as per listing, because a listing can sell
whole buds and trim side by side. The advertised row decides what shows on load and
the dropdown decides after that, so the banner is always about the row on screen.

Two banners, one inside each face, rather than one over the card. Anything in the
flip's 3D space turns with it, so a shared element would render mirrored on the
back and read right to left. `test-flow.mjs` measures this rather than trusting it:
it compares where the first and last characters land on screen, on both faces.

Overridable per request: `?max=` price cap, `?g=` / `?gmax=` the weight band,
`?category=` a different category, `?category=any` to drop the filter. If the pick
ever comes up empty, `?category=any` is the first thing to try, since the likeliest
cause is the classifier labelling an ounce as something other than THCA Flower.

An empty result answers 200 with a plain "nothing qualifies right now" and no cart
button, rather than 404 or a fabricated pick. A link already sitting in someone's
DM should not break because the feed has nothing cheap this week.

### Freshness, and how to force it

`/p/pick` is not on a weekly schedule, it is live. Two caches bound how fast it
moves:

- `/api/products` holds a 30 minute in-memory cache per serverless instance, plus
  its own edge cache. A Vercel cron already hits `/api/products?refresh=1` daily
  at 06:00 UTC.
- `/p/pick` itself is `s-maxage=600`, so the rendered page is edge-cached for 10
  minutes.

To force an early update: hit `/api/products?refresh=1` (no auth, forces a
re-scrape and is never answered from cache), then load `/p/pick?t=<anything>` so
the distinct URL bypasses the page's own edge copy. If a short link points at it,
re-scrape that link in Meta's Sharing Debugger afterwards or the old card sticks.

Because it is live rather than pinned, the pick can change mid-week if a cheaper
ounce appears. That is either the feature or the problem depending on whether the
message promised a specific product.

### The card: front, back, and the size gate

Front is the photo with two overlay pills so they cost no vertical space: a glowing
**Shuffle n/N** and **Details and size**. The card flips to a back that is ordered
as a walkthrough, `1. Choose your size` then `2. What the lab found`, because the
size control is what they must act on.

**Add to cart refuses to guess.** With nothing chosen it forces the flip, glows the
dropdown, says why, and adds nothing. Once chosen, the price, the hint and the
button label all restate the exact size and price ("Add 1oz for $39 to cart"), so
nobody adds a mystery item. Every option is pre-built into the exact item
`addToCart()` would push, affiliate ref and coupon included, so the choice cannot
drift from what lands in the cart.

**The dropdown obeys the page's own promise.** The size list is screened by the same
constraints that chose the product, so on a page headlined "the ounce under $50"
nothing over the cap or under a true ounce is selectable. It did not used to be: only
the PRODUCT was screened, so the row could fail every test the page advertised and
nothing downstream re-checked. A **$175 quarter pound** sat in the dropdown of a $50
offer, one click from the cart. The row the pick actually chose always survives, so
the advertised deal can never be filtered off its own page by a rounding edge, and
`?max=`/`?g=`/`?gmax=` move the size list with them rather than only the product.

When rows are hidden the page says why ("1 other size this store sells is not shown
here: this page is the ounce under $50"), because a one-option dropdown with no
explanation reads as a bug rather than a budget. A plain `/p/<id>` share passes no
constraints and lists every real size, since that page makes no claim about weight
or price.

### The photo follows the variant

The feed already carries a per-variant photo at `sizes[i][6]`, taken from Shopify's
`variant.featured_image` with the admin `varImg` override on top. Measured against
the live feed: **3,434 of 9,877 size rows have one, and 460 listings give each
variant a different one.** On those (a multi-strain "Cheap THCA Flower Trim" is the
typical case) the listing's lead photo is the wrong picture for most rows.

So the photo tracks the choice in three places:

- **The shared card.** `og:image` is the advertised row's own photo, so the DM
  preview shows the strain the price refers to. `?s=` moves it with the price.
- **The card's main photo**, on selection and on load.
- **A thumbnail beside the dropdown.** The main photo is on the *front* face and the
  size control is on the *back*, so swapping only the front is invisible at the exact
  moment the shopper is choosing. The thumbnail is what they can actually see.

A row the store gave no photo of its own falls back to the listing photo rather than
leaving the previous variant's picture up, and says so in the caption ("This store
publishes one photo for every size") rather than implying the picture is of that size.
Variant URLs go through the same `httpsOnly()` gate as the product image, since they
come from the same third-party feed; `test-flow.mjs` feeds it a `javascript:` photo.

Worth knowing: **the main site does not do this.** `consumables.html` builds the same
dropdown but its `change` handler only stops propagation, and its back face carries no
image at all, so `sizes[i][6]` is collected and overridable but never rendered
anywhere. This page is the first thing that uses it.

The lab panel follows this repo's existing honesty rules rather than inventing new
ones. `totalThc` leads, since `coa-data.js` calls it the number a buyer actually
gets. The lab-tested badge needs `labTested` or `coaScope === 'product'`. A
certificate link is worded from what the document is: this product's certificate, a
shared sheet that is not batch-specific, or a results directory. With nothing
matched it says so and labels any store-stated potency as a store claim. Absent
fields are omitted, per that file's own warning never to assume one exists.

Two defects `test-flow.mjs` caught that review would not have:

- The back was square, so the size dropdown fell below the card's edge. The card now
  **resizes to whichever face is showing**, with the control first.

  It never scrolls inside itself. A scroll area nested in a scrolling page is the
  worst of both: the wheel lands on whichever one the pointer is over, the inner bar
  hides how much is left, and on a phone a drag meant for the page moves the panel.
  So the back is released at the bottom (`bottom:auto`) and measures its own content,
  `sizeCard()` sets the container to match on every flip, slide change, size choice
  and window resize, and anything past the fold is reached by scrolling the **page**.
  `aspect-ratio` survives only as the state for the frame before JS measures; with no
  JS there is no flip either, so the back is never shown needing a height.
- On a short viewport the shopper has scrolled past Add to cart by the time they
  click it, so the forced flip left the dropdown **above the fold, glowing where it
  could not be seen**. Measured at 1280x720: `scrollY 329`, dropdown at `y -229`.
  `setFlipped` now scrolls the card into view before focusing.

### The card has to say how big its picture is

A crawler puts the picture in the card on the first scrape only if the tags say what
size it is. Without `og:image:width` and `og:image:height` it has to fetch and measure
the image first, and the card that goes out in the meantime has no picture in it. The
site's own static pages (`index.html`, `consumables.html`) have always declared
1200x630 for `/og-image.png`. This route declared nothing, which was survivable while
`og:image` was the listing's lead photo, because those few URLs were already scraped
from earlier shares. It stopped being survivable the moment the advertised row's own
photo took over: a per-variant URL nothing has ever seen is now the normal case, so
the first send of a link was the one that rendered bare.

Dimensions are only stated where they are true:

- `/og-image.png` is 1200x630, measured off the file.
- A **Shopify CDN** url can be asked for the size we then declare, since that CDN
  reads `width`, `height` and `crop` as query params. It is asked for a square 1200
  and told to crop centre, which is the same treatment every Shopify theme gives a
  product thumbnail. The CDN never upscales past the original, so a smaller original
  comes back smaller, still square: the ratio the card lays out on holds either way,
  which is the part a wrong number would visibly break.
- **Any other host** ships with no dimensions at all rather than a guess.

`og:image:secure_url`, `og:image:type` and `twitter:image:alt` go out with them. The
404 and empty-pick cards declare their image too, since those are links somebody sent
as well.

One related defect went with it: the variant thumbnail rendered as `<img src="">`,
and an empty `src` resolves to the page's own URL, so every view of a card made the
browser fetch that card again as an image. It now ships with no `src` attribute until
something is chosen.

Worth knowing about the feed side: `variant.featured_image` now passes the same
`isCoa()` screen the product images already passed. A store that attaches its lab
sheet to a variant would otherwise have made a certificate scan the shared card's
photo.

If a card is already wrong in Meta's cache, re-scrape it in the Sharing Debugger.
Nothing here can evict a preview Meta has already stored.

### The slideshow

Ten slides, walked with prev/next arrows and a position counter on the photo, in
value order. Every slide ships with the page so moving is instant rather than a
reload; arrow keys and a horizontal swipe work too. `?i=<rank>` still renders a
given slide server side with its own og: tags, and clamps rather than 404s, so a
forwarded link with a stale index shows something real. Moving updates the URL via
`replaceState`, keeping slides shareable without a history entry per tap.

Ten slides means ten distinct **products** wherever the feed allows it. `composePool`
takes one slide per listing first, within each bucket, and only repeats a THCa
listing with another row once the distinct ones are used up (see the mix above). A
listing selling both buds and trim can appear in both buckets, once with each row
advertised, since those are two different offers; either way that slide's dropdown
still offers the rest of its sizes.

**A selection never survives a slide change.** Carrying a size choice from one
product to the next is how somebody adds a thing they never looked at, so the
dropdown, button label, price line and hint all reset and the gate applies again.
`test-slideshow.mjs` selects on one slide, moves, and asserts Add writes nothing.

While the card is turned, the arrows are `pointer-events: none` with the photo and
arrow keys belong to the focused dropdown: browsing and choosing are separate modes,
and flipping back is the way between them. Which is why there are two flip-back
buttons, one at each end of the back panel, styled as buttons rather than links.

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

## Tracking

Mirrors the `LL.track` block in `index.html` rather than adding a second scheme:
same `va()` queue shim, same `ll_sid` session id, same `ll_events` ring buffer,
same deferred `/_vercel/insights/script.js`. That script matters: without it `va()`
only queues and nothing reports.

Events also beacon to `/api/track`, which already exists as the sink and forwards
to `LL_EVENTS_WEBHOOK` when set. A beacon rather than a fetch because people land
on this page, tap, and leave in a second or two, and an ordinary request gets cut
off at unload.

Every event carries **which product was on screen when it fired**: id, store, the
price and size actually shown, and price per gram. That is what a click count
cannot tell you, and it matters most on `/p/pick`, where the product changes under
a URL that never does. `page` is `pick` or `share` so the two are distinguishable,
and `utm_*` tags are read off the URL when the link carries them.

Events: `page_view` on load, `add_to_cart` on the button. An empty pick records
`outcome=empty` plus the cap that found nothing, since an offer going out with no
product behind it is a signal rather than a non-event.

Where to look: Vercel Analytics > Events for the custom events, and your
`LL_EVENTS_WEBHOOK` sink for the durable copy.

Note: the first version of this page called `LL.track` without loading anything
that defines `LL`, so every event silently hit the catch. If you copy this pattern
to another standalone page, bring the analytics block with it.

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
node test-share.mjs      # server rendering: og tags, pick selection, escaping
node test-flow.mjs       # real Chromium: the flip, the size gate, the lab panel
node test-slideshow.mjs  # real Chromium: the ten slides, and the reset on each move
```

Stubs `fetch` with product rows in the real shape, then checks the og: tags a
crawler would read, that exactly one primary action exists and it is Add to cart,
that no vendor button or capture flow crept in, that affiliate refs and the coupon
survive into a real checkout URL, that the image is declared at a size that is true of it and nothing is claimed for a
host that cannot be asked, that `?s=` selects a size, that the size list
honours the pick's own cap and minimum quantity while a direct share lists
everything, that the hostile row is neutralised, and that a dead id 404s with a
noindex fallback card.

The two browser suites need `npm i playwright`. The browser is already on the
image, so do not run `playwright install`; the path
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` is pinned in both.

## Two things to decide

- **Indexing.** These pages are currently indexable and self-canonical. Thousands
  of thin product pages can be an SEO liability, so consider either adding them to
  the sitemap deliberately as real product pages, or disallowing `/p/` in
  `robots.txt` and treating them purely as share links.
- **Preview caching.** Meta's crawler caches a URL's preview. If a card ever
  renders wrong, re-scrape it in the Facebook Sharing Debugger rather than waiting
  it out. UTM tags make each week's URL distinct anyway, which sidesteps most of it.
