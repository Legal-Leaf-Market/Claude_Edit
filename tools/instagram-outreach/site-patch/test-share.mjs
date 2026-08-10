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

function run(id, s) {
  let status = 0, sent = '';
  const res = { setHeader() {}, status(x) { status = x; return this; }, send(b) { sent = b; return this; } };
  const query = { id }; if (s != null) query.s = s;
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
ok(tag('og:image') === 'https://cdn.shopify.com/blue-dream.jpg', 'image is the product photo');
ok(tag('og:type') === 'product', 'og:type product');
ok(tag('og:url') === 'https://legal-leafmarket.com/p/thcaking__blue-dream-oz', 'canonical on our domain');

console.log('\n=== same flow as the site, no new buttons ===');
ok((good.html.match(/class="buy"/g) || []).length === 1, 'exactly one primary action');
ok(/id="add"[^>]*>?|>Add to cart</.test(good.html), 'and it is Add to cart');
ok(!/Buy at |Go straight to |sponsored/.test(good.html), 'no vendor button was introduced');
ok(!/api\/subscribe/.test(good.html), 'no email capture flow was introduced');
ok(good.html.includes("localStorage.setItem('ll_cart'"), 'writes the site cart key ll_cart');
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
const itemLine = (evil.html.match(/var ITEM = (.*);/) || [])[1] || '';
ok(itemLine.length > 0, 'found the embedded cart item');
ok(!itemLine.includes('<'), 'embedded JSON has no raw < at all, so it cannot close the script tag');
ok(itemLine.includes('\\u003c'), 'the angle brackets are unicode-escaped instead');
ok(JSON.parse(itemLine).name === PRODUCTS[1].name, 'and it still parses back to the exact name');
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
    // Best per-gram at ounce size, under the cap, in stock. Should win.
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
    // Accessory: grams 0, must never be considered.
    { id: 'chill__pipe', name: 'Steel Pipe', store: 'Chill', storeKey: 'chill',
      domain: 'chill.store', platform: 'shopify', ref: '', coupon: '',
      category: 'Devices', cur: 'USD', inStock: true, perG: null,
      image: 'https://cdn.shopify.com/p.jpg', url: 'https://chill.store/products/p',
      sizes: [['One Size', 20, 0, 'V-P', 1, null, '']] },
  ];

  const best = __test.pickBest(CATALOG, { maxPrice: 50, minGrams: 25, maxGrams: 40, category: 'THCA Flower' });
  ok(best && best.product.id === 'smallbuds__sour-oz',
     'picked the best-value in-stock ounce under the cap: ' + (best && best.product.id));
  ok(best && best.index === 0, 'picked the 1oz row, not the 4oz: index ' + (best && best.index));
  ok(Math.abs(best.perG - 39 / 28) < 1e-9, 'per gram computed off the chosen row');

  ok(__test.pickBest(CATALOG, { maxPrice: 20, minGrams: 25, maxGrams: 40, category: 'THCA Flower' }) === null,
     'nothing qualifies at a $20 cap');
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
  ok(pick.html.includes('"variantId":"V-OZ"'), 'cart item carries the ounce variant, not the 4oz');
  ok(pick.html.includes('"ref":"coffeeandajoint"'), 'affiliate ref carried on the pick');
  ok(pick.html.includes('"coupon":"JACOBKENNEDY"'), 'coupon carried on the pick');
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

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
