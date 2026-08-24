import { captureSource } from "./extract"

/**
 * THE BOOKMARKLET: `captureSource()` wrapped in the bit that shows a result and
 * hands you the file.
 *
 * WHY THE BODY IS SERIALISED RATHER THAN WRITTEN OUT AS A STRING. A bookmarklet
 * is a single `javascript:` URL, so its code has to be one self-contained
 * expression, and the obvious way to build one is to type the JavaScript into a
 * template literal. That is a second copy of the extractor, in a form nobody
 * can read or test, which is section 7's "never fork the logic" in the version
 * that rots fastest: the readable copy gets the bug fix and the string does not.
 *
 * So there is one copy, in lib/capture/extract.ts, and this reads it back with
 * Function.prototype.toString(). The cost of that trick is a real constraint
 * (`captureSource` may close over nothing at all) and a test that enforces it.
 *
 * WHY IT SAVES A FILE RATHER THAN POSTING. Three reasons, and the third is the
 * one that decided it.
 *
 *   A POST from the merchant's page to gearavail.com is cross-origin, so it
 *   needs CORS and a credential that would then live in a bookmarklet URL in
 *   somebody's bookmarks bar, in plain sight, forever.
 *
 *   A file has no size ceiling worth worrying about. A category page with a
 *   thousand cards and their raw HTML is megabytes, and "capture everything,
 *   filter never" means that is normal rather than exceptional.
 *
 *   And the raw file IS the deliverable. The point of this tool is having the
 *   full pull in hand before drawing a conclusion, so landing it on disk, where
 *   it can be re-read and re-analysed without browsing forty pages again, is
 *   the workflow rather than a fallback for a failed upload.
 *
 * The clipboard gets a copy too, because for one product page that is faster
 * than opening a download.
 */

/** Everything the wrapper needs to say, kept out of the serialised body. */
const OVERLAY_STYLE =
  "position:fixed;top:16px;right:16px;z-index:2147483647;max-width:360px;" +
  "background:#0b1a33;color:#e8eef7;font:13px/1.5 ui-sans-serif,system-ui,sans-serif;" +
  "padding:14px 16px;border-radius:10px;border:1px solid #ffffff;" +
  "box-shadow:0 10px 40px rgba(0,0,0,.5)"

/**
 * Build the `javascript:` URL.
 *
 * `filenameHint` only names the download. The capture records the real page URL
 * inside itself, so a mis-named file is a nuisance rather than a wrong answer.
 */
export function buildCaptureBookmarklet(): string {
  const body = captureSource.toString()

  const wrapper = `(function(){
  try{
    var capture=(${body})();
    var name='capture-'+location.hostname.replace(/[^a-z0-9]+/gi,'-')+'-'+Date.now()+'.json';
    var json=JSON.stringify(capture,null,2);

    try{ navigator.clipboard && navigator.clipboard.writeText(json); }catch(e){}

    var blob=new Blob([json],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },2000);

    var box=document.createElement('div');
    box.setAttribute('style',${JSON.stringify(OVERLAY_STYLE)});
    var per=Object.keys(capture.bySource).map(function(k){return k+': '+capture.bySource[k]}).join(', ');
    var notes=capture.coverage.notes.map(function(n){
      return '<li style="margin:4px 0">'+n.replace(/</g,'&lt;')+'</li>'
    }).join('');
    box.innerHTML='<strong style="color:#4ade80">'+capture.products.length+' products captured</strong>'
      +'<div style="opacity:.8;margin-top:4px">'+(per||'nothing found')+'</div>'
      +(capture.coverage.claimedTotal?'<div style="opacity:.8">page claims '+capture.coverage.claimedTotal+' results</div>':'')
      +(notes?'<ul style="margin:8px 0 0;padding-left:18px;opacity:.9">'+notes+'</ul>':'')
      +'<div style="margin-top:8px;opacity:.7">Saved '+name+' and copied to your clipboard.</div>';
    document.body.appendChild(box);
    setTimeout(function(){ box.remove(); },15000);
  }catch(err){
    alert('Capture failed: '+(err && err.message ? err.message : err));
  }
})()`

  /*
   * encodeURIComponent, not a hand-rolled escape. A bookmarklet URL that is
   * merely "mostly encoded" fails on the first page whose markup contains the
   * character that was missed, and it fails silently in a bookmarks bar where
   * nobody is watching a console.
   */
  return `javascript:${encodeURIComponent(wrapper)}`
}
