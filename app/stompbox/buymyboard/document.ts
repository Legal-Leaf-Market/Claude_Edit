/**
 * THE SELL PAGE, AS A LITERAL DOCUMENT.
 *
 * Same arrangement as `buymyboard/document.ts` next door and for the same
 * reason: one self-contained HTML document, served verbatim by the route
 * handler beside it, and handed out as a file that runs with no server at
 * all. Two copies of a page this size is section 7's fork with the drift
 * hidden inside sales copy rather than inside an error.
 *
 * It imports nothing, so the guide's credential boundary is untouched: no
 * database, no token, no feed. Every figure is computed in the reader's
 * browser from a price table baked into the page.
 *
 * REGENERATE, DO NOT HAND EDIT. The escaping is mechanical and a hand edit
 * here is how the served page and the handed-out file quietly stop being the
 * same program.
 */
export const BUY_MY_BOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<title>Sell Us Your Pedals | Stompbox World</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Get an instant estimate on your pedals. Cash, store credit or consignment. No minimum, free prepaid shipping label, and we take single pedals as happily as a whole board.">
<meta property="og:title" content="Sell Us Your Pedals | Stompbox World">
<meta property="og:description" content="Instant estimate on your pedals. Cash, store credit worth 20% more, or consignment for the highest return. No minimum order.">
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
</head>
<body>
<script>
/* Before first paint: dark unless somebody chose otherwise. */
(function(){var t="dark";try{var v=localStorage.getItem("stompbox-sell/theme");
if(v==="light"||v==="system")t=v}catch(e){}
document.documentElement.setAttribute("data-theme",t)})();
</script>

<div class="wrap">
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
    <h1>Sell us your <span>pedals</span></h1>
    <p class="lede">Tell us what you have got and see three ways to get paid, right now, before you talk to anybody. One pedal or a whole board, it is the same process either way.</p>
    <ul class="trust">
      <li>No minimum, ever</li>
      <li>Free prepaid label</li>
      <li>We take single pedals</li>
      <li>Paid when it lands</li>
    </ul>
  </section>

  <section class="step">
    <div class="step-head">
      <span class="step-n">1</span>
      <h2>What have you got</h2>
      <span class="hint" id="itemCount">1 item</span>
    </div>
    <div class="card">
      <div class="items" id="items"></div>
      <div class="rowbtns">
        <button class="mini" id="addItem">+ Add another pedal</button>
        <button class="mini" id="clearItems">Start over</button>
      </div>
    </div>
  </section>

  <section class="step">
    <div class="step-head">
      <span class="step-n">2</span>
      <h2>Your three options</h2>
      <span class="hint" id="basis"></span>
    </div>

    <div class="offers">
      <div class="offer" id="oCash">
        <span class="tag">Cash</span>
        <span class="amt" id="amtCash">$0</span>
        <span class="sub">Paid the day it arrives</span>
        <span class="why">Simplest. Money in your account, nothing else to do.</span>
      </div>
      <div class="offer" id="oCredit">
        <span class="tag">Store credit</span>
        <span class="amt" id="amtCredit">$0</span>
        <span class="sub" id="subCredit">20% more than cash</span>
        <span class="why">Spend it on anything we have. Worth taking if you are buying anyway.</span>
      </div>
      <div class="offer best" id="oConsign">
        <span class="tag">Consignment, highest return</span>
        <span class="amt" id="amtConsign">$0</span>
        <span class="sub" id="subConsign">of the final sale price, after fees</span>
        <span class="why">We list it, photograph it and sell it on our Reverb shop. Takes longer, pays the most.</span>
      </div>
    </div>

    <p class="estimate" id="estimateNote"></p>
  </section>

  <section class="step">
    <div class="step-head">
      <span class="step-n">3</span>
      <h2>Send it to us</h2>
    </div>
    <div class="card">
      <textarea class="summary" id="summary" readonly aria-label="Your quote summary"></textarea>
      <div class="cta">
        <a class="stomp lit" id="ctaSend" href="#" target="_blank" rel="noopener">Accept and get a prepaid label</a>
        <button class="mini" id="copySummary">Copy the summary</button>
        <button class="mini" id="copyLink">Copy a link to this quote</button>
      </div>
      <p class="fineprint" id="ctaFine">
        The button copies your quote and opens Messenger. Send it and we will confirm the final
        number, then email you a prepaid label the same day. Nothing is binding until we have both
        agreed, and you keep your gear until you have a label in hand.
      </p>
    </div>
  </section>

  <section class="step shop" id="shop" hidden>
    <div class="step-head">
      <span class="step-n" aria-hidden="true">&#9835;</span>
      <h2>What we have live right now</h2>
      <span class="hint">On our Reverb shop</span>
    </div>
    <div class="shop-grid" id="shopGrid"></div>
    <p class="shop-more">
      This is our own stock, listed and shipped by us. It is here so you can see
      we actually move gear, and it is priced independently of anything you were
      just quoted.
      <a id="shopLink" href="https://reverb.com/shop/deans-boutique-505" target="_blank" rel="noopener">See the whole shop</a>
    </p>
  </section>

  <footer class="sitefoot">
    <svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1.6" y="1.6" width="28.8" height="28.8" rx="4.5" fill="var(--metal)" stroke="var(--chrome)" stroke-width="1.5"/>
      <circle cx="16" cy="20" r="5.2" fill="none" stroke="var(--chrome)" stroke-width="2"/>
      <circle cx="16" cy="9" r="1.9" fill="var(--led)"/>
    </svg>
    <span>Stompbox World</span><span class="dot">&middot;</span>
    <span>Estimates only, confirmed before anything ships</span>
  </footer>
