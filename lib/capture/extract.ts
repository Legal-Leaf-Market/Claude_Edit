/**
 * THE CAPTURE EXTRACTOR: everything a page will tell you about its products,
 * taken off a page you are already looking at.
 *
 * WHAT THIS IS FOR, AND WHY IT IS NOT A SCRAPER. A scraper is a program that
 * visits pages on its own, at machine speed, without a person. This runs as a
 * bookmarklet: a person browses a merchant's site in their own browser, as a
 * visitor, and clicks a button that reads the DOM already rendered in front of
 * them. No extra request is made to the merchant. Nothing is crawled. The page
 * was fetched because a human asked for it.
 *
 * The purpose is EVALUATION. Before deciding to chase a merchant, build a
 * category, or model a product, you need to know what they actually stock, at
 * what prices, under which brands. Guessing that from a homepage is how a week
 * gets spent on a category with forty products in it.
 *
 * WHERE THE LINE IS, and it is worth stating plainly because the tool does not
 * enforce it. Reading a page you are on to understand a catalogue is research.
 * Republishing that catalogue as listings on a public site is a different act,
 * governed by the merchant's own terms, and nothing about how the bytes were
 * obtained changes that. Section 2's rule still decides what may become a
 * `marketplace_listings` row: a legitimate feed or a published permission.
 * This tool answers "what is there", not "may we sell it".
 *
 * ---------------------------------------------------------------------------
 *
 * CAPTURE EVERYTHING. FILTER NEVER. This is the design rule and it comes from
 * a real cost: a partial pull gets analysed, a conclusion gets drawn, and then
 * the missing rows turn out to have changed the answer and the work is done
 * twice. So every extractor below keeps what it found in full, including
 * fields nothing here understands, and the output carries the raw objects
 * beside the normalised ones. Whittling is the analyst's job, downstream,
 * where it can be redone without re-browsing forty pages.
 *
 * The same rule is why `coverage` exists. A capture that silently saw 24 of
 * 1,180 products is indistinguishable from a small catalogue, so the extractor
 * reports what it could NOT see: the pagination it found, the result count the
 * page claimed, and whether the grid looked lazy-loaded. A known gap is worth
 * far more than a clean-looking number.
 *
 * ---------------------------------------------------------------------------
 *
 * WHY IT IS ONE SELF-CONTAINED FUNCTION. `captureSource()` is serialised with
 * Function.prototype.toString() and pasted into a `javascript:` URL, so it can
 * reference NOTHING outside its own body: no imports, no module constants, no
 * helpers defined beside it. A bundler renaming or tree-shaking an outer
 * reference would produce a bookmarklet that throws on somebody else's site,
 * where there is no console anybody will read. `tests/capture/extract.test.ts`
 * asserts the serialised form is closed over nothing.
 *
 * That constraint is also what keeps ONE implementation. The alternative was a
 * hand-written string of JS for the bookmarklet and a separate typed copy for
 * the tests, which is section 7's "never fork the logic" in the form that
 * rots fastest: the string is unreadable, so the copy gets fixed and the
 * string does not.
 */

export type CapturedProduct = {
  /** Whichever of the extractors found it. Kept so a thin result is explicable. */
  via: "json-ld" | "microdata" | "opengraph" | "platform" | "dom"
  title: string | null
  brand: string | null
  priceText: string | null
  priceCents: number | null
  currency: string | null
  sku: string | null
  gtin: string | null
  mpn: string | null
  availability: string | null
  url: string | null
  imageUrl: string | null
  /** The untouched source object. The whole point: nothing is discarded. */
  raw: unknown
}

export type CaptureCoverage = {
  /** What the page says it has, when it says anything ("1,180 results"). */
  claimedTotal: number | null
  /** Pagination the page exposes, so the size of the gap is visible. */
  nextPageUrl: string | null
  pageLinks: string[]
  /** A grid that grows on scroll will under-report unless it was scrolled. */
  looksLazyLoaded: boolean
  notes: string[]
}

