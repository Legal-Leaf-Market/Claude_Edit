// Per-product share page, server rendered, at /p/<id> (see the rewrite in vercel.json).
//
// WHY THIS EXISTS
//
// Instagram, Facebook and every other link-preview crawler reads Open Graph tags
// out of the HTML the server returns. None of them run JavaScript. This site is
// static HTML plus a client-side render from /api/products, and every page ships
// the same site-level og: tags pointing at /og-image.png, so pasting ANY link into
// a DM produced one identical generic card: "Compare Legal Hemp Deals by Price Per
// Gram". There was no per-product URL to paste in the first place.
//
// So this route is the only thing on the site that can produce a product card: it
// looks the product up server side and emits og: tags carrying that product's own
// name, price and image, plus a real page for the human who taps it.
//
// It deliberately does NOT re-run the scrape. It fetches the site's own
// /api/products, which is CDN cached (see vercel.json), so a warm hit is one cheap
// request rather than twenty store scrapes.
//
// SAFETY NOTE: every field here originates in a third party store's product feed,
// which means product names and image URLs are untrusted input being written into
// HTML. Everything goes through esc(), and image/link URLs are restricted to https
// so a poisoned feed row cannot smuggle javascript: into an href or break out of an
// attribute.

const SITE = 'https://legal-leafmarket.com';
const FALLBACK_IMG = SITE + '/og-image.png';

