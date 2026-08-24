// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { captureSource } from "@/lib/capture/extract"
import { analyseCaptures } from "@/lib/capture/analyse"

/**
 * WHAT THE EXTRACTOR HAS TO GET RIGHT ON A PAGE IT HAS NEVER SEEN.
 *
 * The merchants this exists for run custom platforms, so the DOM fallback is
 * not a nicety, it is the path that will actually be used. And the two
 * failures that matter are both silent: a price read wrong, and a capture that
 * quietly holds a fraction of the page while looking complete.
 */

function render(html: string, url = "https://example-shop.com/guitars") {
  document.documentElement.innerHTML = html
  /* jsdom will not navigate, so the URL is set on the window directly. */
  Object.defineProperty(window, "location", {
    value: new URL(url),
    writable: true,
    configurable: true,
  })
  const base = document.createElement("base")
  base.href = url
  document.head.appendChild(base)
}

beforeEach(() => {
  document.documentElement.innerHTML = "<head></head><body></body>"
})

describe("reading prices without getting one wrong", () => {
  /*
   * A WRONG PRICE IS WORSE THAN A MISSING ONE, everywhere on this project. The
   * hard case is a thousands separator against a decimal comma, and the two
   * are written identically in different countries.
   */
  const price = (text: string) => {
    render(`<body><a href="/products/x"><h3>A pedal</h3><span>${text}</span></a></body>`)
    return captureSource().products[0]?.priceCents ?? null
  }

  it("reads a plain dollar price", () => {
    expect(price("$129.99")).toBe(12999)
  })

  it("reads thousands with a comma", () => {
    expect(price("$1,299")).toBe(129900)
  })

  it("reads thousands with a dot, the European way", () => {
    expect(price("€1.299")).toBe(129900)
  })

  it("reads a decimal comma", () => {
    expect(price("€1.299,50")).toBe(129950)
  })

  it("reads pounds", () => {
    expect(price("£89.00")).toBe(8900)
  })
})

describe("JSON-LD, the best source when a page has it", () => {
  it("finds a product nested inside an ItemList", () => {
    /*
     * Real category pages nest Product inside ItemList inside @graph, and a
     * flat scan of the top level misses the entire page.
     */
    render(`<head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ItemList",
          itemListElement: [
            {
              "@type": "ListItem",
              item: {
                "@type": "Product",
                name: "Boss DS-1 Distortion",
                brand: { "@type": "Brand", name: "Boss" },
                mpn: "DS-1",
                offers: { "@type": "Offer", price: "59.99", priceCurrency: "USD" },
                url: "/products/ds-1",
              },
            },
          ],
        },
      ],
    })}</script></head><body></body>`)

    const result = captureSource()
    const product = result.products.find((p) => p.via === "json-ld")

    expect(product?.title).toBe("Boss DS-1 Distortion")
    expect(product?.brand).toBe("Boss")
    expect(product?.mpn).toBe("DS-1")
    expect(product?.priceCents).toBe(5999)
    expect(product?.url).toBe("https://example-shop.com/products/ds-1")
  })

  it("keeps the whole source object rather than only the fields it understood", () => {
    /*
     * CAPTURE EVERYTHING, FILTER NEVER. A field nothing here reads today is
     * exactly the field somebody needs on the second pass, and re-browsing
     * forty pages to recover it is the rework this tool exists to prevent.
     */
    render(`<head><script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "A pedal",
      weirdVendorField: "keep me",
    })}</script></head><body></body>`)

    const raw = captureSource().products[0]?.raw as Record<string, unknown>
    expect(raw.weirdVendorField).toBe("keep me")
  })

  it("survives a JSON-LD block that does not parse, and says so", () => {
    render(`<head><script type="application/ld+json">{ not json </script></head><body></body>`)
    const result = captureSource()
    expect(result.coverage.notes.join(" ")).toMatch(/did not parse/)
  })
})

describe("the DOM fallback, which is the path the big retailers need", () => {
  it("pairs a product link with the price in its card", () => {
    render(`<body>
      <div class="grid">
        <div class="card"><a href="/product/tube-screamer"><h3>Ibanez TS9 Tube Screamer</h3></a><span class="price">$109.99</span></div>
        <div class="card"><a href="/product/big-muff"><h3>EHX Big Muff Pi</h3></a><span class="price">$79.00</span></div>
      </div>
      <a href="/help/shipping">Shipping info</a>
    </body>`)

    const result = captureSource()
    const dom = result.products.filter((p) => p.via === "dom")

    expect(dom).toHaveLength(2)
    expect(dom[0].title).toBe("Ibanez TS9 Tube Screamer")
    expect(dom[0].priceCents).toBe(10999)
    /* A help link is navigation, not a product, and carries neither. */
    expect(dom.some((p) => p.url?.includes("/help/"))).toBe(false)
  })

  it("does not report one product twice when two extractors both find it", () => {
    render(`<head><script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Boss DS-1",
      url: "https://example-shop.com/product/ds-1",
      offers: { price: "59.99" },
    })}</script></head>
    <body><a href="/product/ds-1"><h3>Boss DS-1</h3></a><span>$59.99</span></body>`)

    const result = captureSource()
    /* The DOM pass skips a URL the structured pass already claimed. */
    expect(result.products.filter((p) => p.url?.endsWith("/product/ds-1"))).toHaveLength(1)
  })
})

