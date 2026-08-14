// Test harness: extract lines from each PDF the way the browser will,
// run the shared parsers, print records + reconciliation.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.js');
const KLSCAN = require('./parsers.js');

const NUL = String.fromCharCode(0);

async function docPages(path) {
  const data = new Uint8Array(fs.readFileSync(path));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    const frags = [];
    for (const it of tc.items) {
      const text = (it.str || '').split(NUL).join('').trim();
      if (!text) continue;
      frags.push({ x: it.transform[4], y: it.transform[5], t: text.replace(/\s+/g, ' ') });
    }
    const rows = [];
    for (const f of frags) {
      let row = rows.find(r => Math.abs(r.y - f.y) <= 2.5);
      if (!row) { row = { y: f.y, f: [] }; rows.push(row); }
      row.f.push(f);
    }
    rows.sort((a, b) => b.y - a.y);
    rows.forEach(r => r.f.sort((a, b) => a.x - b.x));
    pages.push(rows);
  }
  return pages;
}

const U = '/root/.claude/uploads/911ecf6c-3401-5917-ac0f-6159eb35f4cf';
const FILES = [
  'e1ed5dc0-2026.05.31__Naldo_AC_Trust__Goldman_Sachs_4174.pdf',
  '58adc65f-2026.05.31__RN_2021_Trust__Goldman_Sachs_Statement_xxx1988.pdf',
  '0ee931c2-2026.05.31__RN_2021_Trust__Goldman_Sachs_Statement_xxx3094.pdf',
  '857d4250-300420251231Invt_Mgmt049.pdf',
  '87f3c9a7-900820251231Invt_Mgmt025.pdf',
  '8e0ccce8-400520251231Asset001.pdf',
  'bcb903b6-Brokerage_Statement_20251231_796.PDF',
];

for (const f of FILES) {
  const pages = await docPages(`${U}/${f}`);
  const res = KLSCAN.parseDocument({ filename: f, pages });
  process.stderr.write(`\n########## ${f}\n  custodian: ${res.custodian}  accounts: ${res.accounts.length}\n`);
  for (const acc of res.accounts) {
    process.stderr.write(`  -- number=${acc.number} entity=${JSON.stringify(acc.entity)} reportDate=${acc.reportDate} records=${acc.records.length}\n`);
    for (const r of acc.records) {
      process.stderr.write(`     ${r.Section.padEnd(22)} | ${r['Reporting Period'].padEnd(11)} | ${r.TranType.padEnd(42)} | ${String(r.Amount).padStart(14)} | ${r.confidence}\n`);
    }
    for (const rc of acc.recon) {
      process.stderr.write(`     RECON ${rc.ok ? 'OK  ' : 'FAIL'} ${rc.name}: computed ${rc.actual} vs stated ${rc.expected} (residual ${rc.residual})\n`);
    }
    for (const w of acc.warnings) process.stderr.write(`     WARN ${w}\n`);
  }
  if (res.error) process.stderr.write(`  ERROR: ${res.error}\n`);
}
