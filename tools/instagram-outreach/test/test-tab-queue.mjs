/* Drives the launcher page's tab queue in real Chromium with the pop-up blocker
 * left ON, which is what a normal Chrome profile does.
 *
 * The bug this pins: Chrome allows exactly one window.open per user gesture, so
 * a ten-per-click batch silently became one tab. The earlier version also
 * passed 'noopener', which makes window.open return null even on success, so
 * blocked items were counted as opened and dropped from the queue entirely.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAUNCHER = 'file://' + path.join(HERE, '..', 'new-followers.html');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failures = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) failures++; };

const status = (p) => p.evaluate(() => document.getElementById('status').textContent);

/* Counting ctx.pages() races with tab creation, and ig.me does not resolve in
 * this sandbox so real tabs land on an error page. So window.open is wrapped to
 * record the URLs Chrome actually accepted, while still calling through to the
 * real window.open: the blocker's one-per-gesture behaviour is what is under
 * test and must not be stubbed out. Only the destination is swapped for
 * about:blank, which needs no network. */
const opened = (p) => p.evaluate(() => window.__opened.slice());

async function withBrowser(blockerOn, fn) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    ...(blockerOn ? { ignoreDefaultArgs: ['--disable-popup-blocking'] } : {}),
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    window.__opened = [];
    const real = window.open;
    window.open = function (url, ...rest) {
      const win = real.call(window, 'about:blank', ...rest);
      if (win) window.__opened.push(url);
      return win;
    };
  });
  await page.goto(LAUNCHER);
  // Narrow the run to a predictable five.
  await page.fill('#capN', '5');
  await page.click('#selDue');
  ok(await page.evaluate(() =>
    Array.from(document.querySelectorAll('#list input[type=checkbox]')).filter(c => c.checked).length
  ) === 5, 'five due accounts ticked by Select who is due');
  await fn({ browser, ctx, page, errors });
  ok(errors.length === 0, 'no uncaught page errors' + (errors.length ? ': ' + errors.join('; ') : ''));
  await browser.close();
}

console.log('=== blocker ON (normal Chrome): one tab per gesture ===');
await withBrowser(true, async ({ page }) => {
  await page.click('#openDms');
  ok((await opened(page)).length === 1, 'the queueing click opened exactly 1 tab, got ' + (await opened(page)).length);
  ok(/Opened 1 of 5, 4 to go/.test(await status(page)), 'status reports 1 of 5: ' + JSON.stringify(await status(page)));

  // The batch button must not lose the ones Chrome refuses.
  await page.click('#openBatch');
  ok((await opened(page)).length === 2, 'batch of 10 yielded 1 more tab, total ' + (await opened(page)).length);
  const s = await status(page);
  ok(/Opened 2 of 5, 3 to go/.test(s), 'nothing was dropped: ' + JSON.stringify(s));
  ok(/blocked the rest, which are still queued/.test(s), 'explained the block');

  // O key is a gesture too, so it should advance one per press.
  await page.click('h1');
  for (let i = 0; i < 3; i++) await page.keyboard.press('KeyO');
  const all = await opened(page);
  ok(all.length === 5, 'three O presses opened three more, total ' + all.length);
  ok(/All 5 opened/.test(await status(page)), 'queue drained: ' + JSON.stringify(await status(page)));

  // Every ticked row should now be marked done, and the URLs should be right.
  ok(await page.evaluate(() => document.querySelectorAll('#list li.done').length) === 5,
     'all five rows marked done');
  /* The first five include hebborns_family_f and blazeone, whose handles the
     screenshots truncated. Those must fall back to search rather than a profile
     URL that would 404. */
  const dm = all.filter(u => u.startsWith('https://www.instagram.com/direct/new/#ll='));
  const search = all.filter(u => u.startsWith('https://www.instagram.com/explore/search/keyword/?q='));
  ok(dm.length + search.length === 5, 'every tab is a DM link or a search fallback: ' + JSON.stringify(all));
  ok(dm.length === 3, 'the three exact handles became new-message links, got ' + dm.length);
  ok(search.length === 2, 'the two truncated handles became searches, got ' + search.length);
  ok(all.length === new Set(all).size, 'no duplicate tabs');
  ok(all[0] === 'https://www.instagram.com/direct/new/#ll=j.a.k.50a', 'first tab is the newest follower: ' + all[0]);

  // Typing in a reply box must not be hijacked by the O shortcut.
  await page.fill('#r0', '');
  await page.type('#r0', 'open onto');
  ok(await page.inputValue('#r0') === 'open onto', 'O in a textarea types instead of opening a tab');
  ok((await opened(page)).length === 5, 'no extra tabs from typing, still ' + (await opened(page)).length);
});

console.log('\n=== blocker OFF (pop-ups allowed for the page): full batch ===');
await withBrowser(false, async ({ page }) => {
  await page.click('#openDms');
  ok((await opened(page)).length === 1, 'queueing click opened 1');
  await page.click('#openBatch');
  const all = await opened(page);
  ok(all.length === 5, 'batch opened the remaining 4 in one click, total ' + all.length);
  ok(/All 5 opened/.test(await status(page)), 'queue drained in one batch');
  ok(all.length === new Set(all).size, 'no duplicate tabs in the batch');
});

console.log('\n=== clear queue ===');
await withBrowser(true, async ({ page }) => {
  await page.click('#openDms');
  await page.click('#clearQueue');
  ok(/Nothing queued yet/.test(await status(page)), 'clear resets the status');
  ok(await page.evaluate(() => document.querySelectorAll('#list li.done').length) === 0,
     'clear unmarks the done rows');
  ok(await page.isDisabled('#openNext'), 'next button disabled with an empty queue');
});

console.log(failures ? '\n' + failures + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
