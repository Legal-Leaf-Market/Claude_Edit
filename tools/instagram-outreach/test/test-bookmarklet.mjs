import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAUNCHER = path.join(HERE, '..', 'new-followers.html');
const MOCK = 'file://' + path.join(HERE, 'mock-dm.html');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const REPLIES = ['first line here', 'second line here', 'third line here'];

const html = fs.readFileSync(LAUNCHER, 'utf8');
const injector = html
  .match(/<script type="text\/plain" id="qr-source">([\s\S]*?)<\/script>/)[1]
  .replace('__REPLIES_JSON__', JSON.stringify(REPLIES))
  .replace('__GAP_MS__', '150');

const browser = await chromium.launch({ executablePath: CHROME });
const errors = [];
let failures = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) failures++; };

const panelLog = (pg) => pg.evaluate(() => {
  const h = Array.from(document.querySelectorAll('div')).find(d => d.shadowRoot);
  return h ? h.shadowRoot.querySelector('#log').textContent : '(no panel)';
});

async function runMode(mode) {
  console.log('\n=== editor style: ' + mode + ' ===');
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(mode + ': ' + e));
  await page.goto(MOCK + '?mode=' + mode);
  await page.evaluate(injector);

  ok((await panelLog(page)).startsWith('Armed'), 'panel armed: ' + JSON.stringify(await panelLog(page)));

  await page.click('#box');
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyI');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Alt');

  await page.waitForFunction(() => window.__sent.length >= 3, null, { timeout: 10000 })
    .catch(() => console.log('  (timed out waiting for 3 commits)'));

  const sent = await page.evaluate(() => window.__sent);
  console.log('  editor received: ' + JSON.stringify(sent));
  console.log('  panel log: ' + JSON.stringify(await panelLog(page)));

  ok(sent.length === 3, 'exactly 3 messages committed, got ' + sent.length);
  ok(!sent.some(s => s === ''), 'no blank message was ever posted');
  ok(JSON.stringify(sent) === JSON.stringify(REPLIES), 'all three arrived intact and in order');
  ok(await page.evaluate(() => document.querySelectorAll('#thread div').length) === 3,
     '3 bubbles rendered in the thread');

  // single-reply hotkey
  await page.evaluate(() => { window.__sent = []; });
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Digit2');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Alt');
  await page.waitForFunction(() => window.__sent.length >= 1, null, { timeout: 5000 }).catch(() => {});
  const one = await page.evaluate(() => window.__sent);
  ok(JSON.stringify(one) === JSON.stringify([REPLIES[1]]), 'Alt+Shift+2 sent only reply 2: ' + JSON.stringify(one));

  // Esc hides
  await page.keyboard.press('Escape');
  ok(await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('div')).find(d => d.shadowRoot);
    return h.style.display === 'none';
  }), 'Esc hid the panel');

  await page.close();
}

await runMode('model');   // Lexical-style, the real Instagram shape
await runMode('dom');     // naive editor, exercises the execCommand fallback

// --- refuses on an unreachable box instead of posting blanks ---
console.log('\n=== unreachable composer ===');
const p3 = await browser.newPage();
p3.on('pageerror', e => errors.push('inert: ' + e));
await p3.setContent(`
  <div role="textbox" contenteditable="true" id="box"></div>
  <script>
    // An editor that ignores every insertion route and never enables Send.
    const b = document.getElementById('box');
    b.addEventListener('beforeinput', e => e.preventDefault());
    b.addEventListener('paste', e => e.preventDefault());
    window.__enters = 0;
    b.addEventListener('keydown', e => { if (e.key === 'Enter') window.__enters++; });
  <\/script>`);
await p3.evaluate(injector);
await p3.evaluate(() => window.__gaQR.run([0]));
await p3.waitForFunction(() => {
  const h = Array.from(document.querySelectorAll('div')).find(d => d.shadowRoot);
  return /Stopped/.test(h.shadowRoot.querySelector('#log').textContent);
}, null, { timeout: 8000 }).catch(() => {});
const inertLog = await panelLog(p3);
console.log('  panel log: ' + JSON.stringify(inertLog));
ok(/would not take the text/.test(inertLog), 'reported the refusal');
ok(await p3.evaluate(() => window.__enters) === 0, 'never pressed Enter at an unreachable box');

// --- no composer at all ---
console.log('\n=== no composer ===');
const p4 = await browser.newPage();
p4.on('pageerror', e => errors.push('nocomposer: ' + e));
await p4.setContent('<p>inbox, no thread open</p>');
await p4.evaluate(injector);
await p4.evaluate(() => window.__gaQR.run([0]));
await new Promise(r => setTimeout(r, 700));
const noLog = await panelLog(p4);
console.log('  panel log: ' + JSON.stringify(noLog));
ok(/no message box/.test(noLog), 'told the user to open the thread first');

await browser.close();
console.log('\nuncaught page errors: ' + (errors.length ? JSON.stringify(errors) : 'none'));
if (errors.length) failures++;
console.log(failures ? '\n' + failures + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