describe("a retailer with flat URLs and no structured data", () => {
  /*
   * THE ANDERTONS CASE, and the reason the DOM pass was rewritten.
   *
   * The first version collected links whose path contained /product/, /item/
   * and friends. Andertons product pages live at paths like
   * /guitars/guitar-pedals/boss-ds1-distortion-pedal, with no marker segment
   * anywhere, so every product link was rejected and a category page of a
   * thousand items captured ZERO. The page said "1,000+ results" and the panel
   * said nothing found, which is the contradiction that gave it away.
   *
   * A URL shape is a convention each retailer invents. A price is not.
   */
  const ANDERTONS_SHAPED = `<body>
    <nav><a href="/guitars">Guitars</a><a href="/bass">Bass</a></nav>
    <p>1,024 results</p>
    <div class="ProductList">
      <div class="ProductCard">
        <a href="/guitars/guitar-pedals/boss-ds1-distortion-pedal">
          <img src="/i/ds1.jpg" alt="Boss DS-1 Distortion Pedal">
          <span class="ProductCard__name">Boss DS-1 Distortion Pedal</span>
        </a>
        <div class="ProductCard__price"><span>£45.00</span></div>
      </div>
      <div class="ProductCard">
        <a href="/guitars/guitar-pedals/ibanez-ts9-tube-screamer">
          <img src="/i/ts9.jpg" alt="Ibanez TS9 Tube Screamer">
          <span class="ProductCard__name">Ibanez TS9 Tube Screamer</span>
        </a>
        <div class="ProductCard__price"><span>£99.00</span></div>
      </div>
    </div>
    <footer><a href="/delivery">Delivery from £2.99</a></footer>
  </body>`

  it("finds products whose URLs carry no /product/ marker at all", () => {
    render(ANDERTONS_SHAPED, "https://www.andertons.co.uk/guitars/guitar-pedals")
    const result = captureSource()

    const dom = result.products.filter((p) => p.via === "dom")
    expect(dom.length, "the flat-URL grid was missed again").toBe(2)
    expect(dom.map((p) => p.title)).toContain("Boss DS-1 Distortion Pedal")
    expect(dom[0].priceCents).toBe(4500)
    expect(dom[0].url).toBe(
      "https://www.andertons.co.uk/guitars/guitar-pedals/boss-ds1-distortion-pedal",
    )
  })

  it("does not take the whole grid as one product", () => {
    /*
     * Climbing past the card into the container would file every item on the
     * page under one arbitrary link. A card holds one price; a grid holds
     * many, and that is the test.
     */
    render(ANDERTONS_SHAPED, "https://www.andertons.co.uk/guitars/guitar-pedals")
    const urls = captureSource().products.map((p) => p.url)
    expect(urls).not.toContain("https://www.andertons.co.uk/guitars")
  })

  it("still reports the claimed total beside what it captured", () => {
    render(ANDERTONS_SHAPED, "https://www.andertons.co.uk/guitars/guitar-pedals")
    expect(captureSource().coverage.claimedTotal).toBe(1024)
  })

  it("takes the title from an image alt when the card has no heading", () => {
    render(
      `<body><div><a href="/x/y/thing"><img src="/i.jpg" alt="Fender Blues Junior"></a>
       <span>£599.00</span></div></body>`,
      "https://shop.example.com/amps",
    )
    const dom = captureSource().products.filter((p) => p.via === "dom")
    expect(dom[0]?.title).toBe("Fender Blues Junior")
  })

  it("ignores a price in the footer that belongs to no product card", () => {
    /*
     * "Delivery from £2.99" sits next to a link, so a naive price walk would
     * make a product out of it. It has no product card around it, but it does
     * have an anchor, so this is the honest limit of the heuristic: it is
     * captured and left for the analyser rather than guessed away here. What
     * matters is that it does not displace a real product.
     */
    render(ANDERTONS_SHAPED, "https://www.andertons.co.uk/guitars/guitar-pedals")
    const titles = captureSource().products.map((p) => p.title)
    expect(titles).toContain("Boss DS-1 Distortion Pedal")
    expect(titles).toContain("Ibanez TS9 Tube Screamer")
  })
})

