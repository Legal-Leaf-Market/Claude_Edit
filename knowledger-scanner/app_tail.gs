
// ======================================================================
// Apps Script web app glue (everything above is the tested parser engine)
// ======================================================================

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('KnowLedger Statement Scanner')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Server entry point. docs = [{filename, pages}], where pages follow the
 * KLSCAN line model built client-side from pdf.js text items.
 */
function parseDocuments(docs) {
  var out = { documents: [] };
  docs.forEach(function (doc) {
    var res;
    try {
      res = KLSCAN.parseDocument(doc);
    } catch (e) {
      res = { custodian: null, accounts: [], error: 'Parser threw: ' + e.message };
    }
    out.documents.push({
      filename: doc.filename,
      custodian: res.custodian,
      error: res.error || null,
      accounts: res.accounts
    });
  });
  return out;
}

/** Saves the export files into a Drive folder and returns their URLs. */
function saveExport(baseName, jsonText, csvText) {
  var it = DriveApp.getFoldersByName('KnowLedger Statement Scanner');
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder('KnowLedger Statement Scanner');
  var jsonFile = folder.createFile(baseName + '.json', jsonText, 'application/json');
  var csvFile = folder.createFile(baseName + '.csv', csvText, 'text/csv');
  return { folderUrl: folder.getUrl(), jsonUrl: jsonFile.getUrl(), csvUrl: csvFile.getUrl() };
}
