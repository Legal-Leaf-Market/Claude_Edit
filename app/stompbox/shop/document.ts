/**
 * THE SHOP PAGE, AS A LITERAL DOCUMENT.
 *
 * Same arrangement as its two neighbours: one self-contained HTML document
 * served verbatim by the route handler beside it.
 *
 * It imports nothing and holds no credential. The listings arrive from
 * `/api/reverb/shop`, which is where the token lives, so the guide's tree
 * stays credential free and `tests/stompbox/boundary.test.ts` is untouched.
 *
 * REGENERATE, DO NOT HAND EDIT.
 */
export const SHOP_HTML = `<!doctype html>
<html lang="en">
<head>
<title>Our Shop | Stompbox World</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Every pedal we currently have for sale, live from our Reverb shop. Photographed, tested and shipped by us.">
<meta property="og:title" content="Our Shop | Stompbox World">
<meta property="og:description" content="Every pedal we currently have for sale, live from our Reverb shop.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=&apos;http://www.w3.org/2000/svg&apos; viewBox=&apos;0 0 32 32&apos;%3E%3Crect width=&apos;32&apos; height=&apos;32&apos; rx=&apos;5&apos; fill=&apos;%231c3a63&apos;/%3E%3Crect x=&apos;3.5&apos; y=&apos;3.5&apos; width=&apos;25&apos; height=&apos;25&apos; rx=&apos;3.5&apos; fill=&apos;none&apos; stroke=&apos;%23fff&apos; stroke-width=&apos;1.6&apos;/%3E%3Ccircle cx=&apos;16&apos; cy=&apos;20&apos; r=&apos;5&apos; fill=&apos;none&apos; stroke=&apos;%23fff&apos; stroke-width=&apos;2.2&apos;/%3E%3Ccircle cx=&apos;16&apos; cy=&apos;9.5&apos; r=&apos;1.8&apos; fill=&apos;%233fe07c&apos;/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">

<style>
/* Stompbox World's system. Dark by default, and not by media query: the
   chrome edge and the LED only carry against the navy ground, so somebody
   whose laptop is in light mode still gets the site as designed. */
:root {
  --ground:#08121f; --panel:#0e1e33; --panel-2:#132845; --sunk:#060e18;
  --metal:#1c3a63; --metal-hi:#27508a; --chrome:#ffffff;
  --edge:rgba(255,255,255,.13); --edge-hi:rgba(255,255,255,.30); --edge-accent:#7f9ec4;
  --text:#e6eefb; --text-dim:#93a8c6; --text-faint:#63799a;
  --led:#3fe07c; --led-glow:rgba(63,224,124,.20); --accent-text:#79e2a4;
  --warn:#e8b451; --radius:4px; color-scheme:dark;
  --display:"Chakra Petch","Arial Narrow",system-ui,sans-serif;
  --ui:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
}
:root[data-theme="light"] {
  --ground:#e7ecf3; --panel:#ffffff; --panel-2:#f1f4f9; --sunk:#dbe2ec;
  --edge:rgba(12,26,46,.14); --edge-hi:rgba(12,26,46,.30); --edge-accent:#2b4a7c;
  --text:#0c1a2e; --text-dim:#52678a; --text-faint:#7b8dab;
  --led:#12874a; --led-glow:rgba(18,135,74,.13); --accent-text:#0f7a41; --warn:#8a5d00;
  color-scheme:light;
}
@media (prefers-color-scheme: light) {
  :root[data-theme="system"] {
    --ground:#e7ecf3; --panel:#ffffff; --panel-2:#f1f4f9; --sunk:#dbe2ec;
    --edge:rgba(12,26,46,.14); --edge-hi:rgba(12,26,46,.30); --edge-accent:#2b4a7c;
    --text:#0c1a2e; --text-dim:#52678a; --text-faint:#7b8dab;
    --led:#12874a; --led-glow:rgba(18,135,74,.13); --accent-text:#0f7a41; --warn:#8a5d00;
    color-scheme:light;
  }
}

*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:var(--ground);color:var(--text);font-family:var(--ui);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:940px;margin:0 auto;padding:20px 18px 80px}

/* --- masthead ------------------------------------------------------- */
.mast{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--edge)}
.brand{display:inline-flex;align-items:center;gap:9px;text-decoration:none}
.brand .mark{width:23px;height:23px;flex:0 0 auto}
.brandname{font-family:var(--display);font-size:12.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--text-dim);transition:color .12s}
.brand:hover .brandname{color:var(--text)}
.lp{width:50px;height:46px;padding:0;background:linear-gradient(180deg,var(--metal-hi),var(--metal));border:1px solid var(--edge-hi);border-radius:var(--radius);color:var(--chrome);cursor:pointer;font-family:var(--display);font-size:9.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;display:grid;place-items:center;gap:3px;transition:transform .08s}
.lp:active{transform:translateY(2px)}
.lp b{display:block;width:20px;height:4px;border-radius:3px;background:var(--chrome);opacity:.85}

/* --- hero ----------------------------------------------------------- */
.hero{padding:30px 0 24px}
.hero h1{font-family:var(--display);font-weight:700;font-size:clamp(30px,6vw,46px);line-height:1.06;letter-spacing:.01em;margin:0;text-transform:uppercase;text-wrap:balance}
.hero h1 span{color:var(--led)}
.hero .lede{margin:12px 0 0;font-size:17px;color:var(--text-dim);max-width:56ch}
.trust{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.trust li{list-style:none;display:flex;align-items:center;gap:7px;font-family:var(--display);font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--text-dim);border:1px solid var(--edge);border-radius:999px;padding:6px 13px 6px 10px}
.trust li::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--led);box-shadow:0 0 7px var(--led-glow);flex:0 0 auto}
.trust{padding:0;margin-left:0}

/* --- step blocks ---------------------------------------------------- */
.step{margin-top:30px}
.step-head{display:flex;align-items:center;gap:11px;margin-bottom:13px}
.step-n{flex:0 0 auto;width:27px;height:27px;border-radius:50%;background:var(--metal);border:1px solid var(--edge-hi);color:var(--chrome);display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:13px}
.step-head h2{font-family:var(--display);font-weight:700;font-size:19px;letter-spacing:.03em;text-transform:uppercase;margin:0}
.step-head .hint{margin-left:auto;font-size:13px;color:var(--text-faint)}

.card{background:var(--panel);border:1px solid var(--edge);border-radius:var(--radius);padding:16px}

/* --- item rows ------------------------------------------------------ */
.items{display:flex;flex-direction:column;gap:11px}
.item{display:grid;gap:9px;grid-template-columns:1fr 1fr 150px 38px;align-items:end;padding-bottom:11px;border-bottom:1px solid var(--edge)}
.item:last-of-type{border-bottom:0;padding-bottom:0}
@media (max-width:720px){.item{grid-template-columns:1fr 1fr;}.item .f-cond{grid-column:1/2}.item .drop{grid-column:2/3;justify-self:end}}
.f{display:flex;flex-direction:column;gap:5px;min-width:0}
.f label{font-family:var(--display);font-size:10px;font-weight:600;letter-spacing:.11em;text-transform:uppercase;color:var(--text-dim)}
input[type="text"],select{width:100%;font-family:var(--ui);font-size:15px;color:var(--text);background:var(--sunk);border:1px solid var(--edge);border-radius:var(--radius);padding:10px 11px;caret-color:var(--led);appearance:none}
select{background-image:linear-gradient(180deg,var(--metal-hi),var(--metal));border-color:var(--edge-hi);color:#f2f5f8;font-family:var(--display);font-weight:600;letter-spacing:.03em;font-size:13px;text-transform:uppercase;cursor:pointer}
input::placeholder{color:var(--text-faint)}
input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--led);outline-offset:2px}
.drop button{width:38px;height:40px;background:transparent;border:1px solid var(--edge);border-radius:var(--radius);color:var(--text-faint);font-size:17px;cursor:pointer;line-height:1}
.drop button:hover{border-color:var(--warn);color:var(--warn)}
.match{grid-column:1/-1;font-size:12.5px;color:var(--text-faint);margin-top:-3px}
.match.hit{color:var(--accent-text)}
.match.hand{color:var(--warn)}

.rowbtns{display:flex;gap:9px;margin-top:14px;flex-wrap:wrap}
.mini{font-family:var(--display);font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--text-dim);background:transparent;border:1px solid var(--edge);border-radius:3px;padding:9px 13px;cursor:pointer;transition:border-color .12s,color .12s}
.mini:hover{border-color:var(--edge-accent);color:var(--text)}
.mini.copied{border-color:var(--led);color:var(--accent-text)}

/* --- the three offers ----------------------------------------------- */
.offers{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.offer{background:var(--panel);border:1px solid var(--edge);border-top:3px solid var(--edge-accent);border-radius:var(--radius);padding:16px;display:flex;flex-direction:column;gap:3px}
.offer.best{border-top-color:var(--led)}
.offer .tag{font-family:var(--display);font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint)}
.offer.best .tag{color:var(--accent-text)}
.offer .amt{font-family:var(--display);font-weight:700;font-size:clamp(26px,5vw,34px);letter-spacing:.01em;font-variant-numeric:tabular-nums;line-height:1.1}
.offer .sub{font-size:13.5px;color:var(--text-dim)}
.offer .why{font-size:13px;color:var(--text-faint);margin-top:7px;border-top:1px solid var(--edge);padding-top:9px}

.estimate{margin-top:13px;background:var(--sunk);border:1px solid var(--edge);border-left:2px solid var(--warn);border-radius:var(--radius);padding:12px 14px;font-size:13.5px;color:var(--text-dim)}
.estimate b{color:var(--text);font-weight:600}

/* --- summary / send -------------------------------------------------- */
.summary{width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.5;color:var(--text);background:var(--sunk);border:1px solid var(--edge);border-radius:var(--radius);padding:13px;resize:vertical;min-height:150px;caret-color:var(--led)}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
.stomp{--stomp-ink:#f2f6fc;font-family:var(--display);font-size:14px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--stomp-ink);background:linear-gradient(180deg,var(--metal-hi),var(--metal));border:1px solid var(--edge-hi);border-radius:var(--radius);padding:15px 22px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:9px;transition:transform .08s,border-color .12s}
.stomp:hover{border-color:var(--chrome)}
.stomp:active{transform:translateY(2px)}
.stomp.lit{border-color:var(--led);box-shadow:0 0 0 1px var(--led-glow)}
.fineprint{margin-top:12px;font-size:13px;color:var(--text-faint);max-width:66ch}

/* --- our own shop ---------------------------------------------------- */
.shop{margin-top:34px}
.shop-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(158px,1fr))}
.shop-card{display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--edge);border-radius:var(--radius);overflow:hidden;text-decoration:none;color:inherit;transition:border-color .12s,transform .12s}
.shop-card:hover{border-color:var(--edge-accent);transform:translateY(-2px)}
.shop-card .shot{aspect-ratio:1;background:var(--sunk);display:block;width:100%;object-fit:contain}
.shop-card .meta{padding:10px 11px 12px;display:flex;flex-direction:column;gap:4px;flex:1}
.shop-card .t{font-size:13px;line-height:1.3;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.shop-card .row{margin-top:auto;display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding-top:6px}
.shop-card .p{font-family:var(--display);font-weight:700;font-size:16px;color:var(--text);font-variant-numeric:tabular-nums}
.shop-card .c{font-family:var(--display);font-size:9.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint)}
.shop-more{margin-top:13px;font-size:13.5px;color:var(--text-faint)}
.shop-more a{color:var(--accent-text)}

.sitefoot{margin-top:44px;padding-top:16px;border-top:1px solid var(--edge);display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-family:var(--display);font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint)}
.sitefoot .mark{width:16px;height:16px}
.sitefoot .dot{opacity:.5}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<style>
/* The shop is a grid and almost nothing else, so it gets a little more room
   per card than the strip on the quote page does. */
.shopwrap{max-width:1120px}
.count{font-family:var(--display);font-size:11px;font-weight:600;letter-spacing:.11em;text-transform:uppercase;color:var(--text-dim);border:1px solid var(--edge);border-radius:999px;padding:6px 13px;display:inline-block}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));margin-top:26px}
.card{display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--edge);border-radius:var(--radius);overflow:hidden;text-decoration:none;color:inherit;transition:border-color .12s,transform .12s}
.card:hover{border-color:var(--edge-accent);transform:translateY(-2px)}
.card:focus-visible{outline:2px solid var(--led);outline-offset:2px}
.card .shot{aspect-ratio:1;width:100%;object-fit:contain;background:var(--sunk);display:block}
.card .noshot{aspect-ratio:1;background:var(--sunk);display:grid;place-items:center;color:var(--text-faint);font-family:var(--display);font-size:10px;letter-spacing:.12em;text-transform:uppercase}
.card .meta{padding:12px 13px 13px;display:flex;flex-direction:column;gap:5px;flex:1}
.card .t{font-size:13.5px;line-height:1.35;color:var(--text)}
.card .row{margin-top:auto;display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding-top:8px;border-top:1px solid var(--edge)}
.card .p{font-family:var(--display);font-weight:700;font-size:19px;color:var(--text);font-variant-numeric:tabular-nums}
.card .c{font-family:var(--display);font-size:9.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint)}
.state{margin-top:30px;padding:22px;background:var(--panel);border:1px solid var(--edge);border-radius:var(--radius);color:var(--text-dim);font-size:15px;text-align:center}
.state b{display:block;color:var(--text);font-family:var(--display);font-size:16px;letter-spacing:.03em;text-transform:uppercase;margin-bottom:6px}
.crosslink{margin-top:34px;padding:18px 20px;background:var(--panel);border:1px solid var(--edge);border-left:2px solid var(--led);border-radius:var(--radius)}
.crosslink h3{font-family:var(--display);font-size:16px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;margin:0 0 5px}
.crosslink p{margin:0 0 12px;color:var(--text-dim);font-size:14.5px;max-width:58ch}
</style>
</head>
<body>
<script>
(function(){var t="dark";try{var v=localStorage.getItem("stompbox-sell/theme");
if(v==="light"||v==="system")t=v}catch(e){}
document.documentElement.setAttribute("data-theme",t)})();
</script>

<div class="wrap shopwrap">
  <header class="mast">
    <a class="brand" href="https://stompbox.world">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect x="1.6" y="1.6" width="28.8" height="28.8" rx="4.5" fill="var(--metal)" stroke="var(--chrome)" stroke-width="1.5"/>
        <circle cx="16" cy="20" r="5.2" fill="none" stroke="var(--chrome)" stroke-width="2"/>
        <circle cx="16" cy="9" r="1.9" fill="var(--led)"/>
      </svg>
      <span class="brandname">Stompbox World</span>
    </a>
    <button class="lp" id="theme" aria-label="Cycle theme"><b></b><span id="themeLabel">Dark</span></button>
  </header>

  <section class="hero">
    <h1>Our <span>shop</span></h1>
    <p class="lede">Every pedal we have for sale right now. Photographed, tested and shipped by us, and sold through our Reverb shop so you get their buyer protection.</p>
    <p><span class="count" id="count">Loading</span>
      <button class="mini" id="refresh" style="margin-left:8px">Refresh</button></p>
  </section>

  <div class="grid" id="grid" hidden></div>
  <div class="state" id="state"><b>Loading the shop</b>One moment.</div>

  <section class="crosslink">
    <h3>Got pedals to sell?</h3>
    <p>We buy and consign. Price your own lot in about a minute and see cash, store credit and consignment side by side. No minimum, and we take one pedal as happily as a whole board.</p>
    <a class="stomp lit" href="/buymyboard">Sell us your pedals</a>
  </section>

  <footer class="sitefoot">
    <svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1.6" y="1.6" width="28.8" height="28.8" rx="4.5" fill="var(--metal)" stroke="var(--chrome)" stroke-width="1.5"/>
      <circle cx="16" cy="20" r="5.2" fill="none" stroke="var(--chrome)" stroke-width="2"/>
      <circle cx="16" cy="9" r="1.9" fill="var(--led)"/>
    </svg>
    <span>Stompbox World</span><span class="dot">&middot;</span>
    <span id="footShop">Live from our Reverb shop</span>
  </footer>
</div>

<script type="module">
const $ = id => document.getElementById(id);
const SHOP_URL = "https://reverb.com/shop/deans-boutique-505";

function card(row) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = row.url; a.target = "_blank"; a.rel = "noopener";

  if (row.photo) {
    const img = document.createElement("img");
    img.className = "shot"; img.src = row.photo; img.alt = row.title;
    img.loading = "lazy"; img.decoding = "async";
    /* A dead image link leaves a broken glyph, which reads as a broken shop.
       Swap it for an honest placeholder instead. */
    img.addEventListener("error", () => {
      const ph = document.createElement("div");
      ph.className = "noshot"; ph.textContent = "No photo";
      img.replaceWith(ph);
    });
    a.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "noshot"; ph.textContent = "No photo";
    a.appendChild(ph);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  const t = document.createElement("span");
  t.className = "t"; t.textContent = row.title;
  const rowEl = document.createElement("div");
  rowEl.className = "row";
  const p = document.createElement("span");
  p.className = "p"; p.textContent = row.price || "";
  const c = document.createElement("span");
  c.className = "c"; c.textContent = row.condition || "";
  rowEl.append(p, c);
  meta.append(t, rowEl);
  a.appendChild(meta);
  return a;
}

function say(title, detail) {
  $("state").hidden = false;
  $("state").innerHTML = "";
  const b = document.createElement("b");
  b.textContent = title;
  $("state").append(b, document.createTextNode(detail));
}

/* \`fresh\` bypasses the CDN outright. The cache keys on the whole URL, so a
   unique value is a guaranteed repull for somebody who has just listed
   something and wants to see it now rather than in two minutes. */
async function load(fresh) {
  try {
    const url = fresh ? "/api/reverb/shop?fresh=" + Date.now() : "/api/reverb/shop";
    const res = await fetch(url, { cache: fresh ? "reload" : "default", headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("status " + res.status);
    const data = await res.json();
    const rows = Array.isArray(data.listings) ? data.listings : [];

    if (!rows.length) {
      /* Empty is a real state and gets said plainly. An empty grid under a
         heading reads as broken; "nothing listed right now" does not. */
      $("count").textContent = "Nothing listed";
      say("Nothing in the shop right now",
        "Everything has sold. Check back shortly, or come and sell us something in the meantime.");
      return;
    }

    const grid = $("grid");
    grid.textContent = "";
    for (const row of rows) grid.appendChild(card(row));
    grid.hidden = false;
    $("state").hidden = true;
    $("count").textContent = rows.length + (rows.length === 1 ? " pedal for sale" : " items for sale");
    const link = document.createElement("a");
    link.href = SHOP_URL; link.target = "_blank"; link.rel = "noopener";
    link.textContent = "See it on Reverb";
    $("footShop").textContent = "";
    $("footShop").appendChild(link);
  } catch (_) {
    /* Never a stack trace and never a blank page: say what a reader can do. */
    $("count").textContent = "Unavailable";
    say("The shop is not loading",
      "Our listings live on Reverb and you can browse them there directly while we sort this out.");
    const a = document.createElement("a");
    a.href = SHOP_URL; a.target = "_blank"; a.rel = "noopener";
    a.textContent = " Open our Reverb shop";
    a.style.color = "var(--accent-text)";
    $("state").appendChild(a);
  }
}
load();

$("refresh").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.textContent = "Refreshing";
  btn.disabled = true;
  await load(true);
  btn.textContent = "Refresh";
  btn.disabled = false;
});

const THEMES = ["dark", "light", "system"];
let themeIdx = 0;
try { const i = THEMES.indexOf(localStorage.getItem("stompbox-sell/theme") || ""); if (i >= 0) themeIdx = i; } catch (_) {}
function applyTheme() {
  const t = THEMES[themeIdx];
  document.documentElement.setAttribute("data-theme", t);
  $("themeLabel").textContent = t === "system" ? "Auto" : t === "light" ? "Light" : "Dark";
  try { localStorage.setItem("stompbox-sell/theme", t); } catch (_) {}
}
$("theme").addEventListener("click", () => { themeIdx = (themeIdx + 1) % THEMES.length; applyTheme(); });
applyTheme();
</script>
</body>
</html>
`
