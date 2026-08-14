/**
 * =============================================================================
 * KLR03: Post statement journal entries to Sage Intacct THROUGH KNOWLEDGER
 * =============================================================================
 *
 * A two-file Google Apps Script web app (this file + Index.html, nothing else).
 *
 * WHY THIS EXISTS
 * ---------------
 * Posting straight at Sage's XML gateway from Apps Script dies with GW-0011:
 * the gateway rejects the request BEFORE authentication, almost certainly an
 * IP allowlist on the Web Services sender (Google's cloud IPs rotate and are
 * not on it). KnowLedger's own Decisions->Sage connector runs from a fixed,
 * allowlisted IP and works. So this app stops fighting that wall: it submits
 * finished JEs to KnowLedger's "Post Transactions to Target" flow on the
 * Decisions platform, and KnowLedger's connector does the Sage hop from an IP
 * Sage already trusts. The allowlist problem becomes theirs, and theirs is
 * already solved.
 *
 * THE DECISIONS PLATFORM, IN THREE FACTS
 * --------------------------------------
 * 1. A flow exposed as a REST service is invoked at
 *      {portal}/restapi/Flow/{FLOW_ID}
 *    with a POST whose JSON body is the flow's named inputs. The portal here
 *    is https://knowledger.decisions.com/KLR02 (KLR02 is the INSTANCE name in
 *    the portal URL Jacob uses; the client is KLR03. Probably the instance
 *    that houses the client, but confirm, it is one Script Property away).
 * 2. Auth is a session: either a permanent "named session" key an admin
 *    creates (passed as ?sessionid=...), or a session obtained by calling
 *    {portal}/REST/AccountService/LoginUser with user credentials, or
 *    userid/password passed on the call itself. All are supported below;
 *    KL_AUTH_MODE picks, 'auto' tries the sensible order.
 * 3. Responses usually wrap the flow outputs in the outcome path name,
 *    typically {"Done":{...}}. The parser unwraps defensively and hunts for
 *    PostedTransactions[] / FailedToPostTransactions[] case-insensitively.
 *
 * WHAT IS STILL NEEDED FROM RAHUL (KnowLedger)
 * --------------------------------------------
 *   a. The flow's REST endpoint: either the full Integration Details URL
 *      (paste into KL_FLOW_URL) or the Flow ID (KL_FLOW_ID).
 *   b. Auth: a named session key (KL_SESSION_ID) or an API user login
 *      (KL_USERID / KL_PASSWORD).
 *   c. The business values: ClientID (exact form, "KLR03" or a GUID),
 *      ConnectorConfigurationID, ProcessCode, ProcessID,
 *      SourceTransactionObjectName, and what SendToGL / IsRollUp mean in
 *      their flow.
 *   d. The Transactions[] object schema. Until confirmed, the mapping in
 *      mapJeToTransaction_() below is a sensible default and is THE ONLY
 *      PLACE to edit when the real schema arrives.
 *
 * SETUP (once)
 * ------------
 * 1. script.google.com -> New project -> paste this file as Code.gs and the
 *    companion as Index.html. Two files, exactly.
 * 2. Project Settings -> Script Properties, or just use the Settings panel
 *    in the app itself (it writes the same properties). Secrets live ONLY in
 *    Script Properties, never in this file.
 * 3. Deploy -> New deployment -> Web app -> Execute as: Me,
 *    Who has access: Only myself. Open the URL.
 * 4. In the app: Run diagnostics (safe, posts nothing) -> load and validate
 *    the JE lines -> dry run (shows the exact JSON, sends nothing) -> push.
 *
 * DATA
 * ----
 * Three sources, first one present wins: pasted rows (TSV straight out of
 * Excel, or JSON), a Google Sheet (KL_SHEET_ID / KL_SHEET_TAB), or the
 * JE_LINES constant below. The constant ships with SAMPLE rows so the wizard
 * is demonstrable end to end; the push step refuses sample rows, so the
 * samples can never reach KnowLedger. Replace them with the real 161 lines,
 * or just paste / point at the sheet.
 *
 * Columns are bound BY HEADER NAME through an alias table, never by
 * position, and the validator reports both what bound where and which
 * columns were present but unbound. An unbound column is how a value
 * silently arrives empty on every row; it is a report line here, not a
 * mystery.
 *
 * SAFETY RAILS (each one earned)
 * ------------------------------
 * - Money is integer cents, string-parsed. No floats touch a balance check.
 * - Every GL journal entry must balance to the cent or the push refuses.
 *   Nothing is ever plugged to make it balance; residuals are for review.
 * - KL_POST_DATE_FILTER (default 2025-06-30) keeps the push to the
 *   reconciled June set, same intent as the old app's 20250630 filter.
 * - SendToGL defaults FALSE. Confirm with Rahul what false does in their
 *   flow (expected: stage without posting) before flipping it.
 * - A repeat push of a byte-identical batch demands an extra confirmation.
 * - Session ids and passwords are redacted from everything echoed to the UI.
 * - The diagnostics never touch the real flow. The only pre-push call that
 *   does is the explicit "probe" button, which sends Transactions: [] with
 *   SendToGL forced false, and says so on its face.
 * =============================================================================
 */

/* eslint-disable no-var */

// ---------------------------------------------------------------------------
// 1. CONFIG: defaults here, overrides in Script Properties (same key names)
// ---------------------------------------------------------------------------

var DEFAULTS = {
  KL_BASE_URL: 'https://knowledger.decisions.com/KLR02',
  KL_FLOW_URL: '',            // full REST URL from the flow's Integration Details; wins over KL_FLOW_ID
  KL_FLOW_ID: '',             // GUID; used as {base}/restapi/Flow/{id} when KL_FLOW_URL is empty
  KL_AUTH_MODE: 'auto',       // auto | named-session | login | userpass-query | basic
  KL_SESSION_ID: '',          // named session key (often NS-...). SECRET.
  KL_USERID: '',              // Decisions user (usually an email)
  KL_PASSWORD: '',            // SECRET
  KL_CLIENT_ID: 'KLR03',
  KL_CONNECTOR_CONFIGURATION_ID: '',
  KL_PROCESS_CODE: '',
  KL_PROCESS_ID: '',
  KL_SOURCE_TRANSACTION_OBJECT_NAME: '',
  KL_SEND_TO_GL: 'false',
  KL_IS_ROLLUP: 'false',
  KL_STATE: 'Draft',
  KL_JOURNAL: 'KL Test J',    // confirm for KLR03; earlier designs also mention JK/EB/STATS journals
  KL_POST_DATE_FILTER: '2025-06-30', // empty string = push everything loaded
  KL_BATCH_SIZE: '0',         // transactions per HTTP call; 0 = all in one call
  KL_SHEET_ID: '',
  KL_SHEET_TAB: '',
  KL_EXTRA_INPUTS: ''         // JSON object merged into the flow inputs, for inputs Rahul adds later
};

var SECRET_KEYS = ['KL_PASSWORD', 'KL_SESSION_ID'];

/**
 * Read config: Script Properties over DEFAULTS. Every value is trimmed and a
 * whitespace-only value counts as unset. That rule exists because an
 * invisible pasted space in a hostname once read as an outage; nothing here
 * has meaningful edge whitespace, credentials included.
 */
