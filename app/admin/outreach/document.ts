/**
 * THE BUY MY BOARD TOOL, AS A LITERAL DOCUMENT.
 *
 * This is not a React page and deliberately so. It is one self-contained HTML
 * document with its own <head>, its own stylesheet and its own script, and it
 * is served verbatim by the route handler next door.
 *
 * WHY NOT A COMPONENT. The tool is also handed out as a standalone file that
 * runs off a laptop with no server at all, and two copies of a thing this size
 * is section 7's fork with the drift hidden inside sales copy rather than
 * inside an error. One document, two ways to serve it.
 *
 * WHY IT IS ALLOWED IN THE GUIDE'S TREE. `tests/stompbox/boundary.test.ts`
 * forbids this subtree from importing ingestion, admin, affiliate, queue, auth,
 * mail, cart or lib/db. This file imports nothing at all: no database, no
 * credential, no feed. Everything it computes happens in the reader's browser
 * and nothing leaves it.
 *
 * REGENERATE, DO NOT HAND EDIT. The escaping below is mechanical (a backslash,
 * a backtick and a ${ are the only sequences that matter inside a template
 * literal) and a hand edit here is how the served page and the handed-out file
 * quietly stop being the same program.
 */
export const OUTREACH_HTML = `<!doctype html>
<html lang="en">
<head>
<title>Buy My Board | Stompbox World</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Shareable but not searchable. This page carries the shop's own margins and
     the scripts it sends sellers, so it should not turn up in a search for
     "sell my pedalboard". Delete this line to let it be indexed. -->
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="Stompbox World buys and brokers used pedalboards. Paste a listing, see what the lot is worth, and pick how you want paid.">
<meta property="og:title" content="Buy My Board | Stompbox World">
<meta property="og:description" content="Paste a pedal list, see the market value and three ways to get paid for it.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=&apos;http://www.w3.org/2000/svg&apos; viewBox=&apos;0 0 32 32&apos;%3E%3Crect width=&apos;32&apos; height=&apos;32&apos; rx=&apos;5&apos; fill=&apos;%231c3a63&apos;/%3E%3Crect x=&apos;3.5&apos; y=&apos;3.5&apos; width=&apos;25&apos; height=&apos;25&apos; rx=&apos;3.5&apos; fill=&apos;none&apos; stroke=&apos;%23fff&apos; stroke-width=&apos;1.6&apos;/%3E%3Ccircle cx=&apos;16&apos; cy=&apos;20&apos; r=&apos;5&apos; fill=&apos;none&apos; stroke=&apos;%23fff&apos; stroke-width=&apos;2.2&apos;/%3E%3Ccircle cx=&apos;16&apos; cy=&apos;9.5&apos; r=&apos;1.8&apos; fill=&apos;%233fe07c&apos;/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">

<style>
/* ---------------------------------------------------------------------------
   Tokens. Dark first, because the site this belongs to is dark first.
   Metal never changes between themes: an enclosure is the same object whatever
   it is standing on. Chrome is white and only ever touches metal; anything
   needing an accent edge ON THE PAGE takes --edge-accent, which does flip,
   because white on paper is not an accent.
--------------------------------------------------------------------------- */
:root {
  --ground:      #08121f;
  --panel:       #0e1e33;
  --panel-2:     #132845;
  --sunk:        #060e18;
  --metal:       #1c3a63;
  --metal-hi:    #27508a;
  --chrome:      #ffffff;
  --edge:        rgba(255,255,255,.13);
  --edge-hi:     rgba(255,255,255,.30);
  --edge-accent: #7f9ec4;
  --text:        #e6eefb;
  --text-dim:    #93a8c6;
  --text-faint:  #63799a;
  --led:         #3fe07c;
  --led-glow:    rgba(63,224,124,.20);
  --accent-text: #79e2a4;
  --warn:        #e8b451;
  --bubble:      #1c3a63;
  --bubble-ink:  #f2f6fc;
  --radius:      4px;
  color-scheme: dark;

  --display: "Chakra Petch", "Arial Narrow", system-ui, sans-serif;
  --ui: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  /* The bubbles are set in the stack Messenger itself renders, so the preview
     reads true rather than approximately. */
  --chat: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

@media (prefers-color-scheme: light) {
  :root[data-theme="system"] {
    --ground: #e7ecf3; --panel: #ffffff; --panel-2: #f1f4f9; --sunk: #dbe2ec;
    --edge: rgba(12,26,46,.14); --edge-hi: rgba(12,26,46,.30); --edge-accent: #2b4a7c;
    --text: #0c1a2e; --text-dim: #52678a; --text-faint: #7b8dab;
    --led: #12874a; --led-glow: rgba(18,135,74,.13); --accent-text: #0f7a41; --warn: #8a5d00;
    color-scheme: light;
  }
}
:root[data-theme="dark"] { color-scheme: dark; }
:root[data-theme="light"] {
  --ground: #e7ecf3; --panel: #ffffff; --panel-2: #f1f4f9; --sunk: #dbe2ec;
  --edge: rgba(12,26,46,.14); --edge-hi: rgba(12,26,46,.30); --edge-accent: #2b4a7c;
  --text: #0c1a2e; --text-dim: #52678a; --text-faint: #7b8dab;
  --led: #12874a; --led-glow: rgba(18,135,74,.13); --accent-text: #0f7a41; --warn: #8a5d00;
  color-scheme: light;
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
body {
  margin: 0; background: var(--ground); color: var(--text);
  font-family: var(--ui); font-size: 15px; line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1220px; margin: 0 auto; padding: 22px 20px 72px; }

/* --- masthead ----------------------------------------------------------- */
.mast {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 18px; flex-wrap: wrap;
  padding-bottom: 14px; margin-bottom: 22px; border-bottom: 1px solid var(--edge);
}
.mast h1 {
  font-family: var(--display); font-weight: 700; font-size: 27px; letter-spacing: .02em;
  margin: 0; text-transform: uppercase; text-wrap: balance;
}
.mast h1 span { color: var(--led); }
.brandcol { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.brand {
  display: inline-flex; align-items: center; gap: 8px;
  text-decoration: none; width: fit-content; padding: 2px 0;
}
.brand .mark { width: 21px; height: 21px; flex: 0 0 auto; }
.brandname {
  font-family: var(--display); font-size: 12px; font-weight: 700;
  letter-spacing: .18em; text-transform: uppercase; color: var(--text-dim);
  transition: color .12s;
}
.brand:hover .brandname { color: var(--text); }
.brand:focus-visible { outline: 2px solid var(--led); outline-offset: 3px; border-radius: 3px; }
.mast p { margin: 5px 0 0; color: var(--text-dim); font-size: 13.5px; max-width: 60ch; }

.lp {
  flex: 0 0 auto; width: 54px; height: 50px; padding: 0;
  background: linear-gradient(180deg, var(--metal-hi), var(--metal));
  border: 1px solid var(--edge-hi); border-radius: var(--radius);
  color: var(--chrome); cursor: pointer;
  font-family: var(--display); font-size: 10px; font-weight: 700;
  letter-spacing: .09em; text-transform: uppercase;
  display: grid; place-items: center; gap: 3px; transition: transform .08s;
}
.lp:active { transform: translateY(2px); }
.lp b { display: block; width: 22px; height: 5px; border-radius: 3px; background: var(--chrome); opacity: .85; }

/* --- layout ------------------------------------------------------------- */
.cols { display: grid; gap: 22px; align-items: start; }
@media (min-width: 980px) { .cols { grid-template-columns: 332px 1fr; } }
.stack { display: flex; flex-direction: column; gap: 22px; min-width: 0; }

.plate {
  background: var(--panel); border: 1px solid var(--edge); border-radius: var(--radius);
  padding: 18px; display: flex; flex-direction: column; gap: 16px;
}
@media (min-width: 980px) { .plate { position: sticky; top: 20px; max-height: calc(100vh - 40px); overflow-y: auto; } }

.legend {
  font-family: var(--display); font-size: 10.5px; font-weight: 600;
  letter-spacing: .14em; text-transform: uppercase; color: var(--text-faint);
  display: flex; align-items: center; gap: 9px;
}
.legend::after { content: ""; flex: 1; height: 1px; background: var(--edge); }

.field { display: flex; flex-direction: column; gap: 6px; }
.field > label, .sublabel {
  font-family: var(--display); font-size: 11px; font-weight: 600;
  letter-spacing: .1em; text-transform: uppercase; color: var(--text-dim);
}
.pair { display: grid; grid-template-columns: 1fr 92px; gap: 10px; align-items: end; }

input[type="text"] {
  width: 100%; font-family: var(--ui); font-size: 14.5px; color: var(--text);
  background: var(--sunk); border: 1px solid var(--edge); border-radius: var(--radius);
  padding: 9px 11px; caret-color: var(--led); appearance: none;
}
input[type="text"]::placeholder { color: var(--text-faint); }
input[type="text"]:disabled { opacity: .4; }

.seg {
  display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 4px;
  background: var(--sunk); border: 1px solid var(--edge);
  border-radius: var(--radius); padding: 4px;
}
.seg button {
  font-family: var(--display); font-weight: 600; letter-spacing: .04em;
  text-transform: uppercase; font-size: 10.5px;
  padding: 8px 3px; border: 1px solid transparent; border-radius: 3px;
  background: transparent; color: var(--text-dim); cursor: pointer;
  transition: background .12s, color .12s; white-space: nowrap;
}
.seg.wide button { font-size: 11px; padding: 8px 4px; }
.seg button[aria-pressed="true"] {
  background: linear-gradient(180deg, var(--metal-hi), var(--metal));
  border-color: var(--edge-hi); color: var(--chrome);
}
.seg button:disabled { opacity: .28; cursor: default; }
.seg button:focus-visible { outline: 2px solid var(--led); outline-offset: 1px; }

.checks { display: flex; flex-direction: column; gap: 9px; }
.check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 14px; color: var(--text); }
.check input { position: absolute; opacity: 0; width: 0; height: 0; }
.check .led {
  flex: 0 0 auto; margin-top: 2px; width: 15px; height: 15px; border-radius: 50%;
  background: var(--sunk); border: 2px solid var(--edge-hi);
  transition: background .12s, box-shadow .12s;
}
.check input:checked + .led { background: var(--led); box-shadow: 0 0 8px var(--led-glow); }
.check input:focus-visible + .led { outline: 2px solid var(--led); outline-offset: 3px; }
.check small { display: block; color: var(--text-faint); font-size: 12.5px; line-height: 1.35; }

/* --- gear-note readout -------------------------------------------------- */
.readout {
  background: var(--sunk); border: 1px solid var(--edge);
  border-left: 2px solid var(--led); border-radius: var(--radius);
  padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px;
}
.readout.miss { border-left-color: var(--edge-hi); }
.readout .body { flex: 1; min-width: 0; }
.readout .who {
  font-family: var(--display); font-size: 11px; font-weight: 700;
  letter-spacing: .09em; text-transform: uppercase; color: var(--accent-text);
}
.readout.miss .who { color: var(--text-faint); }
.readout .what { font-size: 12.5px; color: var(--text-dim); margin-top: 3px; line-height: 1.4; }

.knob {
  flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, var(--metal-hi) 0deg 6deg, var(--metal) 6deg 12deg);
  border: 1px solid var(--edge-hi); color: var(--chrome); cursor: pointer;
  display: grid; place-items: center; font-size: 13px; line-height: 1; transition: transform .12s;
}
.knob:hover { border-color: var(--chrome); }
.knob:active { transform: rotate(28deg); }
.knob:disabled { opacity: .35; cursor: default; }

.stomp {
  --stomp-ink: #f2f6fc; width: 100%;
  font-family: var(--display); font-size: 13px; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; color: var(--stomp-ink);
  background: linear-gradient(180deg, var(--metal-hi), var(--metal));
  border: 1px solid var(--edge-hi); border-radius: var(--radius);
  padding: 13px 14px; cursor: pointer; transition: transform .08s, border-color .12s;
}
.stomp:hover { border-color: var(--chrome); }
.stomp:active { transform: translateY(2px); }

.mini {
  font-family: var(--display); font-size: 10.5px; font-weight: 600;
  letter-spacing: .09em; text-transform: uppercase; color: var(--text-dim);
  background: transparent; border: 1px solid var(--edge); border-radius: 3px;
  padding: 6px 10px; cursor: pointer; transition: border-color .12s, color .12s;
}
.mini:hover { border-color: var(--edge-accent); color: var(--text); }
.mini.copied { border-color: var(--led); color: var(--accent-text); }
.mini.go { color: var(--text); border-color: var(--edge-accent); }

/* --- the lot ------------------------------------------------------------ */
.lot {
  background: var(--panel); border: 1px solid var(--edge); border-radius: var(--radius);
  padding: 16px; display: flex; flex-direction: column; gap: 13px;
}
.paste {
  width: 100%; font-family: var(--ui); font-size: 13.5px; line-height: 1.5;
  color: var(--text); background: var(--sunk);
  border: 1px solid var(--edge); border-radius: var(--radius);
  padding: 10px 12px; caret-color: var(--led); resize: vertical; min-height: 78px;
}
.paste::placeholder { color: var(--text-faint); }
.paste:focus-visible { outline: 2px solid var(--led); outline-offset: 1px; }
.lot-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.parse-note { font-size: 12.5px; color: var(--text-faint); }
.parse-note.warn { color: var(--warn); }

.tablewrap { overflow-x: auto; border: 1px solid var(--edge); border-radius: var(--radius); }
table.lot-table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 13.5px; }
.lot-table th {
  font-family: var(--display); font-size: 10px; font-weight: 600;
  letter-spacing: .12em; text-transform: uppercase; color: var(--text-faint);
  text-align: left; padding: 9px 10px; background: var(--panel-2);
  border-bottom: 1px solid var(--edge); white-space: nowrap;
}
.lot-table th.num, .lot-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.lot-table td { padding: 0; border-bottom: 1px solid var(--edge); }
.lot-table tbody tr:last-child td { border-bottom: 0; }
.lot-table input {
  width: 100%; background: transparent; border: 0; color: var(--text);
  font-family: var(--ui); font-size: 13.5px; padding: 9px 10px; caret-color: var(--led);
}
.lot-table input.num { text-align: right; font-variant-numeric: tabular-nums; }
.lot-table input:focus-visible { outline: 2px solid var(--led); outline-offset: -2px; }
.lot-table input.guessed { color: var(--warn); }
.lot-table input.seeded { color: var(--text-dim); font-style: italic; }
.lot-table td.drop { width: 34px; text-align: center; }
.lot-table .x {
  background: transparent; border: 0; color: var(--text-faint);
  cursor: pointer; font-size: 15px; line-height: 1; padding: 6px 8px;
}
.lot-table .x:hover { color: var(--warn); }
.lot-table tfoot td {
  padding: 9px 10px; background: var(--panel-2); border-top: 1px solid var(--edge);
  font-family: var(--display); font-weight: 600; font-size: 11.5px;
  letter-spacing: .08em; text-transform: uppercase; color: var(--text-dim);
}

.offers { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); }
.tile {
  background: var(--sunk); border: 1px solid var(--edge);
  border-top: 2px solid var(--edge-accent); border-radius: var(--radius);
  padding: 11px 13px 12px;
}
.tile.best { border-top-color: var(--led); }
.tile-h {
  font-family: var(--display); font-size: 10px; font-weight: 600;
  letter-spacing: .12em; text-transform: uppercase; color: var(--text-faint);
}
.tile-n {
  font-family: var(--display); font-weight: 700; font-size: 25px;
  letter-spacing: .01em; margin-top: 2px; font-variant-numeric: tabular-nums;
}
.tile-s { font-size: 12px; color: var(--text-dim); margin-top: 1px; }
.spread { font-size: 12.5px; color: var(--text-dim); }
.spread b { color: var(--text); font-weight: 600; }

/* --- the thread --------------------------------------------------------- */
.thread { background: var(--panel); border: 1px solid var(--edge); border-radius: var(--radius); overflow: hidden; }
.thread-head {
  display: flex; align-items: center; gap: 11px; padding: 13px 16px;
  border-bottom: 1px solid var(--edge); background: var(--panel-2);
}
.avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(180deg, var(--metal-hi), var(--metal));
  border: 1px solid var(--edge-hi); display: grid; place-items: center;
  font-family: var(--display); font-weight: 700; font-size: 15px; color: var(--chrome);
}
.thread-head .nm { font-weight: 600; font-size: 14.5px; }
.thread-head .sub { font-size: 12px; color: var(--text-faint); }
.tag {
  margin-left: auto; font-family: var(--display); font-size: 10px; font-weight: 600;
  letter-spacing: .12em; text-transform: uppercase; color: var(--text-dim);
  border: 1px solid var(--edge); border-radius: 999px; padding: 3px 9px;
}

.msgs { padding: 18px 16px 20px; display: flex; flex-direction: column; gap: 6px; }
.msg { display: grid; grid-template-columns: 26px 1fr; gap: 10px; align-items: start; }
.step {
  font-family: var(--display); font-size: 12px; font-weight: 700; color: var(--text-faint);
  text-align: right; padding-top: 11px; font-variant-numeric: tabular-nums;
}
.msg-body { min-width: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

.bubble {
  width: 100%; font-family: var(--chat); font-size: 15px; line-height: 1.45;
  color: var(--bubble-ink); background: var(--bubble);
  border: 1px solid var(--edge-hi); border-radius: 17px; padding: 12px 16px;
  resize: none; overflow: hidden; display: block;
}
.bubble:focus-visible { outline: 2px solid var(--led); outline-offset: 2px; }

.meta { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-faint); font-variant-numeric: tabular-nums; }
.meta .count.long { color: var(--warn); }
.meta .dirty {
  font-family: var(--display); font-size: 10px; font-weight: 600;
  letter-spacing: .1em; text-transform: uppercase; color: var(--warn);
}
.meta .spacer { flex: 1; }
.meta .mini { padding: 5px 9px; }

/* The pause between messages is information: two goes after they answer,
   three goes straight after two. */
.gap {
  display: flex; align-items: center; gap: 10px; margin: 8px 0 8px 36px;
  font-family: var(--display); font-size: 10px; font-weight: 600;
  letter-spacing: .13em; text-transform: uppercase; color: var(--text-faint);
}
.gap::before, .gap::after { content: ""; height: 1px; background: var(--edge); }
.gap::before { width: 18px; }
.gap::after { flex: 1; }

.foot {
  margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--edge);
  color: var(--text-faint); font-size: 12.5px; max-width: 78ch;
}
.foot strong { color: var(--text-dim); font-weight: 600; }
.foot + .foot { margin-top: 12px; padding-top: 0; border-top: 0; }

.sitefoot {
  margin-top: 30px; padding-top: 16px; border-top: 1px solid var(--edge);
  display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
  font-family: var(--display); font-size: 11px; font-weight: 600;
  letter-spacing: .1em; text-transform: uppercase; color: var(--text-faint);
}
.sitefoot .mark { width: 17px; height: 17px; }
.sitefoot .dot { opacity: .5; }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<script>
/* Runs before the page paints. Without it a reader who chose light gets a
   frame of dark first, which is the flash the site's own no-flash init script
   exists to prevent. Deliberately not a module: those are deferred. */
(function () {
  var t = "dark";
  try { var v = localStorage.getItem("stompbox-buymyboard/v1/theme");
        if (v === "light" || v === "system") t = v; } catch (e) {}
  document.documentElement.setAttribute("data-theme", t);
})();
</script>

<div class="wrap">

  <header class="mast">
    <div class="brandcol">
      <a class="brand" href="https://stompbox.world">
        <svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <rect x="1.6" y="1.6" width="28.8" height="28.8" rx="4.5"
                fill="var(--metal)" stroke="var(--chrome)" stroke-width="1.5"/>
          <circle cx="16" cy="20" r="5.2" fill="none" stroke="var(--chrome)" stroke-width="2"/>
          <circle cx="16" cy="9" r="1.9" fill="var(--led)"/>
        </svg>
        <span class="brandname">Stompbox World</span>
      </a>
      <h1>Buy My <span>Board</span></h1>
      <p>Paste a listing, see what the lot is actually worth, and pick how you want paid. The opener picks up a real line about the pedal, and every figure is computed off a market value somebody confirmed.</p>
    </div>
    <button class="lp" id="theme" title="Theme" aria-label="Cycle theme"><b></b><span id="themeLabel">Dark</span></button>
  </header>

  <div class="cols">

    <!-- ============ the plate ============ -->
    <section class="plate">
      <div class="legend">The listing</div>

      <div class="field">
        <label for="fName">Their first name</label>
        <input type="text" id="fName" placeholder="leave blank for a plain hey">
      </div>

      <div class="field">
        <label for="fPedal">The pedal you spotted</label>
        <input type="text" id="fPedal" placeholder="Boss DS-1">
      </div>

      <div class="field">
        <label id="scopeLabel">What they are selling</label>
        <div class="seg wide" role="group" aria-labelledby="scopeLabel" id="scope">
          <button type="button" data-v="one" aria-pressed="false">Just one</button>
          <button type="button" data-v="few" aria-pressed="false">A few</button>
          <button type="button" data-v="board" aria-pressed="true">A board</button>
        </div>
      </div>

      <div class="legend">Your side</div>

      <div class="pair">
        <div class="field">
          <label for="fWhere">Shop is in</label>
          <input type="text" id="fWhere" placeholder="blank for a local shop">
        </div>
        <div class="field">
          <label for="fFee">Fee %</label>
          <input type="text" id="fFee" inputmode="decimal" placeholder="8.5">
        </div>
      </div>

      <div class="field">
        <label for="fMarket">You sell on</label>
        <input type="text" id="fMarket" placeholder="Reverb">
      </div>

      <div class="legend">The icebreaker</div>

      <div class="field">
        <span class="sublabel" id="catLabel">What to talk about</span>
        <div class="seg" role="group" aria-labelledby="catLabel" id="cat">
          <button type="button" data-v="auto" aria-pressed="true">Auto</button>
          <button type="button" data-v="tone" aria-pressed="false">Tone</button>
          <button type="button" data-v="wear" aria-pressed="false">Wear</button>
          <button type="button" data-v="era"  aria-pressed="false">Era</button>
          <button type="button" data-v="util" aria-pressed="false">Quirks</button>
        </div>
      </div>

      <div class="field" id="wearRow" hidden>
        <span class="sublabel" id="wearLabel">How it looks in the photos</span>
        <div class="seg wide" role="group" aria-labelledby="wearLabel" id="wear">
          <button type="button" data-v="worn" aria-pressed="true">Well loved</button>
          <button type="button" data-v="mint" aria-pressed="false">Like new</button>
          <button type="button" data-v="ask"  aria-pressed="false">Cannot tell</button>
        </div>
      </div>

      <div class="readout" id="noteOut">
        <div class="body">
          <div class="who" id="noteWho">No pedal yet</div>
          <div class="what" id="noteWhat">Type a model above.</div>
        </div>
        <button class="knob" id="noteCycle" title="Next line" aria-label="Next gear note">&#8635;</button>
      </div>

      <div class="legend">Offers to show</div>
      <div class="checks">
        <label class="check"><input type="checkbox" id="o1" checked><span class="led"></span>
          <span>Cash up front, 60%<small>You take the lot, they do nothing</small></span></label>
        <label class="check"><input type="checkbox" id="o2" checked><span class="led"></span>
          <span>Half now, 80% total<small>They hold and ship, you true up</small></span></label>
        <label class="check"><input type="checkbox" id="o3" checked><span class="led"></span>
          <span>Max payout, 90%<small>You broker for 10%, no capital out</small></span></label>
      </div>

      <div class="legend">Extras</div>
      <div class="checks">
        <label class="check"><input type="checkbox" id="xNote" checked><span class="led"></span>
          <span>Gear note in the opener</span></label>
        <label class="check"><input type="checkbox" id="xComps" checked><span class="led"></span>
          <span>Define market value<small>Sold comps, not asking prices</small></span></label>
        <label class="check"><input type="checkbox" id="xSteer" checked><span class="led"></span>
          <span>Steer them to an option</span></label>
        <label class="check"><input type="checkbox" id="xDeposit"><span class="led"></span>
          <span>Deposit on the max payout<small>10% up front as good faith. Off is the plain 3A deal</small></span></label>
        <label class="check"><input type="checkbox" id="xPickup"><span class="led"></span>
          <span>Offer local pickup</span></label>
      </div>

      <div class="field">
        <label for="fCity">Your area</label>
        <input type="text" id="fCity" placeholder="Nashville" disabled>
      </div>

      <button class="stomp" id="shuffleAll">Shuffle all three</button>
    </section>

    <div class="stack">

      <!-- ============ the lot ============ -->
      <section class="lot">
        <div class="legend">Their lot</div>

        <textarea class="paste" id="paste" rows="4" spellcheck="false"
          placeholder="Paste their listing here, one pedal per line. Bullets, numbering and prices in almost any shape are fine."></textarea>

        <div class="lot-actions">
          <button class="mini go" id="parseBtn">Read the listing</button>
          <button class="mini" id="addRow">Add a row</button>
          <button class="mini" id="clearLot">Clear</button>
          <span class="parse-note" id="parseNote"></span>
        </div>

        <div class="tablewrap" id="tableWrap" hidden>
          <table class="lot-table">
            <thead>
              <tr>
                <th>Brand</th><th>Model</th>
                <th class="num">Asking</th><th class="num">Market</th><th></th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
            <tfoot>
              <tr>
                <td colspan="2">Totals</td>
                <td class="num" id="totAsk">-</td>
                <td class="num" id="totMv">-</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="offers" id="offers" hidden>
          <div class="tile" id="tile1">
            <div class="tile-h">Cash up front</div>
            <div class="tile-n" id="n1">-</div>
            <div class="tile-s">60% of market, paid now</div>
          </div>
          <div class="tile" id="tile2">
            <div class="tile-h">Half now</div>
            <div class="tile-n" id="n2">-</div>
            <div class="tile-s" id="n2s">80% after fees</div>
          </div>
          <div class="tile best" id="tile3">
            <div class="tile-h">Max payout</div>
            <div class="tile-n" id="n3">-</div>
            <div class="tile-s" id="n3s">90% after fees</div>
          </div>
        </div>

        <div class="spread" id="spread" hidden></div>

        <div class="checks" id="verifyBox" hidden>
          <label class="check"><input type="checkbox" id="xVerified"><span class="led"></span>
            <span>These numbers are checked, put them in the message
              <small id="verifyNote">Until this is on, message three asks for the list instead of quoting a total.</small></span></label>
        </div>
      </section>

      <!-- ============ the thread ============ -->
      <section class="thread">
        <div class="thread-head">
          <div class="avatar" id="avatar">D</div>
          <div>
            <div class="nm" id="headName">Dave</div>
            <div class="sub">Messenger</div>
          </div>
          <div class="tag">Outgoing</div>
        </div>

        <div class="msgs">
          <div class="msg">
            <div class="step">1</div>
            <div class="msg-body">
              <textarea class="bubble" id="m1" rows="2" aria-label="Message one, the opener"></textarea>
              <div class="meta">
                <span class="dirty" id="d1" hidden>Edited</span>
                <span class="count" id="c1">0</span>
                <span class="spacer"></span>
                <button class="mini" data-shuffle="1">Shuffle</button>
                <button class="mini" data-copy="1">Copy</button>
              </div>
            </div>
          </div>

          <div class="gap">Wait for their reply</div>

          <div class="msg">
            <div class="step">2</div>
            <div class="msg-body">
              <textarea class="bubble" id="m2" rows="4" aria-label="Message two, the setup"></textarea>
              <div class="meta">
                <span class="dirty" id="d2" hidden>Edited</span>
                <span class="count" id="c2">0</span>
                <span class="spacer"></span>
                <button class="mini" data-shuffle="2">Shuffle</button>
                <button class="mini" data-copy="2">Copy</button>
              </div>
            </div>
          </div>

          <div class="gap">Send straight after</div>

          <div class="msg">
            <div class="step">3</div>
            <div class="msg-body">
              <textarea class="bubble" id="m3" rows="12" aria-label="Message three, the offers and the close"></textarea>
              <div class="meta">
                <span class="dirty" id="d3" hidden>Edited</span>
                <span class="count" id="c3">0</span>
                <span class="spacer"></span>
                <button class="mini" data-shuffle="3">Shuffle</button>
                <button class="mini" data-copy="3">Copy</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <p class="foot">
    <strong>The market column is a starting point, not a quote.</strong> Seeded values are the
    ballpark for a clean modern example and they are shown in italics until you touch them.
    Pedals whose vintage and reissue versions are worlds apart get no seed at all, because an
    average of sixty dollars and nine hundred is wrong for both. Nothing reaches the message
    until you tick the box saying you checked, and once you do you are quoting these figures to
    a stranger as fact.
  </p>
  <p class="foot">
    <strong>Asking price is not market value.</strong> It is parsed into its own column so the
    two can never be mistaken for each other, and prices the reader had to guess at are shown in
    amber so you can scan them.
  </p>
  <p class="foot">
    <strong>Wear is your call, not the tool's.</strong> Tone, era and quirks come from the model.
    Condition comes from the photos, which the tool cannot see, so Wear asks you first and Auto
    never picks it.
  </p>
  <p class="foot">
    <strong>Send these by hand.</strong> Messenger restricts accounts that fire identical text at
    volume, so the shuffle is account safety rather than decoration. Never paste all three at
    once: a stranger opening with a wall of text is the fastest way to get no reply.
  </p>
</div>

<script type="module">
const NOTES = [
  /* --- the four in the lot on the desk ----------------------------------- */
  { n: "DOD Boneshaker", re: /boneshaker/,
    tone: ["The Boneshaker will do a genuinely usable low grind and then go full fire breather without swapping pedals. Huge range on that thing.",
           "High headroom and a hefty box. It sounds expensive in a way most distortion pedals really do not."],
    era: ["That one was DOD and Black Arts Toneworks together, mid 2010s. Nobody saw that collaboration coming and it absolutely worked."],
    util: ["The depth knob works like an amp's resonance control rather than a bass knob, so it reaches way further down than a normal distortion. Made for down-tuned stuff.",
           "A three band semi parametric EQ on a distortion pedal is almost unheard of. You can carve a hole for the bass player without touching the amp."] },

  { n: "MXR M78 Badass '78 Distortion", re: /\\bm78\\b|badass ?'?78|badass ?78/,
    tone: ["The M78 does big amp stack distortion. Sounds like a cranked head rather than a fizzy pedal, which is the hard part to get right.",
           "Saturated enough for rhythm and it still lets a lead sing over the top. Not many three knob pedals manage both."],
    era: ["MXR took a 1978 distortion circuit and hot rodded it properly. Same DNA as the old ones with a lot more on tap."],
    util: ["That crunch button swaps the clipping between diodes and LEDs, so it is really two pedals in there. Plenty of people never press it.",
           "Distortion, tone, output. Three knobs and nothing to get lost in, which I appreciate more every year."] },

  { n: "Vox StompLab", re: /stomplab|\\bsl[12][gb]\\b/,
    tone: ["104 effect types and 44 amp models in a box that size is faintly ridiculous for the money."],
    era: ["Early 2010s, running the same 24 bit DSP that was in the VT amps, which is why it punches above what you paid."],
    util: ["There is a little expression pedal built into it you can assign to wah or volume. That is the bit that makes it actually gigable.",
           "Metal housing and it runs on AA batteries, so it is a genuine grab and go box rather than another thing needing a supply."] },

  { n: "Ibanez DFL Flanger", re: /\\bdfl\\b/,
    tone: ["The DFL is a proper 80s flanger and it will go from a gentle shimmer to full jet sweep."],
    era: ["Those are from the same Japanese run as the good Tube Screamers and they are still cheap, which will not last forever."] },

  { n: "Maestro Parametric Filter", re: /maestro|parametric ?filter/,
    tone: ["A Maestro parametric filter is a sweepable EQ you can use as an effect, which is a much stranger and more useful thing than it sounds."],
    era: ["Maestro were making pedals before most of the brands on your board existed. The old ones are proper artefacts."] },

  /* --- Boss, past the compact catch-all ---------------------------------- */
  { n: "Boss DS-2", re: /\\bds-?2\\b/,
    tone: ["The DS-2 in Turbo mode is a different animal from a DS-1. Way more mids, way more push."],
    util: ["There is a remote jack on those so you can flip modes with a footswitch. Almost nobody uses it."] },
  { n: "Boss OD-1", re: /\\bod-?1\\b/,
    tone: ["The OD-1 is where the whole overdrive pedal thing started, and it still just sounds like a good amp working."],
    era: ["The old silver screw OD-1s are proper collector money now."] },
  { n: "Boss OD-3", re: /\\bod-?3\\b/,
    tone: ["The OD-3 has more low end than an SD-1 and it takes a humbucker much better because of it."] },
  { n: "Boss CH-1", re: /\\bch-?1\\b|super ?chorus/,
    tone: ["The CH-1 is brighter and more hi-fi than a CE-2. Some people hate that, some people only want that."] },
  { n: "Boss CE-1", re: /\\bce-?1\\b|chorus ?ensemble/,
    tone: ["The CE-1 is the original, and it is a preamp and a vibrato as much as a chorus."],
    era: ["Those are getting properly rare now. Completely different beast from the compact pedals."],
    util: ["Mains powered and the size of a phone book, so it is not really a board pedal."] },
  { n: "Boss BF-2", re: /\\bbf-?2\\b/,
    tone: ["The BF-2 gets metallic in a way modern flangers are usually too polite to do."] },
  { n: "Boss DD-2", re: /\\bdd-?2\\b/,
    tone: ["The DD-2 was the first digital delay you could actually put on a board."],
    era: ["Same circuit as the DD-3 that replaced it, so the DD-2 badge is the only difference and people still pay for it."] },
  { n: "Boss DD-8", re: /\\bdd-?8\\b/,
    tone: ["The DD-8 does a lot for one compact box, and the looper on it is more useful than it has any right to be."] },
  { n: "Boss DD-200", re: /\\bdd-?200\\b/,
    tone: ["The DD-200 gets you most of a DD-500 in half the footprint, which for most boards is the right trade."],
    util: ["Presets and MIDI on that one, and it will run off a normal supply, which the 500s are fussier about."] },
  { n: "Boss RV-200", re: /\\brv-?200\\b/,
    tone: ["The RV-200 is a lot of reverb for the size. The shimmer on it holds up against pedals twice the price."] },
  { n: "Boss DD-500", re: /\\bdd-?500\\b/,
    tone: ["The DD-500 is the one you buy when you want to stop thinking about delay pedals."],
    util: ["Wants a proper high current supply. It will not run happily off a daisy chain."] },
  { n: "Boss RV-500", re: /\\brv-?500\\b/,
    tone: ["The RV-500 is deep enough that most people use about four of its algorithms and are perfectly happy."] },
  { n: "Boss RE-2", re: /\\bre-?2\\b|\\bre-?202\\b/,
    tone: ["The RE-2 gets the Space Echo wobble properly, and it fits on a board, which the real one very much does not."] },
  { n: "Boss OC-3", re: /\\boc-?3\\b/,
    tone: ["The OC-3 will track chords, which the OC-2 flatly refuses to do. Different tool, same family."] },
  { n: "Boss TR-2", re: /\\btr-?2\\b/,
    tone: ["The TR-2 is the cheapest way to get a proper amp tremolo, and it does the wave shape right."] },
  { n: "Boss PH-3", re: /\\bph-?3\\b/,
    tone: ["The PH-3 has the rise and fall modes that never quite reset, which is worth the price on its own."] },
  { n: "Boss CS-3", re: /\\bcs-?3\\b/,
    tone: ["The CS-3 squashes hard and hisses a bit, and it is the single most modded pedal Boss ever made for that reason."] },
  { n: "Boss NS-2", re: /\\bns-?2\\b/,
    util: ["The NS-2 send and return loop is the bit people miss. Used properly it kills the noise at the source instead of just gating the output."] },
  { n: "Boss LS-2", re: /\\bls-?2\\b/,
    util: ["The LS-2 is a genuinely useful utility box. Two loops, blend, and it will run a parallel clean path."] },
  { n: "Boss TU-2", re: /\\btu-?2\\b/,
    tone: ["The TU-2 does the same job as a TU-3 for a lot less money and it will still power your board."] },
  { n: "Boss RC-5", re: /\\brc-?5\\b/,
    tone: ["The RC-5 screen makes a huge difference over the older loopers. You can actually see what you are doing."] },
  { n: "Boss Waza Craft", re: /waza/,
    tone: ["The Waza versions have the custom mode that is genuinely different rather than just a badge."],
    era: ["Waza builds hold their money better than the standard ones, for whatever that is worth."] },

  /* --- MXR, past the brand catch-all ------------------------------------- */
  { n: "MXR Distortion+", re: /distortion ?\\+|distortion ?plus|\\bm104\\b/,
    tone: ["The Distortion+ is two knobs and germanium clipping and it is most of the Randy Rhoads sound."],
    era: ["The old script logo ones sound the same and cost three times as much, which tells you something."] },
  { n: "MXR Phase 95", re: /phase ?95/,
    tone: ["The Phase 95 gets you the 45 and the 90 in one mini box, plus the script switch. Clever little thing."] },
  { n: "MXR Flanger", re: /\\bmxr\\b[^\\n]*flanger|\\bm117\\b/,
    tone: ["The MXR flanger is the jet plane one. Van Halen used it and everybody has been chasing it since."] },
  { n: "MXR 10-Band EQ", re: /10-? ?band|\\bm108\\b/,
    tone: ["Ten bands is more than anyone needs and that is exactly why people buy it."],
    util: ["The older M108s are noisy and the newer ones fixed it. Worth knowing which one you have."] },
  { n: "MXR Stereo Chorus", re: /\\bmxr\\b[^\\n]*stereo ?chorus/,
    tone: ["Analog chorus with a proper bass filter on it, so it does not turn everything to mush low down."] },
  { n: "MXR Timmy", re: /\\btimmy\\b/,
    tone: ["The Timmy is about as transparent as an overdrive gets, and those bass and treble cuts are the whole trick."],
    era: ["Paul Cochrane's originals are the ones people hunt. The MXR version is the same circuit for a third of the money."] },

  /* --- Electro-Harmonix -------------------------------------------------- */
  { n: "Electro-Harmonix Small Clone", re: /small ?clone|nano ?clone/,
    tone: ["The Small Clone is the Come As You Are chorus and it does basically nothing else, which is fine."],
    util: ["One knob and a depth switch. Leave the switch up, that is what everybody actually uses."] },
  { n: "Electro-Harmonix Electric Mistress", re: /electric ?mistress/,
    tone: ["The Electric Mistress filter matrix setting is a whole sound on its own. Gilmour lived on it."],
    era: ["The old big box ones and the reissues are noticeably different pedals. Which one is yours?"] },
  { n: "Electro-Harmonix POG2", re: /\\bpog ?2\\b/,
    tone: ["The POG2 with the attack control is the one that does the swelling organ thing properly."],
    util: ["Pulls a good bit of current, so it wants its own supply output."] },
  { n: "Electro-Harmonix Micro POG", re: /micro ?pog/,
    tone: ["The Micro POG tracks so well it stops being an effect and starts being a second instrument."] },
  { n: "Electro-Harmonix Micro Synth", re: /micro ?synth/,
    tone: ["The Micro Synth is a row of faders and about an hour of your evening gone, in the best way."],
    util: ["It is a big box and it is a proper current draw. Plan the board around it rather than squeezing it in."] },
  { n: "Electro-Harmonix Freeze", re: /\\bfreeze\\b/,
    tone: ["The Freeze is a one trick pedal and the trick is genuinely great. Infinite pad under whatever you play next."] },
  { n: "Electro-Harmonix Oceans 11", re: /oceans ?1[12]/,
    tone: ["Eleven reverbs for that money is faintly ridiculous, and the shimmer and the polyphonic ones are the keepers."] },
  { n: "Electro-Harmonix Cathedral", re: /cathedral/,
    tone: ["The Cathedral reverse reverb is the setting everybody bought it for."] },

  /* --- wahs, volume and utility ------------------------------------------ */
  { n: "Vox Wah", re: /\\bv84[67]\\b|\\bvox\\b[^\\n]*wah/,
    tone: ["The Vox wahs have a vocal midrange the Dunlops never quite got. It is the inductor."],
    era: ["The Italian era V846s are the ones people chase. Which one is yours?"] },
  { n: "Ibanez WH10", re: /\\bwh-?10\\b/,
    tone: ["The WH10 is the Frusciante wah and it does the low fat sweep nothing else does."],
    util: ["The plastic housing on the originals is famously fragile. How is the treadle on yours?"] },
  { n: "Ernie Ball Volume Pedal", re: /\\bvp ?jr\\b|volume ?\\(?x\\)?|ernie ?ball/,
    util: ["The 250K and the 25K look identical and are for passive and active. The wrong one sounds thin and everybody blames the pedal.",
           "String driven, so those eventually need a new cord. Five minute job, worth checking though."] },
  { n: "Korg Pitchblack", re: /pitchblack/,
    tone: ["The Pitchblack display is readable on a dark stage, which sounds trivial until you are on one."],
    util: ["Sloped top so it faces you rather than the ceiling, and true bypass, and it powers the board. Good little box."] },
  { n: "TC Electronic PolyTune", re: /polytune/,
    util: ["Strum all six and it tunes them at once, which is worth the money on its own.",
           "There is a bypass switch on the back, buffered or true. Worth knowing which way yours is set."] },
  { n: "Boss Katana amp", re: /katana/,
    tone: ["Katanas turn up constantly and they are genuinely good for the money."] },

  /* --- vintage and rare -------------------------------------------------- */
  { n: "Dallas Rangemaster", re: /rangemaster/,
    tone: ["A Rangemaster is a treble booster and it is most of the early Sabbath and Clapton sound."],
    era: ["Original ones almost never come up. Most of what you see is a clone, and a lot of the clones are excellent."] },
  { n: "Octavia", re: /octavia|octavio/,
    tone: ["An Octavia is a fuzz with an octave up ring modulating on top, and it only really behaves above the twelfth fret. That is the point."] },
  { n: "Ross Compressor", re: /\\bross\\b/,
    tone: ["The grey Ross is the compressor the Keeley and half the boutique ones are copies of."],
    era: ["Original grey ones are collector money. The reissues are honestly very close."] },
  { n: "Foxx Foot Phaser", re: /\\bfoxx\\b/,
    era: ["The fuzzy velvet coating on those is either the best or worst thing in pedal history depending who you ask."] },
  { n: "Fender Blender", re: /\\bblender\\b/,
    tone: ["The Blender is an octave fuzz that does not really want to be reasonable. Enormous sound."] },
  { n: "Marshall ShredMaster", re: /shredmaster|guv'?nor|bluesbreaker/,
    tone: ["The ShredMaster is most of The Bends, which is not what the name suggests at all."],
    era: ["Those went from ten pound boot sale pedals to proper money once people worked out what was on those records."] },
  { n: "Demeter Tremulator", re: /tremulator/,
    tone: ["The Tremulator is the smoothest tremolo there is. No click, no thump, just a proper swell."] },
  { n: "Heil Talk Box", re: /talk ?box/,
    util: ["The tube goes in your mouth and it needs a spare amp to drive it, which is why most of them sit in cupboards."] },
  { n: "Binson Echorec", re: /echorec/,
    tone: ["The Echorec uses a spinning magnetic drum rather than tape, which is why nothing else has that particular swirl."],
    era: ["Those are museum pieces now. Gilmour built half of Meddle on one."] },
  { n: "Roland Space Echo", re: /space ?echo|\\bre-?201\\b|\\bre-?301\\b/,
    tone: ["A real Space Echo does something to the whole signal even with the delay off. It is the preamp as much as the tape."],
    util: ["Tape and pinch roller are consumables. Any idea when it last had a service?"] },
  { n: "Echoplex EP-3", re: /echoplex|\\bep-?3\\b/,
    tone: ["The EP-3 preamp is the famous bit. Half the people who own one leave the delay off entirely."],
    util: ["Tape machine, so the tape and the heads are wear items. Has yours been gone through?"] },
  { n: "Korg SDD-3000", re: /sdd-?3000/,
    tone: ["The SDD-3000 preamp is The Edge's whole sound, more than the delay ever was."] },
  { n: "Yamaha SPX90", re: /spx-?90/,
    era: ["The SPX90 was on every record for about a decade and now they go for nothing. Genuinely underrated."] },
  { n: "Univox EC-80", re: /\\bec-?80\\b/,
    tone: ["The EC-80 is a cheap tape echo that sounds far better than it has any right to."] },

  /* --- modern boutique and mid-market ------------------------------------ */
  { n: "Strymon blueSky", re: /blue ?sky/,
    tone: ["The blueSky shimmer was the one that made everybody else start putting shimmer on things."] },
  { n: "Strymon Mobius", re: /mobius/,
    tone: ["The Mobius has more modulation than most people will use in a lifetime, and the vibe setting alone justifies it."] },
  { n: "Strymon Sunset", re: /\\bsunset\\b/,
    tone: ["The Sunset is two drives in one box and they stack, which is really why people keep them."] },
  { n: "Strymon Riverside", re: /riverside/,
    tone: ["The Riverside cleans up off the guitar volume better than most digital drives have any business doing."] },
  { n: "Strymon Volante", re: /volante/,
    tone: ["The Volante does the drum echo thing as well as the tape thing, which almost nothing else bothers with."] },
  { n: "Eventide H9", re: /\\bh9\\b/,
    tone: ["The H9 is basically a whole rack in a box, and Crystals alone has sold thousands of them."],
    util: ["Everything is done from the phone app, which people either love or absolutely cannot stand."] },
  { n: "TC Electronic Flashback", re: /flashback/,
    tone: ["The Flashback tape and analog settings are good enough that most people never leave them."],
    util: ["TonePrint, so you hold your phone against the pickup to load a preset. Still a weirdly good idea."] },
  { n: "JHS 3 Series", re: /3 ?series/,
    tone: ["The 3 Series stuff is stripped right back and priced properly, and they sound like JHS pedals."] },
  { n: "Xotic SP Compressor", re: /\\bsp ?comp/,
    tone: ["The SP is a Ross style comp in a tiny box, and the blend on it means it never squashes the life out of things."] },
  { n: "EarthQuaker Dispatch Master", re: /dispatch ?master/,
    tone: ["The Dispatch Master is delay and reverb in one and it is probably the most sold EQD pedal for good reason."],
    util: ["Top mounted jacks, which I always appreciate on a tight board."] },
  { n: "Origin Effects Cali76", re: /cali ?76/,
    tone: ["The Cali76 is an 1176 in a pedal and it genuinely is, which is why they cost what they cost."] },
  { n: "Source Audio Nemesis", re: /nemesis/,
    tone: ["The Nemesis has more delay types than the Strymons and costs less, it just gets talked about less."] },
  { n: "Universal Audio UAFX", re: /\\buafx\\b|golden ?reverberator|starlight|astra|dream ?65|ruby ?63|woodrow/,
    tone: ["The UAFX boxes are basically UAD plugins with a footswitch, and they sound like it in the best way."],
    util: ["Those pull serious current. Check your supply has an output that can feed one before you buy."] },
  { n: "Chase Bliss Mood", re: /\\bmood\\b/,
    tone: ["The Mood is not really a delay or a reverb, it is a little sampler that misbehaves, and that is the appeal."] },
  { n: "Analog Man King of Tone", re: /king ?of ?tone/,
    tone: ["The King of Tone is two low gain drives that stack, and the hype is mostly deserved."],
    era: ["The waitlist is years long, which is why used ones sell above retail. Yours the two or three knob version?"] },
  { n: "Nobels ODR-1", re: /odr-?1/,
    tone: ["The ODR-1 is the Nashville secret. That spectrum knob does something no Tube Screamer will do."] },
  { n: "Maxon OD808", re: /\\bod-?808\\b|\\bmaxon\\b/,
    tone: ["Maxon built the original Ibanez pedals, so the OD808 is arguably the more direct line to an 808."] },
  { n: "DOD 250", re: /\\bdod\\b|\\b250\\b ?overdrive|overdrive ?preamp/,
    tone: ["The DOD 250 is two knobs and a lot of attitude. Same family tree as the MXR Distortion+."] },
  { n: "Way Huge", re: /way ?huge|swollen ?pickle|green ?rhino|aqua ?puss|red ?llama/,
    tone: ["Jeorge Tripps builds proper pedals. The Swollen Pickle in particular is a monster fuzz nobody talks about enough."] },
  { n: "Catalinbread", re: /catalinbread|belle ?epoch|topanga|dirty ?little ?secret/,
    tone: ["Catalinbread build things that sound like a specific record rather than a specific circuit, which I really like."] },
  { n: "Old Blood Noise", re: /old ?blood/,
    tone: ["Old Blood stuff is properly strange in a way most modern pedals are too well behaved to be."],
    util: ["Top mounted jacks on most of them."] },
  { n: "Death By Audio", re: /death ?by ?audio|fuzz ?war/,
    tone: ["The Fuzz War is exactly as subtle as the name suggests, and that is the whole reason to own one."] },
  { n: "Empress", re: /empress/,
    tone: ["Empress build the cleanest sounding digital stuff out there, and the compressor is on more pro boards than anything."] },
  { n: "Darkglass", re: /darkglass|\\bb[37]k\\b/,
    tone: ["The B7K is the modern bass distortion sound, more or less on its own."],
    util: ["DI out on those, which is half of why they end up on so many bass boards."] },
  { n: "Aguilar Tone Hammer", re: /tone ?hammer|\\baguilar\\b/,
    tone: ["The Tone Hammer preamp is what a lot of bass players use instead of trusting the house amp."] },
  { n: "Ibanez AD9", re: /\\bad-?9\\b|\\bad-?80\\b/,
    tone: ["The AD9 is a proper analog delay and it sits under a part rather than on top of it, same as the old Boss ones."] },
  { n: "Suhr Riot", re: /\\briot\\b|\\bsuhr\\b/,
    tone: ["The Riot does high gain without turning to mush, which is rarer in a pedal than it should be."] },
  { n: "Bogner", re: /bogner|ecstasy|burnley|harlow/,
    tone: ["The Bogner pedals are voiced like their amps, which is exactly what you want from an amp company making pedals."] },
  { n: "Greer Lightspeed", re: /lightspeed|\\bgreer\\b/,
    tone: ["The Lightspeed is one of those pedals people leave on all night and forget is there."] },
  { n: "Red Panda", re: /red ?panda|particle|tensor/,
    tone: ["The Particle is a granular delay, which sounds like a gimmick until you hear somebody use it properly."] },
  { n: "Hologram", re: /hologram|microcosm/,
    tone: ["The Microcosm makes ambient music almost by itself, which is either the best or worst thing about it."] },
  { n: "Meris", re: /\\bmeris\\b|mercury7|polymoon|ottobit/,
    tone: ["Meris boxes are tiny and go extremely deep. The Mercury7 reverb is on a lot of records now."] },
  { n: "Neunaber", re: /neunaber|immerse/,
    tone: ["The Immerse is one of the cleanest reverbs at that price and it flies completely under the radar."] },
  { n: "Line 6 HX Stomp", re: /hx ?stomp|\\bhelix\\b|\\bhx ?effects\\b/,
    tone: ["The HX Stomp does the job of about six pedals and a tuner, which is why so many boards are just that and a drive."] },
  { n: "Line 6 M9", re: /\\bm[59]\\b ?(?:stompbox|looper)?|\\bm13\\b/,
    tone: ["The M series still holds up and they go for very little now. Enormous amount of pedal for the money."] },
  { n: "DigiTech Drop", re: /\\bthe ?drop\\b|digitech ?drop/,
    util: ["The Drop tunes down without retuning, which for a covers gig is worth every penny."] },
  { n: "Seymour Duncan pedal", re: /seymour ?duncan|palladium|vapor ?trail/,
    tone: ["The Vapor Trail is an honest analog delay and it never gets mentioned in the same breath as the Carbon Copy, which is a bit unfair."] },
  { n: "Danelectro", re: /danelectro|cool ?cat|\\bfab\\b/,
    tone: ["The Danelectro minis are plastic and cheap and a couple of them genuinely punch above it."] },
  { n: "Donner", re: /\\bdonner\\b/,
    tone: ["Donner pedals are the modern version of what Danelectro was doing. Cheap, cheerful, occasionally surprising."] },
  { n: "NUX", re: /\\bnux\\b/,
    tone: ["NUX have got properly good in the last few years. The verdugo series in particular."] },
  { n: "Hotone", re: /hotone/,
    tone: ["Hotone minis are tiny and they work, which on a crowded board counts for a lot."] },
  { n: "Fender pedal", re: /hammertone|pugilist|santa ?ana|the ?bends|\\bfender\\b/,
    tone: ["Fender's recent pedals are much better than people expect and the anodised boxes look great on a board."],
    util: ["The Hammertones have the jacks up top and a magnetic battery door, which is a nice touch."] },
  { n: "Ibanez TS808", re: /\\bts-?808\\b/,
    tone: ["Man, a TS808 into an amp that is already breaking up is still one of my favourite sounds. Just so warm.",
           "The 808 is the one everybody chases and honestly a lot of it is that mid hump doing the work. Still love it though."],
    era:  ["The real 1979 to 1981 ones with the JRC4558D in them are getting silly money now. Yours an original or a reissue?"],
    util: ["Ibanez put the input on the left, which still catches me out every time after years of Boss pedals."] },

  { n: "Ibanez Tube Screamer", re: /\\bts-?(9|10|7)\\b|tube ?screamer/,
    tone: ["I got to play a TS9 for the first time in ages the other day and man, it was fun. So warm.",
           "A Tube Screamer is really a mid bump and a volume push, and it is still the best thing you can put in front of a loud amp.",
           "Funny thing about Screamers is most people run the drive almost off and the level up, which is not at all what the knobs suggest."],
    era:  ["The early 80s TS9s with the JRC chip are the ones people hunt for. Any idea what year yours is?"],
    util: ["Standard 9V, and the battery door on the bottom is one of the better ones. No screwdriver needed."] },

  { n: "Boss DS-1", re: /\\bds-?1\\b/,
    tone: ["Honestly the DS-1 is underrated. Roll that tone back to about nine o'clock and it turns into a completely different pedal.",
           "The DS-1 is everybody's first distortion and then everybody quietly buys another one ten years later. I have done it twice."],
    era:  ["The Japanese ones from before about 88 have a different chip in them and people pay up for those. Is yours a black label?"],
    util: ["Love that you can get at the battery on a Boss without a screwdriver. Whoever designed that thumb screw deserved a raise."] },

  { n: "Boss SD-1", re: /\\bsd-?1\\b/,
    tone: ["SD-1 into a loud amp is a sound I am never going to get tired of.",
           "The SD-1 is the asymmetrical one, so it has got a bit more hair on it than a Screamer for half the money. Great pedal."],
    era:  ["The old Made in Japan SD-1s are worth a look if you ever come across one."] },

  { n: "Boss BD-2", re: /\\bbd-?2\\b|blues ?driver/,
    tone: ["The BD-2 is badly underrated. Cleans up off the guitar volume better than a lot of boutique stuff at four times the money.",
           "Blues Driver has that slightly fizzy top end everybody complains about and then really misses once it is gone."] },

  { n: "Boss MT-2", re: /\\bmt-?2\\b|metal ?zone/,
    tone: ["Everybody dunks on the Metal Zone but that parametric mid control is genuinely useful once you stop leaving it scooped.",
           "The MT-2 got its whole reputation from the factory setting. Sweep those mids up and it is a totally different box."] },

  { n: "Boss HM-2", re: /\\bhm-?2\\b/,
    tone: ["The HM-2 has exactly one setting and we all know which one it is."],
    era:  ["The Japanese HM-2s go for proper money now, which nobody saw coming twenty years ago."] },

  { n: "Boss DD-3", re: /\\bdd-?3\\b/,
    tone: ["The DD-3 is still the one for short slapback, and that hold function is half the reason people hang onto them."],
    util: ["The direct out on those is handy if you ever run two amps."] },

  { n: "Boss CE-2", re: /\\bce-?2\\b/,
    tone: ["The CE-2 is the chorus everyone else has spent forty years trying to clone. One rate, one depth, done."],
    era:  ["The old Made in Japan CE-2s are the ones people chase."] },

  { n: "Boss GE-7", re: /\\bge-?7\\b/,
    tone: ["Everybody buys a GE-7 to shape their tone and ends up using it as a clean volume kick for solos. Every time."],
    util: ["Cheapest way there is to fix a boxy amp. I keep one on the board just for that."] },

  { n: "Boss OC-2", re: /\\boc-?2\\b/,
    tone: ["The OC-2 tracks low single notes better than almost anything and completely falls apart on chords, which is the charm."],
    util: ["Monophonic, so it wants one note at a time and low on the neck. Nothing has quite replaced that wobble."] },

  { n: "Boss RV-6", re: /\\brv-?6\\b/,
    tone: ["The RV-6 shimmer mode is the reason people who swore off reverb pedals bought one anyway."],
    util: ["Draws a bit more than the old Boss pedals, so it wants a proper supply rather than the end of a long daisy chain."] },

  { n: "Boss TU-3", re: /\\btu-?3\\b/,
    util: ["The TU-3 will power the rest of the board off its output, which is honestly why half of them get bought."] },

  { n: "Boss RC looper", re: /\\brc-?(1|2|3|5|10|30|300|500)\\b/,
    tone: ["The RC is the pedal people buy to practise with and then end up writing everything on."] },

  { n: "ProCo RAT", re: /\\brat ?2\\b|\\bproco\\b|\\brat\\b/,
    tone: ["The filter knob on a RAT runs backwards from what you expect, and working that out is basically the whole pedal.",
           "A RAT with the filter rolled back is a fuzz and with it wide open it is nearly a distortion. Same box, two pedals."],
    era:  ["The whiteface ones from the mid 80s with the LM308 in them are the ones people go after. Is yours a RAT 2?"],
    util: ["The older RATs have that oddball power jack that will not take a normal supply. Always worth checking."] },

  { n: "Electro-Harmonix Big Muff", re: /big ?muff|\\bmuff\\b/,
    tone: ["Nothing sustains like a Muff. Nothing fights a bass player quite like one either.",
           "The Muff has the mids scooped clean out, which is why it vanishes in a band mix unless you put something after it. Worth it anyway."],
    era:  ["Triangle, Ram's Head, Civil War, everyone has a favourite. Any idea which version yours is?"] },

  { n: "Electro-Harmonix Small Stone", re: /small ?stone/,
    tone: ["Small Stone with the colour switch in is one of the most recognisable phaser sounds there is."] },

  { n: "Electro-Harmonix Deluxe Memory Man", re: /deluxe ?memory ?man|\\bdmm\\b/,
    tone: ["The Deluxe Memory Man has that chorus on the repeats that no digital delay has ever quite got right."],
    util: ["Those big EHX boxes can be fussy about power supplies. Does yours come with the right one?"] },

  { n: "Electro-Harmonix Memory Man", re: /memory ?(man|toy)/,
    tone: ["Analog repeats that get darker and mushier as they go, which is exactly what you want sitting underneath everything else."] },

  { n: "Electro-Harmonix Holy Grail", re: /holy ?grail/,
    tone: ["The Holy Grail spring setting is still the fastest way to make a solid state amp sound like it has a tank in it."] },

  { n: "Electro-Harmonix POG", re: /\\bpog\\b|\\bhog\\b/,
    tone: ["The POG tracking polyphonically was witchcraft when it came out and it is still the reason people keep them."],
    util: ["Those pull a fair bit of current, so they want their own supply output rather than a daisy chain."] },

  { n: "Electro-Harmonix Soul Food", re: /soul ?food/,
    tone: ["The Soul Food is the Klon idea for the price of a tank of gas and honestly it is close enough for me."] },

  { n: "MXR Phase 90", re: /phase ?90/,
    tone: ["The Phase 90 has one knob and it never needed a second one. Perfect pedal."],
    era:  ["Script logo or block? Everyone has an opinion and both of them sound like a Phase 90 to me."] },

  { n: "MXR Carbon Copy", re: /carbon ?copy/,
    tone: ["The Carbon Copy is dark on purpose, which is exactly why it sits underneath a part instead of on top of it.",
           "Everybody's first analog delay and most people never actually need a better one."] },

  { n: "MXR Dyna Comp", re: /dyna ?comp/,
    tone: ["The Dyna Comp squashes hard and puts that little pop on the front of every note. That is the whole point of it."] },

  { n: "MXR Micro Amp", re: /micro ?amp/,
    tone: ["One knob, clean boost, nothing to get wrong. Those stay on a board forever."] },

  { n: "Dunlop Cry Baby", re: /cry ?baby|\\bwah\\b|\\bgcb-?95\\b/,
    tone: ["A wah is really a mid filter you steer with your foot, which is why parking it half open works so well.",
           "Half the great wah parts on record are barely moving. People treat it as an effect when it is really a tone control."],
    era:  ["The old Italian made ones with the halo inductor are the holy grail. Yours a standard GCB?"],
    util: ["How is the pot on that one? They get scratchy with age and it is a ten minute fix, not a dealbreaker."] },

  { n: "Klon", re: /\\bklon\\b|centaur|\\bktr\\b/,
    tone: ["The Klon gets called transparent and it is really a mid and treble push, which is a better pedal than transparent anyway."],
    era:  ["Gold or silver? The originals have gone completely mad price wise."],
    util: ["Runs off 9V and doubles it internally, so it wants a clean supply and does not love being daisy chained."] },

  { n: "Wampler Tumnus", re: /tumnus/,
    tone: ["The Tumnus is a Klon in a box a third the size for a twentieth of the money. The argument mostly ends there."],
    era:  ["Wampler has been on a real run the last few years. Everything I have played of theirs has been solid."] },

  { n: "Fulltone OCD", re: /\\bocd\\b/,
    tone: ["The OCD in HP mode is a genuinely different pedal from LP and a lot of people never flip that switch."],
    util: ["Those will take 9V or 18V, and the 18V is worth trying if you have a supply that does it. Much more headroom."] },

  { n: "JHS Morning Glory", re: /morning ?glory/,
    tone: ["The Morning Glory is the Bluesbreaker idea done properly, and it stacks under a fuzz better than nearly anything."],
    era:  ["JHS builds are always clean inside. I have never opened one and thought twice."] },

  { n: "Xotic EP Booster", re: /\\bep ?booster\\b/,
    tone: ["The EP Booster is a discrete FET preamp with about 20dB on tap, and it puts a shimmer on the top and bottom you really only notice when you switch it off.",
           "Brilliant for making up signal loss on a big board, or just shoving an already dirty amp over the edge into something lovely."],
    era: ["It is the preamp stage out of a vintage EP-3 tape echo in a mini enclosure. That is where the whole always-on boost idea came from."],
    util: ["The dip switches inside are where the real pedal is. Most people never take the back off and find them.",
           "Runs on 9V or 18V. Give it 18 and you get noticeably more clean headroom before it starts to break up."] },

  { n: "Fuzz Face", re: /fuzz ?face/,
    tone: ["A Fuzz Face wants to be first in the chain and wants your guitar volume knob, and it will sulk behind a buffer.",
           "Two transistors and a volume control and it still does something no modern fuzz quite manages."],
    era:  ["Germanium or silicon? The old NKT275 ones are a completely different animal."],
    util: ["If it is a germanium one it is positive ground, so it needs its own isolated output. Cannot share a daisy chain."] },

  { n: "Z.Vex Fuzz Factory", re: /fuzz ?factory|\\bzvex\\b|z\\.?vex/,
    tone: ["The Fuzz Factory is barely a pedal and mostly a controlled oscillation, which is exactly why people love it."],
    era:  ["Hand painted or vexter? The hand painted ones are proper objects."] },

  { n: "DigiTech Whammy", re: /whammy/,
    tone: ["The Whammy is one of the few pedals that changed what people wrote, not just how it sounded."],
    util: ["The older Whammys are picky about power and do not run off a normal 9V daisy chain. Does yours come with the supply?"] },

  { n: "DigiTech Bad Monkey", re: /bad ?monkey/,
    tone: ["The Bad Monkey was fifty bucks for years and then the internet found out, which tells you everything."],
    util: ["That mixer out on the side is a genuinely useful thing nobody ever mentions."] },

  { n: "Line 6 DL4", re: /\\bdl-?4\\b/,
    tone: ["The DL4 is on more boards than anything, mostly for the looper nobody admits is why they bought it."],
    util: ["Does yours come with the power brick? The original DL4 needs 9V AC, not DC, and the supply is worth more than people think."] },

  { n: "Strymon Timeline", re: /timeline/,
    tone: ["The Timeline is the delay people buy when they are done buying delays."],
    util: ["Strymons want a proper 9V at about 250mA on their own output. They will not run off the end of a daisy chain."] },

  { n: "Strymon BigSky", re: /big ?sky/,
    tone: ["The BigSky is genuinely too much reverb for most music and everybody keeps theirs anyway."],
    util: ["Wants its own high current supply output like the rest of the Strymons."] },

  { n: "Strymon El Capistan", re: /el ?capistan|\\bel cap\\b/,
    tone: ["The El Capistan does the tape wobble properly, which is the part every other tape emulation gets wrong."],
    util: ["Top mounted jacks on those, which I always appreciate. Makes the board so much easier to lay out."] },

  { n: "Strymon Flint", re: /\\bflint\\b/,
    tone: ["Flint is a tremolo and a reverb in the right order, which is most of what a blackface amp actually was."] },

  { n: "Walrus Audio Slö", re: /\\bsl[oö]/,
    tone: ["The Slö in dark mode is one of those sounds you end up building a whole song around by accident."],
    era:  ["Walrus have been on a tear lately. Everything of theirs I have played has been really well thought out."],
    util: ["Top mounted jacks. Always appreciate when builders do that, makes routing a board so much easier."] },

  { n: "Walrus Audio Julia", re: /\\bjulia\\b/,
    tone: ["The lag control on the Julia blends chorus into vibrato, which is a knob a lot more pedals should have."],
    util: ["Top jacks on those, which I am always glad to see."] },

  { n: "TC Electronic Hall of Fame", re: /hall ?of ?fame|\\bhof\\b/,
    tone: ["The Hall of Fame is the reverb people buy to hold them over and then never actually replace."],
    util: ["The TonePrint thing where you hold your phone up to the pickup to load a preset is still the weirdest good idea in pedals."] },

  { n: "TC Electronic Ditto", re: /\\bditto\\b/,
    tone: ["One knob and one switch. The Ditto is proof most loopers have far too many buttons."] },

  { n: "EarthQuaker Devices Plumes", re: /plumes/,
    tone: ["Plumes mode two takes the clipping diodes out entirely and that is the setting most people end up living on."],
    era:  ["EQD stuff has been consistently great. Very cool builds."],
    util: ["Top mounted jacks on the EQD boxes, which makes such a difference on a tight board."] },

  { n: "EarthQuaker Devices Avalanche Run", re: /avalanche ?run/,
    tone: ["The Avalanche Run in reverse mode is the sort of thing you buy for one song and then use on everything."],
    util: ["Top jacks and an expression input. EQD think about the board layout more than most."] },

  { n: "Keeley Compressor", re: /keeley/,
    tone: ["The Keeley comp is the pedal that made people stop thinking of compression as a studio thing."],
    era:  ["Keeley builds have always been tidy. Never opened one and been disappointed."] },

  { n: "Chase Bliss", re: /chase ?bliss/,
    tone: ["Chase Bliss pedals hide the actual pedal behind the dip switches on the back, which is either the best or the worst part."],
    era:  ["Those are proper boutique builds and they hold value better than almost anything else out there."],
    util: ["They want a clean isolated supply. Worth knowing before you daisy chain one."] },

  { n: "Univibe", re: /uni-? ?vibe|\\bvibe\\b/,
    tone: ["A Univibe is really a badly built phaser and that is exactly why nothing else sounds like one."],
    era:  ["The original ones are enormous and rare. Most of what is out there now is a clone and some of them are great."] },

  { n: "Behringer", re: /behringer/,
    tone: ["Behringer clones are plastic and honestly fine. Half the circuit is the same as the pedal they copied."],
    util: ["Light enough that velcro barely holds them, which is the one real complaint."] },

  { n: "Mooer", re: /\\bmooer\\b/,
    tone: ["Mooer minis punch well above the price, and on a small board that footprint is the whole argument."],
    util: ["No battery in the minis, so they need a supply. Worth saying up front."] },

  { n: "Joyo", re: /\\bjoyo\\b/,
    tone: ["Joyo makes a shameless clone of something good for thirty bucks, and for a spare board that is exactly the right call."] },

  { n: "Zoom multi-effects", re: /\\bzoom\\b|\\bms-?(50|60|70|100)\\b/,
    tone: ["A Zoom multi earns its spot as a utility box for the one weird sound a song needs."],
    util: ["Those run off batteries too, which is handy for practice away from the board."] },

  { n: "Boss compact", re: /\\bboss\\b/,
    tone: ["Boss compacts are basically indestructible, which is why there are so many secondhand ones and why they all still work."],
    era:  ["The old Made in Japan ones with the silver screw are the ones collectors chase. Any idea where yours was built?"],
    util: ["Boss put the input on the right hand side, which still catches people out constantly."] },

  { n: "MXR", re: /\\bmxr\\b/,
    tone: ["MXR boxes do one thing with one or two knobs and there is a reason that formula never went away."],
    util: ["The older MXRs need the bottom plate off to get at the battery, which is a bit of a faff."] },
];


/* --- condition. Not knowable from the model, so it is asked, not guessed. -- */
const WEAR = {
  worn: [
    p => \`That \${p} looks properly well loved. How long have you had it on your board?\`,
    p => \`Man, that \${p} has seen some shows. How long has it been with you?\`,
    p => \`Love the honest wear on that \${p}. Means it actually got used, which I like.\`,
    p => \`That \${p} has got some real miles on it. Scuffs do not bother me at all, for what it is worth.\`,
  ],
  mint: [
    p => \`That \${p} is incredibly clean. Looks like it barely left the box.\`,
    p => \`Wow, that \${p} is mint. You do not see them looking like that very often.\`,
    p => \`That \${p} looks untouched. Did you end up not using it much?\`,
  ],
  ask: [
    p => \`How is the \${p} holding up? Jacks and pots all still solid?\`,
    p => \`Any issues with the \${p}, scratchy pots or anything? Not a dealbreaker either way, just want to know what I am looking at.\`,
    p => \`Is the \${p} all original or has it had anything done to it?\`,
  ],
};

/* ---------------------------------------------------------------------------
   USED MARKET SEEDS, kept SEPARATE from the note table on purpose: a tone note
   is true forever and a price is true for about a quarter, so they have no
   business sharing a lifetime.

   A \`null\` means the pedal is known and deliberately carries NO number,
   because its vintage and reissue versions are worlds apart. A Big Muff is
   sixty dollars or nine hundred depending which one it is, and the average of
   those is wrong for both. Same reasoning as refusing a market price under
   MIN_SAMPLE_SIZE: no number beats a number with nothing behind it.

   Everything here is a ballpark for a clean modern example and is shown as an
   estimate until somebody touches it. It is a place to start checking, not an
   answer.
--------------------------------------------------------------------------- */
const MV = {
  "Boss DS-1": 45, "Boss SD-1": 45, "Boss BD-2": 70, "Boss MT-2": 60,
  "Boss HM-2": null, "Boss DD-3": 90, "Boss CE-2": null, "Boss GE-7": 70,
  "Boss OC-2": null, "Boss RV-6": 110, "Boss TU-3": 65, "Boss RC looper": null,
  "Boss compact": null,
  "Ibanez TS808": null, "Ibanez Tube Screamer": 110,
  "ProCo RAT": 75,
  "Electro-Harmonix Big Muff": null, "Electro-Harmonix Small Stone": null,
  "Electro-Harmonix Deluxe Memory Man": null, "Electro-Harmonix Memory Man": null,
  "Electro-Harmonix Holy Grail": 80, "Electro-Harmonix POG": null,
  "Electro-Harmonix Soul Food": 60,
  "MXR Phase 90": 70, "MXR Carbon Copy": 100, "MXR Dyna Comp": 65,
  "MXR Micro Amp": 55, "MXR": null,
  "Dunlop Cry Baby": 65,
  "Klon": null, "Wampler Tumnus": 130, "Fulltone OCD": 90,
  "JHS Morning Glory": 140, "Xotic EP Booster": 100,
  "Fuzz Face": null, "Z.Vex Fuzz Factory": 180,
  "DigiTech Whammy": null, "DigiTech Bad Monkey": 90, "Line 6 DL4": 180,
  "Strymon Timeline": 320, "Strymon BigSky": 380, "Strymon El Capistan": 230,
  "Strymon Flint": 250,
  "Walrus Audio Slö": 180, "Walrus Audio Julia": 150,
  "TC Electronic Hall of Fame": 85, "TC Electronic Ditto": 70,
  "EarthQuaker Devices Plumes": 90, "EarthQuaker Devices Avalanche Run": 220,
  "Keeley Compressor": 110, "Chase Bliss": null, "Univibe": null,
  "Behringer": 25, "Mooer": 40, "Joyo": 30, "Zoom multi-effects": 80,
  "DOD Boneshaker": 95, "MXR M78 Badass '78 Distortion": 65, "Vox StompLab": 50,
  "Boss DS-2": 65, "Boss OD-3": 60, "Boss CH-1": 55, "Boss CS-3": 55,
  "Boss TR-2": 60, "Boss PH-3": 70, "Boss NS-2": 65, "Boss LS-2": 70,
  "Boss TU-2": 45, "Boss OC-3": 85, "Boss DD-8": 130, "Boss DD-200": 200,
  "Boss RV-200": 190, "Boss DD-500": 260, "Boss RV-500": 280, "Boss RC-5": 170,
  "Boss OD-1": null, "Boss CE-1": null, "Boss BF-2": null, "Boss DD-2": null,
  "MXR Distortion+": 60, "MXR Phase 95": 75, "MXR 10-Band EQ": 120,
  "Electro-Harmonix Small Clone": 60, "Electro-Harmonix Micro POG": 175,
  "Electro-Harmonix POG2": 250, "Electro-Harmonix Oceans 11": 90,
  "Electro-Harmonix Freeze": 80, "Electro-Harmonix Electric Mistress": null,
  "Korg Pitchblack": 60, "TC Electronic PolyTune": 70,
  "TC Electronic Flashback": 90, "Xotic SP Compressor": 110,
  "EarthQuaker Dispatch Master": 130, "Strymon blueSky": 250,
  "Strymon Mobius": 300, "Strymon Sunset": 250, "Strymon Riverside": 250,
  "Eventide H9": 350, "Origin Effects Cali76": 250, "Source Audio Nemesis": 220,
  "Nobels ODR-1": 70, "Ibanez AD9": null, "Ibanez WH10": null,
  "Vox Wah": null, "Dallas Rangemaster": null, "Ross Compressor": null,
  "Echoplex EP-3": null, "Roland Space Echo": null, "Binson Echorec": null,
  "Analog Man King of Tone": null, "Line 6 HX Stomp": 450, "Line 6 M9": 200,
};

function noteFor(raw) {
  const q = String(raw || "").toLowerCase().replace(/\\s+/g, " ").trim();
  if (q.length < 3) return null;                 /* three character floor */
  for (const e of NOTES) if (e.re.test(q)) return e;
  return null;
}

/* Auto rotates only what the model can actually tell you. Wear is excluded on
   purpose: the tool has not seen the photographs. */
const AUTO_KINDS = ["tone", "era", "util"];

function pickNote(hit, cat, wearState, pedal, seed) {
  if (cat === "wear") {
    const pool = WEAR[wearState] || WEAR.ask;
    return pool[seed % pool.length](pedal);
  }
  if (!hit) return null;
  if (cat === "auto") {
    const have = AUTO_KINDS.filter(k => hit[k] && hit[k].length);
    if (!have.length) return null;
    const kind = have[seed % have.length];
    const pool = hit[kind];
    return pool[Math.floor(seed / have.length) % pool.length];
  }
  const pool = hit[cat];
  if (!pool || !pool.length) return null;
  return pool[seed % pool.length];
}

/* ---------------------------------------------------------------------------
   THE LISTING PARSER.

   A price the reader invented is worse than a price it left blank, because it
   feeds the offer arithmetic and then gets quoted at somebody. So there are
   three rules in descending confidence and the third one is fenced:

     1. a dollar sign wins outright
     2. a separator then a number at the end of the line
     3. a bare trailing number, ONLY when the token in front of it is not the
        kind of word a model number follows

   Rule three exists because "Boss DS-1 45" is the commonest listing shape
   there is, and it is fenced because "MXR Phase 90" is the commonest way to
   get it wrong. Anything rule three produces is marked and shown in amber,
   because it is the one class of number nobody typed and nobody confirmed.
--------------------------------------------------------------------------- */
const BRANDS = [
  "Electro-Harmonix", "Electro Harmonix", "EHX", "Chase Bliss Audio", "Chase Bliss",
  "EarthQuaker Devices", "EarthQuaker", "EQD", "Walrus Audio", "Walrus",
  "TC Electronic", "Old Blood Noise", "Death By Audio", "Origin Effects",
  "Source Audio", "Seymour Duncan", "Way Huge", "Dallas Arbiter", "Analog Man",
  "Analogman", "Voodoo Lab", "Pro Co", "ProCo", "Line 6", "Z.Vex", "ZVex", "Zvex",
  "Boss", "Ibanez", "MXR", "Dunlop", "Strymon", "Fulltone", "JHS", "Wampler",
  "Xotic", "Keeley", "DigiTech", "Digitech", "Behringer", "Mooer", "Joyo",
  "Donner", "Zoom", "Fender", "Marshall", "Vox", "Catalinbread", "Empress",
  "Eventide", "Aguilar", "Darkglass", "Danelectro", "Caline", "NUX", "Hotone",
  "Valeton", "Korg", "Peterson", "Snark", "Truetone", "Cioks", "DOD", "Dod",
  "Maxon", "Klon", "Univibe", "Rowin", "Ampeg", "Orange", "Blackstar",
];
/* Words a model NUMBER follows. A number sitting after one of these is part of
   the product's name, not its price. "Phase 90" was the pedal that earned the
   list. */
const MODEL_WORDS = new Set([
  "phase", "model", "mk", "mark", "rev", "revision", "type", "series", "v",
  "ts", "dd", "rc", "oc", "ce", "sd", "ds", "hm", "mt", "ge", "rv", "tu", "dl",
  "ep", "ms", "gcb", "big", "small", "micro", "nano", "deluxe", "line", "vol",
]);

function parseMoney(line) {
  let m = line.match(/\\$\\s*(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{1,2}))?/);
  if (m) return { value: Number(m[1].replace(/,/g, "")) + (m[2] ? Number("0." + m[2]) : 0), guessed: false };

  m = line.match(/(?:[-\\u2013\\u2014:@]|\\bfor\\b|\\basking\\b|\\bobo\\b)\\s*(\\d{2,5})(?:\\.(\\d{1,2}))?\\s*(?:each|ea\\.?|obo|firm|shipped|net|ono|\\+\\s*ship(?:ping)?)?\\s*$/i);
  if (m) return { value: Number(m[1]) + (m[2] ? Number("0." + m[2]) : 0), guessed: false };

  m = line.match(/(\\S+)\\s+(\\d{2,5})(?:\\.(\\d{1,2}))?\\s*(?:each|ea\\.?|obo|firm|shipped|net|ono|\\+\\s*ship(?:ping)?)?\\s*$/i);
  if (m) {
    const before = m[1].toLowerCase().replace(/[^a-z0-9-]/g, "");
    const head = before.split("-")[0];
    if (MODEL_WORDS.has(before) || MODEL_WORDS.has(head)) return null;
    return { value: Number(m[2]) + (m[3] ? Number("0." + m[3]) : 0), guessed: true };
  }
  return null;
}

function splitBrand(name) {
  const lower = name.toLowerCase();
  for (const b of BRANDS) {
    const bl = b.toLowerCase();
    if (lower === bl) return { brand: b, model: "" };
    if (lower.startsWith(bl + " ")) return { brand: b, model: name.slice(b.length).trim() };
  }
  return { brand: "", model: name };
}

function parseListing(text) {
  const rows = [];
  let guessedCount = 0;
  let noPrice = 0;

  for (let raw of String(text).split(/\\r?\\n/)) {
    let line = raw.trim();
    if (!line) continue;
    line = line.replace(/^[-*•·\\u2013\\u2014>]+\\s*/, "").replace(/^\\d{1,2}[.)]\\s+/, "").trim();
    if (!line) continue;
    if (!/[a-z]/i.test(line)) continue;                       /* a bare price line */
    if (/^(pedals?|for sale|prices?|selling|list|gear|my board|board)\\b[:\\s]*$/i.test(line)) continue;

    const money = parseMoney(line);
    let name = line;
    if (money) {
      name = line
        .replace(/\\$\\s*[\\d,]+(?:\\.\\d{1,2})?/, " ")
        .replace(/(?:[-\\u2013\\u2014:@]|\\bfor\\b|\\basking\\b)?\\s*\\d{2,5}(?:\\.\\d{1,2})?\\s*(?:each|ea\\.?|obo|firm|shipped|net|ono|\\+\\s*ship(?:ping)?)?\\s*$/i, " ");
    }
    name = name.replace(/\\s{2,}/g, " ").replace(/[\\s,\\-\\u2013\\u2014:]+$/, "").trim();
    if (!name) name = line;

    const { brand, model } = splitBrand(name);
    const hit = noteFor(name);
    const seed = hit && Object.prototype.hasOwnProperty.call(MV, hit.n) ? MV[hit.n] : undefined;

    if (money && money.guessed) guessedCount += 1;
    if (!money) noPrice += 1;

    rows.push({
      brand, model,
      ask: money ? money.value : null,
      askGuessed: Boolean(money && money.guessed),
      mv: typeof seed === "number" ? seed : null,
      mvSeeded: typeof seed === "number",
      mvSpread: hit ? seed === null : false,
    });
  }
  return { rows, guessedCount, noPrice };
}

/* ---------------------------------------------------------------------------
   MESSAGE COPY.
--------------------------------------------------------------------------- */
const OPENERS_ANY = [
  c => \`\${c.hey}you still got the \${c.pedal}?\`,
  c => \`\${c.hey}saw the \${c.pedal}. Still around?\`,
  c => \`\${c.hey}that \${c.pedal} still up for grabs?\`,
  c => \`\${c.hey}quick one, is the \${c.pedal} still up?\`,
  c => \`\${c.hey}anybody grab the \${c.pedal} yet?\`,
  c => \`\${c.hey}is the \${c.pedal} still going?\`,
  c => \`\${c.hey}good taste man. \${c.pedal} still there?\`,
];
const OPENERS_LOT = [
  c => \`\${c.hey}you selling these one at a time or would you do the whole lot?\`,
  c => \`\${c.hey}sick board. Is the \${c.pedal} still up?\`,
  c => \`\${c.hey}is the \${c.pedal} still there? And is there more where that came from?\`,
  c => \`\${c.hey}is the whole lot still up or has it been picked over?\`,
];
/* When the gear note ends in a question, the opener must NOT also ask one.
   Two questions in a first message from a stranger gets one answer at best. */
const OPENERS_FLAT = [
  c => \`\${c.hey}just saw your \${c.pedal} listing.\`,
  c => \`\${c.hey}nice, a \${c.pedal}.\`,
  c => \`\${c.hey}spotted the \${c.pedal} in your listing.\`,
  c => \`\${c.hey}always good to see a \${c.pedal} pop up.\`,
];

const SETUPS = [
  c =>
\`So quick heads up on who you're dealing with...we're 4 dudes opening a store. Like an actual brick and mortar spot. I buy gear for \${c.shop}, we've got a decent online thing going already, and now we're filling physical shelves!

Next round of buying is later this month. \${c.lotCap} would you be down to do a deal on whatever you're still sitting on at the end of \${c.month} or start of \${c.nextMonth}? If it's the right deal we may be able to move quicker than that.

Next, it really depends what you're after. Some people want cash in hand this week. Some want the most money possible and don't mind waiting a few weeks for it. We do both, no stress either way.

If you can wait on the cash, and want to maximize what you get...we can start moving TODAY 💰💵💪

Wanna hear more?\`,

  c =>
\`Before you answer, I should say I'm not just some guy buying one pedal. We're opening a store, a real physical one. I buy for \${c.shop}, and on top of the online stuff we're building up inventory for the actual location.

We're doing our next round of buying later this month. \${c.lotCap} anything still sitting there at the end of \${c.month} or start of \${c.nextMonth}, I'd love first crack at. And if it's the right deal we can just do it now.

We do things a little different than most shops. Not really into lowballing people, we'd rather work something out. Honestly it comes down to one thing: you want money now, or you want the most money?\`,

  c =>
\`Quick context so I'm not wasting your time. We're opening a brick and mortar shop. I buy for \${c.shop}, we already sell online, and now we need actual stuff on actual shelves.

Next buying round is later this month. \${c.lotCap} I'd rather talk about the whole thing than haggle over one pedal, and if any of it's still around at the end of \${c.month} or start of \${c.nextMonth} we'd love to do a deal on it. Right deal, sooner.

We can buy the lot outright and pay you up front, or we list them for you and pay you as they sell, which works out to a good bit more. Totally your call which one's worth more to you.\`,

  c =>
\`Bit of context first. We're opening a store, a physical one, and I'm the guy filling it. I buy for \${c.shop}, we've got a growing online side, and the next round of buying for the shop floor is later this month.

\${c.lotCap} I'd honestly rather take the whole thing off your hands than pick one pedal off you. Whatever's still sitting there at the end of \${c.month} or start of \${c.nextMonth}, we'd like to do a deal on. Right deal, we'll move faster.

There's three ways we can do that, and which one's best really just depends on whether you want cash now or top dollar later.\`,
];

const HEADS_PRICED = [
  "Okay so I went through your list. Here's where I land.",
  "Alright, priced the whole lot out. Here's what I've got.",
  "Ran the whole list. Here's the numbers.",
  "Went through everything you listed. Here's what it comes to.",
];

/* ONE CLOSE, THE OWNER'S, and no ask for the list: he pulled that first and
   then handed over the standard. The Max Payout clause only appears when that
   tier is switched on, so it cannot point at an option the seller never saw. */
const CLOSE = c => c.o3
  ? "Totally your call. If you wanna try out the Max Payout option TODAY, or I can pencil you in for the end of the month when we're ready to make some big purchases."
  : "Totally your call. I can pencil you in for the end of the month when we're ready to make some big purchases.";

const money = n => "$" + Math.round(n).toLocaleString("en-US");

function offerBlocks(c, m) {
  /* THE OWNER'S STANDARD, VERBATIM (2026-09-05). The code adds the figures,
     the pickup and deposit knobs, and the tier numbers; the words are his. */
  const out = [];
  if (c.o1) out.push(
\`Cash Up Front, Minimal Work 🍹
\${m ? \`\${money(m.o1)} cash today, which is 60% of market value and pretty standard for any shop. \` : "60% of market value, cash today, which is pretty standard for any shop. "}Ship 'em to us and you're done.\${c.pickup ? \` If you're near \${c.city} I'll just come grab them and pay you on the spot.\` : ""}\`);
  if (c.o2) out.push(
\`More Cash Total, Half Cash Up Front, More Work 💪
\${m ? \`\${money(m.o2)} total, which is 80% of market value after \${c.market} fees. \${money(m.o2up)} of that you get on the day we make the deal\` : \`80% of market value after \${c.market} fees in total. Half of that, you get on the day we make the deal\`}, and the pedals stay at your place. We list them and sell them on our channels. When one sells, I email you a prepaid label, you throw the pedal in a free USPS flat rate box (or similar) with some bubble wrap and drop it anywhere that takes pre-paid packages. You get paid out the remainder of the 80% as the pedals sell.\`);
  if (c.o3) out.push(
\`MAX PAYOUT, Nothing Up Front\${c.o2 ? \`, Same Work as #\${c.o1 ? 2 : 1}\` : ""} 💵💰💲💸
\${m ? \`\${money(m.o3)} total, which is 90% of market value after \${c.market} fees. \` : \`90% of market value after \${c.market} fees in total. \`}\${c.o2 ? "Same labor deal as the one above, just nothing up front and much more in your pocket." : "Nothing up front. The pedals stay at your place, we list them and sell them on our channels, and I email you a prepaid label for each one. Much more in your pocket."} You get paid as each one sells. And honestly, we can set this one up today 🚀

I'll build your listings off what's already in your post and just hit you up if I need any pics or details. We get that it's putting a lot of trust in us. But if this model interests you, we're down and have done this a few times.\${c.deposit ? \` If you'd rather have something in hand first, we'll put \${m ? money(m.o3dep) : "a 10% deposit"} down up front as good faith.\` : ""}\`);
  return out;
}

function steerLine(c, m) {
  if (!c.steer || !(c.o1 && c.o3)) return null;
  const gap = m ? m.o3 - m.o1 : 0;
  return gap > 0
    ? \`Less Up Front, More Overall. The gap between the first one and the last is about \${money(gap)}, so really it just comes down to whether that's worth waiting a few weeks for.\`
    : "Less Up Front, More Overall";
}

function buildOffers(c, headIdx, closeIdx, m) {
  const blocks = offerBlocks(c, m);
  const parts = [];

  if (m) parts.push(HEADS_PRICED[headIdx % HEADS_PRICED.length]);

  if (m && c.comps) {
    parts.push(\`Market on the lot comes to about \${money(m.mv)}\${m.count ? \` across the \${m.count} \${m.count === 1 ? "pedal" : "pedals"} you had\` : ""}. That's what they are really selling for recently on \${c.market}, not necessarily the prices you see currently listed. I would be happy to provide any details.\`);
  }

  if (!blocks.length) {
    parts.push("Here's what I'd do.");
  } else if (blocks.length === 1) {
    parts.push(m ? "So here's what I can do:" : "Here's what I'd do:");
    parts.push(blocks[0]);
  } else {
    parts.push(\`\${blocks.length} options:\`);
    blocks.forEach((b, i) => parts.push(\`\${i + 1}. \${b}\`));
  }

  const steer = steerLine(c, m);
  if (steer) parts.push(steer);

  if (!m && c.comps) {
    parts.push(\`**note** - when I say market value I mean what they are really selling for recently on \${c.market}, not necessarily the prices you see currently listed. I would be happy to provide any details.\`);
  }

  parts.push(CLOSE(c));
  return parts.join("\\n\\n");
}

/* ---------------------------------------------------------------------------
   WIRING.
--------------------------------------------------------------------------- */
const $ = id => document.getElementById(id);
const els = {
  name: $("fName"), pedal: $("fPedal"), city: $("fCity"),
  where: $("fWhere"), market: $("fMarket"), fee: $("fFee"),
  o1: $("o1"), o2: $("o2"), o3: $("o3"),
  xNote: $("xNote"), xComps: $("xComps"), xSteer: $("xSteer"), xPickup: $("xPickup"),
  xDeposit: $("xDeposit"),
  xVerified: $("xVerified"),
  paste: $("paste"), rows: $("rows"),
  m: [null, $("m1"), $("m2"), $("m3")],
  c: [null, $("c1"), $("c2"), $("c3")],
  d: [null, $("d1"), $("d2"), $("d3")],
};

const state = {
  scope: "board",
  cat: "auto",
  wear: "worn",
  lot: [],
  pick: { open: 0, note: 0, setup: 0, head: 0, close: 0 },
  dirty: { 1: false, 2: false, 3: false },
};

const KEY = "stompbox-buymyboard/v1";
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      name: els.name.value, pedal: els.pedal.value, city: els.city.value,
      where: els.where.value, market: els.market.value, fee: els.fee.value,
      scope: state.scope, cat: state.cat, wear: state.wear,
      lot: state.lot, paste: els.paste.value, verified: els.xVerified.checked,
      o1: els.o1.checked, o2: els.o2.checked, o3: els.o3.checked,
      xNote: els.xNote.checked, xComps: els.xComps.checked,
      xSteer: els.xSteer.checked, xPickup: els.xPickup.checked,
      xDeposit: els.xDeposit.checked,
    }));
  } catch (_) { /* private window or blocked site data. Not worth telling anyone. */ }
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const v = JSON.parse(raw);
    els.name.value = v.name ?? ""; els.pedal.value = v.pedal ?? ""; els.city.value = v.city ?? "";
    els.where.value = v.where ?? ""; els.market.value = v.market ?? "Reverb";
    els.fee.value = v.fee ?? "8.5";
    els.paste.value = v.paste ?? "";
    state.scope = v.scope ?? "board";
    state.cat = v.cat ?? "auto";
    state.wear = v.wear ?? "worn";
    state.lot = Array.isArray(v.lot) ? v.lot : [];
    els.xVerified.checked = Boolean(v.verified);
    for (const k of ["o1","o2","o3","xNote","xComps","xSteer","xPickup","xDeposit"]) {
      if (typeof v[k] === "boolean") els[k].checked = v[k];
    }
    return true;
  } catch (_) { return false; }
}

function feeRate() {
  const n = parseFloat(String(els.fee.value).replace(/[^\\d.]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 60) return 0.085;
  return n / 100;
}

function totals() {
  let ask = 0, mv = 0, priced = 0, unpriced = 0;
  for (const r of state.lot) {
    if (typeof r.ask === "number") ask += r.ask;
    if (typeof r.mv === "number" && r.mv > 0) { mv += r.mv; priced += 1; }
    else unpriced += 1;
  }
  return { ask, mv, priced, unpriced, count: state.lot.length };
}

function offerMath() {
  const t = totals();
  if (!t.mv) return null;
  const f = 1 - feeRate();
  return {
    mv: t.mv, count: t.count,
    o1: 0.60 * t.mv,
    o2: 0.80 * t.mv * f,
    o2up: 0.80 * t.mv * f / 2,
    o3: 0.90 * t.mv * f,
    o3dep: 0.10 * (0.90 * t.mv * f),
  };
}

/* "The end of September or the start of October" is right for one month and
   then quietly wrong, and this tool is used for longer than that, so the two
   names come from the clock on the day the message is written. */
function monthNames() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const name = d => d.toLocaleString("en-US", { month: "long" });
  return { month: name(now), nextMonth: name(next) };
}

function ctx() {
  const name = els.name.value.trim();
  const pedal = els.pedal.value.trim() || "pedal";
  const scope = state.scope;
  const n = state.lot.length;
  const lot = scope === "one"
    ? "If that one's part of a bigger clear out,"
    : scope === "few"
      ? "If those are part of a bigger clear out,"
      : n >= 5
        ? \`Since you've got \${n} pedals listed,\`
        : "Since you've got the whole board listed,";
  const where = els.where.value.trim();
  return {
    hey: name ? \`Hey \${name}, \` : "Hey, ",
    /* Blank location degrades to the true, vaguer phrase rather than
       printing "our shop (in )". Owner's wording, 2026-09-05. */
    shop: where ? \`our shop (in \${where})\` : "our shop",
    market: els.market.value.trim() || "Reverb",
    pedal, scope, lot,
    lotCap: lot.charAt(0).toUpperCase() + lot.slice(1),
    o1: els.o1.checked, o2: els.o2.checked, o3: els.o3.checked,
    comps: els.xComps.checked, steer: els.xSteer.checked,
    deposit: els.xDeposit.checked,
    pickup: els.xPickup.checked && els.city.value.trim().length > 0,
    city: els.city.value.trim(),
    ...monthNames(),
  };
}

function fit(el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
function setMsg(n, text) { els.m[n].value = text; fit(els.m[n]); meter(n); }

function meter(n) {
  /* The offers message is long by nature, so the warning sits well above it
     and says what to do rather than just turning a number orange. */
  const len = els.m[n].value.length;
  const long = len > 1500;
  els.c[n].textContent = long ? len + " chars, long for one message" : len + " chars";
  els.c[n].classList.toggle("long", long);
  els.d[n].hidden = !state.dirty[n];
}

/* --- the lot table ------------------------------------------------------- */
function cell(value, cls, ph) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  if (ph) input.placeholder = ph;
  if (cls) input.className = cls;
  td.appendChild(input);
  return { td, input };
}

function renderLot() {
  const wrap = $("tableWrap"), tb = els.rows;
  tb.textContent = "";
  const any = state.lot.length > 0;
  wrap.hidden = !any;
  $("offers").hidden = !any;
  $("spread").hidden = !any;
  $("verifyBox").hidden = !any;
  if (!any) { $("totAsk").textContent = "none"; $("totMv").textContent = "none"; return; }

  state.lot.forEach((r, i) => {
    const tr = document.createElement("tr");

    const b = cell(r.brand, "", "brand");
    b.input.addEventListener("input", () => { r.brand = b.input.value; recompute(); });
    tr.appendChild(b.td);

    const mo = cell(r.model, "", "model");
    mo.input.addEventListener("input", () => { r.model = mo.input.value; recompute(); });
    tr.appendChild(mo.td);

    const a = cell(r.ask === null ? "" : String(r.ask), "num" + (r.askGuessed ? " guessed" : ""), "");
    a.input.addEventListener("input", () => {
      const n = parseFloat(a.input.value.replace(/[^\\d.]/g, ""));
      r.ask = Number.isFinite(n) ? n : null;
      r.askGuessed = false;
      a.input.classList.remove("guessed");
      recompute();
    });
    tr.appendChild(a.td);

    const v = cell(r.mv === null ? "" : String(r.mv), "num" + (r.mvSeeded ? " seeded" : ""),
      r.mvSpread ? "varies" : "");
    v.input.title = r.mvSpread
      ? "Vintage and reissue are worlds apart on this one. No seed on purpose, check the comps."
      : r.mvSeeded ? "Estimate. Check it against real comps." : "";
    v.input.addEventListener("input", () => {
      const n = parseFloat(v.input.value.replace(/[^\\d.]/g, ""));
      r.mv = Number.isFinite(n) ? n : null;
      r.mvSeeded = false;
      v.input.classList.remove("seeded");
      recompute();
    });
    tr.appendChild(v.td);

    const x = document.createElement("td");
    x.className = "drop";
    const btn = document.createElement("button");
    btn.className = "x"; btn.type = "button";
    btn.textContent = "×";
    btn.title = "Remove this row";
    btn.setAttribute("aria-label", "Remove " + (r.brand + " " + r.model).trim());
    btn.addEventListener("click", () => { state.lot.splice(i, 1); renderLot(); recompute(); });
    x.appendChild(btn);
    tr.appendChild(x);

    tb.appendChild(tr);
  });

  const t = totals();
  $("totAsk").textContent = t.ask ? money(t.ask) : "none";
  $("totMv").textContent = t.mv ? money(t.mv) : "none";
}

function renderOffers() {
  const m = offerMath();
  const t = totals();
  const sp = $("spread");

  if (!m) {
    for (const id of ["n1", "n2", "n3"]) $(id).textContent = "-";
    $("n2s").textContent = "80% after fees";
    $("n3s").textContent = els.xDeposit.checked ? "90% after fees, 10% deposit" : "90% after fees, paid as they sell";
    sp.textContent = state.lot.length
      ? "No market values filled in yet, so there is nothing to compute."
      : "";
    return;
  }

  $("n1").textContent = money(m.o1);
  $("n2").textContent = money(m.o2);
  $("n3").textContent = money(m.o3);
  $("n2s").textContent = money(m.o2up) + " up front, 80% after fees";
  $("n3s").textContent = els.xDeposit.checked
    ? "90% after fees, " + money(m.o3dep) + " deposit"
    : "90% after fees, paid as they sell";

  const bits = [];
  bits.push(\`Market <b>\${money(m.mv)}</b> across \${t.priced} of \${t.count}.\`);
  if (t.ask) bits.push(\`They are asking <b>\${money(t.ask)}</b>.\`);
  if (t.unpriced) bits.push(\`<b>\${t.unpriced}</b> row\${t.unpriced === 1 ? "" : "s"} with no market value, not counted.\`);
  bits.push(\`Your margin on the cash offer is <b>\${money(m.mv * (1 - feeRate()) - m.o1)}</b> if it all sells at market.\`);
  sp.innerHTML = bits.join(" ");
}

const KIND_LABEL = { tone: "tone", era: "era", util: "quirks" };

function syncCategoryButtons(hit) {
  for (const b of document.querySelectorAll("#cat button")) {
    const v = b.dataset.v;
    let ok = true;
    if (v === "auto") ok = Boolean(hit && AUTO_KINDS.some(k => hit[k] && hit[k].length));
    else if (v !== "wear") ok = Boolean(hit && hit[v] && hit[v].length);
    b.disabled = !ok;
    b.setAttribute("aria-pressed", String(v === state.cat));
  }
  $("wearRow").hidden = state.cat !== "wear";
  for (const b of document.querySelectorAll("#wear button")) {
    b.setAttribute("aria-pressed", String(b.dataset.v === state.wear));
  }
}

function renderReadout(hit, note) {
  const out = $("noteOut"), who = $("noteWho"), what = $("noteWhat"), cyc = $("noteCycle");
  const typed = els.pedal.value.trim();

  if (!els.xNote.checked) {
    out.classList.add("miss");
    who.textContent = "Note switched off";
    what.textContent = "Turn the gear note back on under Extras.";
    cyc.disabled = true;
    return;
  }
  if (state.cat === "wear") {
    out.classList.remove("miss");
    who.textContent = typed ? "Wear, your read" : "Wear";
    what.textContent = "From the photos, not the model. Shuffle for another phrasing.";
    cyc.disabled = false;
    return;
  }
  if (hit) {
    out.classList.remove("miss");
    who.textContent = hit.n;
    const have = AUTO_KINDS.filter(k => hit[k] && hit[k].length).map(k => KIND_LABEL[k]);
    what.textContent = have.length
      ? "Knows: " + have.join(", ") + (note ? "." : ". Nothing under that heading, so the opener stays quiet.")
      : "In the table, but nothing written about it yet.";
    cyc.disabled = !note;
    return;
  }
  out.classList.add("miss");
  who.textContent = typed ? "Not in the table" : "No pedal yet";
  what.textContent = typed
    ? "No note for this one, so the opener stays quiet. Better than a confident line about the wrong circuit. Wear still works."
    : "Type a model above and the opener picks up a line about how it actually sounds.";
  cyc.disabled = true;
}

function render(only) {
  const c = ctx();
  const hit = noteFor(els.pedal.value);

  /* A category the matched pedal has nothing under would silently produce no
     line at all, so fall back to auto rather than leaving a dead selector. */
  if (state.cat !== "auto" && state.cat !== "wear" && (!hit || !hit[state.cat] || !hit[state.cat].length)) {
    state.cat = "auto";
  }
  const note = els.xNote.checked ? pickNote(hit, state.cat, state.wear, c.pedal, state.pick.note) : null;

  syncCategoryButtons(hit);
  renderReadout(hit, note);

  /* THE GATE. Figures reach the message only once somebody has said they
     checked them. An unverified seed quoted at a seller is a number nobody
     stands behind, and the whole offer is computed off it. */
  const m = els.xVerified.checked ? offerMath() : null;
  const vn = $("verifyNote");
  if (vn) {
    const t = totals();
    vn.textContent = els.xVerified.checked
      ? (t.unpriced
          ? \`In the message now. \${t.unpriced} row\${t.unpriced === 1 ? "" : "s"} still have no value and are not counted in the total.\`
          : "In the message now. You are quoting these to a stranger as fact.")
      : "Until this is on, message three quotes percentages only. Tick it and the dollar figures go in.";
  }

  if ((!only || only === 1) && !state.dirty[1]) {
    const asksAlready = Boolean(note) && /\\?\\s*$/.test(note.trim());
    const pool = asksAlready
      ? OPENERS_FLAT
      : (c.scope === "one" ? OPENERS_ANY : OPENERS_ANY.concat(OPENERS_LOT));
    let text = pool[state.pick.open % pool.length](c);
    if (note) text += "\\n\\n" + note;
    setMsg(1, text);
  }
  if ((!only || only === 2) && !state.dirty[2]) setMsg(2, SETUPS[state.pick.setup % SETUPS.length](c));
  if ((!only || only === 3) && !state.dirty[3]) setMsg(3, buildOffers(c, state.pick.head, state.pick.close, m));

  const nm = els.name.value.trim();
  $("headName").textContent = nm || "Seller";
  $("avatar").textContent = (nm || "S").charAt(0).toUpperCase();
}

function recompute() {
  renderOffers();
  const t = totals();
  $("totAsk").textContent = t.ask ? money(t.ask) : "none";
  $("totMv").textContent = t.mv ? money(t.mv) : "none";
  render();
  save();
}

/* --- events ------------------------------------------------------------- */
for (const el of [els.name, els.pedal, els.city, els.where, els.market]) {
  el.addEventListener("input", () => { render(); save(); });
}
els.fee.addEventListener("input", () => { recompute(); });
for (const k of ["o1","o2","o3","xComps","xSteer"]) {
  els[k].addEventListener("change", () => { render(3); save(); });
}
/* The deposit changes the tile's own subtitle as well as the message, so it
   goes through the offer panel rather than only through the composer. */
els.xDeposit.addEventListener("change", () => { renderOffers(); render(3); save(); });
els.xNote.addEventListener("change", () => { state.dirty[1] = false; render(1); save(); });
els.xVerified.addEventListener("change", () => { state.dirty[3] = false; render(3); save(); });
els.xPickup.addEventListener("change", () => {
  els.city.disabled = !els.xPickup.checked;
  if (els.xPickup.checked) els.city.focus();
  render(3); save();
});

function segHandler(id, key, after) {
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b || b.disabled) return;
    state[key] = b.dataset.v;
    if (after) after();
    render(); save();
  });
}
segHandler("scope", "scope");
segHandler("cat", "cat", () => { state.pick.note = 0; state.dirty[1] = false; });
segHandler("wear", "wear", () => { state.pick.note = 0; state.dirty[1] = false; });

$("noteCycle").addEventListener("click", () => {
  state.pick.note += 1; state.dirty[1] = false; render(1);
});

function doParse() {
  const { rows, guessedCount, noPrice } = parseListing(els.paste.value);
  const note = $("parseNote");
  if (!rows.length) {
    note.textContent = els.paste.value.trim()
      ? "Nothing readable in that. Add rows by hand instead."
      : "Paste the listing above, then press this.";
    note.className = "parse-note warn";
    return;
  }
  state.lot = rows;
  /* The scope selector answers to the list rather than being set twice. */
  state.scope = rows.length >= 5 ? "board" : rows.length >= 2 ? "few" : "one";
  for (const b of document.querySelectorAll("#scope button")) {
    b.setAttribute("aria-pressed", String(b.dataset.v === state.scope));
  }
  if (!els.pedal.value.trim() && rows[0]) {
    els.pedal.value = (rows[0].brand + " " + rows[0].model).trim();
  }
  els.xVerified.checked = false;

  const bits = [\`\${rows.length} item\${rows.length === 1 ? "" : "s"} read.\`];
  if (guessedCount) bits.push(\`\${guessedCount} price\${guessedCount === 1 ? "" : "s"} guessed from a bare number, shown in amber.\`);
  if (noPrice) bits.push(\`\${noPrice} with no price found.\`);
  const seeded = rows.filter(r => r.mvSeeded).length;
  const spread = rows.filter(r => r.mvSpread).length;
  if (seeded) bits.push(\`\${seeded} market estimate\${seeded === 1 ? "" : "s"} seeded.\`);
  if (spread) bits.push(\`\${spread} left blank on purpose, vintage spread too wide to guess.\`);
  note.textContent = bits.join(" ");
  note.className = "parse-note" + (guessedCount ? " warn" : "");

  renderLot();
  recompute();
}

$("parseBtn").addEventListener("click", doParse);
els.paste.addEventListener("input", save);
$("addRow").addEventListener("click", () => {
  state.lot.push({ brand: "", model: "", ask: null, askGuessed: false, mv: null, mvSeeded: false, mvSpread: false });
  renderLot(); recompute();
});
$("clearLot").addEventListener("click", () => {
  state.lot = []; els.paste.value = ""; els.xVerified.checked = false;
  $("parseNote").textContent = ""; $("parseNote").className = "parse-note";
  renderLot(); recompute();
});

document.addEventListener("click", (e) => {
  const sh = e.target.closest("[data-shuffle]");
  if (sh) {
    const n = Number(sh.dataset.shuffle);
    state.dirty[n] = false;
    if (n === 1) { state.pick.open += 1; state.pick.note += 1; }
    if (n === 2) state.pick.setup += 1;
    if (n === 3) { state.pick.head += 1; state.pick.close += 1; }
    render(n);
    return;
  }
  const cp = e.target.closest("[data-copy]");
  if (cp) {
    const n = Number(cp.dataset.copy);
    const done = () => {
      cp.textContent = "Copied"; cp.classList.add("copied");
      setTimeout(() => { cp.textContent = "Copy"; cp.classList.remove("copied"); }, 1300);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(els.m[n].value).then(done, () => els.m[n].select());
    } else {
      els.m[n].select();
      try { document.execCommand("copy"); done(); } catch (_) { /* leave it selected */ }
    }
  }
});

$("shuffleAll").addEventListener("click", () => {
  state.dirty = { 1: false, 2: false, 3: false };
  state.pick.open += 1; state.pick.note += 1; state.pick.setup += 1;
  state.pick.head += 1; state.pick.close += 1;
  render();
});

for (let n = 1; n <= 3; n += 1) {
  els.m[n].addEventListener("input", () => { state.dirty[n] = true; fit(els.m[n]); meter(n); });
}

/* --- theme: a toggle cycles rather than picking a position --------------- */
const THEMES = ["dark", "light", "system"];
let themeIdx = 0;
try {
  const stored = localStorage.getItem(KEY + "/theme");
  const i = THEMES.indexOf(stored || "");
  if (i >= 0) themeIdx = i;
} catch (_) { /* private window: dark, which is the default anyway */ }
function applyTheme() {
  const t = THEMES[themeIdx];
  /* Always stamped, "system" included. Absence means dark, so the attribute
     is what carries a deliberate choice to follow the OS. */
  document.documentElement.setAttribute("data-theme", t);
  $("themeLabel").textContent = t === "system" ? "Auto" : t === "light" ? "Light" : "Dark";
  try { localStorage.setItem(KEY + "/theme", t); } catch (_) {}
}
$("theme").addEventListener("click", () => { themeIdx = (themeIdx + 1) % THEMES.length; applyTheme(); });
applyTheme();

/* --- boot --------------------------------------------------------------- */
if (!load()) {
  /* Opens on a worked example rather than an empty shell, so the first look
     shows the whole thing already assembled. */
  els.name.value = "Dave";
  els.pedal.value = "Boss DS-1";
  els.where.value = "Indiana";
  els.market.value = "Reverb";
  els.fee.value = "8.5";
  els.paste.value = [
    "Boss DS-1 $45",
    "Ibanez TS9 - 110",
    "MXR Carbon Copy $95",
    "EHX Holy Grail 80",
    "Walrus Audio Slo $175",
    "TC Electronic Ditto Looper $65",
  ].join("\\n");
  doParse();
}
if (!els.market.value.trim()) els.market.value = "Reverb";
if (!els.fee.value.trim()) els.fee.value = "8.5";
els.city.disabled = !els.xPickup.checked;
for (const b of document.querySelectorAll("#scope button")) {
  b.setAttribute("aria-pressed", String(b.dataset.v === state.scope));
}
renderLot();
recompute();
let rt;
window.addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => { for (let n = 1; n <= 3; n += 1) fit(els.m[n]); }, 120);
});
</script>
</body>
</html>
`
