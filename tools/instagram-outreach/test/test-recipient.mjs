/* The recipient picker is the one place where a wrong guess DMs a stranger, so
 * these checks are mostly about refusing rather than succeeding. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCK = 'file://' + path.join(HERE, 'mock-new.html');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const REPLIES = ['one', 'two', 'three'];
const NEWS = 'pick https://legal-leafmarket.com/p/x';

const injector = fs.readFileSync(path.join(HERE, '..', 'new-followers.html'), 'utf8')
  .match(/<script type="text\/plain" id="qr-source">([\s\S]*?)<\/script>/)[1]
  .replace('__MESSAGES_JSON__', JSON.stringify({ intro: REPLIES, newsletter: NEWS }))
  .replace('__GAP_MS__', '120');

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const browser = await chromium.launch({ executablePath: CHROME });
const log = (p) => p.evaluate(() => {
  const h = Array.from(document.querySelectorAll('div')).find(d => d.shadowRoot);
  return h ? h.shadowRoot.querySelector('#log').textContent : '(no panel)';
});

async function open(url) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(url);
  await page.evaluate(injector);
  return { page, errs };
}

console.log('=== exact handle present: opens the thread, then sends ===');
{
  const { page, errs } = await open(MOCK + '#ll=jellojayy191');
  ok(/Armed for @jellojayy191/.test(await log(page)), 'panel names the recipient: ' + JSON.stringify(await log(page)));
  await page.evaluate(() => window.__gaQR.run('intro', [0, 1, 2]));
  await page.waitForFunction(() => window.__sent.length >= 3, null, { timeout: 15000 }).catch(() => {});
  ok(await page.evaluate(() => window.__picked) === 'jellojayy191',
     'picked the exact handle, got ' + JSON.stringify(await page.evaluate(() => window.__picked)));
  const sent = await page.evaluate(() => window.__sent);
  ok(JSON.stringify(sent) === JSON.stringify(REPLIES), 'all three sent in order: ' + JSON.stringify(sent));
  ok(errs.length === 0, 'no page errors');
  await page.close();
}

console.log('\n=== near misses only: refuses, picks nobody, sends nothing ===');
{
  // Directory deliberately lacks the requested handle but is full of prefix matches.
  const { page } = await open(MOCK + '?dir=jellojayy:A,jellojayy1910:B,jellojayy19:C' + '#ll=jellojayy191');
  await page.evaluate(() => window.__gaQR.run('intro', [0]));
  await page.waitForFunction(() => /Stopped|no result/.test(
    Array.from(document.querySelectorAll('div')).find(d => d.shadowRoot).shadowRoot.querySelector('#log').textContent
  ), null, { timeout: 15000 }).catch(() => {});
  const l = await log(page);
  console.log('  panel log: ' + JSON.stringify(l));
  ok(/no result exactly matching @jellojayy191/.test(l), 'refused with a specific reason');
  ok(await page.evaluate(() => window.__picked) === null, 'nobody was selected');
  ok((await page.evaluate(() => window.__sent)).length === 0, 'nothing was sent');
  await page.close();
}

console.log('\n=== no handle at all: says so instead of guessing ===');
{
  const { page } = await open(MOCK);
  await page.evaluate(() => window.__gaQR.run('intro', [0]));
  await new Promise(r => setTimeout(r, 900));
  const l = await log(page);
  console.log('  panel log: ' + JSON.stringify(l));
  ok(/no handle in the URL/.test(l), 'reported the missing handle');
  ok(await page.evaluate(() => window.__picked) === null, 'nobody was selected');
  await page.close();
}

console.log('\n=== handle survives Instagram dropping the hash ===');
{
  const { page } = await open(MOCK + '#ll=jellojayy191');
  // Instagram's router rewrites the URL after boot; the handle must survive it.
  await page.evaluate(() => history.replaceState(null, '', location.pathname));
  ok(await page.evaluate(() => location.hash) === '', 'hash is gone');
  await page.evaluate(() => window.__gaQR.run('newsletter', []));
  await page.waitForFunction(() => window.__sent.length >= 1, null, { timeout: 15000 }).catch(() => {});
  ok(await page.evaluate(() => window.__picked) === 'jellojayy191', 'still found the recipient from sessionStorage');
  ok(JSON.stringify(await page.evaluate(() => window.__sent)) === JSON.stringify([NEWS]),
     'newsletter sent as one message');
  await page.close();
}

await browser.close();
console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