// Text into HTML, for both element bodies and quoted attribute values.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A URL is only allowed through if it is really https. Anything else, including
// javascript: and data:, is dropped rather than sanitised into something plausible.
function httpsOnly(u, fallback = '') {
  try {
    const parsed = new URL(String(u));
    return parsed.protocol === 'https:' ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

function money(n, cur = 'USD') {
  const v = Number(n);
  if (!isFinite(v)) return '';
  const sym = cur === 'EUR' ? '€' : '$';
  return sym + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, '');
}

// "1oz" reads better than "28g" in a card, and the ounce is the unit the pick of
// the week is chosen on.
function weightLabel(g) {
  const grams = Number(g);
  if (!isFinite(grams) || grams <= 0) return '';
  const oz = grams / 28;
  if (Math.abs(oz - Math.round(oz)) < 0.06 && oz >= 1) {
    const n = Math.round(oz);
    return n + 'oz';
  }
  if (Math.abs(grams - 3.5) < 0.01) return 'eighth, 3.5g';
  if (Math.abs(grams - 7) < 0.01) return 'quarter, 7g';
  if (Math.abs(grams - 14) < 0.01) return 'half, 14g';
  return grams + 'g';
}

// The cheapest size that is actually in stock decides the headline price, so the
// card never advertises a number the shopper cannot get.
function headline(p) {
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const usable = sizes
    .map((s) => ({ label: s && s[0], price: Number(s && s[1]), grams: Number(s && s[2]) }))
    .filter((s) => isFinite(s.price) && s.price > 0);
  if (!usable.length) {
    return { price: Number(p.sale) || Number(p.startsAt) || null, weight: '', perG: p.perG };
  }
  usable.sort((a, b) => a.price - b.price);
  const cheapest = usable[0];
  return {
    price: cheapest.price,
    weight: weightLabel(cheapest.grams) || cheapest.label || '',
    perG: p.perG,
  };
}

// Exactly the item addToCart() in consumables.html pushes, field for field. The
// size row layout is [label, price, grams, variantId, ?, url, ?], so the per-size
// URL at s[5] wins over the product URL when the store gave us one.
function cartItem(p, idx) {
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  let s = idx != null && sizes[idx] ? sizes[idx] : null;
  if (!s) {
    const usable = sizes.filter((x) => isFinite(Number(x && x[1])) && Number(x[1]) > 0);
    usable.sort((a, b) => Number(a[1]) - Number(b[1]));
    s = usable[0] || null;
  }
  return {
    id: p.id, name: p.name, store: p.store, storeKey: p.storeKey, domain: p.domain,
    cartDomain: p.cartDomain || '', platform: p.platform || 'shopify',
    ref: p.ref || '', refLink: p.refLink || '', coupon: p.coupon || '',
    url: (s && s[5]) || p.url || '',
    price: s ? s[1] : p.sale,
    size: s ? s[0] : 'One Size',
    variantId: s ? s[3] : '',
    cur: p.cur || 'USD',
  };
}

/* ---- /p/pick: the weekly pick, computed rather than curated ----
 *
 * "Best value ounce under $50" is a query, not an editorial decision, and this
 * site already holds the one number that answers it: price per gram. So the pick
 * resolves from live data on every request, which means it cannot advertise a
 * product that sold out or a price that moved, and there is no weekly step where
 * somebody pastes a product id into a link.
 *
 * It ranks SIZE ROWS, not products: a product's headline perG can come from a
 * quarter pound, which is not an ounce. Ties break on id so the choice is stable
 * between requests rather than flipping with feed ordering.
 *
 * The weight window is a BAND, not a floor, and that matters. With a floor alone
 * a quarter pound at $45 wins the "best ounce under $50" query outright: 112g
 * clears a 28g floor and $45 clears the cap, so the card would read "4oz $45"
 * under a message promising an ounce. Better value per gram, wrong promise. The
 * band keeps the pick to the thing that was actually advertised.
 */
/* Every qualifying size row, best value first. The slideshow walks this list, so
   the pool is capped: the 40th best ounce is not a deal worth showing anybody. */
var PICK_POOL = 10;

/* Does a size row's own label say "ounce"? Sub-ounce fractions are excluded first,
   because "1/4 oz" contains "oz" while being a quarter. */
var SUB_OUNCE = /(eighth|quarter|half|1\s*\/\s*8|1\s*\/\s*4|1\s*\/\s*2)/i;
var OUNCE_WORD = /(^|[^a-z])(oz|ounce)s?([^a-z]|$)/i;
function namesAnOunce(label) {
  var t = String(label || '');
  if (SUB_OUNCE.test(t)) return false;
  return OUNCE_WORD.test(t);
}

/* Rows often inherit their weight from the PRODUCT TITLE rather than their own
   label: on a multi-strain listing titled "... Smalls Ounce", every strain row is
   tagged 28g even though the row itself says only the strain. That inference is
   usually right, but it goes wrong when the same product also sells a row that
   explicitly IS an ounce at a price above the cap. Picking a title-inferred row
   from such a product advertises an ounce under $50 when the product's actual
   ounce costs more, which is the case the user hit: an $80 ounce with a cheaper
   smaller quantity underneath it.

   So a row whose own label names an ounce is judged on its own price, while a row
   relying on the title's inference is rejected outright when the product has an
   explicitly-ounce row over the cap. */
function ounceRowOverCap(sizes, maxPrice) {
  for (var j = 0; j < sizes.length; j++) {
    var row = sizes[j];
    if (!namesAnOunce(row && row[0])) continue;
    if (Number(row[1]) > maxPrice) return true;
  }
  return false;
}

function pickAll(list, opts, limit) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (!p || p.inStock === false) continue;
    if (opts.category && p.category !== opts.category) continue;
    var sizes = Array.isArray(p.sizes) ? p.sizes : [];
    var pricierOunce = ounceRowOverCap(sizes, opts.maxPrice);
    for (var j = 0; j < sizes.length; j++) {
      var price = Number(sizes[j] && sizes[j][1]);
      var grams = Number(sizes[j] && sizes[j][2]);
      if (!isFinite(price) || price <= 0) continue;
      if (!isFinite(grams) || grams < opts.minGrams) continue;
      if (opts.maxGrams && grams > opts.maxGrams) continue;
      if (price > opts.maxPrice) continue;
      /* A row that names an ounce itself stands on its own price. One relying on
         the title's inferred weight does not, when this product's real ounce is
         over the cap. */
      if (pricierOunce && !namesAnOunce(sizes[j][0])) continue;
      out.push({ product: p, index: j, perG: price / grams, key: p.id + '#' + j });
    }
  }
  /* Ties break on key so the ordering, and therefore every ?i= link, is stable
     between requests instead of following feed order. */
  out.sort(function (a, b) {
    if (a.perG !== b.perG) return a.perG - b.perG;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  return limit ? out.slice(0, limit) : out;
}

function pickBest(list, opts) {
  return pickAll(list, opts, 1)[0] || null;
}

function noPick(canonical, opts) {
  return page({
    title: 'No pick right now: Legal-Leaf Market',
    ogTitle: 'Legal-Leaf Market',
    ogDesc: 'Compare legal hemp prices across trusted stores by price per gram.',
    ogImage: FALLBACK_IMG,
    canonical,
    noindex: true,
    /* A pick with nothing to show is a real signal, not a non-event: it means the
       offer went out with no product behind it. */
    track: { page: 'pick', outcome: 'empty', maxPrice: opts.maxPrice },
    body: `<h1>Nothing qualifies right now</h1>
<p class="meta">No in-stock ounce under ${esc(money(opts.maxPrice))} in the feed at the moment.
Rather than show you something that is not the deal it claims to be, here is everything.</p>
<a class="buy" href="${SITE}/consumables">Compare every store</a>`,
  });
}

function description(p, h) {
  const bits = [];
  if (h.weight) bits.push(h.weight);
  if (h.perG) bits.push(money(h.perG, p.cur) + ' per gram');
  if (p.store) bits.push('at ' + p.store);
  if (p.inStock === false) bits.push('out of stock');
  const lead = bits.join(', ');
  return lead
    ? lead + '. Compared against every other store on Legal-Leaf Market.'
    : 'Compared against every other store on Legal-Leaf Market.';
}

/* ---- analytics ----
 * Mirrors the LL.track block in index.html rather than inventing a second scheme:
 * same va() custom events, same ll_sid session id, same ll_events ring buffer, and
 * the same deferred /_vercel/insights/script.js the satellite pages load. Without
 * that script va() only queues and nothing reports, which is why the earlier
 * version of this page called LL.track into thin air: LL was never defined here.
 *
 * It also beacons to /api/track. On this page the whole point is that people land,
 * tap, and leave within a second or two, and a beacon survives that unload where a
 * normal fetch can be cut off. api/track.js already exists as the event sink and
 * forwards to LL_EVENTS_WEBHOOK when one is configured.
 */
function analytics(track) {
  var payload = JSON.stringify(track).replace(/</g, '\\u003c');
  return `<script defer src="/_vercel/insights/script.js"><\/script>
<script>
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
window.LL = window.LL || {};
(function () {
  function sid() {
    try {
      var k = 'll_sid', s = sessionStorage.getItem(k);
      if (!s) { s = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem(k, s); }
      return s;
    } catch (e) { return ''; }
  }
  var BASE = ${payload};
  // Whatever brought them here: the DM link's own tags, if it carried any.
  try {
    var q = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
      var v = q.get(k); if (v) BASE[k.replace('utm_', '')] = v;
    });
  } catch (e) {}
  LL.track = function (name, props) {
    props = Object.assign({}, BASE, props || {});
    props.sid = sid();
    try { if (typeof window.va === 'function') va('event', Object.assign({ name: name }, props)); } catch (e) {}
    try { if (typeof window.gtag === 'function') gtag('event', name, props); } catch (e) {}
    try {
      var k = 'll_events', a = JSON.parse(localStorage.getItem(k) || '[]');
      a.push({ t: Date.now(), name: name, props: props });
      if (a.length > 250) a = a.slice(-250);
      localStorage.setItem(k, JSON.stringify(a));
    } catch (e) {}
    try {
      var body = JSON.stringify({ name: name, props: props, ts: Date.now() });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      else fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true });
    } catch (e) {}
  };
})();
window.addEventListener('load', function () { try { LL.track('page_view', {}); } catch (e) {} });
<\/script>`;
}

/* ---- the back of the card ----
 *
 * This repo is deliberately strict about not claiming a lab test it cannot prove:
 * attachLab() refuses to attach numbers from a sheet shared across strains, and
 * tagCoaScope() exists because printing "lab-tested" on a link to a store's
 * results directory was a measured false-specificity bug. So this panel follows
 * the same rules: the badge needs p.labTested or coaScope 'product', the COA link
 * is worded from what the document actually is, and every field is omitted when
 * absent rather than rendered as a zero or a dash. coa-data.js says outright:
 * never assume a field exists.
 */
/* "1 oz" and "1oz" are the same fact twice. Compare on alphanumerics only, so a
   row already labelled with its weight does not render "1 oz - 1oz - $39". */
function saysWeightAlready(variant, label) {
  const n = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const v = n(variant), l = n(label);
  return !!l && !!v && v.indexOf(l) !== -1;
}

function pct(v) {
  return typeof v === 'number' && isFinite(v) ? (Math.round(v * 100) / 100) + '%' : '';
}

const FLAG_WORDS = {
  coa_stale: 'the certificate is not recent',
  safety_not_pass: 'the safety panel is not marked pass on the certificate',
  coa_page_1_only: 'only the first page of the certificate was read',
};

function coaLine(p) {
  const url = httpsOnly(p.coa);
  if (!url) return '';
  const scope = p.coaScope;
  const label = scope === 'product'
    ? "View this product's certificate"
    : scope === 'store'
      ? "View the store's shared compliance sheet"
      : "Browse the store's lab results page";
  const note = scope === 'product'
    ? ''
    : scope === 'store'
      ? ' This one sheet covers several of their products, so it is not specific to this batch.'
      : ' That is a directory of results, not this batch\'s certificate.';
  return `<tr><td>Certificate</td><td><a href="${esc(url)}" rel="nofollow noopener" target="_blank">${esc(label)}</a>${esc(note)}</td></tr>`;
}

function labPanel(p) {
  const d = p.lab && typeof p.lab === 'object' ? p.lab : null;
  const tested = p.labTested === true || p.coaScope === 'product';
  const rows = [];

  if (d) {
    /* totalThc is the decarboxylated figure, which coa-data.js calls the number a
       buyer actually gets, so it leads. */
    if (pct(d.totalThc)) rows.push(`<tr><td>Total THC</td><td><span class="big">${esc(pct(d.totalThc))}</span></td></tr>`);
    if (pct(d.thca)) rows.push(`<tr><td>THCa</td><td>${esc(pct(d.thca))}</td></tr>`);
    if (pct(d.d9)) rows.push(`<tr><td>Delta-9</td><td>${esc(pct(d.d9))}</td></tr>`);
    if (pct(d.cbd)) rows.push(`<tr><td>CBD</td><td>${esc(pct(d.cbd))}</td></tr>`);
    if (pct(d.total)) rows.push(`<tr><td>Total cannabinoids</td><td>${esc(pct(d.total))}</td></tr>`);
    if (Array.isArray(d.minors) && d.minors.length) {
      const bits = d.minors.slice(0, 5)
        .filter((m) => Array.isArray(m) && m[0])
        .map((m) => m[0] + ' ' + (pct(m[1]) || '')).join(', ');
      if (bits) rows.push(`<tr><td>Minors</td><td>${esc(bits.trim())}</td></tr>`);
    }
    if (d.lab) rows.push(`<tr><td>Lab</td><td>${esc(d.lab)}</td></tr>`);
    if (d.tested) rows.push(`<tr><td>Tested</td><td>${esc(d.tested)}</td></tr>`);
    if (d.sample) rows.push(`<tr><td>Sample</td><td>${esc(d.sample)}</td></tr>`);
  } else if (typeof p.potency === 'number' && p.potency > 0) {
    /* No certificate matched, so this is the store's own claim and is labelled as
       one rather than dressed up as a measurement. */
    rows.push(`<tr><td>Listed potency</td><td>${esc(pct(p.potency))} <span style="color:var(--muted)">as stated by the store, not from a certificate we have read</span></td></tr>`);
  }

  const kind = [p.cannabinoid, p.type, p.grow].filter(Boolean).join(' · ');
  if (kind) rows.push(`<tr><td>Type</td><td>${esc(kind)}</td></tr>`);
  const coa = coaLine(p);
  if (coa) rows.push(coa);

  const tags = [];
  if (tested) tags.push('<span class="tag ok">lab tested</span>');
  if (d && typeof d.trust === 'number') tags.push(`<span class="tag">certificate confidence ${esc(String(d.trust))}/100</span>`);

  let caution = '';
  if (d && Array.isArray(d.flags) && d.flags.length) {
    const worded = d.flags.map((f) => FLAG_WORDS[f] || String(f).replace(/_/g, ' '));
    caution = `<p class="caution">Worth knowing: ${esc(worded.join('; '))}.</p>`;
  }
  if (!d && !tested) {
    caution = '<p class="caution">No certificate has been matched to this product, so there are no measured numbers to show. That is a gap in what the store published, not a claim either way about the batch.</p>';
  }

  return (tags.length ? '<div>' + tags.join('') + '</div>' : '') +
    caution +
    (rows.length ? `<table class="lab">${rows.join('')}</table>` : '');
}

function page({ title, ogTitle, ogDesc, ogImage, canonical, body, noindex, track }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<link rel="canonical" href="${esc(canonical)}"/>
${noindex ? '<meta name="robots" content="noindex"/>' : ''}
<meta name="description" content="${esc(ogDesc)}"/>
<meta property="og:type" content="product"/>
<meta property="og:site_name" content="Legal-Leaf Market"/>
<meta property="og:locale" content="en_US"/>
<meta property="og:url" content="${esc(canonical)}"/>
<meta property="og:title" content="${esc(ogTitle)}"/>
<meta property="og:description" content="${esc(ogDesc)}"/>
<meta property="og:image" content="${esc(ogImage)}"/>
<meta property="og:image:alt" content="${esc(ogTitle)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(ogTitle)}"/>
<meta name="twitter:description" content="${esc(ogDesc)}"/>
<meta name="twitter:image" content="${esc(ogImage)}"/>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#16181d;--muted:#5f6672;--line:#e2e5ea;--accent:#1c7a3e}
@media(prefers-color-scheme:dark){:root{--bg:#0f1216;--fg:#e7eaef;--muted:#98a1af;--line:#2b313b;--accent:#4ec97a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:640px;margin:0 auto;padding:24px 18px 56px}
a{color:inherit}
.shot{width:100%;height:100%;object-fit:cover;display:block}

/* Flip card. Both faces share one box, so the container owns the geometry and the
   back scrolls internally rather than resizing the card mid-flip. */
.flip{position:relative;width:100%;aspect-ratio:1/1;perspective:1200px;transition:aspect-ratio .4s ease}
/* The back carries more than a square can hold, and the size control must never
   be the thing that falls below the fold, so the card grows when it turns over. */
.flip.flipped{aspect-ratio:3/4}
@media (prefers-reduced-motion:reduce){.flip{transition:none}}
.inner{position:absolute;inset:0;transition:transform .55s cubic-bezier(.2,.7,.3,1);transform-style:preserve-3d}
.flip.flipped .inner{transform:rotateY(180deg)}
.face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;
  border-radius:14px;border:1px solid var(--line);overflow:hidden;background:#f2f3f5}
.back{transform:rotateY(180deg);background:var(--bg);overflow-y:auto;padding:14px 16px}
@media (prefers-reduced-motion:reduce){.inner{transition:none}}

/* Overlay controls sit on the photo so they cost no vertical space. */
.ov{position:absolute;z-index:2;border:none;cursor:pointer;font:inherit;font-weight:700;
  border-radius:999px;padding:9px 14px;color:#fff;background:rgba(10,14,11,.62);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);line-height:1;
  /* backdrop-filter puts these pills in their own compositing context, which
     escapes the face's backface-visibility: they kept rendering through the
     turned-away card with their text mirrored. Hiding their own backface plus
     fading them out on flip covers it either way. */
  backface-visibility:hidden;-webkit-backface-visibility:hidden;
  transition:opacity .2s ease}
.flip.flipped .front .ov{opacity:0;pointer-events:none}
.ov:hover{background:rgba(10,14,11,.78)}
.ov.flipbtn{bottom:12px;right:12px;box-shadow:0 0 0 1px rgba(255,255,255,.35),0 0 18px 2px var(--accent);
  animation:pulse 2.6s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 1px rgba(255,255,255,.35),0 0 14px 1px var(--accent)}
  50%{box-shadow:0 0 0 1px rgba(255,255,255,.5),0 0 26px 5px var(--accent)}}
@media (prefers-reduced-motion:reduce){.ov.flipbtn{animation:none}}

/* Slideshow arrows and position, on the photo so they cost no vertical space. */
.ov.nav{top:50%;transform:translateY(-50%);font-size:24px;padding:6px 14px;line-height:1}
.ov.nav.prev{left:10px}
.ov.nav.next{right:10px}
.ov.count{bottom:14px;left:12px;font-size:12px;font-weight:700;padding:7px 11px;cursor:default}

/* Getting back to the photo has to be obvious, so it is a real button and there is
   one at each end of the back panel. */
.flipback{font:inherit;font-weight:700;cursor:pointer;color:var(--accent);
  /* --line is nearly invisible against the dark background, so this read as a
     plain link. Getting back to the photo has to look like a button. */
  background:color-mix(in srgb,var(--accent) 14%,transparent);
  border:1.5px solid var(--accent);border-radius:999px;padding:6px 12px;white-space:nowrap}
.flipback:hover{background:color-mix(in srgb,var(--accent) 26%,transparent)}
.flipback.wide{display:block;width:100%;margin:16px 0 4px;padding:13px;border-radius:10px}

/* Back panel */
.bh{display:flex;align-items:baseline;gap:8px;margin:0 0 10px}
.bh h2{font-size:15px;margin:0;flex:1}
.bh button{background:none;border:none;color:var(--accent);font:inherit;font-weight:700;cursor:pointer;padding:0}
.lab{width:100%;border-collapse:collapse;font-size:14px;margin:0 0 10px}
.lab td{padding:4px 0;border-bottom:1px solid var(--line);vertical-align:top}
.lab td:first-child{color:var(--muted);padding-right:10px;white-space:nowrap}
.lab tr:last-child td{border-bottom:none}
.big{font-size:26px;font-weight:800;line-height:1.1}
.tag{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
  padding:3px 7px;border-radius:5px;background:var(--line);color:var(--muted);margin:0 4px 4px 0}
.tag.ok{background:var(--accent);color:#fff}
.caution{font-size:13px;color:var(--muted);margin:0 0 10px}
.pickfield{margin:12px 0 4px}
.pickfield label{display:block;font-size:13px;font-weight:700;margin-bottom:5px}
select{width:100%;font:inherit;padding:11px;border-radius:9px;border:1px solid var(--line);
  background:var(--bg);color:var(--fg)}
select.needs{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 35%,transparent);
  animation:glow 1.1s ease-in-out 3}
@keyframes glow{0%,100%{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 20%,transparent)}
  50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--accent) 55%,transparent)}}
