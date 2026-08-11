/* The screenshot reader's parser, run against OCR-shaped text.
 *
 * The OCR itself is not testable here (tesseract.js needs a browser and a real
 * image), and it is not the interesting half anyway. The interesting half is
 * what we do with the text, because a follower list defeats the obvious reading
 * in one specific way: plenty of DISPLAY NAMES are handle-shaped. "comme_222"
 * sits above "comme222", "stickybanditofficial" above "Stickybanditofficial",
 * "geekbar_fam_arabia" above "geekbar_arabia". Take every handle-shaped line and
 * you import each account twice, once under a name that is not a handle at all,
 * and the second one opens a DM with a stranger or a 404.
 *
 * What separates them is the row button. Instagram puts Message or Requested on
 * the handle's line and never on the name's, so the button column is the signal
 * and the fixtures below keep it.
 *
 * The text is written the way tesseract actually returns this screen: the status
 * bar, the profile header, the tab row with its counts, then the rows.
 *
 * Run: node test/test-parse-shots.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'new-followers.html'), 'utf8');

/* Pulled out of the page rather than copied, so a change to the parser that
   nobody mirrors here fails instead of passing against a stale duplicate. */
const from = html.indexOf('const CHROME = new Set([');
const to = html.indexOf('/* ---------- the reader ---------- */');
if (from < 0 || to < 0 || to < from) {
  console.log('  FAIL could not find the parser block in new-followers.html');
  process.exit(1);
}
const src = html.slice(from, to);
const { cleanHandle, looksLikeHandle, parseScreenshotText, parsePastedText } =
  new Function(src + '\nreturn { cleanHandle, looksLikeHandle, parseScreenshotText, parsePastedText };')();

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const HEADER = [
  '8:26',
  'legal_leaf_market',
  '417 followers 1,105 following Subscriptions Fla',
].join('\n');

console.log('=== a follower screen reads as its handles, not its display names ===');
{
  const text = HEADER + '\n' + [
    'comme_222 Message X',
    'comme222',
    'french_fries_insta Message X',
    'French fries',
    'puffcosasquatch Message X',
    'Matt Curtis',
    'gukchex_ra Message X',
    'stickybanditofficial Message X',
    'Stickybanditofficial',
    'james514438 Message X',
    'James Neeson',
    'ian.finley.14 Message X',
    'Ian Finley',
    'og.grow.service Message X',
    'j.a.k.50a Message X',
    'jak',
    'alexa_n6738 Message X',
  ].join('\n');
  const rows = parseScreenshotText(text, 'shot1.png');
  const got = rows.map(r => r.handle);
  console.log('  read: ' + JSON.stringify(got));
  ok(got.length === 10, 'ten rows, one per account: ' + got.length);
  ok(!got.includes('comme222'), 'the display name under comme_222 is not imported as an account');
  ok(!got.includes('stickybanditofficial'.toUpperCase().toLowerCase()) || got.filter(h => h === 'stickybanditofficial').length === 1,
     'a display name identical to its handle is not imported twice');
  ok(!got.includes('legal_leaf_market'), 'the profile header is not a follower');
  ok(!got.includes('417') && !got.includes('1105'), 'the follower counts are not followers');
  ok(!got.some(h => /^(message|following|subscriptions|fla)$/.test(h)),
     'no button or tab label came through as a handle');
  ok(got.includes('ian.finley.14') && got.includes('j.a.k.50a'),
     'dots inside a handle survive');
  ok(rows.find(r => r.handle === 'french_fries_insta').name === 'French fries',
     'the line under a handle is kept as the display name');
  ok(rows.every(r => r.sure), 'a clean read arrives ticked');
}