</div>
<script type="module">
/* ===========================================================================
   THE DIALS. Everything commercial is here and nowhere else.
   =========================================================================== */
const OFFER = {
  /* THESE THREE ARE THE RATE CARD, and they are the same three the outreach
     script quotes on /buymyboard. They were 60 / cash+20% / 80-85 here and
     65 / 75 / 90 there, which meant a seller who got a message and then
     visited the site was shown a WORSE number on the site than in the
     message. One set now, and the copy below derives from it rather than
     restating it, so the two cannot drift apart again. */
  cashPct:      0.65,   // cash, as a share of estimated market value
  creditPct:    0.75,   // store credit, as a share of estimated market value
  consignPct:   0.90,   // consignment, as a share of the sale AFTER fees
  feeRate:      0.085,  // marketplace fee, taken off before the consignment split
  minimum:      0,      // THERE IS NO MINIMUM. Left here so it stays a decision.
};

/* Reverb's own condition ladder. The seeds below describe a clean used
   example, so Excellent is 1.00 and everything else moves from there. */
const CONDITION = [
  ["Brand new",      1.15],
  ["Mint",           1.08],
  ["Excellent",      1.00],
  ["Very good",      0.88],
  ["Good",           0.75],
  ["Fair",           0.55],
  ["Poor",           0.38],
  ["Not working",    0.20],
];
const DEFAULT_CONDITION = "Very good";

/* Where "send it to us" goes. A Messenger handle cannot carry prefilled
   text, which is why the summary is copied first and the button says so.
   EMPTY IS A SUPPORTED STATE: an unset handle turns the button into a copy
   action rather than a link to nowhere, because a dead CTA on a live page is
   worse than an honest one. Set it and the link comes back. */
const MESSENGER = "";

/* ===========================================================================
   THE PRICE TABLE.

   Generated from the same table the outreach tool uses, so the number a
   seller is quoted and the number we work from are one number. It is a
   STARTING POINT for a clean example, not a valuation: 81 of these carry a
   figure and 31 deliberately do not, because a pedal whose vintage and
   reissue versions are worlds apart has no single honest ballpark. Those
   come back as "priced by hand" rather than as a guess, which is the whole
   reason this page can quote anything at all without lying.
   =========================================================================== */