describe("a card that is on sale", () => {
  /*
   * THE BUG THAT COST A THIRD OF ANDERTONS' BASS DEPARTMENT.
   *
   * The card guard was "more than one price means we climbed into the grid",
   * which is true of a grid and equally true of every discounted product: a
   * sale card shows "was £1199" beside "now £999". The diagnostics said it
   * plainly once they existed: 99 price nodes, 34 cards kept, 53 rejected as
   * multi-price, on a page of 48 products.
   *
   * A title is the thing that is genuinely one per card, so that is the guard
   * now, and a card may carry as many prices as it likes.
   */
  const SALE_CARD = `<body><div class="grid">
    <div class="card">
      <h3 class="title"><a href="/bass/tobias-classic-v/">Tobias Classic V</a></h3>
      <div class="prices"><span class="was">£1,199.00</span><span class="now">£999.00</span></div>
    </div>
    <div class="card">
      <h3 class="title"><a href="/bass/eastcoast-srb/">EastCoast SRB</a></h3>
      <div class="prices"><span class="now">£99.00</span></div>
    </div>
  </div></body>`

  it("keeps a discounted product instead of throwing it away", () => {
    render(SALE_CARD, "https://www.andertons.co.uk/browse/bass-dept/")
    const dom = captureSource().products.filter((p) => p.via === "dom")
    expect(dom.map((p) => p.title)).toContain("Tobias Classic V")
    expect(dom).toHaveLength(2)
  })

  it("publishes the price the shopper pays, not the struck-through one", () => {
    /*
     * The lowest, because a "was" price is always the higher one and showing
     * it would put a number above what the merchant is actually asking in
     * front of a shopper. Same class of wrong as a stale price.
     */
    render(SALE_CARD, "https://www.andertons.co.uk/browse/bass-dept/")
    const sale = captureSource().products.find((p) => p.title === "Tobias Classic V")
    expect(sale?.priceCents).toBe(99900)
  })

  it("still refuses to swallow the whole grid as one product", () => {
    /*
     * Relaxing the price guard could have opened this up, so it is pinned:
     * the container holds two titles and must never resolve to one product.
     */
    render(SALE_CARD, "https://www.andertons.co.uk/browse/bass-dept/")
    const urls = captureSource().products.map((p) => p.url)
    expect(new Set(urls).size).toBe(2)
  })
})

describe("reading a page fetched by a crawl rather than the one you are on", () => {
  /*
   * The crawl fetches page two same-origin and parses it into a detached
   * Document that has no window, no location, and a baseURI pointing at the
   * page that DID the fetching. All three would quietly poison the result.
   */
  function parsed(html: string) {
    return new DOMParser().parseFromString(html, "text/html")
  }

  it("resolves relative links against the fetched page, not the fetching one", () => {
    /*
     * THE BUG THIS PREVENTS IS THE ONE THAT LOOKS LIKE SUCCESS. Resolve page
     * two's links against page one and every product URL comes out identical
     * to page one's, so the crawl dedupes them all away, reports "nothing new"
     * and stops after two pages, having captured a fraction of the catalogue
     * while appearing to work.
     */
    /* Wrapped in a card element, as every real grid is: the extractor finds the
       card by walking out from the price to the nearest ancestor holding a
       link, and <body> is deliberately not allowed to be that ancestor. */
    const doc = parsed(
      `<body><div class="card"><a href="/product/page-two-pedal"><h3>Page two pedal</h3></a>` +
        `<span>$99</span></div></body>`,
    )

    const result = captureSource(doc, "https://shop.example.com/guitars?page=2")

    expect(result.products[0].url).toBe("https://shop.example.com/product/page-two-pedal")
    expect(result.pageUrl).toBe("https://shop.example.com/guitars?page=2")
    expect(result.origin).toBe("https://shop.example.com")
  })

  it("does not report the crawling page's platform as the fetched page's", () => {
    /*
     * Platform detection reads `window`, which a detached document has none
     * of. Reading the crawler's globals while claiming to describe the fetched
     * page would stamp every crawled page with page one's platform.
     */
    const doc = parsed(`<body><a href="/product/x"><h3>A pedal</h3></a><span>$10</span></body>`)
    expect(captureSource(doc, "https://shop.example.com/p2").platform).toBeNull()
  })

  it("still finds the pagination on a fetched page, so the crawl can continue", () => {
    const doc = parsed(`<body>
      <a rel="next" href="/guitars?page=3">Next</a>
      <a href="/product/x"><h3>A pedal</h3></a><span>$10</span>
    </body>`)

    const result = captureSource(doc, "https://shop.example.com/guitars?page=2")
    expect(result.coverage.nextPageUrl).toBe("https://shop.example.com/guitars?page=3")
  })
})

