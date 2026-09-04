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

/**
 * WHY THE CAPTURE CARRIES ITS OWN POST-MORTEM.
 *
 * When this finds nothing on a real shop, the person who has to fix it cannot
 * open that shop: the merchants worth capturing are often unreachable from
 * wherever the fixing happens, and "it found zero" is not a bug report. What
 * IS a bug report is the markup around the prices it saw and could not resolve
 * into cards, because that names the shape to support in one look.
 *
 * So every capture records what the passes tried, what they rejected and why,
 * and a few samples of the markup involved. It is the difference between one
 * round trip and five.
 */
export type CaptureDiagnostics = {
  anchors: number
  /** Leaf elements whose own text is a price. The DOM pass starts from these. */
  priceNodes: number
  cardsResolved: number
  /** Climbed past the card into a grid holding several prices. */
  rejectedMultiPrice: number
  /** Price beside a link with no picture and no name: page furniture. */
  rejectedNoProductSignal: number
  /** No ancestor within six levels held a link at all. */
  rejectedNoAnchor: number
  /** Already claimed by a structured pass. */
  rejectedDuplicate: number
  jsonLdBlocks: number
  jsonLdTypes: string[]
  /** Markup around prices that produced nothing. The thing worth reading. */
  unresolvedSamples: string[]
  /** Markup that DID resolve, for comparison. */
  resolvedSamples: string[]
  /**
   * Bot management products detected on this page, by name.
   *
   * Not a judgement about the shop: plenty of retailers run one and still
   * publish a feed. It is a judgement about what THIS tool should do next,
   * because a crawl through a wall returns challenge pages that look exactly
   * like empty categories, and the session it burns is the operator's own.
   */
  defences: string[]
  /** The page itself looks like a challenge or a block, not a listing. */
  challenged: boolean
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
  diagnostics: CaptureDiagnostics
}

/**
 * Read every product signal on the current page.
 *
 * SELF-CONTAINED BY CONTRACT. Everything it uses is either a browser global or
 * declared inside this function. Do not lift a helper out of it, however
 * tempting, and do not import a constant into it.
 */
