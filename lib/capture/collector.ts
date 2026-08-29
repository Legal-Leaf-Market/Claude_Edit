import { createHash } from "node:crypto"
import { captureSource } from "./extract"

/**
 * THE COLLECTOR: the program that runs on the merchant's page.
 *
 * PORTED FROM legal-leafmarket.com/coldwater-collect, which has been in
 * operator use long enough to have paid for every awkward thing in here. The
 * awkward things are the point: a first attempt at this is a bookmarklet that
 * reads the DOM and POSTs it, and that version fails on precisely the shops
 * worth capturing, silently, in four different ways. Each one below is a
 * lesson somebody already paid for, so none of them is simplified away here.
 *
 * ---------------------------------------------------------------------------
 *
 * LESSON 1: A BOOKMARKLET IS EXEMPT FROM CSP. WHAT IT LOADS IS NOT.
 *
 * The obvious build is a one-line bookmarklet that injects `<script
 * src="oursite/collector.js">`. The `javascript:` URL runs, because clicking a
 * bookmark is a user action. The script it injects is an ordinary cross-origin
 * script, and a shop with a strict `script-src` refuses it. Worse, a blocked
 * script fires no error event in most browsers, so it does not fail, it simply
 * never runs, and it reads to the operator as "the bookmark is broken".
 *
 * So there are two bookmarklets. The loader, which is short and always current,
 * and the SELF-CONTAINED one, which carries this whole program inside the URL
 * and therefore has nothing left for a policy to refuse. The install page
 * builds the second by fetching this source and inlining it.
 *
 * LESSON 2: A SELF-CONTAINED BOOKMARKLET IS A SNAPSHOT, AND A STALE ONE LIES.
 *
 * Once dragged, it never updates. On the sister site a shop was reported broken
 * at five products months after the bug was fixed, because the operator's
 * bookmark predated the fix. A stale reader does not throw: it returns a
 * SMALLER catalogue that looks entirely plausible. So this carries a BUILD
 * stamp, the panel prints it, the install page prints the current one, and the
 * two being different is the whole diagnostic.
 *
 * The stamp is a hash of the source rather than a hand-typed version, because a
 * version number somebody has to remember to bump is a version number that
 * stops moving on the day it matters.
 *
 * LESSON 3: connect-src CAN BLOCK THE SEND AFTER A SUCCESSFUL READ.
 *
 * A shop can permit the capture and forbid the POST, which is the most
 * annoying possible failure: all the work done, nothing delivered. That is the
 * page's decision and this does not argue with it. It uses a route CSP does not
 * govern instead: opening a tab is a NAVIGATION, not a connection, so the
 * collector opens the install page with ?receive=1 and hands the capture over
 * with postMessage. From there the POST is same-origin and there is nothing
 * cross-origin left for anybody to forbid.
 *
 * Both ends pin the origin. Beneath even that there is the clipboard, which no
 * policy can stop, and a paste box on the install page to receive it.
 *
 * LESSON 4: WHAT IS IN THE DOM IS ALL THIS CAN SEE.
 *
 * Two consequences the panel states in words rather than leaving to be
 * discovered. A grid that lazy-loads has to be scrolled to the bottom first. A
 * menu inside a cross-origin iframe cannot be read at all, which is the
 * same-origin policy working correctly rather than a bug to route around; the
 * answer is to open that frame in its own tab and run it there.
 *
 * ---------------------------------------------------------------------------
 *
 * ONE EXTRACTOR, SHARED. The reading is `captureSource()` from ./extract,
 * serialised in. This file is only the operator's half: the panel, the confirm
 * step, and the three ways of getting the result home. The sister site's
 * collector is a single committed 180KB JS file, which is the one thing here
 * that is deliberately NOT copied: a committed copy can drift from the typed
 * source, and this is generated from it on every request so it cannot.
 */

/** Where a capture is sent, and where the relay tab lives. */
const INGEST_PATH = "/api/capture/ingest"
const INSTALL_PATH = "/collect"

