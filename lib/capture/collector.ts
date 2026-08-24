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

  var capture = (%%CAPTURE%%)();
  capture.build = BUILD;

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
    '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
      '<button id="ga-send" style="flex:1;background:#4ade80;color:#06202b;font-weight:700;border:0;' +
      'border-radius:999px;padding:9px 14px;cursor:pointer;font:inherit;font-weight:700">Send</button>' +
      '<button id="ga-copy" style="background:none;color:#8fd3ff;border:1px solid #2b4a72;' +
      'border-radius:999px;padding:9px 14px;cursor:pointer;font:inherit">Copy</button>' +
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

  function body(){
    return {
      merchantKey: ($("ga-key").value || "").trim(),
      build: BUILD,
      capture: capture,
    };
  }

  /* ----------------------------------------------------------------- send */

  $("ga-send").onclick = function(){
    var token = ($("ga-token").value || "").trim();
    if (!token) { say("Paste the admin passcode first."); return; }
    if (!($("ga-key").value || "").trim()) { say("Name the merchant first."); return; }
    $("ga-send").disabled = true;
    say("Sending " + capture.products.length + " products...");

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
export function collectorSource(origin: string): { source: string; build: string } {
  const withExtractor = OPERATOR_SOURCE.replace("%%CAPTURE%%", captureSource.toString())
    .replace("%%INGEST%%", INGEST_PATH)
    .replaceAll("%%INSTALL%%", INSTALL_PATH)
    .replace("%%ORIGIN%%", origin)

  const build = createHash("sha256").update(withExtractor).digest("hex").slice(0, 8)
  return { source: withExtractor.replaceAll("%%BUILD%%", build), build }
}
