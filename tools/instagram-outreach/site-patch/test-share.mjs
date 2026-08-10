import fs from 'fs';
import handler, { __test } from './api-share.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

// Real shapes: Shopify keeps sizes[5] null, so the ref-stamped product url is what
// carries attribution, exactly as the site's own addToCart relies on.
const PRODUCTS = [
  { id: 'thcaking__blue-dream-oz', name: 'Blue Dream THCa Flower', store: 'THCA King',
    storeKey: 'thcaking', domain: 'thcaking.com', cartDomain: 'thcaking.com',
    platform: 'shopify', ref: 'coffeeandajoint', refLink: '', coupon: 'JACOBKENNEDY',
    category: 'THCA Flower', cur: 'USD', inStock: true, perG: 1.57,
    image: 'https://cdn.shopify.com/blue-dream.jpg',
    url: 'https://thcaking.com/products/blue-dream?ref=coffeeandajoint',
    sizes: [['1 oz', 44, 28, '4411', 1, null, ''], ['Quarter Pound', 149, 112, '4412', 1, null, '']],
    sale: 44, startsAt: 44 },
  { id: 'evil__x', name: 'Pwn "me" <script>alert(1)</script> & co', store: '<b>Bad</b>',
    storeKey: 'evil', domain: 'evil.test', platform: 'shopify', ref: '', coupon: '',
    category: 'THCA Flower', cur: 'USD', inStock: true, perG: 1,
    image: 'javascript:alert(document.domain)', url: 'javascript:alert(1)',
    sizes: [['1 oz', 30, 28, '9', 1, null, '']], sale: 30, startsAt: 30 },
];

globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: PRODUCTS }) });

function run(id, s, extra) {
  let status = 0, sent = '';
  const res = { setHeader() {}, status(x) { status = x; return this; }, send(b) { sent = b; return this; } };
  const query = Object.assign({ id }, extra || {}); if (s != null) query.s = s;
  return handler({ query, headers: { host: 'legal-leafmarket.com' } }, res).then(() => ({ status, html: sent }));
}

console.log('=== the product card a crawler reads ===');
const good = await run('thcaking__blue-dream-oz');
const tag = (p) => (good.html.match(new RegExp('<meta property="' + p + '" content="([^"]*)"')) || [])[1];
console.log('  og:title       ' + tag('og:title'));
console.log('  og:description ' + tag('og:description'));
console.log('  og:image       ' + tag('og:image'));
ok(good.status === 200, 'status 200');
ok(tag('og:title') === 'Blue Dream THCa Flower (1oz) $44', 'title has product, size, price');
ok(/1oz, \$1\.57 per gram, at THCA King/.test(tag('og:description')), 'description carries the value case');
// The photo is the product's, asked for at the size the tags go on to declare. The
// dedicated block at the bottom covers that mechanism.
ok(tag('og:image').startsWith('https://cdn.shopify.com/blue-dream.jpg?'), 'image is the product photo');
ok(tag('og:image:width') === '1200', 'and the card states its size, so it renders on first scrape');
ok(tag('og:type') === 'product', 'og:type product');
ok(tag('og:url') === 'https://legal-leafmarket.com/p/thcaking__blue-dream-oz', 'canonical on our domain');

console.log('\n=== same flow as the site, no new buttons ===');
ok((good.html.match(/class="buy"/g) || []).length === 1, 'exactly one primary action');
ok(/id="add"[^>]*>?|>Add to cart</.test(good.html), 'and it is Add to cart');
ok(!/Buy at |Go straight to |sponsored/.test(good.html), 'no vendor button was introduced');
ok(!/api\/subscribe/.test(good.html), 'no email capture flow was introduced');
ok(good.html.includes("localStorage.setItem('ll_cart'"), 'writes the site cart key ll_cart');
  ok(/id="size"/.test(good.html), 'the size dropdown is present');
ok(good.html.includes("LL.track('add_to_cart'"), 'fires the same analytics event as the site');

console.log('\n=== affiliate references survive, checked against the real builder ===');
const item = __test.cartItem(PRODUCTS[0], null);
console.log('  cart item: ' + JSON.stringify(item));
const siteFields = ['id','name','store','storeKey','domain','cartDomain','platform','ref','refLink','coupon','url','price','size','variantId','cur'];
ok(siteFields.every(k => k in item), 'item has every field addToCart pushes');
ok(item.ref === 'coffeeandajoint', 'ref carried: ' + item.ref);
ok(item.coupon === 'JACOBKENNEDY', 'coupon carried: ' + item.coupon);
ok(item.url.includes('ref=coffeeandajoint'), 'url keeps its affiliate stamp');
ok(item.variantId === '4411', 'variantId carried, needed for the cart permalink');
ok(item.price === 44 && item.size === '1 oz', 'cheapest size chosen by default');

// Pull the site's own checkout builder out of consumables.html and run it.
const html = fs.readFileSync('/workspace/code_backup/public/consumables.html', 'utf8');
const fnSrc = html.match(/function storeCheckoutUrl\(domain, items\)\{[\s\S]*?\n  \}/)[0];
const storeCheckoutUrl = new Function('return ' + fnSrc)();
const checkout = storeCheckoutUrl(item.domain, [item]);
console.log('  checkout URL the site builds: ' + checkout);
ok(/^https:\/\/thcaking\.com\/cart\/4411:1\?/.test(checkout), 'real cart permalink built');
ok(checkout.includes('ref=coffeeandajoint'), 'affiliate ref present in checkout');
ok(checkout.includes('discount=JACOBKENNEDY'), 'coupon present in checkout');

// A chosen size must win over cheapest, same as picking a size on a card.
const big = __test.cartItem(PRODUCTS[0], 1);
ok(big.price === 149 && big.variantId === '4412', '?s=1 selects the second size');
const bigPage = await run('thcaking__blue-dream-oz', '1');
ok(bigPage.html.includes('"variantId":"4412"'), 'the page embeds the selected size');