console.log('\n=== a handle Instagram truncated is marked, not guessed ===');
{
  const text = HEADER + '\n' + [
    'cannabis_my_medi... Message X',
    'Mike Robinson, The...',
    'margaretsheehan7... Message X',
    'Margaret Sheehan',
    'nab_nabbsbackup Message X',
  ].join('\n');
  const rows = parseScreenshotText(text, 'shot2.png');
  const cut = rows.find(r => r.handle === 'cannabis_my_medi');
  console.log('  read: ' + JSON.stringify(rows.map(r => [r.handle, r.truncated])));
  ok(!!cut, 'the visible part of a cut-off handle is kept: cannabis_my_medi');
  ok(cut.truncated === true, 'and it is flagged truncated rather than treated as complete');
  ok(cut.sure === false, 'so it arrives unticked and has to be looked at');
  ok(rows.find(r => r.handle === 'nab_nabbsbackup').truncated === false,
     'a whole handle on the same screen is not dragged down with it');
  ok(!rows.some(r => r.handle === 'mike'), 'a truncated display name is not read as an account');
}

console.log('\n=== Requested is a row button too ===');
{
  /* bearkingcrbackup and happytenerife420 show Requested rather than Message.
     Miss that and their rows read as display names and vanish. */
  const text = HEADER + '\n' + [
    'happytenerife420 Requested X',
    '420Tenerife',
    'dealertheweed Message X',
    'The weed dealer',
  ].join('\n');
  const got = parseScreenshotText(text, 's.png').map(r => r.handle);
  console.log('  read: ' + JSON.stringify(got));
  ok(got.includes('happytenerife420'), 'a Requested row is still a row');
  ok(got.length === 2, 'and its display name is still not one: ' + got.length);
}

console.log('\n=== a crop with no buttons falls back rather than reading nothing ===');
{
  /* Someone will crop tight around the names. Reading nothing at all would look
     like the tool is broken, so the fallback takes every handle-shaped line and
     the review catches the display names. */
  const text = ['keepin_grow', 'cali_pack_gonzalez', 'Cali Gonzalez', 'codys_kanna_1'].join('\n');
  const got = parseScreenshotText(text, 's.png').map(r => r.handle);
  console.log('  read: ' + JSON.stringify(got));
  ok(got.includes('keepin_grow') && got.includes('codys_kanna_1'),
     'the handles are still found without a button column');
}

console.log('\n=== a handle that cannot be legal is not silently corrected ===');
{
  /* OCR reads I for l and O for 0 constantly. Stripping the illegal characters
     produces something that LOOKS fine, which is the dangerous outcome, so the
     row is kept but marked for checking. */
  const r = parseScreenshotText('mijdrecht|genetics Message X', 's.png')[0];
  console.log('  read: ' + JSON.stringify(r && [r.handle, r.sure]));
  ok(!!r && r.sure === false, 'a token that needed characters stripped arrives unticked');
  ok(cleanHandle('@Robers135').handle === 'robers135', 'a leading @ and stray case are normalised');
  ok(cleanHandle('green.diamond0.').handle === 'green.diamond0', 'a trailing dot, which Instagram forbids, is dropped');
  ok(cleanHandle('copy.catclones_').handle === 'copy.catclones_', 'but a trailing underscore, which it allows, is kept');
  ok(looksLikeHandle('417') === false, 'a bare number is not a handle');
  ok(looksLikeHandle('message') === false, 'and neither is a button');
}

console.log('\n=== pasted text is the fallback when the reader cannot be fetched ===');
{
  const rows = parsePastedText([
    'lucienarmandvoss, Lucien Armand Voss',
    '@breezy.1300 - B1300',
    'cannabis_my_medi…',
    '',
    'Message',
  ].join('\n'));
  console.log('  read: ' + JSON.stringify(rows.map(r => [r.handle, r.name, r.truncated])));
  ok(rows.length === 3, 'blank lines and stray chrome are skipped: ' + rows.length);
  ok(rows[0].name === 'Lucien Armand Voss', 'a comma splits handle from display name');
  ok(rows[1].handle === 'breezy.1300' && rows[1].name === 'B1300', 'so does a spaced dash, and the @ comes off');
  ok(rows[2].truncated === true, 'a trailing ellipsis still means partial');
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