export function captureSource(sourceDoc?: Document, sourceUrl?: string): CaptureResult {
  /*
   * THE DOCUMENT IS A PARAMETER SO A CRAWL CAN REUSE THIS.
   *
   * It read the globals directly, which was right while the only page it could
   * ever see was the one the operator was standing on. Crawling changes that:
   * page two arrives as text from a same-origin fetch and is parsed into a
   * detached Document that has no window, no location, and a baseURI pointing
   * at the page that fetched it.
   *
   * So the document and its URL come in, and default to the live ones. Relative
   * links resolve against the URL PASSED IN rather than document.baseURI, which
   * is the part that silently breaks otherwise: every product link on page two
   * would resolve against page one and the crawl would capture the same
   * products over and over while looking like it was making progress.
   */
  const d = sourceDoc ?? document
  const href = sourceUrl ?? location.href
  const isLive = !sourceDoc

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

  /*
   * The parameter is `raw` rather than `href` on purpose: naming it `href`
   * shadowed the page URL above and resolved every relative link against
   * ITSELF, which throws for a bare path and so returned null for every
   * product on the page. Caught by the compiler, and it would otherwise have
   * been a capture that silently found nothing.
   */
  const absolute = (raw: unknown): string | null => {
    const value = text(raw)
    if (!value) return null
    try {
      return new URL(value, href).toString()
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

    for (const t of types) if (t && t !== "undefined" && !ldTypes.includes(t)) ldTypes.push(t)

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

  const ldTypes: string[] = []
  const ldNodes = d.querySelectorAll('script[type="application/ld+json"]')
  for (const node of Array.from(ldNodes)) {
    try {
      fromJsonLd(JSON.parse(node.textContent ?? ""), 0)
    } catch {
      notes.push("A JSON-LD block on this page did not parse; its products are not in this capture.")
    }
  }

  /* ----------------------------------------------------------- 2. Microdata */
  const microNodes = d.querySelectorAll('[itemtype*="schema.org/Product" i]')
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
      d.querySelector(`meta[property="${name}"]`) ?? d.querySelector(`meta[name="${name}"]`)
    return text(el?.getAttribute("content"))
  }
  if (meta("og:type") === "product" || meta("product:price:amount")) {
    const ogRaw: Record<string, string | null> = {}
    for (const el of Array.from(d.querySelectorAll("meta[property], meta[name]"))) {
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
      url: absolute(meta("og:url")) ?? href,
      imageUrl: absolute(meta("og:image")),
      raw: ogRaw,
    })
  }

  /* --------------------------------------------- 4. Platform globals */
  /*
   * LIVE PAGE ONLY. These read `window`, and a page fetched during a crawl is
   * parsed into a detached Document with no window of its own. Reading the
   * CRAWLING page's globals while claiming to describe the fetched one would
   * be worse than skipping: every crawled page would report the platform, and
   * the variants, of page one.
   */
  let platform: string | null = null
  const w = (isLive ? window : {}) as unknown as Record<string, unknown>

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
          url: href,
          imageUrl: null,
          raw: { product, variant },
        })
      }
    }
    notes.push(
      "Shopify detected. Its own /products.json returns the whole catalogue in one request and is " +
        "the better pull; this DOM capture is only worth keeping if that endpoint is disabled.",
    )
  } else if (w.wc_add_to_cart_params || d.querySelector("body.woocommerce, .woocommerce")) {
    platform = "woocommerce"
    notes.push(
      "WooCommerce detected. Its Store API (/wp-json/wc/store/v1/products) usually answers with the " +
        "whole catalogue, which is a better pull than this one.",
    )
  } else if (w.BCData) {
    platform = "bigcommerce"
  } else if (w.dataLayer && d.querySelector('[data-testid*="product" i]')) {
    platform = "custom (dataLayer present)"
  }

  /*
   * IS THIS SHOP RUNNING A BOT WALL? Named, because "0 products" is what a
   * challenge page and a broken reader look like from here, and they need
   * opposite responses.
   *
   * Musician's Friend is the case that prompted this. A DevTools trace of
   * `/effects` showed `akam-sw.js` plus a run of POSTs to obfuscated paths
   * under one constant prefix, which is Akamai Bot Manager collecting sensor
   * data. A general debugger called that a harmless telemetry beacon and said
   * to ignore it, which is right about the request and wrong about what it
   * means for this tool: it is the single most important fact on the page.
   *
   * WHY IT CHANGES WHAT THE COLLECTOR SHOULD DO. Reading the page the operator
   * is already looking at stays fine, because a human loaded it in their own
   * browser and passed whatever checks were asked of them. Walking pages 2..N
   * from inside that session at machine cadence is a different act: it is what
   * bot management exists to catch, it will start returning challenges instead
   * of products, and the account and address it burns are the OPERATOR's own.
   *
   * DETECTED FROM WHAT IS ALREADY IN THE DOCUMENT, never by probing. Cookies
   * and script names are same-origin reads on a page we were invited to; the
   * interstitial phrases are what these products actually print.
   */
  const defences: string[] = []
  const cookieJar = (() => {
    try {
      return isLive ? document.cookie : ""
    } catch {
      return ""
    }
  })()

  const scriptSrc = Array.from(d.querySelectorAll("script[src]"))
    .map((node) => node.getAttribute("src") ?? "")
    .join(" ")

  if (/\b_abck=|\bbm_sz=|\bak_bmsc=/.test(cookieJar) || /akam[-/]?sw|\/akam\//i.test(scriptSrc)) {
    defences.push("Akamai Bot Manager")
  }
  if (/\b__cf_bm=|\bcf_clearance=/.test(cookieJar) || /challenges\.cloudflare\.com/i.test(scriptSrc)) {
    defences.push("Cloudflare bot management")
  }
  if (/\bdatadome=/.test(cookieJar) || /datadome/i.test(scriptSrc)) defences.push("DataDome")
  if (/\bincap_ses|\bvisid_incap/.test(cookieJar)) defences.push("Imperva/Incapsula")
  if (/\bpx-|_px[23]?=/.test(cookieJar) || /perimeterx|px-cloud/i.test(scriptSrc)) {
    defences.push("PerimeterX")
  }

  /*
   * The interstitial itself, which is what a crawled page comes back as once
   * the wall has decided.
   *
   * THE TITLE ONLY, and that narrowing was earned by a test rather than
   * guessed. Reading the phrase out of the body as well seemed obviously
   * better and immediately flagged an ordinary category page holding a pedal
   * called "Access Denied Fuzz". The false positive is the expensive direction
   * here: it stops an operator working a merchant who never objected, on
   * evidence that is just a product name. A challenge page always titles
   * itself, and a title is short enough not to collide.
   */
  const challenged =
    /pardon our interruption|access denied|request unsuccessful|just a moment|checking your browser|are you a robot|verify you are a? ?human/i.test(
      d.title ?? "",
    )

  if (defences.length) {
    notes.push(
      `This shop runs ${defences.join(" and ")}. Reading the page you are on is fine: you loaded ` +
        "it yourself. Crawling the rest from inside your session is what that product exists to " +
        "catch, and the session it flags is yours, so the crawl will not walk it without being " +
        "told to twice.",
    )
  }
  if (challenged) {
    notes.push(
      "This looks like a challenge or block page rather than a product listing. Anything captured " +
        "from it describes the interstitial, not the catalogue.",
    )
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
  const PRICE = /(?:[$£€¥]|USD|GBP|EUR)\s?\d[\d.,]*/

  /*
   * ANCHOR ON THE PRICE, NOT ON THE URL.
   *
   * The first version collected links whose path contained /product/, /item/
   * and friends, then looked for a price near each. That works on Shopify and
   * fails completely on a retailer with flat URLs: Andertons product pages
   * live at paths like /guitars/guitar-pedals/boss-ds1-distortion-pedal, with
   * no marker segment anywhere, so EVERY product link was rejected and a
   * category page of a thousand items captured zero. The page said "1,000+
   * results" and the panel said nothing found, which is precisely the
   * contradiction that made it obvious.
   *
   * A URL shape is a convention each retailer invents. A price is not: it is a
   * currency symbol next to digits on every commerce page in the world, and
   * it is what a person's eye uses to find the grid too. So the price is the
   * anchor now and the link is found FROM it.
   *
   * The walk goes from the price OUTWARD to the nearest ancestor that also
   * holds a link, which is the card. Outward rather than inward because a card
   * has exactly one price and one product link, while a grid has hundreds of
   * both: starting wide and narrowing would have to guess where the boundaries
   * are, and starting at a price and stopping at the first link cannot.
   */

  /*
   * The elements that ARE a price, rather than elements that merely contain
   * one. Every ancestor of a price contains it, up to <body>, so the leaves
   * are what matter: an element whose own text is a price and which holds no
   * child element that could claim it instead.
   */
  const priceNodes: Element[] = []
  for (const el of Array.from(d.querySelectorAll("body *"))) {
    if (el.children.length > 0) continue
    const own = el.textContent ?? ""
    if (own.length > 40) continue
    if (PRICE.test(own)) priceNodes.push(el)
  }

  const seenUrls = new Set(products.map((p) => p.url).filter(Boolean) as string[])
  let cardsFound = 0
  let rejectedMultiPrice = 0
  let rejectedNoProductSignal = 0
  let rejectedNoAnchor = 0
  let rejectedDuplicate = 0
  const unresolvedSamples: string[] = []
  const resolvedSamples: string[] = []

  /* The markup AROUND a price, which is what names the shape to support. */
  const contextOf = (el: Element): string => {
    let node: Element = el
    for (let up = 0; up < 3 && node.parentElement && node.parentElement !== d.body; up++) {
      node = node.parentElement
    }
    return node.outerHTML.replace(/\s+/g, " ").slice(0, 700)
  }

  for (const priceEl of priceNodes) {
    let priceText = (priceEl.textContent ?? "").match(PRICE)?.[0] ?? null

    /*
     * Up to the card. Six levels is generous for real markup and short enough
     * that a page with no cards at all cannot walk to <body> and call it one.
     */
    let card: Element | null = priceEl.parentElement
    let anchor: HTMLAnchorElement | null = null
    for (let hop = 0; hop < 6 && card && card !== d.body; hop++) {
      /*
       * `matches` BEFORE `querySelector`, because querySelector only looks at
       * descendants. On the very common shape where the whole card IS the
       * link, `<a><h3>Name</h3><span>$129</span></a>`, searching descendants
       * finds nothing, the walk runs to <body> and the product is dropped.
       */
      const found = (card.matches("a[href]") ? card : card.querySelector("a[href]")) as
        | HTMLAnchorElement
        | null
      if (found) {
        anchor = found
        break
      }
      card = card.parentElement
    }
    if (!anchor || !card) {
      rejectedNoAnchor += 1
      if (unresolvedSamples.length < 4) unresolvedSamples.push(contextOf(priceEl))
      continue
    }

    /*
     * A CARD LINKS TO ONE PRODUCT. A GRID LINKS TO MANY. That is the test, and
     * it took three tries to get here, so the two rejected candidates are
     * worth keeping written down.
     *
     * COUNTING PRICES failed on every sale item. A reduced card shows two,
     * "was £999" beside "now £799", so a guard reading "more than one price
     * means we climbed into the grid" threw away every discount, twice over,
     * once per price node. On Andertons' bass department: 53 rejections
     * against 34 kept, on a page of 48.
     *
     * COUNTING TITLES failed on every card, which was worse. Their markup is
     *
     *     <h3 class="productCard__title">
     *       <a class="productCard__title__link" href="...">Tobias Classic V</a>
     *     </h3>
     *
     * and `[class*='title' i]` matches the h3 AND the anchor nested inside it.
     * Two titles in every single card, so the guitar department went from 34
     * products to 0: 94 price nodes, 92 rejected, nothing kept. A substring
     * match on a class name counts the same thing more than once whenever a
     * shop names a child after its parent, which is most of them.
     *
     * DISTINCT HREFS cannot be fooled that way. A card points at one product,
     * however many elements point at it: the image link and the title link
     * carry the same URL and collapse to one. A grid points at dozens. The
     * threshold is generous rather than exact because a card legitimately
     * carries a couple of utility links (quick view, wishlist, a brand page),
     * and the failure being guarded against is not "a few" but "the entire
     * page", which is never close to the line.
     */
    const distinctHrefs = new Set<string>()
    for (const link of Array.from(card.querySelectorAll("a[href]"))) {
      distinctHrefs.add(link.getAttribute("href") ?? "")
    }
    if (distinctHrefs.size > 3) {
      rejectedMultiPrice += 1
      continue
    }

    const url = absolute(anchor.getAttribute("href"))
    if (!url || seenUrls.has(url)) {
      rejectedDuplicate += 1
      continue
    }

    /*
     * A PRODUCT CARD SHOWS THE PRODUCT. It carries a picture or a name, and
     * usually both; a price sitting next to a link with neither is page
     * furniture. "Delivery from £2.99" in a footer is the case that made this
     * necessary: it satisfies price-plus-link perfectly and is not a product,
     * and left in it would inflate every count and every median built on one.
     *
     * This is the one place the "capture everything, filter never" rule bends,
     * and only because the thing being excluded is not a product at all rather
     * than a product we are uninterested in.
     */
    const heading = card.querySelector("h1, h2, h3, h4, h5, [class*='title' i], [class*='name' i]")
    if (!heading && !card.querySelector("img")) {
      rejectedNoProductSignal += 1
      if (unresolvedSamples.length < 4) unresolvedSamples.push(contextOf(priceEl))
      continue
    }
    const title =
      text(heading?.textContent) ??
      text(anchor.getAttribute("title")) ??
      text(anchor.getAttribute("aria-label")) ??
      text(anchor.textContent) ??
      text(card.querySelector("img")?.getAttribute("alt"))

    /* Neither a name nor a price is navigation, not a product. */
    if (!title && !priceText) continue

    /*
     * WITH SEVERAL PRICES IN A CARD, THE LOWEST IS THE ONE THE SHOPPER PAYS.
     *
     * Now that a sale card is kept rather than discarded, which of its prices
     * is the price has to be decided rather than left to whichever node the
     * walk happened to start from. Markup order is no guide: some shops print
     * the RRP first and some print it last.
     *
     * The lowest is the honest answer. A struck-through "was" price is always
     * the higher one, and publishing it would show a shopper a number above
     * what the merchant is actually asking, which is the same class of wrong
     * as a stale price.
     */
    const allPrices = (card.textContent ?? "").match(new RegExp(PRICE, "g")) ?? []
    if (allPrices.length > 1) {
      let lowest: { text: string; value: number } | null = null
      for (const candidate of allPrices) {
        const value = cents(candidate)
        if (value == null || value <= 0) continue
        if (!lowest || value < lowest.value) lowest = { text: candidate, value }
      }
      if (lowest) priceText = lowest.text
    }

    const img = card.querySelector("img")
    seenUrls.add(url)
    cardsFound += 1
    if (resolvedSamples.length < 2) resolvedSamples.push(card.outerHTML.replace(/\s+/g, " ").slice(0, 700))

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
      imageUrl: absolute(
        img?.getAttribute("src") ??
          img?.getAttribute("data-src") ??
          img?.getAttribute("data-srcset")?.split(" ")[0],
      ),
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
  const bodyText = d.body
    ? ((d.body as HTMLElement).innerText ?? joinText(d.body))
    : ""
  const totalMatch =
    bodyText.match(/([\d,]{2,})\s+(?:results?|products?|items?)\b/i) ??
    bodyText.match(/of\s+([\d,]{2,})\b/i)
  const claimedTotal = totalMatch ? Number.parseInt(totalMatch[1].replace(/,/g, ""), 10) : null

  /*
   * A NEXT PAGE IS ON THIS SITE. ANYTHING ELSE IS NOT PAGINATION.
   *
   * zZounds' effects category offered `https://www.google.com/storepages?q=
   * zzounds.com&c=US` as its next page, and it was taken: a real capture of 70
   * products reported a next page pointing at Google. The crawl walks whatever
   * this returns, in a hidden frame, inside the operator's own session, so the
   * cost of a loose match here is not a missing page. It is this tool fetching
   * a search engine on somebody's behalf and reporting the result as the
   * merchant's catalogue.
   *
   * Same-origin is the whole rule, and it is the right shape of rule for the
   * same reason the challenge check reads the title only: the failure that
   * matters is the false positive, and a merchant who genuinely paginates onto
   * another hostname can be handled when one turns up, by somebody looking at
   * it.
   */
  const sameSite = (candidate: Element | null | undefined): Element | null => {
    const raw = candidate?.getAttribute("href")
    if (!raw) return null
    try {
      return new URL(raw, href).origin === new URL(href).origin ? (candidate as Element) : null
    } catch (error) {
      return null
    }
  }

  const nextLink =
    sameSite(d.querySelector('link[rel="next"]')) ??
    sameSite(d.querySelector('a[rel="next"]')) ??
    sameSite(
      Array.from(d.querySelectorAll("a")).find(
        (a) => /^(next|older|more)\b/i.test((a.textContent ?? "").trim()) && sameSite(a) != null,
      ),
    )

  const pageLinks = Array.from(d.querySelectorAll("a[href]"))
    .map((a) => absolute(a.getAttribute("href")))
    .filter((href): href is string => href != null && /[?&](page|p|start|offset)=\d+/i.test(href))
    .filter((href, index, all) => all.indexOf(href) === index)
    .slice(0, 200)

  const looksLazyLoaded = Boolean(
    d.querySelector("[data-infinite-scroll], .infinite-scroll, [class*='load-more' i]") ||
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
    pageUrl: href,
    pageTitle: d.title,
    origin: new URL(href).origin,
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
    diagnostics: {
      anchors: d.querySelectorAll("a[href]").length,
      priceNodes: priceNodes.length,
      cardsResolved: cardsFound,
      rejectedMultiPrice,
      rejectedNoProductSignal,
      rejectedNoAnchor,
      rejectedDuplicate,
      jsonLdBlocks: ldNodes.length,
      jsonLdTypes: ldTypes,
      unresolvedSamples,
      resolvedSamples,
      defences,
      challenged,
    },
  }
}