console.log('\n=== hostile feed row ===');
const evil = await run('evil__x');
ok(!/<script>alert\(1\)<\/script>/.test(evil.html), 'script tag escaped');
ok(evil.html.includes('&lt;script&gt;'), 'appears escaped instead');
ok(!/href="javascript:/.test(evil.html), 'no javascript: href');
const itemLine = (evil.html.match(/var D = (\{.*\});/) || [])[1] || '';
ok(itemLine.length > 0, 'found the embedded payload');
ok(!itemLine.includes('<'), 'embedded JSON has no raw < at all, so it cannot close the script tag');
ok(itemLine.includes('\\u003c'), 'the angle brackets are unicode-escaped instead');
ok(JSON.parse(itemLine).slides[0].sizes[0].item.name === PRODUCTS[1].name,
   'and it still parses back to the exact product name');
const evilImg = (evil.html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
ok(evilImg === 'https://legal-leafmarket.com/og-image.png', 'javascript: image fell back');

console.log('\n=== missing product ===');
const gone = await run('nope__nothing');
ok(gone.status === 404, '404 unknown id');
ok(/robots" content="noindex/.test(gone.html), 'dead links noindex');
ok((await run('')).status === 404, '404 with no id');

// ---------------------------------------------------------------------------
// /p/pick: the weekly pick, computed from live data rather than pasted in
// ---------------------------------------------------------------------------
console.log('\n=== /p/pick selection ===');
{
  const CATALOG = [
    // Dearest qualifying ounce, under the cap, in stock. Should win.
    { id: 'smallbuds__sour-oz', name: 'Sour Diesel Small Buds', store: 'THCA Small Buds',
      storeKey: 'thcasmallbuds', domain: 'thcasmallbuds.com', cartDomain: 'thcasmallbuds.com',
      platform: 'shopify', ref: 'coffeeandajoint', coupon: 'JACOBKENNEDY',
      category: 'THCA Flower', cur: 'USD', inStock: true, perG: 0.5,
      image: 'https://cdn.shopify.com/sour.jpg', url: 'https://thcasmallbuds.com/products/sour?ref=coffeeandajoint',
      sizes: [['1 oz', 39, 28, 'V-OZ', 1, null, ''], ['4 oz', 129, 112, 'V-QP', 1, null, '']] },
    // Cheaper per gram, but only at quarter-pound size, which is over the cap.
    { id: 'king__cheap-qp', name: 'Cheap QP', store: 'THCA King', storeKey: 'thcaking',
      domain: 'thcaking.com', platform: 'shopify', ref: 'coffeeandajoint', coupon: '',
      category: 'THCA Flower', cur: 'USD', inStock: true, perG: 0.4,
      image: 'https://cdn.shopify.com/qp.jpg', url: 'https://thcaking.com/products/qp',
      sizes: [['Quarter Pound', 45, 112, 'V-CHEAP', 1, null, '']] },
    // Better per gram than the winner, but nowhere near an ounce.
    { id: 'king__eighth', name: 'Boutique Eighth', store: 'THCA King', storeKey: 'thcaking',
      domain: 'thcaking.com', platform: 'shopify', ref: '', coupon: '',
      category: 'THCA Flower', cur: 'USD', inStock: true, perG: 0.2,
      image: 'https://cdn.shopify.com/e.jpg', url: 'https://thcaking.com/products/e',
      sizes: [['Eighth', 0.7, 3.5, 'V-E', 1, null, '']] },
    // Would beat the winner, but out of stock.
    { id: 'king__oos', name: 'Sold Out Ounce', store: 'THCA King', storeKey: 'thcaking',
      domain: 'thcaking.com', platform: 'shopify', ref: '', coupon: '',
      category: 'THCA Flower', cur: 'USD', inStock: false, perG: 0.1,
      image: 'https://cdn.shopify.com/o.jpg', url: 'https://thcaking.com/products/o',
      sizes: [['1 oz', 10, 28, 'V-OOS', 1, null, '']] },
    /* Cheaper, and better per gram, at a real ounce. This is what the old
       value-first ranking led with, and it is the case that prompted the change:
       a $20 ounce is the first thing a stranger saw in a DM. It still qualifies
       and still gets a slide, it just no longer leads. */
    { id: 'king__budget-oz', name: 'Budget Ounce', store: 'THCA King', storeKey: 'thcaking',
      domain: 'thcaking.com', platform: 'shopify', ref: '', coupon: '',
      category: 'THCA Flower', cur: 'USD', inStock: true, perG: 0.71,
      image: 'https://cdn.shopify.com/b.jpg', url: 'https://thcaking.com/products/b',
      sizes: [['1 oz', 20, 28, 'V-B20', 1, null, '']] },
    // Accessory: grams 0, must never be considered.
    { id: 'chill__pipe', name: 'Steel Pipe', store: 'Chill', storeKey: 'chill',
      domain: 'chill.store', platform: 'shopify', ref: '', coupon: '',
      category: 'Devices', cur: 'USD', inStock: true, perG: null,
      image: 'https://cdn.shopify.com/p.jpg', url: 'https://chill.store/products/p',
      sizes: [['One Size', 20, 0, 'V-P', 1, null, '']] },
  ];

  const OZ = { maxPrice: 50, minGrams: 25, maxGrams: 40, category: 'THCA Flower' };
  const best = __test.pickBest(CATALOG, OZ);
  ok(best && best.product.id === 'smallbuds__sour-oz',
     'picked the dearest in-stock ounce under the cap: ' + (best && best.product.id));
  ok(best && best.index === 0, 'picked the 1oz row, not the 4oz: index ' + (best && best.index));
  ok(Math.abs(best.perG - 39 / 28) < 1e-9, 'per gram computed off the chosen row');

  /* The reversal itself. The $20 ounce is cheaper per gram and would have led
     under the old rule, so this is the assertion that fails if the sort flips
     back, and $39 is the number that has to reach the card. */
  const ranked = __test.pickAll(CATALOG, OZ);
  ok(ranked.length === 2, 'both real ounces qualify, got ' + ranked.length);
  ok(ranked[0].price === 39 && ranked[1].price === 20,
     'dearest first, cheapest last: ' + ranked.map((r) => r.price).join(','));
  ok(ranked[1].perG < ranked[0].perG,
     'and the one that lost is genuinely the better value per gram, so this is the tradeoff and not a tie');
  ok(ranked.some((r) => r.product.id === 'king__budget-oz'),
     'the cheap ounce still makes the pool, it just does not lead');

  ok(__test.pickBest(CATALOG, { maxPrice: 19, minGrams: 25, maxGrams: 40, category: 'THCA Flower' }) === null,
     'nothing qualifies at a $19 cap, below every in-stock ounce');
  const qp = __test.pickBest(CATALOG, { maxPrice: 50, minGrams: 112, maxGrams: 200, category: 'THCA Flower' });
  ok(qp && qp.product.id === 'king__cheap-qp',
     'widening the band to a QP changes the winner: ' + (qp && qp.product.id));

  const rev = __test.pickBest(CATALOG.slice().reverse(), { maxPrice: 50, minGrams: 25, maxGrams: 40, category: 'THCA Flower' });
  ok(rev && rev.product.id === best.product.id, 'same winner with the feed reversed');
  /* The whole point of the band: a cheaper-per-gram quarter pound must not win an
     ounce query just because it also sits under the cap. */
  ok(best && best.product.id !== 'king__cheap-qp', 'the $45 quarter pound did not win the ounce query');

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: CATALOG }) });
  const pick = await run('pick');
  const pTag = (n) => (pick.html.match(new RegExp('<meta property="' + n + '" content="([^"]*)"')) || [])[1];
  console.log('  og:title       ' + pTag('og:title'));
  console.log('  og:description ' + pTag('og:description'));
  ok(pick.status === 200, '/p/pick returns 200');
  ok(pTag('og:title') === 'Sour Diesel Small Buds (1oz) $39', 'card shows the chosen ounce and its price');
  ok(/per gram, at THCA Small Buds/.test(pTag('og:description')), 'per gram is the chosen row');
  ok(pick.html.includes('"variantId":"V-OZ"'), 'cart item carries the ounce variant');
  ok(pick.html.includes('"ref":"coffeeandajoint"'), 'affiliate ref carried on the pick');
  ok(pick.html.includes('"coupon":"JACOBKENNEDY"'), 'coupon carried on the pick');
  ok(!/"variantId":"V-QP"/.test(pick.html) || /this week/.test(pick.html),
     'the 4oz is only ever an alternative size, never the advertised one');
  ok(pTag('og:url') === 'https://legal-leafmarket.com/p/pick', 'canonical is the stable /p/pick URL');

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [] }) });
  const none = await run('pick');
  ok(none.status === 200, 'no qualifying product still answers 200, not a broken link');
  ok(/Nothing qualifies right now/.test(none.html), 'says so plainly');
  ok(/robots" content="noindex/.test(none.html), 'and is noindex');
  ok(!/Add to cart/.test(none.html), 'offers no cart button with nothing to add');
}