export type CaptureResult = {
  capturedAt: string
  pageUrl: string
  pageTitle: string
  origin: string
  /** Detected from the globals a platform leaves lying around, when it does. */
  platform: string | null
  products: CapturedProduct[]
  coverage: CaptureCoverage
  /** Counts per extractor, so a page carrying rich JSON-LD is obvious. */
  bySource: Record<string, number>
}

/**
 * Read every product signal on the current page.
 *
 * SELF-CONTAINED BY CONTRACT. Everything it uses is either a browser global or
 * declared inside this function. Do not lift a helper out of it, however
 * tempting, and do not import a constant into it.
 */
export function captureSource(): CaptureResult {
  /* ---------------------------------------------------------------- helpers */

  const text = (value: unknown): string | null => {
    if (typeof value === "string") return value.trim() || null
    if (typeof value === "number") return String(value)
    return null
  }

  /**
   * Money out of whatever the page wrote.
   *
   * Deliberately conservative: it returns null rather than a wrong number,
   * because a wrong price is worse than a missing one everywhere on this
   * project. The hard case is thousands separators against decimal commas,
   * so the LAST separator decides which it is, and a group of exactly three
   * digits after a lone separator is read as thousands.
   */
  const cents = (value: unknown): number | null => {
    const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : ""
    const match = raw.replace(/\s/g, "").match(/-?\d[\d.,]*/)
    if (!match) return null
    let digits = match[0]

    const lastComma = digits.lastIndexOf(",")
    const lastDot = digits.lastIndexOf(".")
    const lastSep = Math.max(lastComma, lastDot)

    if (lastSep === -1) {
      digits = digits.replace(/[^\d-]/g, "")
    } else {
      const tail = digits.slice(lastSep + 1)
      if (/^\d{3}$/.test(tail) && (lastComma === -1 || lastDot === -1)) {
        /* "1,299" and "1.299" are both one thousand two hundred and ninety nine. */
        digits = digits.replace(/[.,]/g, "")
      } else {
        digits = digits.slice(0, lastSep).replace(/[^\d-]/g, "") + "." + tail.replace(/[^\d]/g, "")
      }
    }

    const parsed = Number.parseFloat(digits)
    if (!Number.isFinite(parsed)) return null
    return Math.round(parsed * 100)
  }

  const absolute = (href: unknown): string | null => {
    const value = text(href)
    if (!value) return null
    try {
      return new URL(value, document.baseURI).toString()
    } catch {
      return null
    }
  }

  const products: CapturedProduct[] = []
  const notes: string[] = []

  /* ------------------------------------------------------------- 1. JSON-LD */
  /*
   * The best source by a distance when it exists, because it is the merchant
   * describing their own product in a schema rather than us reading a layout.
   * Walked recursively: real pages nest Product inside ItemList inside @graph,
   * and a flat scan misses most of a category page.
   */
  const fromJsonLd = (node: unknown, depth: number): void => {
    if (!node || depth > 8) return
    if (Array.isArray(node)) {
      for (const item of node) fromJsonLd(item, depth + 1)
      return
    }
    if (typeof node !== "object") return

    const obj = node as Record<string, unknown>
    const type = obj["@type"]
    const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")]

    if (types.some((t) => /product|itempage|offer$/i.test(t))) {
      const offersRaw = obj.offers
      const offer = (
        Array.isArray(offersRaw) ? offersRaw[0] : offersRaw
      ) as Record<string, unknown> | undefined
      const brandRaw = obj.brand
      const brand =
        typeof brandRaw === "object" && brandRaw
          ? text((brandRaw as Record<string, unknown>).name)
          : text(brandRaw)
      const image = Array.isArray(obj.image) ? obj.image[0] : obj.image

      products.push({
        via: "json-ld",
        title: text(obj.name),
        brand,
        priceText: text(offer?.price) ?? text(offer?.lowPrice),
        priceCents: cents(offer?.price ?? offer?.lowPrice),
        currency: text(offer?.priceCurrency),
        sku: text(obj.sku),
        gtin: text(obj.gtin13) ?? text(obj.gtin12) ?? text(obj.gtin) ?? text(obj.gtin14),
        mpn: text(obj.mpn),
        availability: text(offer?.availability),
        url: absolute(obj.url ?? offer?.url),
        imageUrl: absolute(typeof image === "object" && image ? (image as Record<string, unknown>).url : image),
        raw: obj,
      })
    }

    /* Keep walking regardless: a Product can be a property of a page node. */
    for (const key of Object.keys(obj)) {
      if (key === "@context") continue
      fromJsonLd(obj[key], depth + 1)
    }
  }

  const ldNodes = document.querySelectorAll('script[type="application/ld+json"]')
  for (const node of Array.from(ldNodes)) {
    try {
      fromJsonLd(JSON.parse(node.textContent ?? ""), 0)
    } catch {
      notes.push("A JSON-LD block on this page did not parse; its products are not in this capture.")
    }
  }

  /* ----------------------------------------------------------- 2. Microdata */
  const microNodes = document.querySelectorAll('[itemtype*="schema.org/Product" i]')
  for (const scope of Array.from(microNodes)) {
    const prop = (name: string): string | null => {
      const el = scope.querySelector(`[itemprop="${name}"]`)
      if (!el) return null
      return (
        text(el.getAttribute("content")) ??
        text(el.getAttribute("href")) ??
        text(el.textContent)
      )
    }
    const raw: Record<string, string | null> = {}
    for (const el of Array.from(scope.querySelectorAll("[itemprop]"))) {
      const name = el.getAttribute("itemprop")
      if (name && !(name in raw)) {
        raw[name] =
          text(el.getAttribute("content")) ?? text(el.getAttribute("href")) ?? text(el.textContent)
      }
    }

    products.push({
      via: "microdata",
      title: prop("name"),
      brand: prop("brand"),
      priceText: prop("price"),
      priceCents: cents(prop("price")),
      currency: prop("priceCurrency"),
      sku: prop("sku"),
      gtin: prop("gtin13") ?? prop("gtin"),
      mpn: prop("mpn"),
      availability: prop("availability"),
      url: absolute(prop("url")),
      imageUrl: absolute(prop("image")),
      raw,
    })
  }

  /* --------------------------------------------------------- 3. OpenGraph */
  /*
   * One product at most, and only on a product page, but it is the most
   * reliable single record on a custom platform that ships no structured data
   * at all, which is exactly the case that matters here.
   */
  const meta = (name: string): string | null => {
    const el =
      document.querySelector(`meta[property="${name}"]`) ?? document.querySelector(`meta[name="${name}"]`)
    return text(el?.getAttribute("content"))
  }
  if (meta("og:type") === "product" || meta("product:price:amount")) {
    const ogRaw: Record<string, string | null> = {}
    for (const el of Array.from(document.querySelectorAll("meta[property], meta[name]"))) {
      const key = el.getAttribute("property") ?? el.getAttribute("name")
      if (key && /^(og|product|twitter):/i.test(key)) ogRaw[key] = el.getAttribute("content")
    }
    products.push({
      via: "opengraph",
      title: meta("og:title"),
      brand: meta("product:brand") ?? meta("og:brand"),
      priceText: meta("product:price:amount"),
      priceCents: cents(meta("product:price:amount")),
      currency: meta("product:price:currency"),
      sku: meta("product:retailer_item_id"),
      gtin: meta("product:ean") ?? meta("product:gtin"),
      mpn: meta("product:mfr_part_no"),
      availability: meta("product:availability"),
      url: absolute(meta("og:url")) ?? location.href,
      imageUrl: absolute(meta("og:image")),
      raw: ogRaw,
    })
  }

  /* --------------------------------------------- 4. Platform globals */
  let platform: string | null = null
  const w = window as unknown as Record<string, unknown>

  const shopifyAnalytics = w.ShopifyAnalytics as { meta?: Record<string, unknown> } | undefined
  if (shopifyAnalytics?.meta || w.Shopify) {
    platform = "shopify"
    const shopMeta = shopifyAnalytics?.meta ?? {}
    const product = shopMeta.product as Record<string, unknown> | undefined
    if (product) {
      const variants = (product.variants as Record<string, unknown>[] | undefined) ?? []
      for (const variant of variants) {
        products.push({
          via: "platform",
          title: text(product.type) ? `${text(product.title) ?? ""}`.trim() : text(product.title),
          brand: text(product.vendor),
          priceText: text(variant.price),
          /* Shopify's analytics meta is already in cents. */
          priceCents: typeof variant.price === "number" ? Math.round(variant.price) : cents(variant.price),
          currency: text(shopMeta.currency),
          sku: text(variant.sku),
          gtin: null,
          mpn: text(variant.sku),
          availability: null,
          url: location.href,
          imageUrl: null,
          raw: { product, variant },
        })
      }
    }
    notes.push(
      "Shopify detected. Its own /products.json returns the whole catalogue in one request and is " +
        "the better pull; this DOM capture is only worth keeping if that endpoint is disabled.",
    )
  } else if (w.wc_add_to_cart_params || document.querySelector("body.woocommerce, .woocommerce")) {
    platform = "woocommerce"
    notes.push(
      "WooCommerce detected. Its Store API (/wp-json/wc/store/v1/products) usually answers with the " +
        "whole catalogue, which is a better pull than this one.",
    )
  } else if (w.BCData) {
    platform = "bigcommerce"
  } else if (w.dataLayer && document.querySelector('[data-testid*="product" i]')) {
    platform = "custom (dataLayer present)"
  }

  /* --------------------------------------------------------------- 5. DOM */
  /*
   * THE FALLBACK THAT MATTERS MOST, because the merchants worth evaluating
   * here run custom platforms with no structured data: a big retailer's
   * category page is frequently a React grid and nothing else.
   *
   * Anchored on the PRICE rather than on class names. Every retailer invents
   * its own markup and renames it on redesign, but a price is a currency
   * symbol next to digits in every one of them, and the product's name is
   * reliably the nearest heading or the longest link text in the same card.
   */
  const seenUrls = new Set(products.map((p) => p.url).filter(Boolean) as string[])
  const PRICE = /(?:[$£€¥]|USD|GBP|EUR)\s?\d[\d.,]*/

  const candidates = Array.from(document.querySelectorAll("a[href]")).filter((a) => {
    const href = a.getAttribute("href") ?? ""
    return /\/(product|products|p|item|dp|gear|detail)[/-]/i.test(href) || /\/p\//.test(href)
  })

  for (const anchor of candidates) {
    const url = absolute(anchor.getAttribute("href"))
    if (!url || seenUrls.has(url)) continue

    /* Walk up to the card: the nearest ancestor that also holds a price. */
    let card: Element | null = anchor
    let priceText: string | null = null
    for (let hop = 0; hop < 5 && card; hop++) {
      const match = (card.textContent ?? "").match(PRICE)
      if (match) {
        priceText = match[0]
        break
      }
      card = card.parentElement
    }
    if (!card) card = anchor

    const heading = card.querySelector("h1, h2, h3, h4, [class*='title' i], [class*='name' i]")
    const title =
      text(heading?.textContent) ??
      text(anchor.getAttribute("title")) ??
      text(anchor.getAttribute("aria-label")) ??
      text(anchor.textContent)

    /* A card with neither a name nor a price is navigation, not a product. */
    if (!title && !priceText) continue

    const img = card.querySelector("img")
    seenUrls.add(url)

    products.push({
      via: "dom",
      title: title ? title.replace(/\s+/g, " ").slice(0, 300) : null,
      brand: null,
      priceText,
      priceCents: cents(priceText),
      currency: null,
      sku: null,
      gtin: null,
      mpn: null,
      availability: null,
      url,
      imageUrl: absolute(img?.getAttribute("src") ?? img?.getAttribute("data-src")),
      raw: { html: card.outerHTML.slice(0, 4000) },
    })
  }

  /* ------------------------------------------------------------ coverage */
  /*
   * WHAT THIS CAPTURE DID NOT SEE. A page that quietly showed 24 of 1,180
   * products looks exactly like a small catalogue, and a conclusion drawn off
   * that is the rework this whole tool exists to prevent.
   */
  /*
   * innerText FIRST, because it respects visibility: a hidden "1,180 results"
   * left in a template should not be read as a claim the page is making.
   *
   * THE FALLBACK CANNOT BE textContent, and this cost a debugging round.
   * textContent concatenates with NO separator, so
   * `<p>1,180 results</p><h3>A pedal</h3>` comes out as "1,180 resultsA pedal"
   * and the word boundary after "results" does not exist. The pattern below
   * then finds nothing, the claimed total is null, and the capture reports
   * full coverage of a page it saw a twentieth of. Which is precisely the
   * silent failure this whole section exists to prevent.
   *
   * So the fallback joins TEXT NODES with a space, which is what innerText's
   * block separation amounts to for this purpose. It matters beyond the test
   * environment: engines without innerText exist, and a wrong answer here is
   * invisible.
   */
  const joinText = (node: Node): string => {
    let out = ""
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) out += ` ${child.nodeValue ?? ""}`
      else if (child.nodeType === 1) out += joinText(child)
    }
    return out
  }
  const bodyText = document.body
    ? ((document.body as HTMLElement).innerText ?? joinText(document.body))
    : ""
  const totalMatch =
    bodyText.match(/([\d,]{2,})\s+(?:results?|products?|items?)\b/i) ??
    bodyText.match(/of\s+([\d,]{2,})\b/i)
  const claimedTotal = totalMatch ? Number.parseInt(totalMatch[1].replace(/,/g, ""), 10) : null

  const nextLink =
    document.querySelector('link[rel="next"]') ??
    document.querySelector('a[rel="next"]') ??
    Array.from(document.querySelectorAll("a")).find((a) =>
      /^(next|older|more)\b/i.test((a.textContent ?? "").trim()),
    )

  const pageLinks = Array.from(document.querySelectorAll("a[href]"))
    .map((a) => absolute(a.getAttribute("href")))
    .filter((href): href is string => href != null && /[?&](page|p|start|offset)=\d+/i.test(href))
    .filter((href, index, all) => all.indexOf(href) === index)
    .slice(0, 200)

  const looksLazyLoaded = Boolean(
    document.querySelector("[data-infinite-scroll], .infinite-scroll, [class*='load-more' i]") ||
      /load more|show more/i.test(bodyText),
  )
  if (looksLazyLoaded) {
    notes.push(
      "This grid loads more on scroll or on a button. Scroll to the very bottom, press Load More " +
        "until it stops, and capture again: what is in the DOM is all this can see.",
    )
  }
  if (claimedTotal != null && claimedTotal > products.length) {
    notes.push(
      `The page claims ${claimedTotal} results and this capture holds ${products.length}. ` +
        "Page through the rest and capture each one; the analyser merges captures by URL.",
    )
  }
  if (products.length === 0) {
    notes.push(
      "Nothing found. Either this is not a product listing page, or the grid renders after this ran. " +
        "Let it finish loading and try again.",
    )
  }

  const bySource: Record<string, number> = {}
  for (const product of products) bySource[product.via] = (bySource[product.via] ?? 0) + 1

  return {
    capturedAt: new Date().toISOString(),
    pageUrl: location.href,
    pageTitle: document.title,
    origin: location.origin,
    platform,
    products,
    coverage: {
      claimedTotal,
      nextPageUrl: absolute(nextLink?.getAttribute("href")),
      pageLinks,
      looksLazyLoaded,
      notes,
    },
    bySource,
  }
}