function getConfig_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var cfg = {};
  Object.keys(DEFAULTS).forEach(function (k) {
    var v = props[k] != null ? String(props[k]).trim() : '';
    cfg[k] = v !== '' ? v : DEFAULTS[k];
  });
  cfg.sendToGL = parseBool_(cfg.KL_SEND_TO_GL);
  cfg.isRollUp = parseBool_(cfg.KL_IS_ROLLUP);
  cfg.batchSize = Math.max(0, parseInt(cfg.KL_BATCH_SIZE, 10) || 0);
  cfg.postDateFilter = cfg.KL_POST_DATE_FILTER ? (normalizeDate_(cfg.KL_POST_DATE_FILTER) || '') : '';
  return cfg;
}

function parseBool_(v) {
  return /^(true|1|yes|y)$/i.test(String(v || '').trim());
}

// ---------------------------------------------------------------------------
// 2. REFERENCE DATA (business facts from the reconciliation work)
// ---------------------------------------------------------------------------

/** Custodian account -> project/fund dimension. */
var ACCOUNT_PROJECT_MAP = {
  '636-897719': 'FID7719',
  '636-897803': 'FID7803',
  '636-897689': 'FID7689',
  '655-123115': 'FID3115',
  '636-897741': 'FID7741'
};

/** Trial balance ties at 06/30/2025, in cents. Used as a SOFT check on
 *  ending-balance (type EB) lines: a mismatch is a warning to review, never
 *  an auto-adjustment. */
var TB_TIES_CENTS = {
  FID7803: 4568243,
  FID3115: 101497185,
  FID7719: 57215289,
  FID7689: 26851841,
  FID7741: 7210763
};

// ---------------------------------------------------------------------------
// 3. JE DATA
// ---------------------------------------------------------------------------

/**
 * Baked-in journal entry lines. THESE FOUR ARE SAMPLES (sample: true) so the
 * wizard can be exercised end to end; the push step refuses any sample row.
 * Replace with the real KLR03 lines (the 161-line set), or ignore this and
 * paste rows / point KL_SHEET_ID at the sheet.
 *
 * Line schema (also what the paste/sheet parsers normalize to):
 *   je         grouping key; lines sharing it form one transaction
 *   date       YYYY-MM-DD
 *   journal    Intacct journal symbol (blank falls back to KL_JOURNAL)
 *   type       GL (default) | STAT | EB. Only GL lines are balance-checked.
 *   account    custodian account (optional, traceability + project autofill)
 *   project    project/fund dimension (autofilled from account when blank)
 *   gl, department, entity, subAccount, class   the dimension coding
 *              (a single "coding" column like 1001||Kerry Fam|Fiag-3115|taxable
 *               is also accepted and split in that order)
 *   memo       line memo
 *   debit / credit   decimal amounts; exactly one side per line
 */
var JE_LINES = [
  { sample: true, je: 'SAMPLE-2025-06-A', date: '2025-06-30', journal: '', type: 'GL',
    account: '655-123115', gl: '1001', department: '', entity: 'Kerry Fam',
    subAccount: 'Fiag-3115', class: 'taxable', memo: 'SAMPLE dividend income',
    debit: 1250.00, credit: null },
  { sample: true, je: 'SAMPLE-2025-06-A', date: '2025-06-30', journal: '', type: 'GL',
    account: '655-123115', gl: '4010', department: '', entity: 'Kerry Fam',
    subAccount: 'Fiag-3115', class: 'taxable', memo: 'SAMPLE dividend income',
    debit: null, credit: 1250.00 },
  { sample: true, je: 'SAMPLE-2025-06-A', date: '2025-06-30', journal: '', type: 'GL',
    account: '655-123115', gl: '1001', department: '', entity: 'Kerry Fam',
    subAccount: 'Fiag-3115', class: 'taxable', memo: 'SAMPLE margin interest',
    debit: null, credit: 84.12 },
  { sample: true, je: 'SAMPLE-2025-06-A', date: '2025-06-30', journal: '', type: 'GL',
    account: '655-123115', gl: '7020', department: '', entity: 'Kerry Fam',
    subAccount: 'Fiag-3115', class: 'taxable', memo: 'SAMPLE margin interest',
    debit: 84.12, credit: null }
];

// ---------------------------------------------------------------------------
// 4. WEB APP ENTRY + SETTINGS
// ---------------------------------------------------------------------------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('KLR03: post to Sage via KnowLedger')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Everything the UI needs on load. Secrets never leave as values. */
function getBootstrap() {
  var cfg = getConfig_();
  var settings = {};
  Object.keys(DEFAULTS).forEach(function (k) {
    if (SECRET_KEYS.indexOf(k) >= 0) {
      settings[k] = cfg[k] ? { set: true, hint: 'set (' + cfg[k].length + ' chars)' } : { set: false, hint: 'not set' };
    } else {
      settings[k] = { set: cfg[k] !== '', value: cfg[k] };
    }
  });
  return {
    settings: settings,
    secretKeys: SECRET_KEYS,
    flowEndpoint: describeFlowEndpoint_(cfg),
    authDescription: describeAuth_(cfg),
    bakedLines: JE_LINES.length,
    bakedAllSamples: JE_LINES.every(function (l) { return !!l.sample; }),
    sheetConfigured: !!cfg.KL_SHEET_ID,
    checklist: buildChecklist_(cfg),
    lastPush: getLastPushInfo_()
  };
}

/** Save Script Properties from the Settings panel. Empty string = leave as
 *  is; the literal token __CLEAR__ deletes the stored value. */
function saveSettings(map) {
  var store = PropertiesService.getScriptProperties();
  var changed = [];
  Object.keys(map || {}).forEach(function (k) {
    if (!(k in DEFAULTS)) return; // only known keys, nothing arbitrary
    var v = String(map[k] == null ? '' : map[k]).trim();
    if (v === '') return;
    if (v === '__CLEAR__') { store.deleteProperty(k); changed.push(k + ' cleared'); return; }
    store.setProperty(k, v);
    changed.push(k + (SECRET_KEYS.indexOf(k) >= 0 ? ' set' : ' = ' + v));
  });
  CacheService.getScriptCache().remove('kl_session'); // credentials may have changed
  return { changed: changed, bootstrap: getBootstrap() };
}

function buildChecklist_(cfg) {
  var haveEndpoint = !!(cfg.KL_FLOW_URL || cfg.KL_FLOW_ID);
  var haveAuth = !!(cfg.KL_SESSION_ID || (cfg.KL_USERID && cfg.KL_PASSWORD) || /[?&]sessionid=/i.test(cfg.KL_FLOW_URL));
  return [
    { item: 'Flow endpoint (KL_FLOW_URL or KL_FLOW_ID)', ok: haveEndpoint, need: 'from Rahul: the flow\'s Integration Details URL or Flow ID' },
    { item: 'Auth (KL_SESSION_ID, or KL_USERID + KL_PASSWORD)', ok: haveAuth, need: 'from Rahul: a named session key or an API user login' },
    { item: 'ClientID', ok: !!cfg.KL_CLIENT_ID, need: 'confirm exact form ("KLR03" or a GUID)' },
    { item: 'ConnectorConfigurationID', ok: !!cfg.KL_CONNECTOR_CONFIGURATION_ID, need: 'from Rahul' },
    { item: 'ProcessCode', ok: !!cfg.KL_PROCESS_CODE, need: 'from Rahul' },
    { item: 'ProcessID', ok: !!cfg.KL_PROCESS_ID, need: 'from Rahul' },
    { item: 'SourceTransactionObjectName', ok: !!cfg.KL_SOURCE_TRANSACTION_OBJECT_NAME, need: 'from Rahul' },
    { item: 'Transactions[] object schema', ok: false, need: 'from Rahul; until then mapJeToTransaction_() is a documented default' }
  ];
}