@media (prefers-reduced-motion:reduce){select.needs{animation:none}}
.hint{font-size:13px;color:var(--muted);margin:8px 0 0;min-height:18px}
.hint.warn{color:var(--accent);font-weight:600}
h1{font-size:22px;line-height:1.25;margin:18px 0 6px}
.price{font-size:28px;font-weight:800;margin:10px 0 2px}
.meta{color:var(--muted);font-size:15px;margin:0 0 18px}
.buy{display:block;width:100%;text-align:center;background:var(--accent);color:#fff;text-decoration:none;font:inherit;font-weight:700;padding:15px;border:none;border-radius:10px;margin:0 0 10px;cursor:pointer}
.buy:disabled{opacity:.7;cursor:default}
.alt{display:block;text-align:center;text-decoration:none;font-weight:600;padding:13px;border-radius:10px;border:1px solid var(--line);margin:0 0 10px}
.fine{color:var(--muted);font-size:13px;margin-top:22px;border-top:1px solid var(--line);padding-top:14px}
</style>
</head>
<body><div class="wrap">
${body}
</div>
${analytics(track || { page: 'share' })}
</body>
</html>`;
}

function notFound(canonical) {
  return page({
    title: 'Product not found: Legal-Leaf Market',
    ogTitle: 'Legal-Leaf Market',
    ogDesc: 'Compare legal hemp prices across trusted stores by price per gram.',
    ogImage: FALLBACK_IMG,
    canonical,
    noindex: true,
    track: { page: 'share', outcome: 'not_found' },
    body: `<h1>That product is gone</h1>
<p class="meta">Stock moves and listings disappear. The comparison is still live.</p>
<a class="buy" href="${SITE}/consumables">Browse every store</a>`,
  });
}

export default async function handler(req, res) {
  const rawId = String((req.query && req.query.id) || '').trim();
  const rawSize = (req.query && req.query.s) != null ? parseInt(req.query.s, 10) : NaN;
  const sizeIndex = Number.isInteger(rawSize) && rawSize >= 0 ? rawSize : null;
  const canonical = SITE + '/p/' + encodeURIComponent(rawId);

  // A crawler must never be handed a stale-forever card, and must never be made
  // to wait on a cold scrape either. Ten minutes at the edge with a long
  // stale-while-revalidate is the compromise.
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');

  if (!rawId) return res.status(404).send(notFound(canonical));

  /* A price cap and a minimum weight, both overridable, so the same route can
     answer "best ounce under $50" or "best quarter under $25" later without a
     second endpoint. */
  const isPick = rawId.toLowerCase() === 'pick';
  const pickOpts = {
    maxPrice: Number(req.query && req.query.max) > 0 ? Number(req.query.max) : 50,
    /* A full ounce is 28g and stores label it 28 to 31.5. The floor was 25, which
       admitted a short row and still called the offer an ounce; it is now a true
       ounce. The ceiling keeps a half (14g) out below and two ounces (56g) out
       above. */
    minGrams: Number(req.query && req.query.g) > 0 ? Number(req.query.g) : 28,
    maxGrams: Number(req.query && req.query.gmax) > 0 ? Number(req.query.gmax) : 31.5,
    /* ?category=any drops the filter, which is the first thing to try if the pick
       comes up empty: the classifier may label an ounce as something else. */
    category: (function (c) {
      if (!c) return 'THCA Flower';
      return String(c).toLowerCase() === 'any' ? null : String(c);
    })(req.query && req.query.category),
  };

  let product = null;
  let chosenIndex = sizeIndex;
  let rank = 0;
  let pool = 0;
  let candidates = [];
  try {
    // Same origin, so this rides the CDN cache /api/products already populates
    // instead of triggering another twenty-store scrape.
    const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'legal-leafmarket.com';
    const proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    const r = await fetch(`${proto}://${host}/api/products`, { headers: { accept: 'application/json' } });
    if (r.ok) {
      const data = await r.json();
      const list = Array.isArray(data && data.products) ? data.products : [];
      if (isPick) {
        /* One slide per PRODUCT. pickAll ranks size rows, so a listing selling two
           qualifying ounces at different prices would occupy two slides, which is
           the same thing to look at twice. The best-value row wins the slide and
           that slide's dropdown still offers the product's other rows, so nothing
           is lost. Deduping before the cap also means ten slides really are ten
           different products. */
        const ranked = pickAll(list, pickOpts);
        const seenProduct = new Set();
        candidates = ranked.filter((c) => {
          if (seenProduct.has(c.product.id)) return false;
          seenProduct.add(c.product.id);
          return true;
        }).slice(0, PICK_POOL);
        pool = candidates.length;
        const wanted = parseInt(req.query && req.query.i, 10);
        rank = Number.isInteger(wanted) && wanted > 0 ? Math.min(wanted, pool - 1) : 0;
        const chosen = candidates[rank];
        if (chosen) { product = chosen.product; chosenIndex = chosen.index; }
      } else {
        product = list.find((p) => p && p.id === rawId) || null;
      }
    }
  } catch {
    product = null;
  }

  if (!product) {
    /* A pick that found nothing is not a broken link, it is an honest "nothing
       qualifies", so it answers 200 with a real page rather than a 404. */
    return isPick
      ? res.status(200).send(noPick(canonical, pickOpts))
      : res.status(404).send(notFound(canonical));
  }

  /* ---- one slide ----
   * Everything the page shows for a single product, built server side so the
   * slideshow can swap slides without another round trip and without duplicating
   * the lab panel's honesty rules in the client. */
  function buildSlide(prod, rowIndex, marked) {
    const cur = prod.cur || 'USD';
    const head = rowIndex != null && Array.isArray(prod.sizes) && prod.sizes[rowIndex]
      ? (function (row) {
          const g = Number(row[2]);
          return {
            price: Number(row[1]),
            weight: weightLabel(g) || String(row[0] || ''),
            perG: g > 0 ? Math.round((Number(row[1]) / g) * 100) / 100 : prod.perG,
          };
        })(prod.sizes[rowIndex])
      : headline(prod);

    const rows = (Array.isArray(prod.sizes) ? prod.sizes : [])
      .map((row, i) => ({ i, row }))
      .filter(({ row }) => isFinite(Number(row && row[1])) && Number(row[1]) > 0)
      .map(({ i, row }) => {
        const price = Number(row[1]);
        const grams = Number(row[2]);
        /* The row's own label, which on multi-strain listings is the strain and
           grade. It is the only thing distinguishing one row from another, so it
           leads and the normalised weight follows only when not already stated. */
        const variant = String(row[0] || '').trim();
        const label = weightLabel(grams) || String(row[0] || 'One size');
        return {
          i,
          label,
          display: variant
            ? (saysWeightAlready(variant, label) ? variant : variant + ' · ' + label)
            : label,
          price,
          perG: grams > 0 ? Math.round((price / grams) * 100) / 100 : null,
          isPick: marked && i === rowIndex,
          item: cartItem(prod, i),
        };
      });

    /* A product can carry a headline price with no priced size rows at all.
       headline() falls back to sale/startsAt, so the page would show a price the
       gate could never let anyone add. The site's own addToCart covers that case
       with a "One Size" line, so offer exactly that. Raised on PR #23. */
    if (!rows.length && Number(head.price) > 0) {
      rows.push({
        i: -1,
        label: head.weight || 'One size',
        display: head.weight || 'One size',
        price: Number(head.price),
        perG: head.perG || null,
        isPick: false,
        item: cartItem(prod, null),
      });
    }

    const priceText = head.price != null ? money(head.price, cur) : '';
    return {
      pid: prod.id,
      name: String(prod.name || ''),
      store: String(prod.store || ''),
      img: httpsOnly(prod.image, FALLBACK_IMG),
      priceText,
      weight: head.weight || '',
      perG: head.perG || null,
      desc: description(prod, head),
      ogTitle: priceText
        ? `${prod.name} ${head.weight ? '(' + head.weight + ') ' : ''}${priceText}`
        : String(prod.name || 'Legal-Leaf Market'),
      lab: labPanel(prod),
      sizes: rows,
      canAdd: rows.length > 0,
      cur,
      size: rows.length ? (rows.find((r) => r.isPick) || rows[0]).item.size : '',
      value: head.price != null ? Number(head.price) : null,
    };
  }

  /* The pick is a slideshow over the qualifying pool; a plain /p/<id> is a single
     slide with no controls. */
  const slides = isPick && candidates.length
    ? candidates.map((c) => buildSlide(c.product, c.index, true))
    : [buildSlide(product, chosenIndex, false)];
  const slide = slides[isPick ? rank : 0] || slides[0];
  const total = slides.length;

  const optionsFor = (sl) => sl.sizes.map((r) => {
    const bits = [r.display, money(r.price, sl.cur)];
    if (r.perG) bits.push(money(r.perG, sl.cur) + '/g');
    if (r.isPick) bits.push('this week\'s pick');
    return `<option value="${r.i}">${esc(bits.join(' · '))}</option>`;
  }).join('');

  const payload = JSON.stringify({
    slides: slides.map((sl) => ({
      pid: sl.pid, name: sl.name, store: sl.store, img: sl.img, priceText: sl.priceText,
      weight: sl.weight, perG: sl.perG, desc: sl.desc, lab: sl.lab, cur: sl.cur,
      canAdd: sl.canAdd, value: sl.value,
      sizes: sl.sizes.map((r) => ({
        i: r.i, label: r.label, display: r.display, price: r.price, perG: r.perG, item: r.item,
      })),
    })),
    start: isPick ? rank : 0,
    isPick,
  }).replace(/</g, '\\u003c');

  const ogTitle = slide.ogTitle;
  const ogDesc = slide.desc;
  const img = slide.img;

  const body = `<div class="flip" id="flip">
  <div class="inner">
    <div class="face front">
      <img class="shot" id="shot" src="${esc(img)}" alt="${esc(slide.name)}"/>
      ${total > 1 ? `<button class="ov nav prev" id="prev" type="button" aria-label="Previous">&#8249;</button>
      <button class="ov nav next" id="next" type="button" aria-label="Next">&#8250;</button>
      <span class="ov count" id="count">${(isPick ? rank : 0) + 1} of ${total}</span>` : ''}
      <button class="ov flipbtn" id="toBack" type="button">Details and size</button>
    </div>
    <div class="face back">
      <div class="bh">
        <h2>What you are actually getting</h2>
        <button class="flipback" id="toFront" type="button">&#8592; Photo</button>
      </div>
      <div id="pickwrap">
        ${slide.canAdd ? `<div class="pickfield">
          <label for="size">1. Choose your size</label>
          <select id="size">
            <option value="">Select a size...</option>
            ${optionsFor(slide)}
          </select>
          <p class="hint" id="hint2">The price updates once you choose.</p>
        </div>` : `<p class="caution">This store has not published a buyable size for this
        product, so it cannot be added to a cart here. The comparison below still has it.</p>`}
      </div>
      <h2 style="font-size:13px;color:var(--muted);margin:14px 0 6px">2. What the lab found</h2>
      <div id="labwrap">${slide.lab}</div>
      <button class="flipback wide" id="toFront2" type="button">&#8592; Back to the photo</button>
    </div>
  </div>
</div>
<h1 id="pname">${esc(slide.name)}</h1>
<div class="price" id="price">${esc(slide.priceText)}${slide.weight ? ' <span class="meta">' + esc(slide.weight) + '</span>' : ''}</div>
<p class="meta" id="pdesc">${esc(slide.desc)}</p>
<p class="hint" id="hint">${slide.canAdd
  ? 'Tap "Details and size" to see the lab numbers and pick your size.'
  : 'Tap "Details and size" for the lab numbers.'}</p>
<button class="buy" id="add" type="button"${slide.canAdd ? '' : ' hidden'}>Add to cart</button>
<a class="alt" href="${SITE}/consumables">Compare every store on Legal-Leaf Market</a>
<p class="fine" id="fine">Price and stock come from ${esc(slide.store)}'s own feed and can move without notice.
Legal-Leaf Market does not take the order or hold the stock. Ranking is never affected by commission.</p>
<script>
(function(){
  var D = ${payload};
  var at = D.start;
  var flip = document.getElementById('flip');
  var sel = document.getElementById('size');
  var add = document.getElementById('add');
  var hint = document.getElementById('hint');
  var priceEl = document.getElementById('price');

  function cur(){ return D.slides[at]; }
  function money(n, c){
    if (typeof n !== 'number' || !isFinite(n)) return '';
    return (c === 'EUR' ? '\\u20ac' : '$') + (Math.round(n * 100) / 100).toFixed(2).replace(/\\.00$/, '');
  }
  function chosen(){
    var s = document.getElementById('size');
    if (!s || s.value === '') return null;
    var i = parseInt(s.value, 10), z = cur().sizes;
    for (var k = 0; k < z.length; k++) if (z[k].i === i) return z[k];
    return null;
  }

  function setFlipped(on){
    flip.classList.toggle('flipped', !!on);
    var s = document.getElementById('size');
    if (!on || !s) return;
    /* Bring the card on screen before focusing. Add to cart sits below the card,
       so on a short viewport the shopper has already scrolled past it, and a bare
       focus with preventScroll left the dropdown above the fold: glowing exactly
       where nobody could see it. Measured at 1280x720: scrollY 329, y -229. */
    try { flip.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    catch (e) { flip.scrollIntoView(); }
    setTimeout(function(){ try { s.focus({ preventScroll: true }); } catch (e) { s.focus(); } }, 260);
  }

  function wireSelect(){
    var s = document.getElementById('size');
    if (!s) return;
    s.addEventListener('change', function(){
      s.classList.remove('needs');
      var c = chosen(), sl = cur();
      var h2 = document.getElementById('hint2');
      if (!c) { hint.textContent = 'Choose a size to see the exact price.'; hint.className = 'hint'; return; }
      priceEl.innerHTML = '';
      priceEl.appendChild(document.createTextNode(money(c.price, sl.cur)));
      var w = document.createElement('span');
      w.className = 'meta';
      w.textContent = ' ' + c.label + (c.perG ? ' \\u00b7 ' + money(c.perG, sl.cur) + ' per gram' : '');
      priceEl.appendChild(w);
      if (add) add.textContent = 'Add ' + c.label + ' for ' + money(c.price, sl.cur) + ' to cart';
      hint.textContent = 'Adding ' + c.display + ', ' + money(c.price, sl.cur) + ', from ' + sl.store + '.';
      hint.className = 'hint';
      if (h2) h2.textContent = 'Ready. Flip back or add it now.';
      try { LL.track('size_selected', { size: c.label, value: c.price }); } catch (e) {}
    });
  }
  wireSelect();

  /* ---- the slideshow ----
   * Slides swap in place rather than reloading, so moving through the ten picks is
   * instant. The selection is reset on every move: carrying a choice from one
   * product to the next is how somebody ends up adding a thing they never saw. */
  function optionHtml(sl){
    var out = '\\u003coption value=""\\u003eSelect a size...\\u003c/option\\u003e';
    for (var k = 0; k < sl.sizes.length; k++) {
      var r = sl.sizes[k];
      var bits = [r.display, money(r.price, sl.cur)];
      if (r.perG) bits.push(money(r.perG, sl.cur) + '/g');
      if (r.isPick) bits.push("this week's pick");
      var o = document.createElement('option');
      o.value = String(r.i);
      o.textContent = bits.join(' \\u00b7 ');
      out += o.outerHTML;
    }
    return out;
  }

  function render(){
    var sl = cur();
    document.getElementById('shot').src = sl.img;
    document.getElementById('shot').alt = sl.name;
    document.getElementById('pname').textContent = sl.name;
    priceEl.innerHTML = '';
    priceEl.appendChild(document.createTextNode(sl.priceText));
    if (sl.weight) {
      var w = document.createElement('span');
      w.className = 'meta';
      w.textContent = ' ' + sl.weight;
      priceEl.appendChild(w);
    }
    document.getElementById('pdesc').textContent = sl.desc;
    document.getElementById('labwrap').innerHTML = sl.lab;
    document.getElementById('fine').textContent = 'Price and stock come from ' + sl.store +
      "'s own feed and can move without notice. Legal-Leaf Market does not take the order or " +
      'hold the stock. Ranking is never affected by commission.';

    var wrap = document.getElementById('pickwrap');
    if (sl.canAdd) {
      wrap.innerHTML = '\\u003cdiv class="pickfield"\\u003e\\u003clabel for="size"\\u003e1. Choose your size\\u003c/label\\u003e' +
        '\\u003cselect id="size"\\u003e' + optionHtml(sl) + '\\u003c/select\\u003e' +
        '\\u003cp class="hint" id="hint2"\\u003eThe price updates once you choose.\\u003c/p\\u003e\\u003c/div\\u003e';
      wireSelect();
    } else {
      wrap.innerHTML = '\\u003cp class="caution"\\u003eThis store has not published a buyable size for this ' +
        'product, so it cannot be added to a cart here. The comparison below still has it.\\u003c/p\\u003e';
    }
    if (add) {
      add.hidden = !sl.canAdd;
      add.disabled = false;
      add.textContent = 'Add to cart';
    }
    hint.className = 'hint';
    hint.textContent = sl.canAdd
      ? 'Tap "Details and size" to see the lab numbers and pick your size.'
      : 'Tap "Details and size" for the lab numbers.';

    var c = document.getElementById('count');
    if (c) c.textContent = (at + 1) + ' of ' + D.slides.length;

    /* Keep the URL in step so a slide can still be shared, without adding a
       history entry per tap. */
    try {
      var q = new URLSearchParams(location.search);
      q.set('i', String(at));
      history.replaceState(null, '', location.pathname + '?' + q.toString());
    } catch (e) {}
  }

  function go(delta){
    var n = D.slides.length;
    if (n < 2) return;
    var from = at;
    at = (at + delta + n) % n;
    setFlipped(false);
    render();
    try { LL.track('slide', { from: from, to: at, pid: cur().pid }); } catch (e) {}
  }

  var prev = document.getElementById('prev');
  var next = document.getElementById('next');
  if (prev) prev.addEventListener('click', function(){ go(-1); });
  if (next) next.addEventListener('click', function(){ go(1); });

  document.addEventListener('keydown', function(e){
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  });

  /* Swipe, since this lands on a phone from a DM. Only a clearly horizontal drag
     counts, or scrolling the page would flick through the slides. */
  var x0 = null, y0 = null;
  var frontFace = flip.querySelector('.front');
  frontFace.addEventListener('touchstart', function(e){
    if (e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  frontFace.addEventListener('touchend', function(e){
    if (x0 == null || !e.changedTouches.length) return;
    var dx = e.changedTouches[0].clientX - x0;
    var dy = e.changedTouches[0].clientY - y0;
    x0 = y0 = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? 1 : -1);
  }, { passive: true });

  document.getElementById('toBack').addEventListener('click', function(){ setFlipped(true); });
  document.getElementById('toFront').addEventListener('click', function(){ setFlipped(false); });
  document.getElementById('toFront2').addEventListener('click', function(){ setFlipped(false); });

  if (add) add.addEventListener('click', function(){
    var c = chosen(), s = document.getElementById('size');
    /* Nobody adds a mystery item to a cart. No selection means walk them to the
       choice rather than guessing on their behalf. */
    if (!c) {
      setFlipped(true);
      if (s) s.classList.add('needs');
      hint.textContent = 'Choose a size first, so you know exactly what you are adding.';
      hint.className = 'hint warn';
      var h2 = document.getElementById('hint2');
      if (h2) h2.textContent = 'Pick one of these, then add to cart.';
      try { LL.track('add_blocked_no_size', {}); } catch (e) {}
      return;
    }
    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('ll_cart')) || []; } catch (e) { cart = []; }
    cart.push(c.item);
    try { localStorage.setItem('ll_cart', JSON.stringify(cart)); } catch (e) {}
    try { LL.track('add_to_cart', { store: c.item.store, storeKey: c.item.storeKey,
      product: c.item.name, size: c.label, value: c.item.price, cur: c.item.cur }); } catch (e) {}
    add.textContent = 'Added, opening your cart...';
    add.disabled = true;
    location.href = ${JSON.stringify(SITE + '/consumables#cart')};
  });
})();
<\/script>`;

  return res.status(200).send(
    page({
      title: ogTitle + ': Legal-Leaf Market',
      ogTitle,
      ogDesc,
      ogImage: img,
      canonical,
      body,
      track: {
        page: isPick ? 'pick' : 'share',
        rank: isPick ? rank : null,
        of: isPick ? pool : null,
        pid: product.id,
        store: product.store,
        storeKey: product.storeKey,
        size: slide.size,
        value: slide.value,
        perG: slide.perG,
        cur: slide.cur,
      },
    })
  );
}

// Exported for tests. Not part of the route contract.
export const __test = { esc, httpsOnly, money, weightLabel, headline, description, cartItem, pickBest, pickAll, PICK_POOL, saysWeightAlready, namesAnOunce, ounceRowOverCap };