// ---------------------------------------------------------------------------
// Tracking. The earlier version called LL.track without ever defining LL, so
// every event went nowhere. These pin that it is wired the same way the rest of
// the site wires it.
// ---------------------------------------------------------------------------
console.log('\n=== tracking ===');
{
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: PRODUCTS }) });
  const pg = await run('thcaking__blue-dream-oz');

  ok(/_vercel\/insights\/script\.js/.test(pg.html), 'loads the Vercel insights script, so va() actually reports');
  ok(/window\.va = window\.va \|\|/.test(pg.html), 'defines the same va queue shim as index.html');
  ok(/window\.LL = window\.LL \|\|/.test(pg.html), 'defines LL, which the cart handler calls');
  ok(/sessionStorage\.getItem\(k\)/.test(pg.html) && /ll_sid/.test(pg.html), 'reuses the ll_sid session id');
  ok(/'ll_events'/.test(pg.html), 'writes the same ll_events ring buffer');
  ok(/navigator\.sendBeacon\('\/api\/track'/.test(pg.html), 'beacons to the existing /api/track sink');
  ok(/LL\.track\('page_view'/.test(pg.html), 'fires page_view on load');
  ok(/LL\.track\('add_to_cart'/.test(pg.html), 'still fires add_to_cart, and now LL exists to receive it');

  // The event payload has to identify which pick was on screen when they clicked.
  const base = (pg.html.match(/var BASE = (\{.*?\});/) || [])[1];
  console.log('  event payload: ' + base);
  ok(!!base, 'found the event payload');
  const parsed = JSON.parse(base);
  ok(parsed.pid === 'thcaking__blue-dream-oz', 'carries the product id');
  ok(parsed.store === 'THCA King', 'carries the store');
  ok(parsed.value === 44, 'carries the price actually shown');
  ok(parsed.size === '1 oz', 'carries the size shown');
  ok(parsed.page === 'share', 'labels the page kind');
  ok(/utm_source/.test(pg.html), 'picks up utm tags off the URL when the link carries them');

  // /p/pick must label itself distinctly or the two cannot be told apart.
  const pk = await run('pick');
  const pkBase = JSON.parse((pk.html.match(/var BASE = (\{.*?\});/) || [])[1]);
  ok(pkBase.page === 'pick', '/p/pick labels itself as pick, got ' + pkBase.page);

  // Nothing to show is a signal worth recording, not a silent dead end.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [] }) });
  const empty = await run('pick');
  const emptyBase = JSON.parse((empty.html.match(/var BASE = (\{.*?\});/) || [])[1]);
  ok(emptyBase.outcome === 'empty', 'an empty pick records outcome=empty, got ' + emptyBase.outcome);
  ok(emptyBase.maxPrice === 50, 'and the cap that found nothing');

  // Feed text reaches the payload too, so it needs the same escaping treatment.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: PRODUCTS }) });
  const nasty = await run('evil__x');
  const nastyBase = (nasty.html.match(/var BASE = (\{.*?\});/) || [])[1] || '';
  ok(!nastyBase.includes('<'), 'no raw < in the event payload either');
  ok(JSON.parse(nastyBase).store === '<b>Bad</b>', 'and it still parses back to the exact store name');
}

// ---------------------------------------------------------------------------
// Shuffle: walk the ranked pool of qualifying ounces
// ---------------------------------------------------------------------------
console.log('\n=== shuffle ===');
{
  const oz = (id, name, store, price, ref) => ({
    id, name, store, storeKey: store.toLowerCase().replace(/\W/g, ''),
    domain: 'x.test', cartDomain: 'x.test', platform: 'shopify',
    ref: ref || '', coupon: '', category: 'THCA Flower', cur: 'USD', inStock: true,
    perG: price / 28, image: 'https://cdn.test/' + id + '.jpg',
    url: 'https://x.test/products/' + id,
    sizes: [['1 oz', price, 28, 'V-' + id, 1, null, '']],
  });
  // Deliberately out of price order, to prove ranking rather than feed order.
  const POOL = [oz('c', 'Ounce C', 'Store C', 47), oz('a', 'Ounce A', 'Store A', 39, 'coffeeandajoint'), oz('b', 'Ounce B', 'Store B', 44)];
  const opts = { maxPrice: 50, minGrams: 25, maxGrams: 40, category: 'THCA Flower' };

  const ranked = __test.pickAll(POOL, opts, __test.PICK_POOL);
  ok(ranked.length === 3, 'all three ounces qualify, got ' + ranked.length);
  /* Dearest first: $47, $44, $39. All three are the same 28g, so this is price
     order and value order reversed, which is the point. Feed order is 'c,a,b'. */
  ok(ranked.map(r => r.product.id).join(',') === 'c,b,a',
     'ranked dearest first regardless of feed order: ' + ranked.map(r => r.product.id).join(','));
  ok(__test.pickBest(POOL, opts).product.id === 'c', 'pickBest is still just the head of that list');
  ok(__test.pickAll(POOL, opts, 2).length === 2, 'the pool cap truncates');

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: POOL }) });

  const first = await run('pick');
  /* Now a slideshow: arrows on the photo and a position counter, rather than a
     random jump per click. */
  ok(/id="prev"/.test(first.html) && /id="next"/.test(first.html), 'prev and next arrows exist');
  ok(/id="count"[^>]*>1 of 3</.test(first.html), 'the counter states the position');
  ok(/class="ov nav prev"/.test(first.html), 'arrows are photo overlays');
  const b0 = JSON.parse((first.html.match(/var BASE = (\{.*?\});/) || [])[1]);
  ok(b0.rank === 0 && b0.of === 3, 'events carry rank and pool size: rank=' + b0.rank + ' of=' + b0.of);
  ok(b0.pid === 'c', 'rank 0 is the dearest ounce inside the cap');

  // ?i= moves through the pool, and the card follows it.
  const second = await run('pick', null, { i: '1' });
  const t2 = (n) => (second.html.match(new RegExp('<meta property="' + n + '" content="([^"]*)"')) || [])[1];
  ok(t2('og:title') === 'Ounce B (1oz) $44', 'i=1 renders the next one down: ' + t2('og:title'));
  ok(second.html.includes('"variantId":"V-b"'), 'and its cart item is the right product');
  ok(/id="count"[^>]*>2 of 3</.test(second.html), 'counter reflects the requested slide');

  // Out of range must clamp rather than 404 or render nothing.
  const far = await run('pick', null, { i: '99' });
  ok(far.status === 200, 'i=99 still renders, status ' + far.status);
  ok(/id="count"[^>]*>3 of 3</.test(far.html), 'clamped to the last slide');
  const neg = await run('pick', null, { i: '-4' });
  ok(/id="count"[^>]*>1 of 3</.test(neg.html), 'a negative index falls back to the lead slide');

  // Moving slides must keep the URL shareable without dropping a custom cap.
  ok(/new URLSearchParams\(location\.search\)/.test(first.html) && /q\.set\('i'/.test(first.html),
     'the URL tracks the slide and only changes i');
  ok(/history\.replaceState/.test(first.html), 'without stacking a history entry per tap');
  ok(/LL\.track\('slide'/.test(first.html), 'slide moves are tracked');
  // All ten slides ship with the page, so moving is instant rather than a reload.
  const allSlides = JSON.parse((first.html.match(/var D = (\{[\s\S]*?\});\n/) || [])[1]);
  ok(allSlides.slides.length === 3, 'every slide is embedded, got ' + allSlides.slides.length);
  ok(allSlides.slides.every((z) => z.img && z.lab != null && Array.isArray(z.sizes)),
     'each carries its own photo, lab panel and sizes');
  ok(allSlides.start === 0, 'starting slide recorded');

  // One qualifying product means nothing to move between, so no arrows.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [POOL[1]] }) });
  const lone = await run('pick');
  ok(!/id="next"/.test(lone.html) && !/id="count"/.test(lone.html),
     'no arrows or counter when only one ounce qualifies');
  ok(/Add to cart/.test(lone.html), 'but the page still works');
}

// ---------------------------------------------------------------------------
// Multi-strain listings. Taken from the live feed: Cheap THCA Smalls Ounce has
// seven rows, every one 28g, three of them at the same $35.99. Labelling options
// by weight and price alone rendered three identical entries, so the shopper could
// not tell Royal Zkittlez from Barney's Biscotti from Punch Breath.
// ---------------------------------------------------------------------------
console.log('\n=== multi-strain option labels ===');
{
  const MULTI = {
    id: 'thcasmallbuds__cheap-thca-smalls-ounce', name: 'Cheap THCA Smalls Ounce',
    store: 'THCA Small Buds', storeKey: 'thcasmallbuds', domain: 'thcasmallbuds.com',
    cartDomain: 'thcasmallbuds.com', platform: 'shopify',
    ref: 'coffeeandajoint', coupon: 'JACOBKENNEDY',
    category: 'THCA Flower', cur: 'USD', inStock: true, perG: 0.71,
    image: 'https://cdn.shopify.com/x.png', url: 'https://thcasmallbuds.com/products/x?ref=coffeeandajoint',
    sizes: [
      ['Royal Zkittlez (Indica Hybrid)', 35.99, 28, 'V1', 1, null, ''],
      ['Mudslide (Indica Hybrid) - New Mediums', 20, 28, 'V2', 1, null, ''],
      ["Barney's Biscotti (Indica Hybrid) - New Arrival", 35.99, 28, 'V3', 1, null, ''],
      ['Punch Breath (Indica Hybrid) - New Arrival', 35.99, 28, 'V4', 1, null, ''],
    ],
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [MULTI] }) });
  const page = await run('pick');

  const opts = [...page.html.matchAll(/<option value="(\d+)">([^<]*)<\/option>/g)]
    .map((m) => ({ v: m[1], text: m[2] }));
  console.log('  options:');
  opts.forEach((o) => console.log('    ' + o.text));

  ok(opts.length === 4, 'all four rows offered, got ' + opts.length);
  ok(new Set(opts.map((o) => o.text)).size === 4,
     'every option is distinguishable from every other');
  ok(opts.every((o) => /Zkittlez|Mudslide|Biscotti|Punch Breath/.test(o.text)),
     'each option names its strain');
  /* This listing is the one that prompted the reversal: its $20 Mudslide row was
     the cheapest per gram in the whole feed, so it led the card. The pick is now
     the dearest qualifying row, and with three of them tied at $35.99 and all
     28g the tie-break falls through per gram to the row index, so the first of
     the three wins and keeps winning between requests. */
  ok(/Royal Zkittlez[^<]*this week&#39;s pick/.test(page.html),
     'the pick is marked, and the tie at $35.99 resolves to the first such row');
  ok(!/Mudslide[^<]*this week&#39;s pick/.test(page.html), 'the $20 row no longer leads');
  ok(opts.filter((o) => /35\.99/.test(o.text)).length === 3,
     'the three same-priced rows are all present rather than collapsed');

  // The selection hint must name the strain, since that is what they are choosing.
  ok(/'Adding ' \+ c\.display/.test(page.html), 'the hint restates the chosen strain');
  ok(__test.saysWeightAlready('1 oz', '1oz'), '"1 oz" counts as already stating 1oz');
  ok(!__test.saysWeightAlready('Mudslide (Indica Hybrid)', '1oz'), 'a strain name does not');
  const D = JSON.parse((page.html.match(/var D = (\{.*?\});\n/) || [])[1]);
  const S0 = D.slides[0];
  ok(S0.sizes.every((z) => typeof z.display === 'string' && z.display.length > 0),
     'every size in the payload carries a display string');
  ok(S0.sizes[0].display === 'Royal Zkittlez (Indica Hybrid) · 1oz',
     'display is strain plus weight: ' + S0.sizes[0].display);
  ok(S0.sizes[1].item.variantId === 'V2' && S0.sizes[1].item.size === 'Mudslide (Indica Hybrid) - New Mediums',
     'the cart item still carries the raw label the site cart expects');
}

