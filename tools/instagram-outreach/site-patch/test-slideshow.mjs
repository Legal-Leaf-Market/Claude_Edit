/* The slideshow, driven in real Chromium. The load-bearing property is that a
 * selection never survives a slide change: carrying a size choice from one product
 * to the next is how somebody adds a thing they never looked at. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import handler from './api-share.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const oz = (id, price, sizes) => ({
  id: 's__' + id, name: 'Ounce ' + id.toUpperCase(), store: 'Store ' + id.toUpperCase(),
  storeKey: id, domain: id + '.test', cartDomain: id + '.test', platform: 'shopify',
  ref: 'ref' + id, coupon: 'CODE' + id, category: 'THCA Flower', cur: 'USD', inStock: true,
  perG: price / 28, image: 'https://cdn.test/' + id + '.png', url: 'https://' + id + '.test/p',
  cannabinoid: 'THCa', type: 'Hybrid',
  sizes: sizes || [['1 oz', price, 28, 'V-' + id, 1, null, '']],
});
/* Three ounces, ascending price, so slide order is deterministic. Slide 2's two
   strains each carry their own photo, the live multi-strain shape, so a swap on one
   slide has something to leak onto the next. */
const POOL = [oz('a', 39), oz('b', 44, [
  ['Strain One 1 oz', 44, 28, 'V-b1', 1, null, 'https://cdn.test/b-one.png'],
  ['Strain Two 1 oz', 46, 28, 'V-b2', 1, null, 'https://cdn.test/b-two.png'],
]), oz('c', 47)];
globalThis.fetch = async () => ({ ok: true, json: async () => ({ products: POOL }) });