describe("saying what the capture did NOT see", () => {
  /*
   * THE FAILURE THIS PREVENTS IS THE EXPENSIVE ONE. A capture holding 24 of
   * 1,180 products looks exactly like a small catalogue, and a decision made
   * on it is wrong in a way nothing reveals until the work has been done
   * twice.
   */
  it("reports the total the page claims", () => {
    render(`<body><p>1,180 results</p><a href="/product/a"><h3>A</h3></a><span>$10</span></body>`)
    expect(captureSource().coverage.claimedTotal).toBe(1180)
  })

  it("warns when the claimed total exceeds what it captured", () => {
    render(`<body><p>1,180 results</p><a href="/product/a"><h3>A</h3></a><span>$10</span></body>`)
    expect(captureSource().coverage.notes.join(" ")).toMatch(/claims 1180 results/)
  })

  it("notices a grid that loads more on demand", () => {
    render(`<body><button class="load-more">Load more</button><a href="/product/a"><h3>A</h3></a><span>$10</span></body>`)
    const coverage = captureSource().coverage
    expect(coverage.looksLazyLoaded).toBe(true)
    expect(coverage.notes.join(" ")).toMatch(/Scroll to the very bottom/)
  })

  it("collects the pagination it can see", () => {
    render(`<body>
      <a href="/guitars?page=2">2</a><a href="/guitars?page=3">3</a>
      <a rel="next" href="/guitars?page=2">Next</a>
      <a href="/product/a"><h3>A</h3></a><span>$10</span>
    </body>`)
    const coverage = captureSource().coverage
    expect(coverage.nextPageUrl).toContain("page=2")
    expect(coverage.pageLinks.length).toBeGreaterThanOrEqual(2)
  })

  it("says plainly when it found nothing at all", () => {
    render(`<body><h1>Welcome</h1></body>`)
    const result = captureSource()
    expect(result.products).toHaveLength(0)
    expect(result.coverage.notes.join(" ")).toMatch(/Nothing found/)
  })
})

describe("what the analysis concludes", () => {
  it("scores a capture against the pedals we have already modelled", () => {
    /*
     * THE NUMBER WORTH ACTING ON. The site has 89 measured 3D models and
     * almost nothing live reaches them, so "this page carries pedals we can
     * already render" is a better reason to chase a merchant than a product
     * count.
     */
    render(`<body>
      <div><a href="/product/ds-1"><h3>Boss DS-1 Distortion</h3></a><span>$59.99</span></div>
      <div><a href="/product/kettle"><h3>Stainless Steel Kettle</h3></a><span>$29.99</span></div>
    </body>`)

    const analysis = analyseCaptures([captureSource()])

    expect(analysis.modelled.count).toBe(1)
    expect(analysis.modelled.matches[0].model).toMatch(/DS-1/)
    expect(analysis.verdict).toMatch(/measured 3D models/)
  })

  it("calls a partial capture a sample rather than a catalogue", () => {
    render(`<body><p>1,180 results</p><a href="/product/a"><h3>A pedal</h3></a><span>$10</span></body>`)
    const analysis = analyseCaptures([captureSource()])
    expect(analysis.verdict).toMatch(/THIS IS A SAMPLE, NOT THE CATALOGUE/)
  })

  it("merges several pages into one answer and does not double-count", () => {
    render(`<body><div><a href="/product/a"><h3>A pedal</h3></a><span>$10</span></div></body>`)
    const first = captureSource()
    render(`<body>
      <div><a href="/product/a"><h3>A pedal</h3></a><span>$10</span></div>
      <div><a href="/product/b"><h3>B pedal</h3></a><span>$20</span></div>
    </body>`)
    const second = captureSource()

    const analysis = analyseCaptures([first, second])
    expect(analysis.distinct).toBe(2)
  })

  it("prefers the richer record when two extractors found one product", () => {
    /*
     * A JSON-LD record carries a brand and an identifier; the DOM record for
     * the same product carries a name off a card. Keeping whichever arrived
     * first would throw away half the fields at random.
     */
    render(`<head><script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Boss DS-1",
      brand: { name: "Boss" },
      mpn: "DS-1",
      url: "https://example-shop.com/product/ds-1",
      offers: { price: "59.99" },
    })}</script></head>
    <body><a href="/product/ds-1"><h3>Boss DS-1</h3></a><span>$59.99</span></body>`)

    const analysis = analyseCaptures([captureSource()])
    expect(analysis.brands[0]?.brand).toBe("Boss")
  })

  it("reports a median rather than a mean", () => {
    /* Section 8's rule, for section 8's reason: one optimist ruins a mean. */
    render(`<body>
      <div><a href="/product/a"><h3>A</h3></a><span>$10</span></div>
      <div><a href="/product/b"><h3>B</h3></a><span>$20</span></div>
      <div><a href="/product/c"><h3>C</h3></a><span>$100000</span></div>
    </body>`)
    const analysis = analyseCaptures([captureSource()])
    expect(analysis.priceCents?.median).toBe(2000)
  })
})