const GEAR = [["DOD Boneshaker","boneshaker","",95],["MXR M78 Badass '78 Distortion","\\\\bm78\\\\b|badass ?'?78|badass ?78","",65],["Vox StompLab","stomplab|\\\\bsl[12][gb]\\\\b","",50],["Boss DS-2","\\\\bds-?2\\\\b","",65],["Boss OD-1","\\\\bod-?1\\\\b","",null],["Boss OD-3","\\\\bod-?3\\\\b","",60],["Boss CH-1","\\\\bch-?1\\\\b|super ?chorus","",55],["Boss CE-1","\\\\bce-?1\\\\b|chorus ?ensemble","",null],["Boss BF-2","\\\\bbf-?2\\\\b","",null],["Boss DD-2","\\\\bdd-?2\\\\b","",null],["Boss DD-8","\\\\bdd-?8\\\\b","",130],["Boss DD-200","\\\\bdd-?200\\\\b","",200],["Boss RV-200","\\\\brv-?200\\\\b","",190],["Boss DD-500","\\\\bdd-?500\\\\b","",260],["Boss RV-500","\\\\brv-?500\\\\b","",280],["Boss OC-3","\\\\boc-?3\\\\b","",85],["Boss TR-2","\\\\btr-?2\\\\b","",60],["Boss PH-3","\\\\bph-?3\\\\b","",70],["Boss CS-3","\\\\bcs-?3\\\\b","",55],["Boss NS-2","\\\\bns-?2\\\\b","",65],["Boss LS-2","\\\\bls-?2\\\\b","",70],["Boss TU-2","\\\\btu-?2\\\\b","",45],["Boss RC-5","\\\\brc-?5\\\\b","",170],["MXR Distortion+","distortion ?\\\\+|distortion ?plus|\\\\bm104\\\\b","",60],["MXR Phase 95","phase ?95","",75],["MXR 10-Band EQ","10-? ?band|\\\\bm108\\\\b","",120],["Electro-Harmonix Small Clone","small ?clone|nano ?clone","",60],["Electro-Harmonix Electric Mistress","electric ?mistress","",null],["Electro-Harmonix POG2","\\\\bpog ?2\\\\b","",250],["Electro-Harmonix Micro POG","micro ?pog","",175],["Electro-Harmonix Freeze","\\\\bfreeze\\\\b","",80],["Electro-Harmonix Oceans 11","oceans ?1[12]","",90],["Vox Wah","\\\\bv84[67]\\\\b|\\\\bvox\\\\b[^\\\\n]*wah","",null],["Ibanez WH10","\\\\bwh-?10\\\\b","",null],["Korg Pitchblack","pitchblack","",60],["TC Electronic PolyTune","polytune","",70],["Dallas Rangemaster","rangemaster","",null],["Ross Compressor","\\\\bross\\\\b","",null],["Binson Echorec","echorec","",null],["Roland Space Echo","space ?echo|\\\\bre-?201\\\\b|\\\\bre-?301\\\\b","",null],["Echoplex EP-3","echoplex|\\\\bep-?3\\\\b","",null],["Strymon blueSky","blue ?sky","",250],["Strymon Mobius","mobius","",300],["Strymon Sunset","\\\\bsunset\\\\b","",250],["Strymon Riverside","riverside","",250],["Eventide H9","\\\\bh9\\\\b","",350],["TC Electronic Flashback","flashback","",90],["Xotic SP Compressor","\\\\bsp ?comp","",110],["EarthQuaker Dispatch Master","dispatch ?master","",130],["Origin Effects Cali76","cali ?76","",250],["Source Audio Nemesis","nemesis","",220],["Analog Man King of Tone","king ?of ?tone","",null],["Nobels ODR-1","odr-?1","",70],["Ibanez AD9","\\\\bad-?9\\\\b|\\\\bad-?80\\\\b","",null],["Line 6 HX Stomp","hx ?stomp|\\\\bhelix\\\\b|\\\\bhx ?effects\\\\b","",450],["Line 6 M9","\\\\bm[59]\\\\b ?(?:stompbox|looper)?|\\\\bm13\\\\b","",200],["Ibanez TS808","\\\\bts-?808\\\\b","",null],["Ibanez Tube Screamer","\\\\bts-?(9|10|7)\\\\b|tube ?screamer","",110],["Boss DS-1","\\\\bds-?1\\\\b","",45],["Boss SD-1","\\\\bsd-?1\\\\b","",45],["Boss BD-2","\\\\bbd-?2\\\\b|blues ?driver","",70],["Boss MT-2","\\\\bmt-?2\\\\b|metal ?zone","",60],["Boss HM-2","\\\\bhm-?2\\\\b","",null],["Boss DD-3","\\\\bdd-?3\\\\b","",90],["Boss CE-2","\\\\bce-?2\\\\b","",null],["Boss GE-7","\\\\bge-?7\\\\b","",70],["Boss OC-2","\\\\boc-?2\\\\b","",null],["Boss RV-6","\\\\brv-?6\\\\b","",110],["Boss TU-3","\\\\btu-?3\\\\b","",65],["Boss RC looper","\\\\brc-?(1|2|3|5|10|30|300|500)\\\\b","",null],["ProCo RAT","\\\\brat ?2\\\\b|\\\\bproco\\\\b|\\\\brat\\\\b","",75],["Electro-Harmonix Big Muff","big ?muff|\\\\bmuff\\\\b","",null],["Electro-Harmonix Small Stone","small ?stone","",null],["Electro-Harmonix Deluxe Memory Man","deluxe ?memory ?man|\\\\bdmm\\\\b","",null],["Electro-Harmonix Memory Man","memory ?(man|toy)","",null],["Electro-Harmonix Holy Grail","holy ?grail","",80],["Electro-Harmonix POG","\\\\bpog\\\\b|\\\\bhog\\\\b","",null],["Electro-Harmonix Soul Food","soul ?food","",60],["MXR Phase 90","phase ?90","",70],["MXR Carbon Copy","carbon ?copy","",100],["MXR Dyna Comp","dyna ?comp","",65],["MXR Micro Amp","micro ?amp","",55],["Dunlop Cry Baby","cry ?baby|\\\\bwah\\\\b|\\\\bgcb-?95\\\\b","",65],["Klon","\\\\bklon\\\\b|centaur|\\\\bktr\\\\b","",null],["Wampler Tumnus","tumnus","",130],["Fulltone OCD","\\\\bocd\\\\b","",90],["JHS Morning Glory","morning ?glory","",140],["Xotic EP Booster","\\\\bep ?booster\\\\b","",100],["Fuzz Face","fuzz ?face","",null],["Z.Vex Fuzz Factory","fuzz ?factory|\\\\bzvex\\\\b|z\\\\.?vex","",180],["DigiTech Whammy","whammy","",null],["DigiTech Bad Monkey","bad ?monkey","",90],["Line 6 DL4","\\\\bdl-?4\\\\b","",180],["Strymon Timeline","timeline","",320],["Strymon BigSky","big ?sky","",380],["Strymon El Capistan","el ?capistan|\\\\bel cap\\\\b","",230],["Strymon Flint","\\\\bflint\\\\b","",250],["Walrus Audio Slö","\\\\bsl[oö]","",180],["Walrus Audio Julia","\\\\bjulia\\\\b","",150],["TC Electronic Hall of Fame","hall ?of ?fame|\\\\bhof\\\\b","",85],["TC Electronic Ditto","\\\\bditto\\\\b","",70],["EarthQuaker Devices Plumes","plumes","",90],["EarthQuaker Devices Avalanche Run","avalanche ?run","",220],["Keeley Compressor","keeley","",110],["Chase Bliss","chase ?bliss","",null],["Univibe","uni-? ?vibe|\\\\bvibe\\\\b","",null],["Behringer","behringer","",25],["Mooer","\\\\bmooer\\\\b","",40],["Joyo","\\\\bjoyo\\\\b","",30],["Zoom multi-effects","\\\\bzoom\\\\b|\\\\bms-?(50|60|70|100)\\\\b","",80],["Boss compact","\\\\bboss\\\\b","",null],["MXR","\\\\bmxr\\\\b","",null]];
const TABLE = GEAR.map(([name, src, flags, mv]) => ({ name, re: new RegExp(src, flags || ""), mv }));

