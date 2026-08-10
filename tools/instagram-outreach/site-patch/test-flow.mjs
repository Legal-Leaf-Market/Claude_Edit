/* Drives the /p/pick page in real Chromium: the flip, the size gate, and the lab
 * panel's honesty rules. The gate is the part that matters most, since the whole
 * point is that nobody adds a mystery item to a cart. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import handler from './api-share.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

// Two ounces so shuffle exists; the first carries real measured COA data.
const A = {
  id: 'smallbuds__sour', name: 'Sour Diesel Small Buds', store: 'THCA Small Buds',
  storeKey: 'thcasmallbuds', domain: 'thcasmallbuds.com', cartDomain: 'thcasmallbuds.com',
  platform: 'shopify', ref: 'coffeeandajoint', coupon: 'JACOBKENNEDY',
  category: 'THCA Flower', cur: 'USD', inStock: true, perG: 1.39,
  cannabinoid: 'THCa', type: 'Hybrid', grow: 'Indoor',
  image: 'https://cdn.test/a.jpg', url: 'https://thcasmallbuds.com/products/a?ref=coffeeandajoint',
  coa: 'https://thcasmallbuds.com/files/a-coa.pdf', coaScope: 'product',
  lab: { thca: 24.1, totalThc: 21.14, cbd: 0.05, total: 25.3, lab: 'Pinnacle Labs',
         tested: '2026-06-02', sample: 'Sour Diesel', trust: 90,
         minors: [['CBG', 0.8], ['CBN', 0.1]], flags: ['coa_page_1_only'] },
  sizes: [['1 oz', 39, 28, 'V-OZ', 1, null, ''], ['2 oz', 74, 56, 'V-2OZ', 1, null, '']],
};
// No certificate matched, and the store only publishes a results index.
const B = {
  id: 'other__gg', name: 'Gorilla Glue', store: 'Other Store', storeKey: 'other',
  domain: 'other.test', platform: 'shopify', ref: '', coupon: '',
  category: 'THCA Flower', cur: 'USD', inStock: true, perG: 1.6, potency: 22,
  image: 'https://cdn.test/b.jpg', url: 'https://other.test/products/b',
  coa: 'https://other.test/pages/lab-results', coaScope: 'index',
  sizes: [['1 oz', 45, 28, 'V-B', 1, null, '']],
};

globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [A, B] }) });

async function render(query) {
  let html = '';
  const res = { setHeader() {}, status() { return this; }, send(b) { html = b; return this; } };
  await handler({ query, headers: { host: 'legal-leafmarket.com' } }, res);
  return html;
}

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
/* Add to cart hands off to legal-leafmarket.com/consumables#cart. Letting that
   navigation happen would move the page to another origin, so its localStorage,
   the thing under test, becomes unreadable. Aborting the main-frame navigation
   leaves the page in place with the cart intact. */
/* Add to cart hands off to legal-leafmarket.com/consumables#cart. Aborting that
   navigation makes Chromium commit an error page, which destroys the document for
   every later assertion, so it is fulfilled with a stub instead: the handoff is
   still observed, and the page stays in a sane state. */
let handoffs = 0;
await page.route('**/consumables**', (route) => {
  handoffs++;
  route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>stub cart</h1>' });
});

/* The cart write is captured as it happens rather than read back afterwards.
   Aborting the handoff navigation commits an error page whose origin is opaque,
   and localStorage is unreadable from there, so a post-click read cannot see the
   value the page just wrote. Wrapping setItem catches it at the moment of truth
   and needs no change to the page itself. */
const writes = [];
await page.exposeFunction('__record', (k, v) => { writes.push({ k, v }); });
await page.addInitScript(() => {
  const real = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) {
    try { window.__record(k, v); } catch (e) {}
    return real(k, v);
  };
});
const cartWrites = () => writes.filter((w) => w.k === 'll_cart');
const lastCart = () => {
  const w = cartWrites();
  return w.length ? JSON.parse(w[w.length - 1].v) : [];
};

const html = await render({ id: 'pick' });
fs.writeFileSync('/tmp/pick.html', html);
await page.goto('file:///tmp/pick.html');

console.log('=== layout: controls sit on the photo ===');
const shufBox = await page.locator('#next').boundingBox();
const imgBox = await page.locator('.shot').boundingBox();
ok(!!shufBox, 'the next arrow exists');
ok(shufBox.x >= imgBox.x && shufBox.y >= imgBox.y &&
   shufBox.x + shufBox.width <= imgBox.x + imgBox.width + 1 &&
   shufBox.y + shufBox.height <= imgBox.y + imgBox.height + 1,
   'it is inside the image bounds, costing no vertical space');
ok(await page.evaluate(() => getComputedStyle(document.getElementById('next')).position) === 'absolute',
   'and it is an overlay');