function describeFlowEndpoint_(cfg) {
  if (cfg.KL_FLOW_URL) return { kind: 'url', display: redact_(cfg.KL_FLOW_URL) };
  if (cfg.KL_FLOW_ID) return { kind: 'id', display: cfg.KL_BASE_URL + '/restapi/Flow/' + cfg.KL_FLOW_ID };
  return { kind: 'none', display: 'not configured; set KL_FLOW_URL (preferred) or KL_FLOW_ID' };
}

function describeAuth_(cfg) {
  var mode = resolveAuthMode_(cfg);
  var m = {
    'embedded': 'session id already embedded in KL_FLOW_URL',
    'named-session': 'named session key from KL_SESSION_ID, passed as ?sessionid=',
    'login': 'LoginUser exchange with KL_USERID / KL_PASSWORD, session cached ~20 min',
    'userpass-query': 'KL_USERID / KL_PASSWORD passed on the call itself',
    'basic': 'HTTP Basic header from KL_USERID / KL_PASSWORD',
    'none': 'nothing configured yet'
  };
  return mode + ': ' + m[mode];
}

// ---------------------------------------------------------------------------
// 5. AUTH against the Decisions platform
// ---------------------------------------------------------------------------

function resolveAuthMode_(cfg) {
  var mode = (cfg.KL_AUTH_MODE || 'auto').toLowerCase();
  if (mode !== 'auto') return mode;
  if (/[?&]sessionid=/i.test(cfg.KL_FLOW_URL)) return 'embedded';
  if (cfg.KL_SESSION_ID) return 'named-session';
  if (cfg.KL_USERID && cfg.KL_PASSWORD) return 'login';
  return 'none';
}

/**
 * Returns { query: 'k=v&k2=v2' or '', headers: {...} } to attach to a call.
 * May perform a LoginUser exchange (cached) in 'login' mode.
 */
function buildAuth_(cfg, forceFresh) {
  var mode = resolveAuthMode_(cfg);
  if (mode === 'embedded') return { mode: mode, query: '', headers: {} };
  if (mode === 'named-session') return { mode: mode, query: 'sessionid=' + encodeURIComponent(cfg.KL_SESSION_ID), headers: {} };
  if (mode === 'userpass-query') {
    return { mode: mode, query: 'userid=' + encodeURIComponent(cfg.KL_USERID) + '&password=' + encodeURIComponent(cfg.KL_PASSWORD), headers: {} };
  }
  if (mode === 'basic') {
    return { mode: mode, query: '', headers: { Authorization: 'Basic ' + Utilities.base64Encode(cfg.KL_USERID + ':' + cfg.KL_PASSWORD) } };
  }
  if (mode === 'login') {
    var sid = getSession_(cfg, forceFresh);
    if (sid) return { mode: mode, query: 'sessionid=' + encodeURIComponent(sid), headers: {} };
    // Login did not yield a session id; fall back to credentials on the call
    // so a version-specific LoginUser response shape cannot brick the app.
    return { mode: 'userpass-query (login fallback)', query: 'userid=' + encodeURIComponent(cfg.KL_USERID) + '&password=' + encodeURIComponent(cfg.KL_PASSWORD), headers: {} };
  }
  return { mode: 'none', query: '', headers: {} };
}

function getSession_(cfg, forceFresh) {
  var cache = CacheService.getScriptCache();
  if (!forceFresh) {
    var cached = cache.get('kl_session');
    if (cached) return cached;
  }
  var result = loginUser_(cfg);
  if (result.sessionId) cache.put('kl_session', result.sessionId, 1200); // 20 min
  return result.sessionId || null;
}

/**
 * LoginUser, tried in several shapes because the accepted one varies by
 * Decisions version. Stops at the first attempt that yields a session id.
 * Returns { sessionId, attempts: [{desc, status, snippet}] } for diagnostics.
 */
function loginUser_(cfg) {
  var base = cfg.KL_BASE_URL.replace(/\/+$/, '');
  var url = base + '/REST/AccountService/LoginUser?outputtype=Json';
  var attempts = [];
  var shapes = [
    { desc: 'POST JSON {userid, password}', opts: { method: 'post', contentType: 'application/json', payload: JSON.stringify({ userid: cfg.KL_USERID, password: cfg.KL_PASSWORD }) } },
    { desc: 'POST JSON {userEmail, password}', opts: { method: 'post', contentType: 'application/json', payload: JSON.stringify({ userEmail: cfg.KL_USERID, password: cfg.KL_PASSWORD }) } },
    { desc: 'GET with userid/password query params', url: url + '&userid=' + encodeURIComponent(cfg.KL_USERID) + '&password=' + encodeURIComponent(cfg.KL_PASSWORD), opts: { method: 'get' } },
    { desc: 'GET with HTTP Basic header', opts: { method: 'get', headers: { Authorization: 'Basic ' + Utilities.base64Encode(cfg.KL_USERID + ':' + cfg.KL_PASSWORD) } } }
  ];
  for (var i = 0; i < shapes.length; i++) {
    var s = shapes[i];
    var r = klFetch_(s.url || url, s.opts);
    var sid = extractSessionId_(r.body);
    attempts.push({ desc: s.desc, status: r.status, snippet: redact_(String(r.body).slice(0, 300)), gotSession: !!sid });
    if (sid) return { sessionId: sid, attempts: attempts };
  }
  return { sessionId: null, attempts: attempts };
}

/** Hunt for a session id in a LoginUser response without assuming its exact
 *  shape: any JSON key containing "session", then any NS-/S- looking token. */
function extractSessionId_(body) {
  var text = String(body || '');
  var m = text.match(/"[^"]*[Ss]ession[Ii][Dd][^"]*"\s*:\s*"([^"]+)"/);
  if (m) return m[1];
  m = text.match(/<[^>]*[Ss]ession[Ii][Dd][^>]*>([^<]+)</); // XML fallback
  if (m) return m[1];
  return null;
}

// ---------------------------------------------------------------------------
// 6. HTTP plumbing
// ---------------------------------------------------------------------------

function klFetch_(url, opts) {
  var options = {
    method: (opts && opts.method) || 'get',
    muteHttpExceptions: true,
    followRedirects: false, // a 302 to the login page IS the diagnosis
    validateHttpsCertificates: true
  };
  if (opts && opts.contentType) options.contentType = opts.contentType;
  if (opts && opts.payload != null) options.payload = opts.payload;
  if (opts && opts.headers) options.headers = opts.headers;
  try {
    var resp = UrlFetchApp.fetch(url, options);
    return { status: resp.getResponseCode(), body: resp.getContentText(), headers: resp.getAllHeaders(), error: null };
  } catch (e) {
    return { status: 0, body: '', headers: {}, error: String(e && e.message || e) };
  }
}

function appendQuery_(url, q) {
  if (!q) return url;
  return url + (url.indexOf('?') >= 0 ? '&' : '?') + q;
}

function resolveFlowUrl_(cfg) {
  var url = null;
  if (cfg.KL_FLOW_URL) url = cfg.KL_FLOW_URL;
  else if (cfg.KL_FLOW_ID) url = cfg.KL_BASE_URL.replace(/\/+$/, '') + '/restapi/Flow/' + encodeURIComponent(cfg.KL_FLOW_ID);
  if (url && !/[?&]outputtype=/i.test(url)) url = appendQuery_(url, 'outputtype=Json');
  return url;
}