function lookup(brand, model) {
  const q = (brand + " " + model).toLowerCase().replace(/\\s+/g, " ").trim();
  if (q.length < 3) return null;
  for (const row of TABLE) if (row.re.test(q)) return row;
  return null;
}

const money = n => "$" + Math.round(n).toLocaleString("en-US");
const $ = id => document.getElementById(id);

/* ===========================================================================
   STATE
   =========================================================================== */
let items = [];
const blank = () => ({ brand: "", model: "", condition: DEFAULT_CONDITION });

function priceOf(item) {
  const hit = lookup(item.brand, item.model);
  if (!hit || hit.mv === null) return { hit, value: null };
  const mult = (CONDITION.find(c => c[0] === item.condition) || ["", 1])[1];
  return { hit, value: hit.mv * mult };
}

function totals() {
  let market = 0, priced = 0, byHand = 0, named = 0;
  for (const it of items) {
    const named_ = (it.brand + it.model).trim().length > 0;
    if (named_) named += 1; else continue;
    const { value } = priceOf(it);
    if (value === null) byHand += 1;
    else { market += value; priced += 1; }
  }
  return { market, priced, byHand, named };
}

/* ===========================================================================
   RENDER
   =========================================================================== */
function itemRow(item, i) {
  const row = document.createElement("div");
  row.className = "item";

  const mk = (cls, label, value, ph, onInput) => {
    const f = document.createElement("div");
    f.className = "f " + cls;
    const l = document.createElement("label");
    l.textContent = label;
    l.htmlFor = cls + "-" + i;
    const inp = document.createElement("input");
    inp.type = "text"; inp.id = cls + "-" + i; inp.value = value; inp.placeholder = ph;
    inp.autocomplete = "off";
    inp.addEventListener("input", () => onInput(inp.value));
    f.append(l, inp);
    return f;
  };

  row.append(mk("f-brand", "Brand", item.brand, "Boss", v => { item.brand = v; render(); }));
  row.append(mk("f-model", "Model", item.model, "DS-1 Distortion", v => { item.model = v; render(); }));

  const cf = document.createElement("div");
  cf.className = "f f-cond";
  const cl = document.createElement("label");
  cl.textContent = "Condition"; cl.htmlFor = "cond-" + i;
  const sel = document.createElement("select");
  sel.id = "cond-" + i;
  for (const [name] of CONDITION) {
    const o = document.createElement("option");
    o.value = name; o.textContent = name;
    if (name === item.condition) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => { item.condition = sel.value; render(); });
  cf.append(cl, sel);
  row.append(cf);

  const drop = document.createElement("div");
  drop.className = "drop";
  const x = document.createElement("button");
  x.type = "button"; x.textContent = "×";
  x.setAttribute("aria-label", "Remove item " + (i + 1));
  x.disabled = items.length < 2;
  x.addEventListener("click", () => { items.splice(i, 1); if (!items.length) items.push(blank()); render(true); });
  drop.append(x);
  row.append(drop);

  const note = document.createElement("p");
  note.className = "match";
  const named = (item.brand + item.model).trim().length > 0;
  if (!named) {
    note.textContent = "";
  } else {
    const { hit, value } = priceOf(item);
    if (value !== null) {
      note.classList.add("hit");
      note.textContent = hit.name + ", around " + money(value) + " in " + item.condition.toLowerCase() + " shape";
    } else {
      note.classList.add("hand");
      note.textContent = hit
        ? hit.name + ". Values swing too far on this one to quote blind, so we will price it by hand."
        : "Not one we have a book price for. We will price it by hand, which is normal and not a problem.";
    }
  }
  row.append(note);
  return row;
}