// ---------------------------------------------------------------------------
// Ounce discipline. The pick must be an actual ounce, and must not be a cheaper
// smaller row on a product whose real ounce costs more than the cap.
// ---------------------------------------------------------------------------
console.log('\n=== it has to really be an ounce ===');
{
  ok(__test.namesAnOunce('1 oz'), '"1 oz" names an ounce');
  ok(__test.namesAnOunce('Ounce'), '"Ounce" names an ounce');
  ok(!__test.namesAnOunce('1/4 oz'), '"1/4 oz" does not, despite containing oz');
  ok(!__test.namesAnOunce('Half Ounce'), '"Half Ounce" does not');
  ok(!__test.namesAnOunce('Eighth'), '"Eighth" does not');
  ok(!__test.namesAnOunce('Quarter Pound'), '"Quarter Pound" does not');
  ok(!__test.namesAnOunce('Mudslide (Indica Hybrid)'), 'a bare strain does not');

  const opts = { maxPrice: 50, minGrams: 28, maxGrams: 31.5, category: 'THCA Flower' };
  const base = {
    store: 'S', storeKey: 's', domain: 's.test', platform: 'shopify', ref: '', coupon: '',
    category: 'THCA Flower', cur: 'USD', inStock: true,
    image: 'https://cdn.test/x.jpg', url: 'https://s.test/x',
  };

  // The reported case: the ounce is $80, a smaller quantity is under $50, and the
  // smaller row inherits 28g from the product title.
  const TRAP = { ...base, id: 's__trap', name: 'Premium Flower Ounce', perG: 1,
    sizes: [
      ['1 oz', 80, 28, 'V-OZ', 1, null, ''],
      ['Sampler', 45, 28, 'V-SMALL', 1, null, ''],
    ] };
  ok(__test.pickAll([TRAP], opts, 12).length === 0,
     'nothing from a product whose own ounce row is $80, even though a 28g-tagged row is $45');

  // A genuine ounce under the cap on the same shape still qualifies.
  const GOOD = { ...base, id: 's__good', name: 'Flower', perG: 1,
    sizes: [['1 oz', 44, 28, 'V-A', 1, null, '']] };
  ok(__test.pickAll([GOOD], opts, 12).length === 1, 'a real $44 ounce still qualifies');

  // A product with several explicitly-ounce rows: the cheap one survives even
  // though a pricier ounce row exists, because each stands on its own label.
  const MIXED = { ...base, id: 's__mixed', name: 'Flower', perG: 1,
    sizes: [
      ['Strain A 1 oz', 42, 28, 'V-A', 1, null, ''],
      ['Strain B 1 oz', 80, 28, 'V-B', 1, null, ''],
    ] };
  const mixed = __test.pickAll([MIXED], opts, 12);
  ok(mixed.length === 1 && mixed[0].index === 0,
     'an explicitly-ounce row under the cap is not punished for a pricier sibling');

  // Short rows can no longer masquerade as an ounce.
  const SHORT = { ...base, id: 's__short', name: 'Flower', perG: 1,
    sizes: [['25g special', 30, 25, 'V-S', 1, null, '']] };
  ok(__test.pickAll([SHORT], opts, 12).length === 0, '25g does not count as an ounce');
  ok(__test.weightLabel(25) === '25g', 'and it would not have displayed as 1oz either');
}