ok((await page.evaluate(() => getComputedStyle(document.getElementById('toBack')).boxShadow)).length > 5,
   'the Details pill glows, since that is the one to notice');

console.log('\n=== the flip ===');
const flipped = () => page.evaluate(() => document.getElementById('flip').classList.contains('flipped'));
ok(await flipped() === false, 'starts on the photo');
await page.click('#toBack');
ok(await flipped() === true, 'Details flips it over');
ok(await page.isVisible('#size'), 'the size dropdown is on the back');
await page.click('#toFront');
ok(await flipped() === false, 'Photo flips it back');

console.log('\n=== the dropdown obeys the page\'s own promise ===');
/* The bug: /p/pick screened which PRODUCT won, then offered every priced row of
   it, so a page headlined "ounce under $50" let a $74 two-ounce (and in
   production a $175 quarter pound) be selected and added. Checked in the browser
   because the dropdown is where a shopper meets it. */
{
  const opts = await page.$$eval('#size option', (os) =>
    os.map((o) => ({ v: o.value, t: o.textContent.trim() })).filter((o) => o.v !== ''));
  console.log('  offered: ' + JSON.stringify(opts.map((o) => o.t)));
  ok(opts.length === 1, 'only the qualifying ounce is offered, got ' + opts.length);
  ok(!/\$74/.test(await page.content()), 'the over-budget 2 oz appears nowhere on the page');
  const note = (await page.textContent('#limitnote')).trim();
  console.log('  note: ' + JSON.stringify(note));
  ok(/1 other size[\s\S]*not shown here[\s\S]*ounce under \$50/.test(note),
     'and the short list explains itself rather than looking broken');
}

console.log('\n=== the gate: no size, no add ===');
await page.click('#add');
ok(await flipped() === true, 'clicking Add with nothing chosen forces the flip');
ok(await page.evaluate(() => document.getElementById('size').classList.contains('needs')),
   'and glows the dropdown');
/* The dropdown is the whole point of the flip, so it must not be the thing that
   falls below the fold. A square card clipped it, which is how this got caught. */
await page.waitForTimeout(600);
const selBox = await page.locator('#size').boundingBox();
const cardBox = await page.locator('#flip').boundingBox();
ok(selBox.y + selBox.height <= cardBox.y + cardBox.height + 1,
   'the size dropdown sits fully inside the card, not clipped at its edge');
ok(await page.evaluate(() => {
  const r = document.getElementById('size').getBoundingClientRect();
  return r.top >= 0 && r.bottom <= innerHeight;
}), 'and fully inside the viewport');
ok(await page.evaluate(() => {
  const sel = document.getElementById('size');
  const back = sel.closest('.back');
  return sel.getBoundingClientRect().top - back.getBoundingClientRect().top < 160;
}), 'it sits near the top of the back, ahead of the lab table');

const warn = await page.textContent('#hint');
console.log('  hint: ' + JSON.stringify(warn.trim()));
ok(/Choose a size first/.test(warn), 'tells them why');
ok(cartWrites().length === 0, 'nothing was written to the cart');
ok(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'size',
   'focus lands on the dropdown');

console.log('\n=== choosing walks them through ===');
/* By row value rather than DOM position, so a change in what the constraints
   offer fails loudly here instead of shifting which row is under test. */
await page.selectOption('#size', '0');
ok(!(await page.evaluate(() => document.getElementById('size').classList.contains('needs'))),
   'the glow clears on selection');
const priceTxt = (await page.textContent('#price')).replace(/\s+/g, ' ').trim();
console.log('  price now: ' + JSON.stringify(priceTxt));
ok(/\$39/.test(priceTxt) && /1oz/.test(priceTxt), 'price and weight update to the choice');
const addLabel = (await page.textContent('#add')).trim();
console.log('  button now: ' + JSON.stringify(addLabel));
ok(/Add 1oz for \$39 to cart/.test(addLabel), 'the button states exactly what it will add');
/* The mock's row label is "1 oz", which is the weight restated, so the display
   string must not read "1 oz, 1oz". */
const hintTxt = (await page.textContent('#hint')).trim();
console.log('  hint now: ' + JSON.stringify(hintTxt));
ok(/^Adding 1 oz, \$39, from THCA Small Buds\.$/.test(hintTxt), 'the hint names it once, not twice');

console.log('\n=== adding writes the site cart ===');
await page.click('#add');
await page.waitForTimeout(250);
ok(handoffs === 1, 'it hands off to the site cart page, attempts: ' + handoffs);
const cart = lastCart();
ok(cart.length === 1, 'one line added, got ' + cart.length);
ok(cart[0].variantId === 'V-OZ', 'the chosen variant, not the other size: ' + cart[0].variantId);
ok(cart[0].ref === 'coffeeandajoint' && cart[0].coupon === 'JACOBKENNEDY', 'affiliate ref and coupon intact');
ok(cart[0].price === 39 && cart[0].size === '1 oz', 'price and size match the selection');