function render(rebuild) {
  const host = $("items");
  if (rebuild || host.children.length !== items.length) {
    host.textContent = "";
    items.forEach((it, i) => host.append(itemRow(it, i)));
  } else {
    items.forEach((it, i) => {
      const note = host.children[i].querySelector(".match");
      const fresh = itemRow(it, i).querySelector(".match");
      note.className = fresh.className;
      note.textContent = fresh.textContent;
      host.children[i].querySelector(".drop button").disabled = items.length < 2;
    });
  }

  const t = totals();
  $("itemCount").textContent = t.named + (t.named === 1 ? " item" : " items");

  const cash = t.market * OFFER.cashPct;
  const credit = t.market * OFFER.creditPct;
  const consign = t.market * (1 - OFFER.feeRate) * OFFER.consignPct;

  $("amtCash").textContent = money(cash);
  $("amtCredit").textContent = money(credit);
  $("amtConsign").textContent = money(consign);
  /* Derived, not typed. A hardcoded "20% more" is how the number on the card
     and the number in the maths quietly stop agreeing. */
  const bump = Math.round((OFFER.creditPct / OFFER.cashPct - 1) * 100);
  $("subCredit").textContent = bump + "% more than cash, spend it here";
  $("subConsign").textContent = Math.round(OFFER.consignPct * 100)
    + "% of the sale, after fees";
  $("basis").textContent = t.market ? "based on about " + money(t.market) + " of market value" : "";

  /* The honesty line. It is not decoration: these figures come from a book
     price for a clean example, and a seller reading a precise number as a
     promise is the one way this page can do real damage. */
  const bits = [];
  if (!t.named) {
    bits.push("Put a pedal in above and the numbers fill in.");
  } else {
    bits.push("<b>These are estimates.</b> They come from what these actually sell for used, adjusted for the condition you picked. We confirm the real number once we see the gear, and you can walk away at any point before you ship.");
    if (t.byHand) {
      bits.push("<b>" + t.byHand + (t.byHand === 1 ? " item is" : " items are") + " not in the totals above</b>, because "
        + (t.byHand === 1 ? "it needs" : "they need") + " pricing by hand. Send "
        + (t.byHand === 1 ? "it" : "them") + " along anyway and we will quote "
        + (t.byHand === 1 ? "it" : "them") + " properly.");
    }
    if (!t.priced) bits.push("Nothing here has a book price yet, so there is no total to show. That is common with vintage and boutique gear and it does not slow anything down.");
  }
  $("estimateNote").innerHTML = bits.join(" ");

  writeSummary(t, cash, credit, consign);
  save();
}