console.log('\n=== a price with no buyable size is not a dead end ===');
{
  const NOSIZE = {
    id: 's__nosize', name: 'Mystery Flower', store: 'S', storeKey: 's', domain: 's.test',
    cartDomain: 's.test', platform: 'shopify', ref: 'refcode', coupon: 'CODE',
    category: 'THCA Flower', cur: 'USD', inStock: true, perG: null,
    image: 'https://cdn.test/x.jpg', url: 'https://s.test/x?ref=refcode',
    sizes: [], sale: 25, startsAt: 25,
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [NOSIZE] }) });
  const pg = await run('s__nosize');
  ok(pg.status === 200, 'renders');
  ok(/\$25/.test(pg.html), 'shows the price it has');
  ok(/id="add"/.test(pg.html), 'and still offers Add to cart rather than dead-ending');
  const D = JSON.parse((pg.html.match(/var D = (\{.*?\});\n/) || [])[1]);
  const F = D.slides[0];
  ok(F.sizes.length === 1, 'one fallback option is offered, got ' + F.sizes.length);
  ok(F.sizes[0].item.ref === 'refcode' && F.sizes[0].item.coupon === 'CODE',
     'the fallback item keeps the affiliate ref and coupon');
  ok(F.sizes[0].price === 25, 'at the price shown');

  // With no price either, there is nothing to add and it should say so.
  const NOTHING = { ...NOSIZE, id: 's__nothing', sale: 0, startsAt: 0 };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [NOTHING] }) });
  const none = await run('s__nothing');
  ok(/id="add"[^>]*hidden/.test(none.html), 'the Add button is hidden when there is no price at all');
  ok(/has not published a buyable size/.test(none.html), 'says why');
  ok(/consumables/.test(none.html), 'and still offers the comparison');
}

// ---------------------------------------------------------------------------
// The dropdown must obey the same minimum quantity and budget the pick does.
// Reported case: a $175 bulk row was selectable on a page advertising an ounce
// under $50, because only the PRODUCT was screened and the rows were not.
// ---------------------------------------------------------------------------
console.log('\n=== the size dropdown honours the pick constraints ===');
{
  const BULK = {
    id: 'sb__bulk', name: 'THCA Flower', store: 'Bulk Store', storeKey: 'sb',
    domain: 'sb.test', cartDomain: 'sb.test', platform: 'shopify',
    ref: 'refsb', coupon: 'CODESB', category: 'THCA Flower', cur: 'USD',
    inStock: true, perG: 0.7, image: 'https://cdn.test/b.png', url: 'https://sb.test/p',
    sizes: [
      ['1 oz', 39, 28, 'V-OZ', 1, null, ''],           // qualifies
      ['Half Ounce', 24, 14, 'V-HALF', 1, null, ''],   // under the minimum quantity
      ['Quarter Pound', 175, 112, 'V-QP', 1, null, ''],// over budget and over the band
      ['2 oz', 70, 56, 'V-2OZ', 1, null, ''],          // over budget and over the band
    ],
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [BULK] }) });

  const pick = await run('pick');
  const opts = [...pick.html.matchAll(/<option value="(-?\d+)">([^<]*)<\/option>/g)].map((m) => m[2]);
  console.log('  offered on /p/pick:');
  opts.forEach((o) => console.log('    ' + o));
  ok(opts.length === 1, 'only the qualifying ounce is offered, got ' + opts.length);
  ok(/1 oz/.test(opts[0]) && /\$39/.test(opts[0]), 'and it is the $39 ounce');
  ok(!/175/.test(pick.html), 'the $175 quarter pound appears nowhere on the page');
  ok(!/V-QP/.test(pick.html), 'and its variant is not embedded in the payload either');
  ok(!/V-HALF/.test(pick.html), 'the half ounce is out too, being under the minimum quantity');
  ok(!/V-2OZ/.test(pick.html), 'and the 2oz, being over budget');

  const D = JSON.parse((pick.html.match(/var D = (\{[\s\S]*?\});\n/) || [])[1]);
  ok(D.slides[0].sizes.length === 1, 'the payload carries one size, got ' + D.slides[0].sizes.length);
  ok(D.slides[0].sizes[0].item.variantId === 'V-OZ', 'the ounce variant');
  ok(D.slides[0].sizes[0].item.ref === 'refsb', 'with the affiliate ref intact');
  console.log('  note: ' + JSON.stringify(D.slides[0].limitNote));
  ok(/3 other sizes .*not shown here: this page is the ounce under \$50\./.test(D.slides[0].limitNote),
     'the page explains why the list is short');
  ok(/other sizes/.test(pick.html), 'and says it in the rendered HTML too');

  // A raised cap should let more through, proving the filter reads the request.
  const loose = await run('pick', null, { max: '200', gmax: '120' });
  const looseOpts = [...loose.html.matchAll(/<option value="(-?\d+)">([^<]*)<\/option>/g)].map((m) => m[2]);
  ok(looseOpts.length === 3, '?max=200&gmax=120 widens it to three, got ' + looseOpts.length);
  ok(/175/.test(loose.html), 'and the quarter pound is then legitimately offered');

  // A plain /p/<id> share makes no claim about weight or budget, so it stays honest
  // about what the product actually sells.
  const direct = await run('sb__bulk');
  const directOpts = [...direct.html.matchAll(/<option value="(-?\d+)">([^<]*)<\/option>/g)].map((m) => m[2]);
  ok(directOpts.length === 4, 'a direct product share still lists all four sizes, got ' + directOpts.length);
  ok(/Quarter Pound/.test(direct.html), 'including the quarter pound');
}