/**
 * The operator's half, as source. `%%CAPTURE%%` is replaced with the shared
 * extractor and `%%BUILD%%` with the stamp.
 *
 * Written in ES5 with no template literals or arrow functions, because it is
 * inlined into a `javascript:` URL and pasted into consoles on sites of
 * unknown vintage, and because a stray backtick in a template literal inside a
 * template literal is a debugging afternoon nobody needs.
 */
const OPERATOR_SOURCE = `
(function(){
  "use strict";
  if (window.__GEAR_COLLECTOR__) { try { document.getElementById("ga-collector").remove(); } catch(e){} }
  window.__GEAR_COLLECTOR__ = true;

  var BUILD = "%%BUILD%%";

  /*
   * WHERE THIS CAME FROM, and it is not optional. The collector reads its API
   * origin off its own script tag, and an INLINED program has no
   * currentScript, so without the fallback a self-contained bookmarklet built
   * on a preview deploy would send to production. The install page and the
   * copy button both prepend __GEAR_COLLECTOR_SRC__ for exactly this reason,
   * so all three install methods agree about where a capture lands.
   */
  var SRC = window.__GEAR_COLLECTOR_SRC__ ||
    (document.currentScript && document.currentScript.src) || "";
  var ORIGIN = "";
  try { ORIGIN = new URL(SRC).origin; } catch (e) { ORIGIN = "%%ORIGIN%%"; }

  var CAPTURE = %%CAPTURE%%;
  var capture = CAPTURE();
  capture.build = BUILD;
  capture.readVia = "live page";

  /* Everything gathered this session: the page you are on, plus every page a
     crawl walked. Merged on send, deduplicated by product URL. */
  var pages = [capture];
  var stopRequested = false;

  /* ---------------------------------------------------------------- panel */

  var panel = document.createElement("div");
  panel.id = "ga-collector";
  panel.setAttribute("style",
    "position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;max-height:86vh;" +
    "overflow:auto;background:#0b1a33;color:#e8eef7;border:1px solid #ffffff;border-radius:12px;" +
    "font:13px/1.55 ui-sans-serif,system-ui,-apple-system,sans-serif;padding:14px 16px;" +
    "box-shadow:0 14px 50px rgba(0,0,0,.55)");

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  var per = Object.keys(capture.bySource).map(function(k){
    return k + ": " + capture.bySource[k]; }).join(", ");

  var notes = capture.coverage.notes.map(function(n){
    return '<li style="margin:4px 0">' + esc(n) + "</li>"; }).join("");

  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">' +
      '<strong style="font-size:15px;color:#4ade80">' + capture.products.length + ' products</strong>' +
      '<button id="ga-x" style="background:none;border:0;color:#8fa6c4;font-size:18px;cursor:pointer;line-height:1">&times;</button>' +
    '</div>' +
    '<div style="opacity:.8;margin-top:2px">' + esc(per || "nothing found") + '</div>' +
    (capture.coverage.claimedTotal
      ? '<div style="color:#ffb454;margin-top:4px">This page claims ' + capture.coverage.claimedTotal +
        ' results. Page through the rest and capture each one.</div>' : "") +
    (notes ? '<ul style="margin:8px 0 0;padding-left:18px;opacity:.9">' + notes + "</ul>" : "") +
    '<label style="display:block;margin-top:12px;opacity:.85">Merchant key' +
      '<input id="ga-key" value="' + esc(guessKey()) + '" ' +
      'style="width:100%;margin-top:3px;padding:7px 8px;border-radius:7px;border:1px solid #2b4a72;' +
      'background:#061223;color:#e8eef7;font:13px ui-monospace,monospace"></label>' +
    '<label style="display:block;margin-top:8px;opacity:.85">Admin token' +
      '<input id="ga-token" type="password" placeholder="ADMIN_PASSCODE" ' +
      'style="width:100%;margin-top:3px;padding:7px 8px;border-radius:7px;border:1px solid #2b4a72;' +
      'background:#061223;color:#e8eef7"></label>' +
    '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">' +
      '<button id="ga-crawl" style="flex:1;background:none;color:#ffd479;border:1px solid #6b5426;' +
      'border-radius:999px;padding:9px 14px;cursor:pointer;font:inherit">Crawl every page</button>' +
      '<input id="ga-max" type="number" value="200" min="1" max="2000" title="page limit" ' +
      'style="width:70px;padding:8px;border-radius:7px;border:1px solid #2b4a72;background:#061223;color:#e8eef7">' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
      '<button id="ga-send" style="flex:1;background:#4ade80;color:#06202b;font-weight:700;border:0;' +
      'border-radius:999px;padding:9px 14px;cursor:pointer;font:inherit;font-weight:700">Send</button>' +
      '<button id="ga-copy" style="background:none;color:#8fd3ff;border:1px solid #2b4a72;' +
      'border-radius:999px;padding:9px 14px;cursor:pointer;font:inherit">Copy</button>' +
    '</div>' +
    '<div style="margin-top:8px">' +
      '<button id="ga-diag" style="width:100%;background:none;color:#c0b4ff;border:1px solid #40376b;' +
      'border-radius:999px;padding:8px 14px;cursor:pointer;font:inherit">Copy diagnostics</button>' +
    '</div>' +
    '<div id="ga-msg" style="margin-top:9px;opacity:.85"></div>' +
    '<div style="margin-top:10px;opacity:.5;font-size:11px">build ' + BUILD + '</div>';

  document.body.appendChild(panel);

  function $(id){ return document.getElementById(id); }
  function say(text){ $("ga-msg").innerHTML = esc(text); }

  $("ga-x").onclick = function(){ panel.remove(); };

  /*
   * A GUESS, SHOWN IN AN EDITABLE FIELD RATHER THAN APPLIED SILENTLY. Filing a
   * capture under the wrong merchant is the failure that gets found by a
   * shopper rather than by us, so the operator confirms it every time.
   */
  function guessKey(){
    return location.hostname.replace(/^www\\./, "").replace(/\\.(com|co\\.uk|net|org|io|audio)$/, "")
      .replace(/[^a-z0-9]+/gi, "");
  }

  /* ----------------------------------------------------------------- copy */

  $("ga-copy").onclick = function(){
    var payload = JSON.stringify(body(), null, 2);
    try {
      navigator.clipboard.writeText(payload);
      say("Copied " + Math.round(payload.length / 1024) + " KB. Paste it into " + ORIGIN + "%%INSTALL%%.");
    } catch (e) {
      say("Could not copy. Open the console and read window.__GEAR_CAPTURE__ instead.");
    }
    window.__GEAR_CAPTURE__ = body();
  };

  /*
   * ONE PAYLOAD FROM EVERY PAGE WALKED. Deduplicated by product URL because
   * consecutive pages of a grid repeat a few cards, and because the extractors
   * overlap on purpose. The page URL reported is the one the crawl STARTED
   * from, so re-crawling the same section replaces its row rather than
   * accumulating one row per page: the ingest is keyed on page URL.
   */
  function body(){
    var seen = {}, products = [], notes = [], claimed = null;
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      for (var j = 0; j < p.products.length; j++) {
        var item = p.products[j];
        var key = item.url || (item.title + "|" + item.priceCents);
        if (seen[key]) continue;
        seen[key] = 1;
        products.push(item);
      }
      for (var n = 0; n < p.coverage.notes.length; n++) {
        if (notes.indexOf(p.coverage.notes[n]) === -1) notes.push(p.coverage.notes[n]);
      }
      if (p.coverage.claimedTotal != null) {
        claimed = Math.max(claimed || 0, p.coverage.claimedTotal);
      }
    }
    var bySource = {};
    for (var k = 0; k < products.length; k++) {
      bySource[products[k].via] = (bySource[products[k].via] || 0) + 1;
    }
    var merged = {
      capturedAt: capture.capturedAt,
      pageUrl: capture.pageUrl,
      pageTitle: capture.pageTitle,
      origin: capture.origin,
      platform: capture.platform,
      build: BUILD,
      pagesWalked: pages.length,
      products: products,
      coverage: {
        claimedTotal: claimed,
        nextPageUrl: null,
        pageLinks: [],
        looksLazyLoaded: capture.coverage.looksLazyLoaded,
        notes: notes,
      },
      bySource: bySource,
    };
    return {
      merchantKey: ($("ga-key").value || "").trim(),
      build: BUILD,
      capture: merged,
    };
  }

  function total(){ return body().capture.products.length; }

  /* ----------------------------------------------------------- diagnostics */

  /*
   * WHAT TO SEND SOMEBODY WHEN IT FINDS NOTHING.
   *
   * "It found zero" is not a bug report, and the person who has to fix the
   * extractor usually cannot open the shop it failed on. What they need is the
   * markup around the prices this saw and could not turn into cards, because
   * that names the shape to support in one look rather than five round trips.
   *
   * Deliberately small enough to paste into a message: counts, the page, and a
   * few hundred characters of markup per sample rather than the page itself.
   */
  $("ga-diag").onclick = function(){
    var lines = [];
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i], g = p.diagnostics || {};
      lines.push(
        "PAGE " + (i + 1) + ": " + p.pageUrl,
        "  build " + BUILD + "  platform " + (p.platform || "none") +
          "  read via " + (p.readVia || "?"),
        "  products " + p.products.length + "  by source " + JSON.stringify(p.bySource),
        "  claimed total " + p.coverage.claimedTotal + "  next page " + (p.coverage.nextPageUrl || "none") +
          "  lazy " + p.coverage.looksLazyLoaded,
        "  anchors " + g.anchors + "  price nodes " + g.priceNodes + "  cards " + g.cardsResolved,
        "  rejected: multi-price " + g.rejectedMultiPrice + ", no product signal " +
          g.rejectedNoProductSignal + ", no anchor " + g.rejectedNoAnchor +
          ", duplicate " + g.rejectedDuplicate,
        "  json-ld blocks " + g.jsonLdBlocks + "  types " + JSON.stringify(g.jsonLdTypes || [])
      );
      var un = g.unresolvedSamples || [];
      for (var u = 0; u < un.length; u++) lines.push("  UNRESOLVED " + (u + 1) + ": " + un[u]);
      var re = g.resolvedSamples || [];
      for (var r = 0; r < re.length; r++) lines.push("  RESOLVED " + (r + 1) + ": " + re[r]);
      var notes = p.coverage.notes || [];
      for (var n = 0; n < notes.length; n++) lines.push("  NOTE: " + notes[n]);
      lines.push("");
    }
    var report = lines.join("\\n");
    try {
      navigator.clipboard.writeText(report);
      say("Diagnostics copied, " + Math.round(report.length / 1024) + " KB. Paste them where they help.");
    } catch (e) {
      window.__GEAR_DIAGNOSTICS__ = report;
      say("Could not copy. Read window.__GEAR_DIAGNOSTICS__ in the console.");
    }
  };

  /* ---------------------------------------------------------------- crawl */

  /*
   * WALK THE WHOLE SECTION, not just the page you are standing on.
   *
   * A retailer's category runs to hundreds of pages, and pressing a bookmark on
   * each is not a workflow anybody sustains. So this follows the pagination
   * itself: fetch the next page SAME-ORIGIN from inside the merchant's own
   * page, parse it, and run the identical extractor against it.
   *
   * SAME-ORIGIN IS WHY THIS WORKS AT ALL. The bookmarklet is executing on the
   * merchant's own origin, so a fetch of their page two is an ordinary
   * same-origin request carrying the session the operator already has. There is
   * no CORS to negotiate and no proxy involved.
   *
   * IT GOES SLOWLY ON PURPOSE. One page at a time, never in parallel, with a
   * pause between. A crawl that hammers a merchant we have an affiliate
   * agreement with is a good way to lose the agreement, and nothing here is
   * urgent enough to be worth that. The delay is deliberately not configurable
   * in the panel: the one setting somebody would reach for under impatience is
   * the one that should not move.
   *
   * FOUR WAYS IT STOPS, and the second is the one that matters most. No next
   * page found; a page that yielded NOTHING NEW, which is what a pagination
   * that silently loops back to page one looks like; the page cap; and the
   * operator pressing stop.
   */
  var CRAWL_DELAY_MS = 1200;

  function nextUrlFrom(result, currentUrl){
    /* The page's own declared next link is always preferred: it is the
       merchant telling us where page two is. */
    if (result.coverage.nextPageUrl) return result.coverage.nextPageUrl;

    /* Otherwise increment a page parameter, which covers numbered pagination
       with no rel=next. A URL with no such parameter gets ?page=2 tried once. */
    try {
      var u = new URL(currentUrl);
      var keys = ["page", "p", "pageNumber", "start", "offset"];
      for (var i = 0; i < keys.length; i++) {
        var v = u.searchParams.get(keys[i]);
        if (v !== null && /^\\d+$/.test(v)) {
          u.searchParams.set(keys[i], String(parseInt(v, 10) + 1));
          return u.toString();
        }
      }
      u.searchParams.set("page", "2");
      return u.toString();
    } catch (e) { return null; }
  }

  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  /*
   * READ A PAGE IN A HIDDEN IFRAME, NOT WITH fetch.
   *
   * fetch was the obvious way and it fails on any shop that renders its grid
   * in the browser. Andertons is one: page one captured 34 products because
   * the operator was LOOKING at it, fully rendered, while page two fetched as
   * raw HTML held 977 links, two prices and no grid whatsoever. The markup
   * that arrives over the wire is a shell, and the products appear only after
   * the page's own JavaScript has run.
   *
   * A same-origin iframe is a real browsing context: it runs their scripts,
   * renders their grid, and hands back a document that looks exactly like what
   * the operator sees. Because the collector is executing on the merchant's
   * own origin, reading contentDocument is ordinary same-origin access rather
   * than anything clever.
   *
   * IT WAITS FOR THE GRID RATHER THAN FOR A FIXED DELAY, by re-reading until
   * products appear. A fixed wait is wrong in both directions: too short on a
   * slow page and wasted on a fast one, and the slow case fails silently as an
   * empty capture that looks like an empty category.
   *
   * FALLS BACK TO fetch when the iframe cannot be read at all, which is what a
   * frame-busting script or X-Frame-Options: DENY produces. On a
   * server-rendered shop that fallback is perfectly good, and it is how this
   * worked before.
   */
  var FRAME_TIMEOUT_MS = 12000;
  /* The frame's viewport height, and the step the scroller walks down in. ONE
     number, because the sizing and the "have we reached the bottom" test have
     to agree: a frame told it is 2400 tall while the maths assumes 800 stops
     scrolling three quarters of the way down every page. */
  var FRAME_H = 2400;
  var frame = null;

  function ensureFrame(){
    if (frame && frame.parentNode) return frame;
    frame = document.createElement("iframe");
    /* Big enough that a responsive grid lays out as the desktop one, and far
       enough off-screen not to flash. Not display:none: some layouts render
       nothing at all with no box to render into. */
    frame.setAttribute("style",
      "position:fixed;left:-10000px;top:0;width:1400px;height:" + FRAME_H + "px;border:0;opacity:0.01;" +
      "pointer-events:none;z-index:-1");
    document.body.appendChild(frame);
    return frame;
  }

  /*
   * THE FRAME HAS TO BE SCROLLED, AND NOT SCROLLING IT IS WHY PAGE ONE WORKED
   * AND NOTHING AFTER IT DID.
   *
   * Reported as a crawl that finds the first page and returns zero for every
   * page after it, which looked like the frame being refused and was not. The
   * asymmetry gives it away: page one is the tab the OPERATOR already has open,
   * and the panel tells them to scroll to the bottom before capturing, because
   * a lazy grid only renders what has been near the viewport. Nobody scrolls a
   * hidden iframe, so every later page was read as an empty grid with its
   * loading placeholders still in it.
   *
   * The frame was already given a real 1400x2400 box for exactly this family of
   * reasons. That is necessary and it is not sufficient: an IntersectionObserver
   * grid wants the SCROLL, not just the room, and a category page is far taller
   * than one screen anyway.
   *
   * Stepwise rather than one jump to the bottom. A single scrollTo past the end
   * skips every band in between, and some observers never fire for a region
   * that was never intersected; walking down in screen-sized steps is what a
   * person does and it is what the page is built to respond to.
   */
  async function readViaFrame(url){
    var f = ensureFrame();

    var loaded = new Promise(function(resolve){
      f.onload = function(){ resolve(true); };
      setTimeout(function(){ resolve(false); }, FRAME_TIMEOUT_MS);
    });
    f.src = url;
    await loaded;

    var best = null;
    var stalled = 0;
    var y = 0;
    var scrolls = 0;
    var grewAfterScroll = false;

    for (var pass = 0; pass < 26; pass++) {
      var doc = null, win = null;
      try { doc = f.contentDocument; win = f.contentWindow; } catch (e) { doc = null; }
      /* Cross-origin, frame-busted, or refused: nothing to read here ever. */
      if (!doc || !doc.body) return null;

      var attempt = CAPTURE(doc, url);
      if (!best || attempt.products.length > best.products.length) {
        if (best && scrolls > 0) grewAfterScroll = true;
        best = attempt;
        stalled = 0;
      } else {
        stalled += 1;
      }

      var height = 0;
      try { height = doc.documentElement.scrollHeight || doc.body.scrollHeight || 0; } catch (e) { height = 0; }
      var atBottom = y + FRAME_H >= height - 40;
      var canScroll = height > FRAME_H + 40;

      /* Everything is in: products found, the count has stopped climbing, and
         there is no more page to reveal. */
      if (best.products.length > 0 && stalled >= 2 && atBottom) break;

      if (canScroll && !atBottom) {
        y = Math.min(y + Math.round(FRAME_H * 0.8), Math.max(0, height - FRAME_H));
        try { win.scrollTo(0, y); scrolls += 1; } catch (e) {}
      } else if (best.products.length === 0) {
        /*
         * NOTHING FOUND AND NOWHERE TO SCROLL, which is not the contradiction
         * it looks like: a page whose grid has not arrived yet is SHORT because
         * the grid has not arrived, so the honest "have we reached the bottom"
         * test says yes on a page that is nothing but a skeleton. Gating the
         * scroll on that test alone is why the first version of this fix
         * changed nothing at all.
         *
         * A document with no overflow cannot emit a scroll event however hard
         * it is pushed, so this nudges the position and says so directly. Once
         * the grid lands the page grows and the walk above takes over.
         */
        try {
          win.scrollTo(0, 1);
          win.scrollTo(0, 0);
          win.dispatchEvent(new win.Event("scroll"));
        } catch (e) {}
        scrolls += 1;
      }

      await sleep(500);
    }

    if (best) {
      best.frameScrolls = scrolls;
      best.frameGrewAfterScroll = grewAfterScroll;
    }
    return best;
  }

  /*
   * WHICH PATH READ THIS PAGE, RECORDED RATHER THAN GUESSED.
   *
   * When a crawled page comes back empty there are two completely different
   * causes and the numbers alone cannot separate them: the frame rendered and
   * the page really has nothing, or the frame was refused and what got read
   * was the pre-render shell over fetch. The first is a finished category; the
   * second is a tool that is not working. Guessing between them cost a round
   * trip, so the diagnostics now say.
   */
  async function readPage(url){
    var viaFrame = null, frameNote = "";
    try {
      viaFrame = await readViaFrame(url);
      if (viaFrame === null) frameNote = "frame unreadable (cross-origin, frame-busted, or refused)";
    } catch (e) {
      frameNote = "frame threw: " + (e && e.message ? e.message : e);
    }
    if (viaFrame && viaFrame.products.length > 0) {
      viaFrame.readVia = "frame, " + (viaFrame.frameScrolls || 0) + " scrolls" +
        (viaFrame.frameGrewAfterScroll ? " (the grid grew as it scrolled: lazy)" : "");
      return viaFrame;
    }
    if (!frameNote) {
      frameNote = "frame rendered and scrolled " + ((viaFrame && viaFrame.frameScrolls) || 0) +
        " times, still found no products";
    }

    /*
     * The iframe gave nothing. Either the page genuinely has no products, or
     * it refused to be framed. fetch decides which, and on a server-rendered
     * shop it is a complete answer by itself.
     */
    try {
      var response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) return viaFrame;
      var html = await response.text();
      var doc = new DOMParser().parseFromString(html, "text/html");
      var fetched = CAPTURE(doc, url);
      if (!viaFrame || fetched.products.length > viaFrame.products.length) {
        fetched.readVia = "fetch (" + frameNote + ")";
        return fetched;
      }
      viaFrame.readVia = "frame (" + frameNote + ")";
      return viaFrame;
    } catch (e) {
      if (viaFrame) viaFrame.readVia = "frame (" + frameNote + "); fetch also failed";
      return viaFrame;
    }
  }


  async function crawl(){
    var max = parseInt($("ga-max").value, 10);
    if (!(max > 0)) max = 200;

    stopRequested = false;
    $("ga-crawl").textContent = "Stop";
    $("ga-crawl").onclick = function(){ stopRequested = true; $("ga-crawl").textContent = "Stopping..."; };

    var url = nextUrlFrom(capture, location.href);
    var walked = 1;
    var emptyStreak = 0;

    while (url && walked < max && !stopRequested) {
      say("Page " + (walked + 1) + " of at most " + max + ", " + total() + " products so far...");
      var before = total();

      try {
        var result = await readPage(url);
        if (!result) { say("Page " + (walked + 1) + " could not be read. Stopping."); break; }
        pages.push(result);
        walked++;

        /*
         * NOTHING NEW MEANS STOP. A pagination that runs past its last page
         * commonly serves page one again rather than a 404, and without this
         * the crawl would walk to the cap re-reading the same grid and report
         * a confident, wrong total.
         */
        if (total() === before) {
          emptyStreak++;
          if (emptyStreak >= 2) { say("Two pages in a row added nothing new. Stopping at " + total() + " products."); break; }
        } else {
          emptyStreak = 0;
        }

        url = nextUrlFrom(result, url);
      } catch (err) {
        say("Page " + (walked + 1) + " failed: " + (err && err.message ? err.message : err) + ". Stopping.");
        break;
      }

      await sleep(CRAWL_DELAY_MS);
    }

    if (frame && frame.parentNode) { frame.parentNode.removeChild(frame); frame = null; }
    $("ga-crawl").textContent = "Crawl every page";
    $("ga-crawl").onclick = function(){ void crawl(); };
    say((stopRequested ? "Stopped" : "Done") + ": " + walked + " page(s), " + total() +
        " products. Press Send.");
    var counter = panel.querySelector("strong");
    if (counter) counter.textContent = total() + " products";
  }

  $("ga-crawl").onclick = function(){ void crawl(); };

  /* ----------------------------------------------------------------- send */

  $("ga-send").onclick = function(){
    var token = ($("ga-token").value || "").trim();
    if (!token) { say("Paste the admin passcode first."); return; }
    if (!($("ga-key").value || "").trim()) { say("Name the merchant first."); return; }
    $("ga-send").disabled = true;
    say("Sending " + total() + " products from " + pages.length + " page(s)...");

    fetch(ORIGIN + "%%INGEST%%", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ga-admin-token": token },
      body: JSON.stringify(body()),
    })
      .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
      .then(function(o){
        $("ga-send").disabled = false;
        say(o.ok
          ? "Stored " + o.j.stored + " products under " + o.j.merchantKey + "."
          : "Refused: " + (o.j.error || "unknown"));
      })
      .catch(function(){
        /*
         * A THROWN fetch HERE IS ALMOST ALWAYS CSP, NOT AN OUTAGE. connect-src
         * refusals surface as a generic TypeError with no detail, so there is
         * nothing to read and no point reporting it as a network error. The
         * relay is the answer, and it is tried automatically rather than
         * offered, because an operator who has already captured the page
         * should not have to know what connect-src is.
         */
        say("This shop blocks sending directly. Opening a relay tab...");
        relay(token);
      });
  };

  /* ---------------------------------------------------------------- relay */

  function relay(token){
    var win = window.open(ORIGIN + "%%INSTALL%%?receive=1", "gaRelay");
    if (!win) { say("Allow pop-ups for this site, then press Send again. Or press Copy."); return; }

    var sent = false;
    function onReady(ev){
      if (ev.origin !== ORIGIN) return;
      if (!ev.data || ev.data.type !== "ga-relay-ready" || sent) return;
      sent = true;
      win.postMessage({ type: "ga-capture", token: token, payload: body() }, ORIGIN);
    }
    function onResult(ev){
      if (ev.origin !== ORIGIN || !ev.data || ev.data.type !== "ga-relay-result") return;
      say(ev.data.ok ? "Stored " + ev.data.result.stored + " products via the relay tab."
                     : "Relay refused: " + (ev.data.error || (ev.data.result && ev.data.result.error) || "unknown"));
    }
    window.addEventListener("message", onReady);
    window.addEventListener("message", onResult);

    /* The relay announces itself when it loads; this is the backstop for a
       tab that loaded before the listener was attached. */
    setTimeout(function(){
      if (!sent) { sent = true; try { win.postMessage({ type: "ga-capture", token: token, payload: body() }, ORIGIN); } catch (e) {} }
    }, 2500);
  }
})();
`