function writeSummary(t, cash, credit, consign) {
  const lines = ["Pedals I want to sell, quoted on stompbox.world:", ""];
  let any = false;
  items.forEach(it => {
    const named = (it.brand + it.model).trim();
    if (!named) return;
    any = true;
    const { value } = priceOf(it);
    lines.push("  " + (it.brand + " " + it.model).trim() + "  (" + it.condition + ")"
      + (value === null ? "  [price by hand]" : "  ~" + money(value)));
  });
  if (!any) { $("summary").value = "Add a pedal above and your summary appears here."; return; }

  lines.push("");
  if (t.priced) {
    lines.push("Estimated market value: " + money(t.market)
      + (t.byHand ? "  (plus " + t.byHand + " to be priced by hand)" : ""));
    lines.push("");
    lines.push("  Cash            " + money(cash));
    lines.push("  Store credit    " + money(credit));
    lines.push("  Consignment     " + money(consign));
  } else {
    lines.push("Nothing here has a book price, so this needs quoting by hand.");
  }
  lines.push("");
  lines.push("Estimate from the site, not a final offer.");
  $("summary").value = lines.join("\\n");
}

/* ===========================================================================
   SHARING. The quote travels in the URL so a link is the whole state.
   =========================================================================== */
function encode() {
  try {
    const payload = items
      .filter(i => (i.brand + i.model).trim())
      .map(i => [i.brand, i.model, i.condition]);
    if (!payload.length) return "";
    return "#q=" + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch (_) { return ""; }
}
function decode() {
  try {
    const m = location.hash.match(/#q=(.+)$/);
    if (!m) return null;
    const rows = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows.map(r => ({
      brand: String(r[0] || ""), model: String(r[1] || ""),
      condition: CONDITION.some(c => c[0] === r[2]) ? r[2] : DEFAULT_CONDITION,
    }));
  } catch (_) { return null; }
}

const KEY = "stompbox-sell/v1";
function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_) {} }
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const rows = JSON.parse(raw);
    return Array.isArray(rows) && rows.length ? rows : null;
  } catch (_) { return null; }
}

/* ===========================================================================
   EVENTS
   =========================================================================== */
$("addItem").addEventListener("click", () => {
  items.push(blank());
  render(true);
  const inputs = $("items").querySelectorAll(".f-brand input");
  if (inputs.length) inputs[inputs.length - 1].focus();
});
$("clearItems").addEventListener("click", () => {
  items = [blank()];
  history.replaceState(null, "", location.pathname + location.search);
  render(true);
});

