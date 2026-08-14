// Mirrors the browser-side extraction the Apps Script app will do:
// pdf.js getTextContent -> items -> group into visual lines by Y -> sort by X.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.js');

const NUL = String.fromCharCode(0);

export async function docLines(path) {
  const data = new Uint8Array(fs.readFileSync(path));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    const frags = [];
    for (const it of tc.items) {
      const text = (it.str || '').split(NUL).join('');
      if (!text.trim()) continue;
      frags.push({ x: it.transform[4], y: it.transform[5], text });
    }
    const rows = [];
    for (const f of frags) {
      let row = rows.find(r => Math.abs(r.y - f.y) <= 2.5);
      if (!row) { row = { y: f.y, frags: [] }; rows.push(row); }
      row.frags.push(f);
    }
    rows.sort((a, b) => b.y - a.y); // PDF y grows upward
    pages.push(rows.map(r =>
      r.frags.sort((a, b) => a.x - b.x).map(f => f.text).join(' ').replace(/\s+/g, ' ').trim()
    ));
  }
  return pages;
}

if (process.argv[2]) {
  const pages = await docLines(process.argv[2]);
  fs.writeFileSync(process.argv[3], JSON.stringify(pages));
}
