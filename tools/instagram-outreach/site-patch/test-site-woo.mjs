/* Boot verification per CLAUDE.md 5a: the additive layers over the base64 engine are only real
 * if the real page runs them. Serves public/ with a stubbed /api/products carrying one Woo
 * listing that sells whole buds AND shake, then drives it in Chromium.
 *
 * What it pins:
 *   - the trim chip follows the DROPDOWN, not the card, so the whole-bud size is not libelled
 *   - the cart's Checkout link is rewritten to land IN the store's cart with the chosen
 *     variation added, under the store's own affiliate param (sld, not ref)
 *
 * Run: node test-site-woo.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import fs from 'node:fs';

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

/* Resolved rather than hardcoded, for the reason test-share.mjs records: a single hardcoded path
   silently read a stale second clone and validated code nobody ships. */
const CANDIDATES = ['/home/user/code_backup/public', '/workspace/code_backup/public'];
const PUBLIC = CANDIDATES.find((c) => fs.existsSync(c));
console.log('  serving the site from: ' + PUBLIC);
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

/* One product, two sizes, one of them shake. Slot 7 is the feed's per-row grade. */
const WOO = {
  id: 'cbdhempdirect__house-blend', name: 'House Blend THCA Flower', store: 'CBD Hemp Direct',
  storeKey: 'cbdhempdirect', domain: 'cbdhemp.direct', cartDomain: 'cbdhemp.direct',
  platform: 'woocommerce', productId: 153600, cartPath: '/cart',
  ref: '161', refParam: 'sld', refLink: '', coupon: '',
  cannabinoid: 'THCa', category: 'THCA Flower', type: 'Hybrid', grow: 'Indoor', potency: null,
  cur: 'USD', inStock: true, sale: 44, startsAt: 99, perG: 1.57, ship: 0, added: Date.now(),
  badges: [], gallery: [], coa: '', image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  url: 'https://cbdhemp.direct/products/thca-flower-house-blend?sld=161',
  offcut: false, subTags: { trim: false },
  /* Slot 8 is the add-to-cart attribute query, derived at scrape time from the parent's own
     declared taxonomy. Without it the link degrades to the product page on purpose. */
  sizes: [
    ['Net Weight: 28 Grams', 99, 28, '153601', true, null, '', 0, 'attribute_pa_net-weight=28-grams'],
    ['Shake 28 Grams', 44, 28, '153602', true, null, '', 1, 'attribute_pa_shake=28-grams'],
  ],
};
const PAYLOAD = JSON.stringify({ products: [WOO], meta: { updated: '2026-08-10 00:00 UTC', total: 1, stores: [{ name: 'CBD Hemp Direct', count: 1 }] } });

const server = createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (path.startsWith('/api/products')) {
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end(PAYLOAD);
  }
  if (path.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{}'); }
  const file = path === '/' ? 'index.html' : path.replace(/^\//, '') + (extname(path) ? '' : '.html');
  try {
    const body = await readFile(join(PUBLIC, file));
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(3111, r));
const BASE = 'http://127.0.0.1:3111';

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
/* Resource failures are this harness, not the page: the stub server has no favicon or sw.js and
   the sandbox blocks outbound requests. A JS exception is the thing worth failing on. */
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/Failed to load resource|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|net::ERR/.test(t)) return;
  errors.push('console: ' + t);
});

console.log('=== the grid: the chip follows the size, not the card ===');
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const card = await page.evaluate(() => {
  const c = document.querySelector('.card[data-pid]');
  const sel = c && c.querySelector('select.sizesel');
  return { found: !!c, options: sel ? [...sel.options].map((o) => o.textContent) : [],
           selected: sel ? sel.selectedIndex : -1,
           chip: c && c.querySelector('.ll-trim-tag') ? c.querySelector('.ll-trim-tag').textContent : null };
});
console.log('  options: ' + JSON.stringify(card.options));
ok(card.found, 'the engine rendered the listing');
ok(card.options.length === 2, 'both sizes are in the dropdown: ' + card.options.length);
ok(card.options.every((o) => /House Blend/.test(o)), 'every option names the strain');
ok(card.options.every((o) => /\$\d/.test(o)), 'and its price');
ok(card.options.every((o) => /28 Grams/.test(o)), 'and its size');
/* The engine opens on the best price per gram, which on a mixed listing is the shake, so the
   banner is up before anyone touches anything. That is the right way round: the cheapest row is
   the one a shopper is most likely to take on trust. */
ok(/This size: Trim \/ Shake/.test(card.chip || ''),
   'the shake row is selected on load and says so: ' + card.chip);
ok(!/^Trim \/ Shake$/.test(card.chip || ''),
   'and it says this SIZE, not the whole listing, which sells whole buds too');

/* Choosing the whole-bud row must take it back off. The engine does not re-render the card on
   change, which is why the layer listens for the event. */
const pick = (match) => page.evaluate(async (m) => {
  const c = document.querySelector('.card[data-pid]');
  const sel = c.querySelector('select.sizesel');
  sel.selectedIndex = [...sel.options].findIndex((o) => new RegExp(m).test(o.textContent));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const tag = c.querySelector('.ll-trim-tag');
  return tag ? tag.textContent : null;
}, match);
const onBuds = await pick('Net Weight');
ok(onBuds === null, 'switching to the whole-bud size clears it, so that size is not libelled: ' + onBuds);
const backOnShake = await pick('Shake');
ok(/This size: Trim \/ Shake/.test(backOnShake || ''), 'and switching back raises it again: ' + backOnShake);

console.log('\n=== the cart link lands in their cart with that size added ===');
const href = await page.evaluate(async () => {
  const c = document.querySelector('.card[data-pid]');
  const sel = c.querySelector('select.sizesel');
  sel.selectedIndex = [...sel.options].findIndex((o) => /Shake/.test(o.textContent));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  const add = [...c.querySelectorAll('button')].find((b) => /add/i.test(b.textContent) && !b.disabled);
  add.click();
  await new Promise((r) => setTimeout(r, 600));
  const a = [...document.querySelectorAll('a.checkout')].find((x) => /Checkout at/.test(x.textContent));
  return a ? a.getAttribute('href') : null;
});
console.log('  href: ' + href);
ok(!!href && href.startsWith('https://cbdhemp.direct/cart?'), 'it is their cart page: ' + href);
ok(/add-to-cart=153600/.test(href || ''), 'posting the parent id, the way their own form does');
ok(/variation_id=153602/.test(href || ''), 'naming the variation the shopper chose');
ok(/attribute_pa_shake=28-grams/.test(href || ''), 'with the attribute that makes Woo accept it');
ok(/quantity=1/.test(href || ''), 'with a quantity');
ok(/sld=161/.test(href || ''), 'under the store\'s own param');
ok(!/[?&]ref=161/.test(href || ''), 'and not the hardcoded ref= that would have paid nobody');

console.log('\n=== the satellite page agrees with it ===');
await page.goto(BASE + '/consumables', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const sat = await page.evaluate(() => {
  const sel = document.querySelector('select.ssizesel');
  return { options: sel ? [...sel.options].map((o) => o.textContent) : [] };
});
console.log('  options: ' + JSON.stringify(sat.options));
ok(sat.options.length === 2, 'both sizes on the satellite too: ' + sat.options.length);
ok(sat.options.every((o) => /House Blend/.test(o) && /\$/.test(o)), 'each stating strain, size and price');
ok(sat.options.some((o) => /trim\/shake/.test(o)), 'and the shake row says so in the option itself');

ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

await browser.close();
server.close();
console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