function flash(btn, word) {
  const was = btn.textContent;
  btn.textContent = word; btn.classList.add("copied");
  setTimeout(() => { btn.textContent = was; btn.classList.remove("copied"); }, 1400);
}
function copy(text, btn, word) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => flash(btn, word), () => {});
  } else {
    const ta = $("summary");
    ta.select();
    try { document.execCommand("copy"); flash(btn, word); } catch (_) {}
  }
}
$("copySummary").addEventListener("click", e => copy($("summary").value, e.currentTarget, "Copied"));
$("copyLink").addEventListener("click", e => {
  const url = location.origin + location.pathname + encode();
  copy(url, e.currentTarget, "Link copied");
});

/* The CTA copies first and then opens Messenger, because a Messenger link
   cannot carry prefilled text and an empty chat window is where a quote goes
   to die. */
$("ctaSend").addEventListener("click", e => {
  e.preventDefault();
  const btn = e.currentTarget;
  const go = () => { if (MESSENGER) window.open(MESSENGER, "_blank", "noopener"); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText($("summary").value)
      .then(() => { flash(btn, MESSENGER ? "Copied, now paste it to us" : "Copied, send it to us"); go(); }, go);
  } else { $("summary").select(); }
});
if (!MESSENGER) {
  $("ctaSend").textContent = "Copy my quote to send";
  $("ctaFine").textContent = "That copies your quote. Send it to us on Messenger or Instagram and"
    + " we will confirm the final number, then email you a prepaid label the same day. Nothing is"
    + " binding until we have both agreed, and you keep your gear until you have a label in hand.";
}

/* --- theme ---------------------------------------------------------- */
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

/* ===========================================================================
   OUR OWN SHOP.

   Read from our own API route, which holds the token. Nothing here touches
   the quote above it: these are our listings at our asking prices, and the
   seller's estimate is computed from a book price. Keeping the two visibly
   separate is the point of the paragraph under the grid.

   IT FAILS BY DISAPPEARING. No shop, no section. A page whose whole job is
   quoting somebody for their gear must not show an error because a
   decorative strip could not load, and the offline copy of this file has no
   API to call at all.
   =========================================================================== */
async function loadShop() {
  try {
    const res = await fetch("/api/reverb/shop", { headers: { accept: "application/json" } });
    if (!res.ok) return;
    const data = await res.json();
    const rows = Array.isArray(data.listings) ? data.listings.slice(0, 8) : [];
    if (!rows.length) return;

    const grid = $("shopGrid");
    grid.textContent = "";
    for (const row of rows) {
      const a = document.createElement("a");
      a.className = "shop-card";
      a.href = row.url; a.target = "_blank"; a.rel = "noopener";

      if (row.photo) {
        const img = document.createElement("img");
        img.className = "shot"; img.src = row.photo; img.alt = row.title;
        img.loading = "lazy"; img.decoding = "async";
        /* A dead image link leaves a grey box with a broken glyph in it,
           which looks worse than the card simply being tighter. */
        img.addEventListener("error", () => img.remove());
        a.appendChild(img);
      }

      const meta = document.createElement("div");
      meta.className = "meta";
      const t = document.createElement("span");
      t.className = "t"; t.textContent = row.title;
      const rowEl = document.createElement("span");
      rowEl.className = "row";
      const p = document.createElement("span");
      p.className = "p"; p.textContent = row.price || "";
      const c = document.createElement("span");
      c.className = "c"; c.textContent = row.condition || "";
      rowEl.append(p, c);
      meta.append(t, rowEl);
      a.appendChild(meta);
      grid.appendChild(a);
    }
    $("shop").hidden = false;
  } catch (_) { /* no shop section today, and nothing else is affected */ }
}
loadShop();

/* --- boot ----------------------------------------------------------- */
/* A shared link wins over saved state: somebody following a quote wants the
   quote in the link, not whatever they last typed. */
items = decode() || load() || [
  { brand: "Electro-Harmonix", model: "Canyon", condition: "Very good" },
  { brand: "Boss", model: "DS-1", condition: "Good" },
  { brand: "TC Electronic", model: "Hall of Fame", condition: "Excellent" },
];
render(true);
</script>
</body>
</html>
`