/**
 * The collector's source, with the shared extractor inlined and stamped.
 *
 * The stamp is a hash of the finished program, so any change to either half
 * moves it. A version number somebody has to remember to bump stops moving on
 * the day it matters.
 */
/**
 * STRIP THE PROSE BEFORE IT GOES IN A BOOKMARK.
 *
 * A normal bookmarklet is a few hundred bytes. This one was FIFTY THOUSAND
 * characters, a fifth of which was the commentary above being shipped into
 * somebody's bookmarks bar, and browsers get unreliable with bookmark URLs
 * that long: the failure is not an error, it is a bookmark that stores wrong
 * or does not fire, which is exactly what was reported.
 *
 * So the served file keeps every comment, because that is the copy a person
 * pastes into a snippet and reads, and the BOOKMARK build gets this. One
 * source, two renderings, which is a build step rather than a second
 * implementation.
 *
 * DELIBERATELY CONSERVATIVE. It removes only block comments that START a line
 * and the indentation in front of them, so it can never reach inside a string
 * or a regex. That matters more than the last few bytes: a minifier that eats
 * the `//` in "https://..." produces a program that fails on a stranger's
 * website with nothing to read.
 */
export function compactCollector(source: string): string {
  return source
    .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\r?\n/gm, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

export function collectorSource(origin: string): { source: string; build: string } {
  const withExtractor = OPERATOR_SOURCE.replace("%%CAPTURE%%", captureSource.toString())
    .replace("%%INGEST%%", INGEST_PATH)
    .replaceAll("%%INSTALL%%", INSTALL_PATH)
    .replace("%%ORIGIN%%", origin)

  const build = createHash("sha256").update(withExtractor).digest("hex").slice(0, 8)
  return { source: withExtractor.replaceAll("%%BUILD%%", build), build }
}
