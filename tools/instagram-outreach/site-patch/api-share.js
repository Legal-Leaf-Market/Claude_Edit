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
/* Every qualifying size row, best value first. Shuffle walks this list, so the
   pool is capped: the 40th best ounce is not a deal worth showing anybody. */
var PICK_POOL = 12;

function pickAll(list, opts, limit) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (!p || p.inStock === false) continue;
    if (opts.category && p.category !== opts.category) continue;
    var sizes = Array.isArray(p.sizes) ? p.sizes : [];
    for (var j = 0; j < sizes.length; j++) {
      var price = Number(sizes[j] && sizes[j][1]);
      var grams = Number(sizes[j] && sizes[j][2]);
      if (!isFinite(price) || price <= 0) continue;
      if (!isFinite(grams) || grams < opts.minGrams) continue;
      if (opts.maxGrams && grams > opts.maxGrams) continue;
      if (price > opts.maxPrice) continue;
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
.shot{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:14px;border:1px solid var(--line);background:#f2f3f5}
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
    /* An ounce is 28g, and stores label it 28 to 31. The band excludes a half
       (14g) below and two ounces (56g) above, so "the ounce pick" is an ounce. */
    minGrams: Number(req.query && req.query.g) > 0 ? Number(req.query.g) : 25,
    maxGrams: Number(req.query && req.query.gmax) > 0 ? Number(req.query.gmax) : 40,
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
        const candidates = pickAll(list, pickOpts, PICK_POOL);
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

  const h = chosenIndex != null && Array.isArray(product.sizes) && product.sizes[chosenIndex]
    ? (function (row) {
        return {
          price: Number(row[1]),
          weight: weightLabel(Number(row[2])) || row[0] || '',
          perG: Number(row[2]) > 0 ? Math.round((Number(row[1]) / Number(row[2])) * 100) / 100 : product.perG,
        };
      })(product.sizes[chosenIndex])
    : headline(product);
  const img = httpsOnly(product.image, FALLBACK_IMG);
  const priceText = h.price != null ? money(h.price, product.cur) : '';
  const ogTitle = priceText
    ? `${product.name} ${h.weight ? '(' + h.weight + ') ' : ''}${priceText}`
    : String(product.name || 'Legal-Leaf Market');
  const ogDesc = description(product, h);

  // This page adds no flow of its own. It has the one action the product cards on
  // /consumables already have, Add to cart, writing the identical item shape into
  // the identical ll_cart key, then hands over to /consumables where the existing
  // drawer and per-store checkout take it from there. That is what keeps the
  // shopper on our domain: the vendor link is reached through our cart, the same
  // way it is everywhere else on the site, not as a shortcut out of here.
  const item = cartItem(product, chosenIndex);
  const itemJson = JSON.stringify(item).replace(/</g, '\\u003c');

  const body = `<img class="shot" src="${esc(img)}" alt="${esc(product.name)}"/>
<h1>${esc(product.name)}</h1>
<div class="price">${esc(priceText)}${h.weight ? ' <span class="meta">' + esc(h.weight) + '</span>' : ''}</div>
<p class="meta">${esc(ogDesc)}</p>
<button class="buy" id="add" type="button">Add to cart</button>
${isPick && pool > 1 ? `<button class="alt" id="shuf" type="button">Shuffle a different ounce under ${esc(money(pickOpts.maxPrice))} (${rank + 1} of ${pool})</button>` : ''}
<a class="alt" href="${SITE}/consumables">Compare every store on Legal-Leaf Market</a>
<p class="fine">Price and stock come from ${esc(product.store)}'s own feed and can move without notice.
Legal-Leaf Market does not take the order or hold the stock. Ranking is never affected by commission.</p>
<script>
(function(){
  // Same key and same item shape as addToCart() in consumables.html. If that
  // shape changes, this has to change with it or the drawer will render a
  // half-populated line.
  var ITEM = ${itemJson};
  var btn = document.getElementById('add');
  btn.addEventListener('click', function(){
    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('ll_cart')) || []; } catch(e) { cart = []; }
    cart.push(ITEM);
    try { localStorage.setItem('ll_cart', JSON.stringify(cart)); } catch(e) {}
    try { LL.track('add_to_cart', {store:ITEM.store, storeKey:ITEM.storeKey, product:ITEM.name, value:ITEM.price, cur:ITEM.cur}); } catch(e) {}
    btn.textContent = 'Added, opening your cart...';
    btn.disabled = true;
    location.href = ${JSON.stringify(SITE + '/consumables#cart')};
  });

  /* Shuffle moves to another rank in the same qualifying pool, so every result is
     still an ounce inside the cap. It preserves the query string, otherwise a
     custom cap or band would be silently dropped on the first shuffle. */
  var shuf = document.getElementById('shuf');
  if (shuf) {
    var POOL = ${pool}, RANK = ${rank};
    shuf.addEventListener('click', function () {
      var next = RANK;
      if (POOL > 1) { while (next === RANK) next = Math.floor(Math.random() * POOL); }
      try { LL.track('shuffle', { from: RANK, to: next }); } catch (e) {}
      var q = new URLSearchParams(location.search);
      q.set('i', String(next));
      location.href = location.pathname + '?' + q.toString();
    });
  }
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
        size: item.size,
        value: Number(item.price) || null,
        perG: h.perG || null,
        cur: item.cur,
      },
    })
  );
}

// Exported for tests. Not part of the route contract.
export const __test = { esc, httpsOnly, money, weightLabel, headline, description, cartItem, pickBest, pickAll, PICK_POOL };