console.log('\n=== switching size switches what gets added ===');
/* On a direct product share, not the pick: that page makes no claim about weight
   or budget, so all of a product's real sizes belong in the dropdown and the 2 oz
   is a legitimate choice. On /p/pick it is correctly filtered out, which is what
   the constraints block above checks. */
fs.writeFileSync('/tmp/share.html', await render({ id: 'smallbuds__sour' }));
await page.goto('file:///tmp/share.html');
await page.click('#toBack');
ok(await page.$$eval('#size option', (os) => os.filter((o) => o.value !== '').length) === 2,
   'a direct share lists both real sizes');
ok(await page.isHidden('#limitnote'), 'and carries no constraint note, having no constraint');
await page.selectOption('#size', '1');
ok(await page.inputValue('#size') === '1', 'the second size row is selected');
ok(/Add 2oz for \$74 to cart/.test((await page.textContent('#add')).trim()),
   'button restates the new choice: ' + (await page.textContent('#add')).trim());
await page.click('#add');
await page.waitForTimeout(400);
/* Asserted by content rather than by "the last write", because exposeFunction
   callbacks are async and can land out of order with respect to the test's own
   bookkeeping. What matters is that choosing the 2oz produced a 2oz cart line. */
const sawTwoOz = cartWrites().some((w) =>
  JSON.parse(w.v).some((l) => l.variantId === 'V-2OZ' && l.price === 74 && l.size === '2 oz'));
ok(sawTwoOz, 'choosing the 2oz wrote a 2oz cart line, writes: ' +
   JSON.stringify(cartWrites().map((w) => JSON.parse(w.v).map((l) => l.variantId))));

