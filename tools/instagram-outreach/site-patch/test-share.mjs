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

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
