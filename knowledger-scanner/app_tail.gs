
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

// ======================================================================
// Knowledger Statement Ingest (ksinjest) integration.
// The token lives in Script Properties, never in code or in the page.
// ======================================================================

function ksConfig() {
  var p = PropertiesService.getScriptProperties();
  return {
    base: (p.getProperty('KSINJEST_BASE') || 'https://ksinjest.knowledgerllc.com/api/v1').replace(/\/+$/, ''),
    client: p.getProperty('KSINJEST_CLIENT') || 'KLR03',
    token: p.getProperty('KSINJEST_TOKEN') || ''
  };
}

/** Stores the bearer token (and optionally the client code). Returns status only. */
function ksSaveToken(token, client) {
  var p = PropertiesService.getScriptProperties();
  if (token && token.trim()) p.setProperty('KSINJEST_TOKEN', token.trim());
  if (client && client.trim()) p.setProperty('KSINJEST_CLIENT', client.trim());
  return ksStatus();
}

function ksStatus() {
  var cfg = ksConfig();
  return { hasToken: !!cfg.token, client: cfg.client, base: cfg.base };
}

function ksGet(path) {
  var cfg = ksConfig();
  if (!cfg.token) throw new Error('No ingest token saved. Paste it in the ingest panel and hit Save first.');
  var res = UrlFetchApp.fetch(cfg.base + path, {
    headers: { Authorization: 'Bearer ' + cfg.token },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code >= 300) throw new Error('Ingest API ' + code + ' on ' + path + ': ' + body.slice(0, 300));
  return JSON.parse(body);
}

/** Lists ingestion runs for the configured client. */
function ksListRuns() {
  var cfg = ksConfig();
  return ksGet('/' + encodeURIComponent(cfg.client) + '/runs');
}

/**
 * Pulls one run's extraction JSON and reshapes it into the same
 * document/account structure parseDocuments returns, so the review
 * and export steps work identically for imported runs.
 */
function ksImportRun(runId) {
  var data = ksGet('/runs/' + encodeURIComponent(runId) + '/json');
  var records = data.records || [];
  var bySource = {};
  var sourceOrder = [];
  records.forEach(function (r) {
    var src = r.Source || '(unknown source)';
    if (!bySource[src]) { bySource[src] = { accounts: {}, order: [] }; sourceOrder.push(src); }
    var num = r.Number || '(unknown)';
    if (!bySource[src].accounts[num]) { bySource[src].accounts[num] = []; bySource[src].order.push(num); }
    bySource[src].accounts[num].push({
      Number: r.Number,
      Custodian: r.Custodian,
      'Report Date': r['Report Date'],
      'Reporting Period': r['Reporting Period'],
      TranType: r.TranType,
      Amount: r.Amount,
      Source: r.Source,
      Section: r.Section,
      confidence: r.confidence || 'medium'
    });
  });
  var documents = sourceOrder.map(function (src) {
    var group = bySource[src];
    var accounts = group.order.map(function (num) {
      var recs = group.accounts[num];
      return {
        number: num,
        entity: '',
        custodian: recs[0] ? recs[0].Custodian : '',
        reportDate: recs[0] ? recs[0]['Report Date'] : '',
        source: src,
        records: recs,
        recon: [],
        warnings: []
      };
    });
    return {
      filename: src,
      custodian: accounts[0] ? accounts[0].custodian : null,
      error: null,
      accounts: accounts
    };
  });
  return { run_id: data.run_id, documents: documents };
}