// ---------------------------------------------------------------------------
// The card a crawler reads should show the variant being advertised, not the
// listing's lead photo. On a multi-strain listing they are different pictures.
// ---------------------------------------------------------------------------
console.log('\n=== the shared card shows the variant, not just the listing ===');
{
  const MULTI = {
    id: 'sb__trim', name: 'Cheap THCA Flower Trim', store: 'THCA Small Buds',
    storeKey: 'sb', domain: 'sb.test', cartDomain: 'sb.test', platform: 'shopify',
    ref: 'refsb', coupon: 'CODESB', category: 'THCA Flower', cur: 'USD', inStock: true,
    perG: 1.07, image: 'https://cdn.test/lead.png', url: 'https://sb.test/p',
    sizes: [
      ['Dank Work 1 oz', 29.99, 28, 'V-DANK', 1, null, 'https://cdn.test/dank.png'],
      ['Candy Hustle 1 oz', 39.99, 28, 'V-CANDY', 1, null, 'https://cdn.test/candy.png'],
      ['House Blend 1 oz', 34.99, 28, 'V-HOUSE', 1, null, ''],
      ['Hostile 1 oz', 31.99, 28, 'V-BAD', 1, null, 'javascript:alert(1)'],
    ],
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [MULTI] }) });

  const pick = await run('pick');
  const ogImg = (pick.html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  console.log('  og:image ' + JSON.stringify(ogImg));
  ok(ogImg === 'https://cdn.test/candy.png', "the picked row's own photo is the shared one");
  ok(!/javascript:/.test(pick.html), 'a javascript: photo in the feed reaches the page nowhere');

  /* The pick leads with the dearest row ($39.99 Candy), so its photo is the one
     shared. A plain /p/<id> names no row, so it still quotes the cheapest price
     ($29.99 Dank) under the listing's own photo: the ranking change is scoped to
     the pick and did not quietly move what a direct product share advertises. */
  const direct = await run('sb__trim');
  const ogD = (direct.html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  ok(ogD === 'https://cdn.test/lead.png', 'a direct share still shows the listing photo: ' + ogD);
  ok(/\$29\.99/.test((direct.html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || ''),
     'and still quotes the cheapest row, which is what a page making no budget claim should do');

  const P = JSON.parse((pick.html.match(/var D = (\{[\s\S]*?\});\n/) || [])[1].replace(/\\u003c/g, '<'));
  const imgs = P.slides[0].sizes.map((z) => [z.display, z.img]);
  imgs.forEach((z) => console.log('    ' + JSON.stringify(z)));
  ok(P.slides[0].baseImg === 'https://cdn.test/lead.png',
     'the listing photo is kept as the fallback for rows without one');
  ok(imgs.find((z) => /Candy/.test(z[0]))[1] === 'https://cdn.test/candy.png', 'each row carries its own');
  ok(imgs.find((z) => /House/.test(z[0]))[1] === '', 'a row with none carries an empty string, not the lead photo');
  ok(imgs.find((z) => /Hostile/.test(z[0]))[1] === '', 'and the hostile one is dropped to empty');

  // ?s= should move the shared photo with the shared price.
  const second = await run('sb__trim', '1');
  const ogB = (second.html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  ok(ogB === 'https://cdn.test/candy.png', '?s= moves the shared photo too: ' + ogB);
  ok(/\$39\.99/.test((second.html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || ''),
     'along with the price it advertises');
}

// ---------------------------------------------------------------------------
// A crawler will only put the picture in the card on the first scrape if the tags
// say how big it is. Without that it renders the card bare and attaches the image
// later, which is the send nobody sees. So: dimensions stated wherever they are
// known to be true, and never stated otherwise.
// ---------------------------------------------------------------------------
console.log('\n=== the shared card declares its image ===');
{
  const meta = (html, p) =>
    (html.match(new RegExp('<meta property="' + p + '" content="([^"]*)"')) || [])[1];

  const SHOP = {
    id: 'sb__shop', name: 'Runtz THCa Flower', store: 'THCA Small Buds', storeKey: 'sb',
    domain: 'sb.test', cartDomain: 'sb.test', platform: 'shopify', ref: 'refsb', coupon: '',
    category: 'THCA Flower', cur: 'USD', inStock: true, perG: 1.42,
    image: 'https://cdn.shopify.com/s/files/1/1/2/products/lead.jpg?v=1',
    url: 'https://sb.test/p',
    sizes: [
      ['Runtz 1 oz', 39.99, 28, 'V-OZ', 1, null,
        'https://cdn.shopify.com/s/files/1/1/2/products/runtz.jpg?v=1699999999'],
      ['Gelato 1 oz', 44.99, 28, 'V-GEL', 1, null, 'https://img.otherstore.test/gelato.png'],
      ['Zkittlez 1 oz', 46.99, 28, 'V-ZK', 1, null,
        'https://cdn.shopify.com/s/files/1/1/2/products/zk.webp'],
      ['Mystery 1 oz', 47.99, 28, 'V-MY', 1, null, 'https://img.otherstore.test/photo'],
    ],
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [SHOP] }) });

  /* Addressed by row rather than through the pick. What these assertions are
     about is the photo host and the file extension, not which row leads, and
     hanging them off the pick made them fail the day the ranking changed for
     reasons that had nothing to do with og:image. */
  const shop = await run('sb__shop', '0');
  console.log('  og:image ' + meta(shop.html, 'og:image'));
  ok(meta(shop.html, 'og:image') ===
     'https://cdn.shopify.com/s/files/1/1/2/products/runtz.jpg?v=1699999999&amp;width=1200&amp;height=1200&amp;crop=center',
     'a Shopify CDN photo is asked for the exact size we then declare');
  ok(meta(shop.html, 'og:image').includes('v=1699999999'),
     "and the store's own cache-busting query survives being asked");
  ok(meta(shop.html, 'og:image:width') === '1200' && meta(shop.html, 'og:image:height') === '1200',
     'the dimensions are declared, which is what puts the picture in the first card');
  ok(meta(shop.html, 'og:image:type') === 'image/jpeg', 'and the type, read off the extension');
  ok(meta(shop.html, 'og:image:secure_url') === meta(shop.html, 'og:image'),
     'secure_url is the same url, since only https ever gets this far');

  /* The pick now leads with the dearest row, whose photo happens to sit on a host
     that cannot be asked for a size. The card must still refuse to claim one: a
     stated size that is wrong lays the card out on an aspect ratio the picture
     does not have, which is worse than stating nothing. */
  const lead = await run('pick');
  ok(meta(lead.html, 'og:image') === 'https://img.otherstore.test/photo',
     'the pick leads with the dearest row: ' + meta(lead.html, 'og:image'));
  ok(meta(lead.html, 'og:image:width') === undefined,
     'and claims no dimensions for a photo it cannot resize');

  // Any other host cannot be asked for a size, so nothing is claimed about it. A
  // wrong number would lay the card out on an aspect ratio the image does not have.
  const other = await run('sb__shop', '1');
  console.log('  og:image ' + meta(other.html, 'og:image'));
  ok(meta(other.html, 'og:image') === 'https://img.otherstore.test/gelato.png',
     'a photo on any other host is passed through untouched');
  ok(meta(other.html, 'og:image:width') === undefined &&
     meta(other.html, 'og:image:height') === undefined,
     'and ships with no dimensions rather than a guess');
  ok(meta(other.html, 'og:image:type') === 'image/png', 'the type is still safe to state');

  const webp = await run('sb__shop', '2');
  ok(meta(webp.html, 'og:image:type') === 'image/webp', 'webp is named correctly');
  ok(meta(webp.html, 'og:image:width') === '1200', 'and is still asked for a declared size');

  const bare = await run('sb__shop', '3');
  ok(meta(bare.html, 'og:image:type') === undefined,
     'a url with no extension claims no type at all');

  // The generic card matters as much as the product one: an empty pick or a dead id
  // is still a link somebody sent.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [] }) });
  const gone = await run('sb__vanished');
  ok(gone.status === 404, 'a dead id still 404s');
  ok(meta(gone.html, 'og:image') === 'https://legal-leafmarket.com/og-image.png',
     'the fallback card keeps the site image');
  ok(meta(gone.html, 'og:image:width') === '1200' && meta(gone.html, 'og:image:height') === '630',
     'declared at the size that file actually is, measured: 1200x630');
  ok(meta(gone.html, 'og:image:type') === 'image/png', 'and as a png');

  const empty = await run('pick');
  ok(empty.status === 200, 'an empty pick is still a 200');
  ok(meta(empty.html, 'og:image:width') === '1200',
     'and its card declares an image too, rather than rendering as a bare link');

  // An empty src attribute resolves to the page's own URL, so the browser fetches
  // this page again as an image: a second render of the pick for every view.
  ok(!/src=""/.test(shop.html), 'no element ships with an empty src');
}

// ---------------------------------------------------------------------------
// Trim and shake. Leading with the dearest ounce inside the cap surfaces these
// often, because trim is the cheapest thing per gram and so the most of it a $50
// budget can buy. Carrying them is fine; letting somebody find out afterwards is
// not.
// ---------------------------------------------------------------------------
console.log('\n=== trim and shake are declared ===');
{
  /* The words, taken from live ids in coa-blacktie.js, coa-data.js and
     coa-thcaking.js rather than invented. The last two are the boundary: Black
     Tie's own "Grape Milkshake" is a whole-bud strain, and branding it shake
     would be a false claim on a real product. */
  ok(__test.isTrimShake('THCA Flower Trim Shake'), 'names both words');
  ok(__test.isTrimShake('Cheap THCA Flower Trim'), 'trim at the end');
  ok(__test.isTrimShake('THCA Shake Indoor'), 'shake mid-name');
  ok(__test.isTrimShake('Dank THCA Trim'), 'and the short form');
  ok(!__test.isTrimShake('Grape Milkshake Greenhouse THCA Flower'),
     'but milkshake is a strain, not shake');
  ok(!__test.isTrimShake('Sour Diesel Small Buds'), 'and whole buds are not trim');

  const TRIM = {
    id: 'blacktiecbd__thca-flower-trim-shake', name: 'THCA Flower Trim Shake',
    store: 'Black Tie', storeKey: 'blacktiecbd', domain: 'blacktiecbd.com',
    cartDomain: 'blacktiecbd.com', platform: 'shopify', ref: 'refbt', coupon: '',
    category: 'THCA Flower', cur: 'USD', inStock: true, perG: 1.71,
    image: 'https://cdn.test/trim.png', url: 'https://blacktiecbd.com/p',
    sizes: [['1 oz', 48, 28, 'V-TRIM', 1, null, '']],
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [TRIM] }) });
  const t = await run('pick');
  const tag = (n) => (t.html.match(new RegExp('<meta property="' + n + '" content="([^"]*)"')) || [])[1];
  console.log('  og:description ' + tag('og:description'));

  /* The card's own text, so it travels with the link. A banner nobody has opened
     the page to see is not a disclosure. */
  ok(/^This 1oz is trim\/shake, not whole buds\./.test(tag('og:description')),
     'the shared card leads with it, ahead of the price');
  /* The weight is named, so the sentence is one a shopper can check against what
     they think they are buying rather than a word next to a photo of buds. */
  ok(/This 1oz is/.test(tag('og:description')), 'and names the size it is talking about');
  const banners = [...t.html.matchAll(/<div class="tsb" id="(tsb[FB])"([^>]*)>([^<]*)<\/div>/g)];
  ok(banners.length === 2, 'one banner per face, got ' + banners.length);
  ok(banners.every((b) => !/hidden/.test(b[2])), 'both visible on a trim listing');
  ok(banners.every((b) => /This 1oz is trim\/shake, not whole buds/.test(b[3])),
     'both say what it is, and which size');
  /* Front and back carry their own copy rather than sharing one element over the
     card, which is what keeps the back one upright: anything in the flip's 3D
     space turns with it and renders mirrored. */
  const front = t.html.indexOf('id="tsbF"');
  const back = t.html.indexOf('id="tsbB"');
  ok(front > -1 && back > -1 && front < t.html.indexOf('class="face back"'),
     'the front copy is inside the front face');
  ok(back > t.html.indexOf('class="face back"'), 'and the back copy inside the back face');
  ok(/\.flip\.flipped \.front \.tsbwrap\{opacity:0/.test(t.html),
     'the front copy fades on flip, so the two are never both on screen mid-turn');
  ok(!/\.tsb\{[^}]*backdrop-filter/.test(t.html),
     'and uses no backdrop-filter, which is what made the .ov pills bleed through mirrored');

  // A whole-bud listing must not be branded.
  const CLEAN = { ...TRIM, id: 'blacktiecbd__grape-milkshake-greenhouse-thca-flower',
    name: 'Grape Milkshake Greenhouse THCA Flower' };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [CLEAN] }) });
  const c = await run('pick');
  const cTags = (c.html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1];
  ok(!/Trim and shake/.test(cTags), 'a milkshake strain gets no banner in the card text');
  ok([...c.html.matchAll(/<div class="tsb"[^>]*hidden[^>]*>/g)].length === 2,
     'and both banners ship hidden rather than absent, so the client can reveal them');

  /* Mixed listing: whole buds and trim side by side. The advertised row decides
     what shows on load, and the dropdown decides thereafter. */
  const MIXED = { ...TRIM, id: 'blacktiecbd__mixed', name: 'Black Tie Ounce',
    sizes: [
      ['Whole Buds 1 oz', 49, 28, 'V-W', 1, null, ''],
      ['Trim 1 oz', 42, 28, 'V-T', 1, null, ''],
    ] };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [MIXED] }) });
  const m = await run('pick');
  const D = JSON.parse((m.html.match(/var D = (\{[\s\S]*?\});\n/) || [])[1].replace(/\\u003c/g, '<'));
  const rows = D.slides[0].sizes;
  console.log('  rows: ' + JSON.stringify(rows.map((r) => [r.display, r.trim])));
  ok(rows.find((r) => /Whole Buds/.test(r.display)).trim === false, 'the whole-bud row is not flagged');
  ok(rows.find((r) => /Trim/.test(r.display)).trim === true, 'the trim row is');
  ok(D.slides[0].trimProd === false, 'the listing itself is not trim throughout');
  /* $49 whole buds outbids $42 trim under the cap, so this page advertises the
     clean row and opens with no banner. Choosing the trim row is what raises it,
     which is the client path showTrim(c) covers. */
  ok(D.slides[0].trim === false, 'so the advertised row decides, and it is the whole-bud one');
  ok(!/Trim and shake, not whole buds\./.test(
     (m.html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1] || ''),
     'and the card text makes no claim the advertised row does not carry');
}

