# KnowLedger Statement Scanner

A two-file Google Apps Script web app that turns custodian statement PDFs into
klr03-all records (`Number | Custodian | Report Date | Reporting Period |
TranType | Amount | Source | Section`), with per-account reconciliation checks
and JSON/CSV export matching the ksinjest run format.

Custodians: Fidelity, Goldman Sachs, JP Morgan, Schwab. Extraction happens in
the browser with pdf.js (text layer, no OCR); parsing happens server-side.

## Files

- `Code.gs` - the deployable server file: parser engine + web app glue.
  Assembled from `parsers.js` (the engine, testable under node) and
  `app_tail.gs` (doGet / parseDocuments / saveExport).
- `Index.html` - the deployable UI: upload, extract, review/tie-out, export.
- `parsers.js` - the parser engine on its own, shared verbatim with Code.gs.
- `extract_lines.mjs` / `test_parse.mjs` - node test harness that runs the
  real pdf.js extraction plus the engine against local statement PDFs
  (`npm i pdfjs-dist@3.11.174`, adjust the file paths, `node test_parse.mjs`).

## Deploy

New Apps Script project, paste `Code.gs`, add an HTML file named exactly
`Index`, paste `Index.html`, Deploy as web app (execute as Me, access: only
myself).

## Notes

- Goldman Sachs masks portfolio numbers on the page (`XXX-XX309-4`); the
  Account # field in the review step is editable and stamps every record.
- Reconciliation failures are flagged with their residual, never plugged.
- Fidelity is written to the klr03-all vocabulary but should be verified
  against a real statement PDF before first use.