let html = '';
const res = { setHeader() {}, status() { return this; }, send(b) { html = b; return this; } };
await handler({ query: { id: 'pick' }, headers: { host: 'legal-leafmarket.com' } }, res);
fs.writeFileSync('/tmp/slides.html', html);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 430, height: 950 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
const writes = [];
await page.exposeFunction('__record', (k, v) => writes.push({ k, v }));
await page.addInitScript(() => {
  const real = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) { try { window.__record(k, v); } catch (e) {} return real(k, v); };
});
await page.route('**/consumables**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
await page.goto('file:///tmp/slides.html');

const shown = () => page.evaluate(() => ({
  name: document.getElementById('pname').textContent,
  count: (document.getElementById('count') || {}).textContent,
  price: document.getElementById('price').textContent.replace(/\s+/g, ' ').trim(),
  img: document.getElementById('shot').getAttribute('src'),
  opts: Array.from(document.querySelectorAll('#size option')).map((o) => o.textContent),
  fine: document.getElementById('fine').textContent.slice(0, 40),
}));

console.log('=== it starts on the best value ===');
let v = await shown();
console.log('  ' + JSON.stringify({ name: v.name, count: v.count, price: v.price }));
ok(v.name === 'Ounce A' && v.count === '1 of 3', 'slide 1 is the cheapest ounce');

console.log('\n=== next advances without a reload ===');
const url0 = page.url();
await page.click('#next');
await page.waitForTimeout(250);
v = await shown();
console.log('  ' + JSON.stringify({ name: v.name, count: v.count, price: v.price, img: v.img }));
ok(v.name === 'Ounce B' && v.count === '2 of 3', 'moved to slide 2');
ok(/\$44/.test(v.price), 'price followed the slide');
/* The picked row's own photo, not the listing's lead photo: this slide advertises
   Strain One at $44, so that strain's picture is the honest one to open on. Slides A
   and C give their rows no photo, so they show the product image. */
ok(v.img === 'https://cdn.test/b-one.png',
   "photo followed the slide, and is the picked strain's: " + v.img);
ok(/Store B/.test(v.fine), 'the store disclaimer followed too');
ok(v.opts.length === 3, "slide 2's own two sizes are offered, got " + (v.opts.length - 1));
ok(page.url().includes('i=1'), 'the URL tracks the slide: ' + page.url().split('/').pop());
ok(await page.evaluate(() => history.length) <= 2, 'without stacking history entries');

console.log('\n=== a selection never survives a slide change ===');
await page.click('#toBack');
await page.waitForTimeout(600);
await page.selectOption('#size', { index: 1 });
/* The button stays short, weight and price, while the hint directly above it
   names the strain in full. Between them and the dropdown, the strain is stated
   three times before anything is added. */
const btn2 = (await page.textContent('#add')).trim();
const hint2 = (await page.textContent('#hint')).trim();
console.log('  button: ' + JSON.stringify(btn2));
console.log('  hint:   ' + JSON.stringify(hint2));
ok(/^Add 1oz for \$44 to cart$/.test(btn2), 'the button states weight and price');
ok(/Adding Strain One 1 oz, \$44, from Store B\./.test(hint2), 'the hint names the strain');
/* The photo follows the strain, and must not follow it onto the next slide. */
ok(await page.getAttribute('#shot', 'src') === 'https://cdn.test/b-one.png',
   "the card shows Strain One's own photo: " + (await page.getAttribute('#shot', 'src')));
ok(await page.isVisible('#vshot'), 'with the thumbnail beside the dropdown to confirm it');
await page.click('#toFront');
await page.waitForTimeout(600);
await page.click('#next');
await page.waitForTimeout(300);
ok((await page.textContent('#add')).trim() === 'Add to cart', 'the button resets on the next slide');
ok(await page.evaluate(() => document.getElementById('size').value) === '', 'and no size is selected');
ok(await page.getAttribute('#shot', 'src') === 'https://cdn.test/c.png',
   "the photo is the new slide's, not the last variant's: " + (await page.getAttribute('#shot', 'src')));
ok(await page.isHidden('#vshot'), 'and the thumbnail is gone until they choose again');
await page.click('#add');
await page.waitForTimeout(600);
ok(writes.filter((w) => w.k === 'll_cart').length === 0, 'so Add cannot fire with a stale choice');
ok(/Choose a size first/.test(await page.textContent('#hint')), 'it gates again on the new slide');

console.log('\n=== adding on the slide you are looking at ===');
await page.selectOption('#size', { index: 1 });
await page.click('#add');
await page.waitForTimeout(400);
const cart = JSON.parse(writes.filter((w) => w.k === 'll_cart').pop().v);
console.log('  added: ' + JSON.stringify({ id: cart[0].id, v: cart[0].variantId, ref: cart[0].ref }));
ok(cart[0].id === 's__c' && cart[0].variantId === 'V-c', 'the item is slide 3, the one on screen');
ok(cart[0].ref === 'refc' && cart[0].coupon === 'CODEc', "and carries that store's own ref and coupon");
ok(writes.filter((w) => w.k === 'll_cart').length === 1, 'exactly one cart write happened');

console.log('\n=== wrapping, keyboard and back-to-photo ===');
await page.goto('file:///tmp/slides.html');
await page.click('#prev');
await page.waitForTimeout(250);
ok((await shown()).count === '3 of 3', 'prev from the first slide wraps to the last');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(250);
ok((await shown()).count === '1 of 3', 'arrow keys work and wrap forward');
await page.click('#toBack');
await page.waitForTimeout(600);
ok(await page.isVisible('#toFront') && await page.isVisible('#toFront2'),
   'two ways back to the photo, top and bottom');
ok((await page.textContent('#toFront2')).includes('Back to the photo'), 'the bottom one spells it out');
await page.click('#toFront2');
await page.waitForTimeout(600);
ok(await page.evaluate(() => !document.getElementById('flip').classList.contains('flipped')),
   'and it flips back');
// Moving slides while flipped should show the photo, not leave them on a stale back.
/* Turned to the back, the slideshow controls are deliberately unreachable: the
   arrows live on the photo and go pointer-events:none with it, and arrow keys
   belong to the focused dropdown. Choosing a size and browsing slides are separate
   modes, and flipping back is the way between them, which is why there are now two
   obvious buttons for it. */
await page.click('#toBack');
await page.waitForTimeout(600);
const navBlocked = await page.evaluate(() => {
  const n = document.getElementById('next');
  const st = getComputedStyle(n);
  return { pe: st.pointerEvents, op: st.opacity };
});
console.log('  nav while flipped: ' + JSON.stringify(navBlocked));
ok(navBlocked.pe === 'none' && navBlocked.op === '0', 'the arrows are inert while flipped');
await page.click('#toFront2');
await page.waitForTimeout(600);
ok(await page.evaluate(() => getComputedStyle(document.getElementById('next')).pointerEvents) === 'auto',
   'and live again on the front');
const before = (await shown()).count;
await page.click('#next');
await page.waitForTimeout(300);
ok((await shown()).count !== before, 'so browsing resumes after flipping back');

ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
await browser.close();
console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