console.log('\n=== lab panel honesty ===');
await page.goto('file:///tmp/pick.html');
const back = await page.textContent('.back');
ok(/Total THC/.test(back) && /21\.14%/.test(back), 'leads with total THC, the number a buyer gets');
ok(/THCa[\s\S]*24\.1%/.test(back), 'shows THCa');
ok(/Pinnacle Labs/.test(back) && /2026-06-02/.test(back), 'names the lab and the test date');
ok(/lab tested/.test(back), 'badges it, since coaScope is product');
ok(/only the first page of the certificate was read/.test(back), 'words the flag in plain English');
ok(/View this product's certificate/.test(back), 'links the certificate as what it is');

// The second product has no matched certificate and only an index page.
const htmlB = await render({ id: 'pick', i: '1' });
fs.writeFileSync('/tmp/pickb.html', htmlB);
await page.goto('file:///tmp/pickb.html');
const backB = await page.textContent('.back');
ok(!/lab tested/.test(backB), 'no lab-tested badge without evidence');
ok(/No certificate has been matched/.test(backB), 'says so plainly instead of implying a test');
ok(/as stated by the store, not from a certificate/.test(backB), 'labels the listed potency as the store claim');
ok(/Browse the store's lab results page/.test(backB) && /directory of results, not this batch/.test(backB),
   'words an index link as a directory rather than a result');
ok(!/21\.14/.test(backB), 'and shows no numbers it does not have');

console.log('\n=== front overlays must not show through the flipped card ===');
{
  /* backdrop-filter on those pills gives them their own compositing context, which
     escapes the face's backface-visibility, so they kept rendering through the
     turned-away card with their text mirrored. */
  await page.goto('file:///tmp/pick.html');
  const opacity = () => page.evaluate(() =>
    getComputedStyle(document.getElementById('toBack')).opacity);
  ok(await opacity() === '1', 'the Details pill is visible on the front');
  ok(await page.evaluate(() =>
    getComputedStyle(document.getElementById('toBack')).backfaceVisibility) === 'hidden',
    'its own backface is hidden');
  await page.click('#toBack');
  await page.waitForTimeout(700);
  ok(await opacity() === '0', 'and it is fully transparent once flipped, so nothing reads backwards');
  ok(await page.evaluate(() =>
    getComputedStyle(document.getElementById('toBack')).pointerEvents) === 'none',
    'and not clickable through the back');
  const navOpacity = await page.evaluate(() => {
    const b = document.getElementById('next');
    return b ? getComputedStyle(b).opacity : 'absent';
  });
  ok(navOpacity === '0' || navOpacity === 'absent', 'same for the nav arrows: ' + navOpacity);
  await page.click('#toFront');
  await page.waitForTimeout(700);
  ok(await opacity() === '1', 'and they come back when flipped to the front');
}

console.log('\n=== the photo follows the variant ===');
{
  /* Shape taken from the live feed: one listing, several strains, each with its own
     photo at row[6], and one row the store gave no photo of its own. 3,434 live
     size rows carry one and 460 listings differ per variant, so the product's lead
     photo is the wrong picture for most rows on a multi-strain listing. */
  const MULTI = {
    id: 'sb__trim', name: 'Cheap THCA Flower Trim', store: 'THCA Small Buds',
    storeKey: 'thcasmallbuds', domain: 'thcasmallbuds.com', cartDomain: 'thcasmallbuds.com',
    platform: 'shopify', ref: 'coffeeandajoint', coupon: 'JACOBKENNEDY',
    category: 'THCA Flower', cur: 'USD', inStock: true, perG: 1.2,
    image: 'https://cdn.test/product-lead.png',
    url: 'https://thcasmallbuds.com/products/trim',
    sizes: [
      ['Dank Work 1 oz', 29.99, 28, 'V-DANK', 1, null, 'https://cdn.test/dank.png'],
      ['Candy Hustle 1 oz', 39.99, 28, 'V-CANDY', 1, null, 'https://cdn.test/candy.png'],
      ['House Blend 1 oz', 34.99, 28, 'V-HOUSE', 1, null, ''],
      // A poisoned feed row: the photo must be dropped, not rendered.
      ['Hostile 1 oz', 31.99, 28, 'V-BAD', 1, null, 'javascript:alert(1)'],
    ],
  };
  const saved = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: [MULTI] }) });
  const multiHtml = await render({ id: 'pick' });
  globalThis.fetch = saved;
  fs.writeFileSync('/tmp/multi.html', multiHtml);

  /* The cheapest qualifying row is Dank Work, so the card and its og:image should
     open on THAT strain's photo rather than the listing's lead photo. */
  const og = (multiHtml.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  console.log('  og:image ' + JSON.stringify(og));
  ok(og === 'https://cdn.test/dank.png', "the shared card shows the picked variant's photo");

  const p2 = await browser.newPage();
  await p2.goto('file:///tmp/multi.html');
  const shot = () => p2.getAttribute('#shot', 'src');
  ok(await shot() === 'https://cdn.test/dank.png', 'and so does the card on load: ' + (await shot()));

  await p2.click('#toBack');
  ok(await p2.isHidden('#vshot'), 'no variant thumbnail before a choice is made');

  await p2.selectOption('#size', '1');
  ok(await shot() === 'https://cdn.test/candy.png',
     'choosing Candy Hustle swaps the main photo: ' + (await shot()));
  /* The main photo is on the other face, so a swap there alone is invisible at the
     moment of choosing. The thumbnail beside the dropdown is what they can see. */
  ok(await p2.isVisible('#vshot'), 'the thumbnail beside the dropdown appears');
  ok(await p2.getAttribute('#vimg', 'src') === 'https://cdn.test/candy.png',
     'and shows that variant too');
  ok(/Candy Hustle/.test(await p2.textContent('#vcap')), 'captioned with the variant it is');

  await p2.selectOption('#size', '2');
  ok(await shot() === 'https://cdn.test/product-lead.png',
     'a row with no photo of its own falls back to the product photo, not the last variant');
  ok(/one photo for every size/.test(await p2.textContent('#vcap')),
     'and says so rather than implying the picture is of that size');

  await p2.selectOption('#size', '3');
  ok(await shot() === 'https://cdn.test/product-lead.png',
     'a javascript: photo in the feed is dropped, not rendered: ' + (await shot()));
  ok(!/javascript:/.test(multiHtml), 'and it is nowhere in the page source');

  // Adding still carries the right variant, so the photo work changed nothing there.
  await p2.selectOption('#size', '1');
  ok(/Add 1oz for \$39\.99 to cart/.test((await p2.textContent('#add')).trim()),
     'the button still states the chosen row: ' + (await p2.textContent('#add')).trim());
  await p2.close();
}

console.log('\n=== the gate on a short viewport ===');
{
  /* Add to cart sits below the card, so on a short viewport the shopper has
     scrolled past it by the time they click. The flip must bring the dropdown back
     on screen; it previously landed above the fold, glowing out of sight. */
  const short = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await short.route('**/consumables**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
  await short.goto('file:///tmp/pick.html');
  await short.click('#add');
  await short.waitForTimeout(900);
  const m = await short.evaluate(() => {
    const r = document.getElementById('size').getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight, scrollY: Math.round(scrollY) };
  });
  console.log('  dropdown at ' + JSON.stringify(m));
  ok(m.top >= 0 && m.bottom <= m.h, 'the dropdown is on screen after the forced flip');
  ok(await short.evaluate(() => document.getElementById('size').classList.contains('needs')),
     'and still glowing');
  await short.close();
}

ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
await browser.close();
console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