// ---------------------------------------------------------------------------
// The mix. Ranking dearest-first inside a $50 cap handed the whole slideshow to
// trim, because trim is the cheapest thing per gram and so the most weight a fixed
// budget can buy. The pool is composed to 6 THCa, 3 trim, 1 CBD instead.
// ---------------------------------------------------------------------------
console.log('\n=== the pool is composed, not just ranked ===');
{
  const row = (label, price) => [label, price, 28, 'V-' + label.replace(/\W/g, ''), 1, null, ''];
  const mk = (id, name, price, extra) => ({
    id, name, store: 'Store ' + id, storeKey: id, domain: id + '.test',
    cartDomain: id + '.test', platform: 'shopify', ref: '', coupon: '',
    category: 'THCA Flower', cur: 'USD', inStock: true, perG: price / 28,
    image: 'https://cdn.test/' + id + '.png', url: 'https://' + id + '.test/p',
    sizes: [row('1 oz', price)], ...extra,
  });

  // Eight trim ounces, all dearer than the buds, which is the real shape: they
  // would have taken every slide under a plain ranking.
  const FEED = [];
  for (let i = 0; i < 8; i++) FEED.push(mk('trim' + i, 'THCA Flower Trim ' + i, 49 - i));
  for (let i = 0; i < 4; i++) FEED.push(mk('bud' + i, 'Whole Bud Ounce ' + i, 40 - i));
  for (let i = 0; i < 3; i++) FEED.push(mk('cbd' + i, 'CBD Hemp Ounce ' + i, 45 - i, { cannabinoid: 'CBD' }));
  // A multi-strain THCa listing, which is what fills the gap when distinct
  // whole-bud listings run out.
  FEED.push(mk('multi', 'Four Strain Ounce', 38, {
    sizes: [row('Zkittlez 1 oz', 38), row('Gelato 1 oz', 37), row('Runtz 1 oz', 36)],
  }));

  const opts = { maxPrice: 50, minGrams: 25, maxGrams: 40, category: 'THCA Flower' };
  const pool = __test.composePool(__test.pickAll(FEED, opts));
  const buckets = pool.map((c) => c.bucket);
  console.log('  mix: ' + JSON.stringify(buckets));
  console.log('  pool: ' + JSON.stringify(pool.map((c) => c.product.id + '#' + c.index)));

  ok(pool.length === 10, 'ten slides, got ' + pool.length);
  ok(buckets.filter((b) => b === 'thca').length === 6, 'six THCa');
  ok(buckets.filter((b) => b === 'trim').length === 3, 'three trim, not eight');
  ok(buckets.filter((b) => b === 'cbd').length === 1, 'one CBD');
  /* THCa leads, so slide one and the shared card are always whole buds. */
  ok(buckets.slice(0, 6).every((b) => b === 'thca'), 'THCa fills the front of the run');
  ok(buckets[9] === 'cbd', 'and the CBD one brings up the rear');

  // Dearest first inside each bucket, and the caps take the dearest trim rather
  // than a random three.
  const trims = pool.filter((c) => c.bucket === 'trim').map((c) => c.price);
  ok(trims.join(',') === '49,48,47', 'the three trim slots are the dearest three: ' + trims.join(','));
  ok(pool[0].price === 40, 'the lead slide is the dearest whole-bud ounce: ' + pool[0].price);

  /* Only four distinct whole-bud listings exist, so the multi-strain one repeats to
     make six, each time with a different row advertised. That is the fallback the
     user asked for: the same listing again with another size selected. */
  const thca = pool.filter((c) => c.bucket === 'thca');
  const ids = thca.map((c) => c.product.id);
  ok(new Set(ids).size === 5, 'five distinct listings across six THCa slides: ' + new Set(ids).size);
  const repeats = thca.filter((c) => c.product.id === 'multi');
  ok(repeats.length === 2, 'the multi-strain listing fills the gap twice, got ' + repeats.length);
  ok(repeats[0].index !== repeats[1].index,
     'with a different row each time: ' + repeats.map((r) => r.index).join(' and '));
  /* Distinct listings are exhausted BEFORE any repeat, so a repeat never displaces
     a shop that had not been shown yet. */
  ok(ids.indexOf('multi') < ids.lastIndexOf('multi'), 'and the repeat comes after the first use');
  ok(new Set(ids.slice(0, 5)).size === 5, 'the first five THCa slides are five different listings');

  // Caps do not backfill: no trim beyond three even when the buckets underfill.
  const THIN = [mk('t0', 'THCA Flower Trim A', 49), mk('t1', 'THCA Flower Trim B', 48),
    mk('t2', 'THCA Flower Trim C', 47), mk('t3', 'THCA Flower Trim D', 46)];
  const thin = __test.composePool(__test.pickAll(THIN, opts));
  ok(thin.length === 3, 'with only trim in the feed the pool is three, not ten: ' + thin.length);
  ok(thin.every((c) => c.bucket === 'trim'), 'and trim never expands into the THCa slots');

  // Bucketing itself.
  ok(__test.bucketOf({ name: 'Whole Bud Ounce' }, '1 oz') === 'thca', 'no cannabinoid field means THCa');
  ok(__test.bucketOf({ name: 'CBD Hemp Ounce', cannabinoid: 'CBD' }, '1 oz') === 'cbd', 'CBD is its own bucket');
  ok(__test.bucketOf({ name: 'Ounce', cannabinoid: 'CBD' }, 'Trim 1 oz') === 'trim',
     'trim wins over the cannabinoid, since being sold offcuts is the more material surprise');
  ok(__test.bucketOf({ name: 'Delta 8 Ounce', cannabinoid: 'Δ8' }, '1 oz') === null,
     'and D8 belongs to none of the three, so it is left out rather than counted as THCa');

  // The CBD banner, on a listing that is CBD but not trim.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [FEED[FEED.length - 2]] }) });
  const c = await run('pick');
  const cDesc = (c.html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1];
  console.log('  og:description ' + cDesc);
  ok(/^This 1oz is CBD, non-psychoactive\./.test(cDesc), 'the card says so first');
  ok(!/trim\/shake/.test(cDesc), 'and claims nothing about trim');
  const cbdBars = [...c.html.matchAll(/<div class="tsb cbd" id="(cbd[FB])"([^>]*)>([^<]*)</g)];
  ok(cbdBars.length === 2, 'one CBD banner per face, got ' + cbdBars.length);
  ok(cbdBars.every((b) => !/hidden/.test(b[2])), 'both showing');
  ok(cbdBars.every((b) => /non-psychoactive/.test(b[3])), 'both stating it is not psychoactive');
  ok([...c.html.matchAll(/<div class="tsb" id="tsb[FB]"[^>]*hidden/g)].length === 2,
     'while the trim pair stays hidden on a CBD listing that is not trim');
  ok(/\.tsb\.cbd\{background:/.test(c.html), 'and the CBD bar is styled apart from the trim one');
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