/** Redact anything credential-shaped before it reaches the UI or logs. */
function redact_(s) {
  return String(s == null ? '' : s)
    .replace(/(sessionid=)[^&\s"']+/gi, '$1[redacted]')
    .replace(/(password=)[^&\s"']+/gi, '$1[redacted]')
    .replace(/("password"\s*:\s*")[^"]*(")/gi, '$1[redacted]$2')
    .replace(/("[^"]*[Ss]ession[Ii][Dd][^"]*"\s*:\s*")[^"]*(")/g, '$1[redacted]$2')
    .replace(/(Authorization[":\s]+Basic\s+)[A-Za-z0-9+/=]+/gi, '$1[redacted]');
}

// ---------------------------------------------------------------------------
// 7. DIAGNOSTICS (safe: never touches the real flow)
// ---------------------------------------------------------------------------

/**
 * Three measurements, none of which can run the posting flow:
 *  A. Reach the portal at all (DNS, TLS, and any IP filtering at their edge).
 *  B. Prove auth without side effects: call restapi/Flow/{zero GUID}. That
 *     flow id cannot exist, so nothing can execute; the STATUS tells the
 *     story. Rejected session -> 401/403 or a redirect to the login page.
 *     Accepted session -> a structured 404/400 "no such flow" style answer.
 *  C. In 'login' mode, show each LoginUser attempt and which one worked.
 * Lead with the measurement, then act on the result.
 */
function diagnoseKnowledger() {
  var cfg = getConfig_();
  var base = cfg.KL_BASE_URL.replace(/\/+$/, '');
  var steps = [];

  // A. Portal reachability
  var a = klFetch_(base + '/', { method: 'get' });
  steps.push({
    name: 'A. Reach the portal',
    url: base + '/',
    status: a.status,
    detail: a.error ? a.error : ('HTTP ' + a.status + (a.headers && a.headers.Location ? ', redirects to ' + redact_(a.headers.Location) : '')),
    snippet: redact_(String(a.body).slice(0, 200)),
    verdict: a.error ? 'FAIL: could not reach ' + base + ' from Google\'s servers at all.'
      : (a.status >= 200 && a.status < 400) ? 'OK: the Decisions portal answers from Google\'s IPs. This is the wall Sage\'s gateway put up; KnowLedger\'s does not have one here.'
      : 'Portal answered HTTP ' + a.status + '. Read the snippet; the portal may sit behind extra protection.'
  });
  if (a.error) return { steps: steps, authMode: resolveAuthMode_(cfg) };

  // B. Auth probe against a flow id that cannot exist
  var mode = resolveAuthMode_(cfg);
  if (mode === 'none') {
    steps.push({ name: 'B. Auth probe', status: null, detail: 'skipped', snippet: '',
      verdict: 'SKIPPED: no auth configured yet. Set KL_SESSION_ID, or KL_USERID and KL_PASSWORD, in Settings.' });
  } else {
    var auth = buildAuth_(cfg);
    var zeroUrl = appendQuery_(base + '/restapi/Flow/00000000-0000-0000-0000-000000000000?outputtype=Json', auth.query);
    var b = klFetch_(zeroUrl, { method: 'post', contentType: 'application/json', payload: '{}', headers: auth.headers });
    var redirected = b.status >= 300 && b.status < 400;
    var authRejected = b.status === 401 || b.status === 403 || redirected || /log\s*in|login/i.test(String(b.body).slice(0, 400)) && b.status !== 404;
    steps.push({
      name: 'B. Auth probe (nonexistent flow id, cannot execute anything)',
      url: redact_(zeroUrl),
      status: b.status,
      detail: b.error || ('HTTP ' + b.status + ' via auth mode: ' + auth.mode),
      snippet: redact_(String(b.body).slice(0, 300)),
      verdict: b.error ? 'FAIL: network error on the REST path: ' + b.error
        : authRejected ? 'AUTH REJECTED: the platform did not accept the session/credentials (mode ' + auth.mode + '). Fix auth before anything else.'
        : 'AUTH ACCEPTED: the platform let the call through to flow routing (HTTP ' + b.status + ' on a flow id that does not exist is the expected answer). Auth is good.'
    });
  }

  // C. Login trace, when applicable
  if (mode === 'login') {
    var trace = loginUser_(cfg);
    steps.push({
      name: 'C. LoginUser exchange trace',
      status: trace.sessionId ? 200 : null,
      detail: trace.sessionId ? 'a session id was obtained (cached ~20 min)' : 'no attempt yielded a session id; the fallback passes credentials on the call itself',
      snippet: trace.attempts.map(function (t) { return t.desc + ' -> HTTP ' + t.status + (t.gotSession ? ' (session!)' : ''); }).join('\n'),
      verdict: trace.sessionId ? 'OK' : 'WARN: LoginUser shape not recognized on this instance; ask Rahul for a named session key, the simplest option.'
    });
  }

  steps.push({
    name: 'Flow endpoint',
    status: null,
    detail: describeFlowEndpoint_(cfg).display,
    snippet: '',
    verdict: (cfg.KL_FLOW_URL || cfg.KL_FLOW_ID)
      ? 'Configured. Diagnostics deliberately never call it; use the probe button (empty batch, SendToGL=false) when you want that measured.'
      : 'NOT CONFIGURED: waiting on the flow URL or id from Rahul. Everything up to the dry run works without it.'
  });

  return { steps: steps, authMode: mode };
}

/**
 * The ONLY pre-push call that touches the real flow, behind its own button:
 * real inputs, Transactions: [], SendToGL forced false. Expected outcomes:
 * a no-op success, or a structured validation error. Either one proves URL,
 * auth and input routing, which is everything the push needs proven.
 */
function probeFlow() {
  var cfg = getConfig_();
  var url = resolveFlowUrl_(cfg);
  if (!url) return { ok: false, verdict: 'No flow endpoint configured. Set KL_FLOW_URL or KL_FLOW_ID first.' };
  var inputs = buildFlowInputs_(cfg, []);
  inputs.SendToGL = false; // forced, whatever config says
  var r = sendToFlow_(cfg, url, inputs);
  return {
    ok: !r.transportError && r.status >= 200 && r.status < 300,
    status: r.status,
    url: redact_(url),
    requestBody: JSON.stringify(inputs, null, 2),
    snippet: redact_(String(r.body).slice(0, 800)),
    verdict: r.transportError ? 'Network error: ' + r.transportError
      : (r.status >= 200 && r.status < 300) ? 'The flow answered HTTP ' + r.status + '. Auth and routing are proven; read the response to see how it treats an empty batch.'
      : (r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400)) ? 'HTTP ' + r.status + ': auth was not accepted at the flow. Run diagnostics.'
      : 'HTTP ' + r.status + ': the flow answered with an error. A structured input-validation message here is GOOD news, it names what to fix (compare GW-0015 telling us the Sage transport).'
  };
}

// ---------------------------------------------------------------------------
// 8. LOADING + PARSING JE LINES (paste, sheet, or baked-in)
// ---------------------------------------------------------------------------

/** Header alias table. First match wins; bind by NAME, never by position. */
var COLUMN_ALIASES = {
  je:         ['je', 'je number', 'je no', 'je #', 'je id', 'jenumber', 'entry', 'entry no', 'entry number', 'transaction id', 'transactionid', 'group', 'batch'],
  date:       ['date', 'transaction date', 'trandate', 'posting date', 'post date', 'report date'],
  journal:    ['journal', 'journal symbol', 'journalsymbol', 'journal id'],
  type:       ['type', 'line type', 'entry type', 'je type'],
  account:    ['custodian account', 'account number', 'acct number', 'account no', 'custodian acct', 'brokerage account', 'custodian'],
  project:    ['project', 'projectid', 'project id', 'fund'],
  coding:     ['coding', 'gl coding', 'dimension coding', 'dimensions', 'code'],
  gl:         ['gl', 'gl account', 'glaccount', 'gl no', 'gl number', 'accountno', 'acct', 'account'],
  department: ['department', 'dept', 'departmentid', 'department id'],
  entity:     ['entity', 'location', 'locationid', 'location id'],
  subAccount: ['subaccount', 'sub account', 'sub-account', 'sub acct', 'sub'],
  class:      ['class', 'classid', 'class id'],
  memo:       ['memo', 'description', 'desc', 'line memo', 'narrative'],
  debit:      ['debit', 'dr', 'debit amount', 'debits'],
  credit:     ['credit', 'cr', 'credit amount', 'credits'],
  amount:     ['amount', 'signed amount', 'value', 'net amount'],
  side:       ['side', 'd/c', 'dc', 'trtype', 'tr type', 'drcr']
};

function normalizeHeader_(h) {
  return String(h == null ? '' : h).toLowerCase().replace(/[\s_./-]+/g, ' ').trim();
}

/** Bind headers to fields. Returns { map: {field: colIndex}, bound: {field: header}, unbound: [header] }.
 *  Aliases pass through the SAME normalizer as headers, so "D/C" (which
 *  normalizes to "d c") still binds; comparing raw aliases against normalized
 *  headers is how a column silently fails to bind. */
function bindHeaders_(headers) {
  var norm = headers.map(normalizeHeader_);
  var map = {}, bound = {}, used = {};
  Object.keys(COLUMN_ALIASES).forEach(function (field) {
    var aliases = COLUMN_ALIASES[field].map(normalizeHeader_);
    for (var i = 0; i < norm.length; i++) {
      if (used[i]) continue;
      if (aliases.indexOf(norm[i]) >= 0) { map[field] = i; bound[field] = headers[i]; used[i] = true; return; }
    }
  });
  var unbound = [];
  norm.forEach(function (h, i) { if (!used[i] && h !== '') unbound.push(headers[i]); });
  return { map: map, bound: bound, unbound: unbound };
}

/** Split "1001||Kerry Fam|Fiag-3115|taxable" into its named parts. */
function parseCoding_(coding) {
  var parts = String(coding == null ? '' : coding).split('|');
  return {
    gl: (parts[0] || '').trim(),
    department: (parts[1] || '').trim(),
    entity: (parts[2] || '').trim(),
    subAccount: (parts[3] || '').trim(),
    class: (parts[4] || '').trim()
  };
}

function normalizeDate_(v) {
  if (v == null || v === '') return null;
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO, possibly with time
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/); // 20250630
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2}|\d{4})$/); // M/D/YYYY or M/D/YY
  if (m) {
    var yr = m[3].length === 2 ? '20' + m[3] : m[3];
    return yr + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  }
  return null;
}

/**
 * Money to integer cents by STRING math; floats never touch a balance.
 * Accepts "1,234.56", "$1,234.56", "(123.45)" as negative, "-" and blank as
 * "nothing on this side" (null). Returns null for blank, NaN for garbage.
 */
function parseMoneyCents_(v) {
  if (v == null) return null;
  var s = String(v).trim();
  if (s === '' || s === '-' || s === '–' || s === '—') return null;
  var neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[$,\s]/g, '');
  if (s.charAt(0) === '-') { neg = !neg; s = s.slice(1); }
  if (!/^\d+(\.\d{1,4})?$/.test(s)) return NaN;
  var parts = s.split('.');
  var whole = parseInt(parts[0], 10);
  var fracStr = ((parts[1] || '') + '00').slice(0, 2);
  var extra = (parts[1] || '').slice(2); // sub-cent digits: only exact zeros are tolerated
  if (extra && /[1-9]/.test(extra)) return NaN;
  var cents = whole * 100 + parseInt(fracStr, 10);
  return neg ? -cents : cents;
}

function centsToNumber_(c) { return c == null ? null : Math.round(c) / 100; }
function fmtCents_(c) {
  if (c == null) return '';
  var neg = c < 0; var a = Math.abs(c);
  var s = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + ('0' + (a % 100)).slice(-2);
  return (neg ? '-' : '') + s;
}

/** Parse pasted text: JSON array, or delimited rows with a header line. */
function parsePaste_(text) {
  var t = String(text || '').replace(/^﻿/, '').trim();
  if (!t) return { rows: [], headers: [], note: 'empty paste' };
  if (t.charAt(0) === '[' || t.charAt(0) === '{') {
    var data = JSON.parse(t);
    if (!Array.isArray(data)) data = [data];
    return { json: data };
  }
  var lines = t.split(/\r\n|\r|\n/).filter(function (l) { return l.trim() !== ''; });
  var delim = lines[0].indexOf('\t') >= 0 ? '\t' : ',';
  var rows = lines.map(function (l) { return splitDelimited_(l, delim); });
  return { headers: rows[0], rows: rows.slice(1) };
}

/** Minimal quoted-field-aware splitter (Excel TSV rarely quotes; CSV does). */
function splitDelimited_(line, delim) {
  var out = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line.charAt(i);
    if (inQ) {
      if (ch === '"') { if (line.charAt(i + 1) === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Read the configured sheet as DISPLAY values (what the sheet shows is the
 *  truth; no serial-date or float surprises). */
function readSheet_(cfg) {
  if (!cfg.KL_SHEET_ID) throw new Error('KL_SHEET_ID is not set.');
  var ss = SpreadsheetApp.openById(cfg.KL_SHEET_ID);
  var sheet = cfg.KL_SHEET_TAB ? ss.getSheetByName(cfg.KL_SHEET_TAB) : ss.getSheets()[0];
  if (!sheet) throw new Error('Sheet tab "' + cfg.KL_SHEET_TAB + '" not found in that spreadsheet.');
  var values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) throw new Error('The sheet has no data rows under its header.');
  return { headers: values[0], rows: values.slice(1), name: sheet.getName() };
}

/** Turn tabular rows into normalized line objects via header binding. */
function rowsToLines_(headers, rows) {
  var binding = bindHeaders_(headers);
  var need = ['je', 'date'];
  var missing = need.filter(function (f) { return !(f in binding.map); });
  var hasCoding = 'coding' in binding.map;
  var hasGl = 'gl' in binding.map;
  if (!hasCoding && !hasGl) missing.push('gl (or a combined "coding" column)');
  var hasAmount = ('debit' in binding.map && 'credit' in binding.map) || ('amount' in binding.map);
  if (!hasAmount) missing.push('debit+credit (or a signed "amount" column)');
  if (missing.length) {
    throw new Error('Could not bind required columns: ' + missing.join(', ') +
      '. Headers seen: ' + headers.join(' | ') +
      '. Rename a column or extend COLUMN_ALIASES; columns bind by name, never by position.');
  }
  var get = function (row, f) { return f in binding.map ? String(row[binding.map[f]] == null ? '' : row[binding.map[f]]).trim() : ''; };
  var lines = rows.map(function (row, idx) {
    var ln = {
      _row: idx + 2, // 1-based plus header, for human-readable errors
      je: get(row, 'je'),
      date: get(row, 'date'),
      journal: get(row, 'journal'),
      type: get(row, 'type'),
      account: get(row, 'account'),
      project: get(row, 'project'),
      gl: get(row, 'gl'),
      department: get(row, 'department'),
      entity: get(row, 'entity'),
      subAccount: get(row, 'subAccount'),
      class: get(row, 'class'),
      memo: get(row, 'memo'),
      debitRaw: get(row, 'debit'),
      creditRaw: get(row, 'credit'),
      amountRaw: get(row, 'amount'),
      side: get(row, 'side')
    };
    if (hasCoding) {
      var c = parseCoding_(get(row, 'coding'));
      ln.gl = ln.gl || c.gl;
      ln.department = ln.department || c.department;
      ln.entity = ln.entity || c.entity;
      ln.subAccount = ln.subAccount || c.subAccount;
      ln.class = ln.class || c.class;
    }
    return ln;
  });
  return { lines: lines, binding: binding };
}

/** Normalize baked-in / JSON objects to the same internal shape. */
function objectsToLines_(objs) {
  var lines = objs.map(function (o, idx) {
    return {
      _row: idx + 1,
      sample: !!o.sample,
      je: str_(o.je), date: str_(o.date), journal: str_(o.journal), type: str_(o.type),
      account: str_(o.account), project: str_(o.project),
      gl: str_(o.gl), department: str_(o.department), entity: str_(o.entity),
      subAccount: str_(o.subAccount != null ? o.subAccount : o.subaccount), class: str_(o.class),
      memo: str_(o.memo),
      debitRaw: o.debit == null ? '' : String(o.debit),
      creditRaw: o.credit == null ? '' : String(o.credit),
      amountRaw: o.amount == null ? '' : String(o.amount),
      side: str_(o.side)
    };
  });
  return { lines: lines, binding: null };
}

function str_(v) { return v == null ? '' : String(v).trim(); }

function loadLines_(source, pasteText, cfg) {
  if (source === 'paste') {
    var p = parsePaste_(pasteText);
    if (p.json) return { origin: 'pasted JSON (' + p.json.length + ' objects)', parsed: objectsToLines_(p.json) };
    if (!p.rows || !p.rows.length) throw new Error('The paste parsed to zero data rows. First line must be a header row.');
    return { origin: 'pasted rows (' + p.rows.length + ')', parsed: rowsToLines_(p.headers, p.rows) };
  }
  if (source === 'sheet') {
    var s = readSheet_(cfg);
    var parsed = rowsToLines_(s.headers, s.rows);
    return { origin: 'sheet "' + s.name + '" (' + s.rows.length + ' rows)', parsed: parsed };
  }
  return { origin: 'baked-in JE_LINES (' + JE_LINES.length + ' lines)', parsed: objectsToLines_(JE_LINES) };
}

// ---------------------------------------------------------------------------
// 9. VALIDATION (nothing is ever plugged; residuals are flagged, not fixed)
// ---------------------------------------------------------------------------

function classifyType_(t) {
  var s = String(t || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!s || s === 'gl' || s === 'journal' || s === 'je') return 'GL';
  if (s === 'stat' || s === 'statistical' || s === 'stats') return 'STAT';
  if (s === 'eb' || s === 'endingbalance' || s === 'endbal' || s === 'balance') return 'EB';
  return 'GL'; // unknown labels are treated as GL (so they ARE balance-checked) and reported
}

function validateAndAssemble_(source, pasteText) {
  var cfg = getConfig_();
  var loaded = loadLines_(source, pasteText, cfg);
  var lines = loaded.parsed.lines;
  var errors = [], warnings = [];

  lines.forEach(function (ln) {
    ln.typeClass = classifyType_(ln.type);
    if (ln.type && ln.typeClass === 'GL' && !/^(gl|journal|je)?$/i.test(String(ln.type).trim())) {
      warnings.push('Row ' + ln._row + ': unrecognized type "' + ln.type + '" treated as GL (so it is balance-checked).');
    }
    ln.dateNorm = normalizeDate_(ln.date);
    if (!ln.je) errors.push('Row ' + ln._row + ': missing JE grouping key.');
    if (!ln.dateNorm) errors.push('Row ' + ln._row + ': unparseable date "' + ln.date + '".');
    if (!ln.gl) errors.push('Row ' + ln._row + ': missing GL account.');
    if (!ln.project && ln.account && ACCOUNT_PROJECT_MAP[ln.account]) ln.project = ACCOUNT_PROJECT_MAP[ln.account];

    var d = parseMoneyCents_(ln.debitRaw);
    var c = parseMoneyCents_(ln.creditRaw);
    var a = parseMoneyCents_(ln.amountRaw);
    if ((typeof d === 'number' && isNaN(d)) || (typeof c === 'number' && isNaN(c)) || (typeof a === 'number' && isNaN(a))) {
      errors.push('Row ' + ln._row + ': unparseable amount (debit "' + ln.debitRaw + '", credit "' + ln.creditRaw + '", amount "' + ln.amountRaw + '").');
      d = c = a = null;
    }
    if (d == null && c == null && a != null) { // signed amount column: positive = debit, negative = credit
      if (a >= 0) d = a; else c = -a;
      var sideNorm = String(ln.side || '').toLowerCase();
      if (sideNorm) { // explicit side column wins over sign
        if (/^(d|dr|debit)/.test(sideNorm)) { d = Math.abs(a); c = null; }
        else if (/^(c|cr|credit)/.test(sideNorm)) { c = Math.abs(a); d = null; }
      }
    }
    var dLive = d != null && d !== 0, cLive = c != null && c !== 0;
    if (!dLive && !cLive) errors.push('Row ' + ln._row + ': no amount on either side.');
    if (dLive && cLive) errors.push('Row ' + ln._row + ': amounts on BOTH sides (debit ' + fmtCents_(d) + ', credit ' + fmtCents_(c) + '); one side per line.');
    if ((d != null && d < 0) || (c != null && c < 0)) warnings.push('Row ' + ln._row + ': negative amount passed through as-is; confirm the side is intended.');
    ln.debitC = dLive ? d : null;
    ln.creditC = cLive ? c : null;
  });

  // Date filter (never silent: excluded rows are counted and listed by date)
  var filter = cfg.postDateFilter;
  lines.forEach(function (ln) { ln.included = !filter || ln.dateNorm === filter; });
  var excludedByDate = lines.filter(function (l) { return !l.included; }).length;

  // Group into JEs and balance-check GL lines
  var groups = {};
  lines.forEach(function (ln) {
    if (!ln.je) return;
    (groups[ln.je] = groups[ln.je] || []).push(ln);
  });
  var jes = Object.keys(groups).map(function (key) {
    var g = groups[key];
    var inc = g.filter(function (l) { return l.included; });
    var gl = inc.filter(function (l) { return l.typeClass === 'GL'; });
    var dC = gl.reduce(function (s, l) { return s + (l.debitC || 0); }, 0);
    var cC = gl.reduce(function (s, l) { return s + (l.creditC || 0); }, 0);
    var balanced = dC === cC;
    if (inc.length && gl.length && !balanced) {
      errors.push('JE "' + key + '" does not balance: debits ' + fmtCents_(dC) + ' vs credits ' + fmtCents_(cC) + ' (off by ' + fmtCents_(Math.abs(dC - cC)) + '). Nothing will be plugged; fix the source.');
    }
    var dates = unique_(inc.map(function (l) { return l.dateNorm; }));
    if (dates.length > 1) warnings.push('JE "' + key + '" spans multiple dates: ' + dates.join(', '));
    return {
      je: key,
      date: dates[0] || unique_(g.map(function (l) { return l.dateNorm; }))[0] || '',
      journal: unique_(inc.map(function (l) { return l.journal; }).filter(Boolean))[0] || cfg.KL_JOURNAL,
      lines: inc.length,
      totalLines: g.length,
      debits: fmtCents_(dC),
      credits: fmtCents_(cC),
      balanced: gl.length ? balanced : null,
      types: unique_(inc.map(function (l) { return l.typeClass; })).join('+') || '-',
      included: inc.length > 0,
      hasSample: g.some(function (l) { return l.sample; })
    };
  });

  // Soft trial-balance tie-out on ending-balance lines
  var ebLines = lines.filter(function (l) { return l.included && l.typeClass === 'EB' && l.project; });
  var tbTies = null;
  if (ebLines.length) {
    var byProject = {};
    ebLines.forEach(function (l) {
      byProject[l.project] = (byProject[l.project] || 0) + (l.debitC || 0) - (l.creditC || 0);
    });
    tbTies = Object.keys(byProject).map(function (p) {
      var expected = TB_TIES_CENTS[p];
      var got = byProject[p];
      var ok = expected != null && expected === got;
      if (expected != null && !ok) warnings.push('EB tie-out ' + p + ': lines total ' + fmtCents_(got) + ' vs trial balance ' + fmtCents_(expected) + ' at 06/30/2025. Review, do not plug.');
      return { project: p, expected: expected != null ? fmtCents_(expected) : 'n/a', got: fmtCents_(got), ok: expected == null ? null : ok };
    });
  }

  var includedLines = lines.filter(function (l) { return l.included; });
  var sampleIncluded = includedLines.filter(function (l) { return l.sample; }).length;
  if (sampleIncluded) warnings.push(sampleIncluded + ' included line(s) are SAMPLE data; the push will refuse them. Replace JE_LINES or use paste/sheet.');

  return {
    cfg: cfg,
    origin: loaded.origin,
    binding: loaded.parsed.binding ? { bound: loaded.parsed.binding.bound, unbound: loaded.parsed.binding.unbound } : null,
    lines: lines,
    jes: jes,
    errors: errors,
    warnings: warnings,
    counts: {
      lines: lines.length,
      included: includedLines.length,
      excludedByDate: excludedByDate,
      jes: jes.filter(function (j) { return j.included; }).length,
      stat: includedLines.filter(function (l) { return l.typeClass === 'STAT'; }).length,
      eb: includedLines.filter(function (l) { return l.typeClass === 'EB'; }).length,
      sample: sampleIncluded
    },
    totals: {
      debits: fmtCents_(includedLines.reduce(function (s, l) { return s + (l.debitC || 0); }, 0)),
      credits: fmtCents_(includedLines.reduce(function (s, l) { return s + (l.creditC || 0); }, 0))
    },
    tbTies: tbTies,
    dateFilter: filter || '(none: everything loaded is included)'
  };
}

function unique_(arr) {
  var seen = {}, out = [];
  arr.forEach(function (v) { if (v != null && v !== '' && !seen[v]) { seen[v] = true; out.push(v); } });
  return out;
}

/** UI entry: validate and summarize without the heavy line objects. */
function validateLines(source, pasteText) {
  var v = validateAndAssemble_(source, pasteText);
  return {
    origin: v.origin, binding: v.binding, jes: v.jes, errors: v.errors, warnings: v.warnings,
    counts: v.counts, totals: v.totals, tbTies: v.tbTies, dateFilter: v.dateFilter,
    ok: v.errors.length === 0 && v.counts.included > 0
  };
}

// ---------------------------------------------------------------------------
// 10. MAPPING TO THE KNOWLEDGER FLOW PAYLOAD
// ---------------------------------------------------------------------------

/**
 * >>> THE CONTRACT LIVES HERE <<<
 * The flow's documented INPUTS are exact (ClientID, ConnectorConfigurationID,
 * ProcessCode, ProcessID, SendToGL, SourceTransactionObjectName,
 * Transactions[], IsRollUp; it returns PostedTransactions[] and
 * FailedToPostTransactions[]). The SHAPE of each Transactions[] element is
 * NOT yet confirmed; this default carries every field we have under
 * self-explanatory names, both sided amounts and a signed amount, so
 * adapting to Rahul's real schema is edits to THIS function and nothing else.
 * The dry run displays the exact JSON this produces; trust the dry run, not
 * this comment.
 */
function mapJeToTransaction_(jeKey, jeLines, cfg) {
  var first = jeLines[0];
  return {
    TransactionID: jeKey,
    TransactionDate: first.dateNorm,
    Journal: first.journal || cfg.KL_JOURNAL,
    State: cfg.KL_STATE,
    Description: first.memo || ('KLR03 ' + jeKey),
    Lines: jeLines.map(function (ln, i) {
      var side = ln.debitC != null ? 'debit' : 'credit';
      var cents = ln.debitC != null ? ln.debitC : ln.creditC;
      return {
        LineNumber: i + 1,
        Type: ln.typeClass,
        AccountNo: ln.gl,
        Department: ln.department || '',
        Entity: ln.entity || '',
        SubAccount: ln.subAccount || '',
        Class: ln.class || '',
        Project: ln.project || '',
        CustodianAccount: ln.account || '',
        Memo: ln.memo || '',
        Debit: ln.debitC != null ? centsToNumber_(ln.debitC) : null,
        Credit: ln.creditC != null ? centsToNumber_(ln.creditC) : null,
        Side: side,
        Amount: centsToNumber_(side === 'debit' ? cents : -cents) // signed: debit positive
      };
    })
  };
}

/** The flow inputs, exactly as documented, around a given Transactions[]. */
function buildFlowInputs_(cfg, transactions) {
  var inputs = {
    ClientID: cfg.KL_CLIENT_ID,
    ConnectorConfigurationID: cfg.KL_CONNECTOR_CONFIGURATION_ID,
    ProcessCode: cfg.KL_PROCESS_CODE,
    ProcessID: cfg.KL_PROCESS_ID,
    SendToGL: cfg.sendToGL,
    SourceTransactionObjectName: cfg.KL_SOURCE_TRANSACTION_OBJECT_NAME,
    IsRollUp: cfg.isRollUp,
    Transactions: transactions
  };
  if (cfg.KL_EXTRA_INPUTS) {
    try {
      var extra = JSON.parse(cfg.KL_EXTRA_INPUTS);
      Object.keys(extra).forEach(function (k) { inputs[k] = extra[k]; });
    } catch (e) {
      throw new Error('KL_EXTRA_INPUTS is not valid JSON: ' + e.message);
    }
  }
  return inputs;
}

function buildBatches_(v) {
  var groups = {};
  v.lines.forEach(function (ln) {
    if (!ln.included || !ln.je) return;
    (groups[ln.je] = groups[ln.je] || []).push(ln);
  });
  var txns = Object.keys(groups).map(function (key) { return mapJeToTransaction_(key, groups[key], v.cfg); });
  var size = v.cfg.batchSize > 0 ? v.cfg.batchSize : txns.length || 1;
  var batches = [];
  for (var i = 0; i < txns.length; i += size) batches.push(txns.slice(i, i + size));
  return { transactions: txns, batches: batches };
}

/** Dry run: build EXACTLY what the push would send, send nothing. */
function dryRun(source, pasteText) {
  var v = validateAndAssemble_(source, pasteText);
  var built = buildBatches_(v);
  var payloads = built.batches.map(function (b) { return buildFlowInputs_(v.cfg, b); });
  var blankIds = ['KL_CONNECTOR_CONFIGURATION_ID', 'KL_PROCESS_CODE', 'KL_PROCESS_ID', 'KL_SOURCE_TRANSACTION_OBJECT_NAME']
    .filter(function (k) { return !v.cfg[k]; });
  return {
    ok: v.errors.length === 0 && built.transactions.length > 0,
    errors: v.errors,
    warnings: v.warnings,
    counts: v.counts,
    transactions: built.transactions.length,
    batches: payloads.length,
    endpoint: describeFlowEndpoint_(v.cfg).display,
    sendToGL: v.cfg.sendToGL,
    isRollUp: v.cfg.isRollUp,
    state: v.cfg.KL_STATE,
    blankIds: blankIds,
    payloadJson: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads, null, 2),
    bytes: payloads.reduce(function (s, p) { return s + JSON.stringify(p).length; }, 0)
  };
}

// ---------------------------------------------------------------------------
// 11. THE PUSH
// ---------------------------------------------------------------------------

function sendToFlow_(cfg, url, inputs) {
  var auth = buildAuth_(cfg);
  var full = appendQuery_(url, auth.query);
  var r = klFetch_(full, { method: 'post', contentType: 'application/json', payload: JSON.stringify(inputs), headers: auth.headers });
  // One retry on an expired session in login mode
  var sessionish = r.status === 401 || (/session/i.test(String(r.body)) && /(expired|invalid|not\s*valid)/i.test(String(r.body)));
  if (sessionish && resolveAuthMode_(cfg) === 'login') {
    CacheService.getScriptCache().remove('kl_session');
    auth = buildAuth_(cfg, true);
    full = appendQuery_(url, auth.query);
    r = klFetch_(full, { method: 'post', contentType: 'application/json', payload: JSON.stringify(inputs), headers: auth.headers });
  }
  return { status: r.status, body: r.body, transportError: r.error };
}

/** Unwrap {"Done": {...}} style outcome wrappers, then hunt for the posted /
 *  failed arrays by key name, case-insensitively. Raw body is always kept. */
function interpretFlowResponse_(status, body) {
  var parsed = null;
  try { parsed = JSON.parse(body); } catch (e) { /* not JSON; raw snippet still shown */ }
  var layer = parsed;
  var outcome = null;
  if (layer && typeof layer === 'object' && !Array.isArray(layer)) {
    var keys = Object.keys(layer);
    if (keys.length === 1 && layer[keys[0]] && typeof layer[keys[0]] === 'object') {
      outcome = keys[0];
      layer = layer[keys[0]];
    }
  }
  var posted = null, failed = null;
  if (layer && typeof layer === 'object') {
    Object.keys(layer).forEach(function (k) {
      var lk = k.toLowerCase();
      if (failed == null && lk.indexOf('fail') >= 0) failed = layer[k];
      else if (posted == null && lk.indexOf('post') >= 0) posted = layer[k];
    });
  }
  return {
    httpStatus: status,
    outcome: outcome,
    posted: Array.isArray(posted) ? posted : (posted != null ? [posted] : []),
    failed: Array.isArray(failed) ? failed : (failed != null ? [failed] : []),
    recognized: posted != null || failed != null,
    rawSnippet: redact_(String(body).slice(0, 1500))
  };
}

/**
 * The push. Refuses to run on validation errors, sample rows, a missing
 * endpoint, or a wrong confirmation count. Repeating a byte-identical batch
 * requires allowRepeat (the UI asks again, loudly).
 */
function pushToKnowLedger(source, pasteText, confirmCount, allowRepeat) {
  var v = validateAndAssemble_(source, pasteText);
  if (v.errors.length) return { ok: false, refused: 'Validation has ' + v.errors.length + ' error(s). Fix the source data; nothing was sent.', errors: v.errors };
  var built = buildBatches_(v);
  if (!built.transactions.length) return { ok: false, refused: 'Zero transactions after the date filter (' + (v.cfg.postDateFilter || 'none') + '). Nothing to send.' };
  var sampleRows = v.lines.filter(function (l) { return l.included && l.sample; }).length;
  if (sampleRows) return { ok: false, refused: sampleRows + ' included line(s) are baked-in SAMPLE data. The samples exist to demo the wizard and are never pushed. Load real lines via paste or the sheet, or replace JE_LINES.' };
  var url = resolveFlowUrl_(v.cfg);
  if (!url) return { ok: false, refused: 'No flow endpoint configured (KL_FLOW_URL or KL_FLOW_ID). That is the piece Rahul supplies.' };
  if (Number(confirmCount) !== built.transactions.length) {
    return { ok: false, refused: 'Confirmation count ' + confirmCount + ' does not match the ' + built.transactions.length + ' transaction(s) about to be sent. Nothing was sent.' };
  }

  var payloads = built.batches.map(function (b) { return buildFlowInputs_(v.cfg, b); });
  var fingerprint = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(payloads)));
  var last = getLastPushInfo_();
  if (last && last.fingerprint === fingerprint && !allowRepeat) {
    return { ok: false, needsRepeatConfirm: true, refused: 'This exact batch was already pushed at ' + last.when + ' (' + last.transactions + ' transactions). Pushing again would duplicate JEs. Confirm the repeat explicitly if that is intended.' };
  }

  var results = [];
  var allPosted = [], allFailed = [];
  for (var i = 0; i < payloads.length; i++) {
    var r = sendToFlow_(v.cfg, url, payloads[i]);
    if (r.transportError) {
      results.push({ batch: i + 1, of: payloads.length, httpStatus: 0, error: r.transportError, rawSnippet: '' });
      break; // do not fire remaining batches into a dead network
    }
    var interp = interpretFlowResponse_(r.status, r.body);
    interp.batch = i + 1; interp.of = payloads.length;
    results.push(interp);
    allPosted = allPosted.concat(interp.posted);
    allFailed = allFailed.concat(interp.failed);
  }

  var sent = results.length && !results[0].error;
  if (sent) {
    PropertiesService.getScriptProperties().setProperty('KL_LAST_PUSH', JSON.stringify({
      fingerprint: fingerprint, when: new Date().toISOString(), transactions: built.transactions.length,
      sendToGL: v.cfg.sendToGL
    }));
  }
  return {
    ok: results.every(function (r) { return !r.error && r.httpStatus >= 200 && r.httpStatus < 300; }),
    endpoint: redact_(url),
    sendToGL: v.cfg.sendToGL,
    transactions: built.transactions.length,
    batches: payloads.length,
    results: results,
    posted: allPosted,
    failed: allFailed,
    recognized: results.some(function (r) { return r.recognized; }),
    note: results.some(function (r) { return r.recognized; })
      ? null
      : 'The response did not contain recognizable PostedTransactions / FailedToPostTransactions arrays; read the raw snippets. If the flow answered with an input-validation message, it is naming exactly what to fix.'
  };
}

function getLastPushInfo_() {
  var raw = PropertiesService.getScriptProperties().getProperty('KL_LAST_PUSH');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// ---------------------------------------------------------------------------
// 12. Editor conveniences (run from the Apps Script editor, results in logs)
// ---------------------------------------------------------------------------

function RUN_DIAGNOSE() { Logger.log(JSON.stringify(diagnoseKnowledger(), null, 2)); }
function RUN_VALIDATE_BAKED() { Logger.log(JSON.stringify(validateLines('baked', ''), null, 2)); }
function RUN_DRYRUN_BAKED() { Logger.log(JSON.stringify(dryRun('baked', ''), null, 2)); }
