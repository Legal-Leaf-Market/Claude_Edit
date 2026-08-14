/**
 * KnowLedger Statement Scanner - Code.gs
 * Statement PDF -> klr03-all records, for Fidelity / Goldman Sachs / JP Morgan / Schwab.
 * Parser engine below is validated against real statements; see Index.html for the UI.
 */

/**
 * KLSCAN — statement parsers for the Knowledger Statement Scanner.
 * Shared verbatim between the node test harness and Code.gs.
 *
 * Input model: a document is an array of pages; a page is an array of lines;
 * a line is {y: Number, f: [{x: Number, t: String}, ...]} sorted by x.
 * Output records use the klr03-all schema.
 */
var KLSCAN = (function () {
  'use strict';

  var MONEY_RE = /^\(?-?\$?[\d,]+\.?\d*\)?-?$/;

  function isMoney(tok) {
    if (!/\d/.test(tok)) return false;
    if (!MONEY_RE.test(tok)) return false;
    // Reject bare integers with no separators that look like ids/pages (e.g. "2026", "100%")
    return /[.,]/.test(tok) || tok.length <= 3 || /^\(?\$/.test(tok);
  }

  function num(tok) {
    if (tok === null || tok === undefined) return null;
    var s = String(tok).trim();
    if (s === '-' || s === '–' || s === '—') return 0; // dash-as-zero
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
    if (/^-/.test(s)) { neg = true; s = s.slice(1); }
    s = s.replace(/[$,\s]/g, '');
    if (!/^\d*\.?\d+$/.test(s)) return null;
    var v = parseFloat(s);
    return neg ? -v : v;
  }

  function lineText(line) {
    return line.f.map(function (f) { return f.t; }).join(' ').replace(/\s+/g, ' ').trim();
  }

  function moneyFrags(line) {
    return line.f.filter(function (f) { return isMoney(f.t); });
  }

  function labelOf(line) {
    var parts = [];
    for (var i = 0; i < line.f.length; i++) {
      if (isMoney(line.f[i].t)) break;
      parts.push(line.f[i].t);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  var MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  function monthNum(name) {
    var i = MONTHS.indexOf(String(name).toUpperCase());
    return i < 0 ? null : i + 1;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) { return String(y) + pad2(Number(m)) + pad2(Number(d)); }
  function fixYear(y) { y = Number(y); return y < 100 ? 2000 + y : y; }

  function titleCase(s) {
    return s.toLowerCase().replace(/(^|[\s(\/-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\bUs\b/g, 'US').replace(/\bAi\b/g, 'AI').replace(/\bYtd\b/g, 'YTD');
  }

  function mkRecord(acc, tranType, period, amount, section, confidence) {
    return {
      Number: acc.number || '',
      Custodian: acc.custodian,
      'Report Date': acc.reportDate || '',
      'Reporting Period': period,
      TranType: tranType,
      Amount: amount,
      Source: acc.source,
      Section: section,
      confidence: confidence || 'high'
    };
  }

  // ------------------------------------------------------------------
  // Custodian detection
  // ------------------------------------------------------------------
  function detectCustodian(pages) {
    var head = pages.slice(0, 3).map(function (p) {
      return p.map(lineText).join('\n');
    }).join('\n');
    if (/goldman sachs/i.test(head)) return 'Goldman Sachs';
    if (/JPMorgan Chase Bank|J\.P\. Morgan/i.test(head)) return 'JP Morgan';
    if (/schwab/i.test(head)) return 'Schwab';
    if (/fidelity|national financial services/i.test(head)) return 'Fidelity';
    return null;
  }

  // ------------------------------------------------------------------
  // Goldman Sachs
  // ------------------------------------------------------------------
  function parseGoldman(pages, filename) {
    var accounts = {};
    var warnings = [];

    function accFor(portfolio) {
      if (!accounts[portfolio]) {
        accounts[portfolio] = {
          custodian: 'Goldman Sachs', number: portfolio, entity: '', reportDate: '',
          source: filename, records: [], recon: [], warnings: []
        };
      }
      return accounts[portfolio];
    }

    function portfolioOf(page) {
      for (var i = page.length - 1; i >= 0; i--) {
        var m = lineText(page[i]).match(/Portfolio No: ?([A-Z0-9Xx-]+)/i);
        if (m) return m[1];
      }
      return '(unknown)';
    }

    pages.forEach(function (page) {
      var text = page.map(lineText).join('\n');
      var isOverview = /^PORTFOLIO ACTIVITY/m.test(text);
      var isTax = /^REPORTABLE INCOME/m.test(text) || /US Tax Summary/.test(text);
      if (!isOverview && !isTax) return;

      var acc = accFor(portfolioOf(page));
      var dm = text.match(/Period Ended (\w+) (\d{1,2}), (\d{4})/);
      if (dm && !acc.reportDate) acc.reportDate = ymd(dm[3], monthNum(dm[1]), dm[2]);
      var em = text.match(/^(.+?)\n/);
      page.forEach(function (line) {
        var t = lineText(line);
        if (!acc.entity && /TRUST|LLC|L\.P\.|FOUNDATION|PARTNERS/i.test(t) && !/Page \d/i.test(t) && line.f.length && moneyFrags(line).length === 0 && t === t.toUpperCase() && t.length < 60 && !/PORTFOLIO|SUMMARY|ACTIVITY|REPORTABLE|STATEMENT DETAIL/.test(t)) acc.entity = t;
      });

      if (isOverview) {
        if (!acc.entity && page.length > 1) {
          var t1 = lineText(page[1]);
          if (t1 && moneyFrags(page[1]).length === 0 && !/Period Ended|Overview/i.test(t1)) acc.entity = t1;
        }
        var activityStarted = false;
        page.forEach(function (line) {
          var t = lineText(line);
          if (/PORTFOLIO ACTIVITY/.test(t)) { activityStarted = true; return; }
          if (!activityStarted) return;
          // Market value lines: may appear twice on one line (side-by-side blocks);
          // day 1 of a month is the beginning, anything else the ending.
          var re = /MARKET VALUE AS OF (\w+) (\d{1,2}), (\d{4}) (\(?\$?[\d,]+\.\d{2}\)?)/g;
          var m, sawMv = false;
          while ((m = re.exec(t)) !== null) {
            sawMv = true;
            var tran = Number(m[2]) === 1 ? 'Beginning Account Value' : 'Ending Account Value';
            acc.records.push(mkRecord(acc, tran, 'This Period', num(m[4]), 'Overview'));
          }
          if (sawMv) return;
          // Generic activity row: an all-caps label plus exactly one amount.
          var moneys = moneyFrags(line);
          var label = labelOf(line);
          if (moneys.length !== 1 || !label) return;
          if (/^\(|^TOTAL|^CURRENT MONTH|^YEAR TO DATE|^Portfolio No|^Market Value|^Beginning|^Ending|^INVESTMENT RESULTS|^PORTFOLIO/i.test(label)) return;
          if (label !== label.toUpperCase()) return;
          acc.records.push(mkRecord(acc, titleCase(label), 'This Period', num(moneys[0].t), 'Overview'));
        });
      }

      if (isTax) {
        var inIncome = false;
        page.forEach(function (line) {
          var t = lineText(line);
          if (/^REPORTABLE INCOME/.test(t)) { inIncome = true; return; }
          if (/^MUNICIPAL INTEREST BY STATE|^Certain dividends|^This statement should not/.test(t)) { inIncome = false; }
          var m = t.match(/^CURRENT UNREALIZED GAIN \(LOSS\) (\(?\$?[\d,]+\.\d{2}\)?)/);
          if (m) {
            acc.records.push(mkRecord(acc, 'Current Unrealized Gain (Loss)', 'This Period', num(m[1]), 'US Tax Summary', 'medium'));
            return;
          }
          if (!inIncome) return;
          var moneys = moneyFrags(line);
          var label = labelOf(line);
          if (moneys.length === 3 && label && !/^Current Month/i.test(label)) {
            var tran = titleCase(label);
            acc.records.push(mkRecord(acc, tran, 'This Period', num(moneys[0].t), 'US Tax Summary'));
            acc.records.push(mkRecord(acc, tran, 'This Year', num(moneys[2].t), 'US Tax Summary'));
          }
        });
      }
    });

    // Reconciliation per account: begin + activity = end (Overview, This Period)
    Object.keys(accounts).forEach(function (k) {
      var acc = accounts[k];
      var ov = acc.records.filter(function (r) { return r.Section === 'Overview'; });
      var begin = null, end = null, activity = 0;
      ov.forEach(function (r) {
        if (r.TranType === 'Beginning Account Value') begin = r.Amount;
        else if (r.TranType === 'Ending Account Value') end = r.Amount;
        else activity += r.Amount;
      });
      if (begin !== null && end !== null) {
        var expected = Math.round((begin + activity) * 100) / 100;
        acc.recon.push({
          name: 'Overview: beginning + activity = ending',
          expected: end, actual: expected,
          ok: Math.abs(expected - end) < 0.011,
          residual: Math.round((expected - end) * 100) / 100
        });
      }
      acc.warnings = acc.warnings.concat(warnings);
    });

    return Object.keys(accounts).map(function (k) { return accounts[k]; });
  }

  // ------------------------------------------------------------------
  // JP Morgan
  // ------------------------------------------------------------------
  function parseJPM(pages, filename) {
    var acc = {
      custodian: 'JP Morgan', number: '', entity: '', reportDate: '',
      source: filename, records: [], recon: [], warnings: []
    };

    var all = pages.map(function (p) { return p.map(lineText).join('\n'); }).join('\n');
    var m = all.match(/ACCT\. ?([A-Z]?\d{5,})/);
    if (m) acc.number = m[1];
    m = all.match(/For the Period \d{1,2}\/\d{1,2}\/\d{2,4} to (\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) acc.reportDate = ymd(fixYear(m[3]), m[1], m[2]);
    m = all.match(/^(.*?) ACCT\./m);
    if (m) acc.entity = m[1].replace(/^JPMorgan Chase Bank, N\.A\.\s*/, '').replace(/^INVESTMENTS\s*/, '').trim();

    // The Account Summary page: blocks "Portfolio Activity" and "Tax Summary",
    // each with Current Period | Year-to-Date columns.
    var page = null;
    for (var i = 0; i < pages.length; i++) {
      var txt = pages[i].map(lineText).join('\n');
      if (/^Account Summary$/m.test(txt) && /Portfolio Activity/.test(txt)) { page = pages[i]; break; }
    }
    if (!page) {
      acc.warnings.push(filename + ': no Account Summary page found');
      return [acc];
    }

    // Column centers from the Beginning Market Value row (always two values).
    var colPeriod = null, colYtd = null;
    page.forEach(function (line) {
      if (/^Beginning Market Value/.test(lineText(line))) {
        var moneys = moneyFrags(line);
        if (moneys.length === 2) { colPeriod = moneys[0].x; colYtd = moneys[1].x; }
      }
    });

    function assign(moneys) {
      // Returns {period: n|null, ytd: n|null} using column x positions.
      var out = { period: null, ytd: null };
      moneys.forEach(function (f) {
        var v = num(f.t);
        if (colPeriod === null || colYtd === null) { if (out.period === null) out.period = v; else out.ytd = v; return; }
        var mid = (colPeriod + colYtd) / 2;
        if (f.x < mid) out.period = v; else out.ytd = v;
      });
      return out;
    }

    var region = null; // 'activity' | 'tax' | null
    var LABELS = /^(Beginning Market Value|Ending Market Value|Contributions|Withdrawals|Withdrawals & Fees|Securities Transferred In|Securities Transferred Out|Net Contributions\/Withdrawals|Income & Distributions|Transfers|Fees|Accruals|Market Value with Accruals|Change In Value|Change In Investment Value|Realized Gains?\/?\(?Losses?\)?|Domestic Dividends\/Distributions|Foreign Dividends\/Distributions|Interest Income|Tax-Exempt Income|Taxable Income|Non-Taxable Income|Capital Gains Distributions)$/;
    var CANON = { 'Beginning Market Value': 'Beginning Account Value', 'Ending Market Value': 'Ending Account Value' };

    page.forEach(function (line) {
      var t = lineText(line);
      if (/^Portfolio Activity/.test(t)) { region = 'activity'; return; }
      if (/^Tax Summary/.test(t)) { region = 'tax'; return; }
      if (/^Asset Allocation/.test(t)) { region = null; return; }
      if (!region) return;
      var moneys = moneyFrags(line);
      if (!moneys.length) return;
      var label = labelOf(line);
      if (!LABELS.test(label)) return;
      var section = region === 'activity' ? 'Portfolio Activity' : 'Tax Summary';
      var got = assign(moneys);
      var tran = CANON[label] || label;
      var conf = moneys.length === 1 && (colPeriod === null) ? 'low' : 'high';
      if (got.period !== null) acc.records.push(mkRecord(acc, tran, 'This Period', got.period, section, conf));
      if (got.ytd !== null) acc.records.push(mkRecord(acc, tran, 'This Year', got.ytd, section, conf));
    });

    // Recon: beginning + activity rows = ending, per column.
    ['This Period', 'This Year'].forEach(function (period) {
      var rows = acc.records.filter(function (r) { return r.Section === 'Portfolio Activity' && r['Reporting Period'] === period; });
      var begin = null, end = null, sum = 0;
      rows.forEach(function (r) {
        if (r.TranType === 'Beginning Account Value') begin = r.Amount;
        else if (r.TranType === 'Ending Account Value') end = r.Amount;
        else if (/^(Contributions|Withdrawals|Withdrawals & Fees|Securities Transferred In|Securities Transferred Out)$/.test(r.TranType)) return; // folded into Net Contributions/Withdrawals
        else if (r.TranType === 'Accruals' || r.TranType === 'Market Value with Accruals') return; // memo rows
        else sum += r.Amount;
      });
      if (begin !== null && end !== null) {
        var expected = Math.round((begin + sum) * 100) / 100;
        acc.recon.push({
          name: 'Portfolio Activity (' + period + '): beginning + activity = ending',
          expected: end, actual: expected,
          ok: Math.abs(expected - end) < 0.011,
          residual: Math.round((expected - end) * 100) / 100
        });
      }
    });

    return [acc];
  }

  // ------------------------------------------------------------------
  // Schwab
  // ------------------------------------------------------------------
  function parseSchwab(pages, filename) {
    var acc = {
      custodian: 'Schwab', number: '', entity: '', reportDate: '',
      source: filename, records: [], recon: [], warnings: []
    };

    var all = pages.map(function (p) { return p.map(lineText).join('\n'); }).join('\n');
    var m = all.match(/(\d{4}-\d{4})/);
    if (m) acc.number = m[1];
    m = all.match(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}-(\d{1,2}), (\d{4})/);
    if (m) acc.reportDate = ymd(m[3], monthNum(m[1]), m[2]);
    m = all.match(/Account of\n(.+?)(?: \d{4}-\d{4})?\n/);
    var m2 = all.match(/^([A-Z][A-Z &.,'-]{4,60}?) \d{4}-\d{4} /m);
    if (m2) acc.entity = m2[1].trim();

    var SUMMARY_LABELS = /^(Beginning Account Value|Deposits|Withdrawals|Dividends and Interest|Transfer of Securities|Market Appreciation\/?\(?Depreciation\)?|Fees and Charges|Expenses|Ending Account Value)$/;

    pages.forEach(function (page) {
      var txt = page.map(lineText).join('\n');

      // -- Account Summary block: label + This Statement + YTD
      if (/Account Summary/.test(txt)) {
        page.forEach(function (line) {
          var label = labelOf(line);
          if (!SUMMARY_LABELS.test(label)) return;
          var moneys = moneyFrags(line);
          if (moneys.length < 2) return;
          var tran = titleCase(label).replace('Market Appreciation/(Depreciation)', 'Market Appreciation/(Depreciation)');
          var exists = acc.records.some(function (r) { return r.Section === 'Account Summary' && r.TranType === tran; });
          if (exists) return;
          acc.records.push(mkRecord(acc, tran, 'This Period', num(moneys[0].t), 'Account Summary'));
          acc.records.push(mkRecord(acc, tran, 'This Year', num(moneys[1].t), 'Account Summary'));
        });
      }

      // -- Gain or (Loss) Summary: map by the two "Net" column x positions.
      var glHeader = null;
      page.forEach(function (line) { if (/Gain or \(Loss\) Summary/.test(lineText(line))) glHeader = line; });
      if (glHeader) {
        var netXs = [];
        page.forEach(function (line) {
          if (line.y < glHeader.y - 120 || line.y > glHeader.y) return;
          line.f.forEach(function (f) { if (f.t === 'Net') netXs.push(f.x); });
        });
        netXs.sort(function (a, b) { return a - b; });
        if (netXs.length >= 2) {
          var stX = netXs[0], ltX = netXs[netXs.length - 1];
          page.forEach(function (line) {
            var t = lineText(line);
            var period = null;
            if (/\bThis\b/.test(t) && moneyFrags(line).length >= 6) period = 'This Period';
            else if (/^YTD\b/.test(t)) period = 'This Year';
            if (!period) return;
            var moneys = moneyFrags(line);
            var pick = function (x) {
              var best = null;
              moneys.forEach(function (f) {
                if (best === null || Math.abs(f.x - x) < Math.abs(best.x - x)) best = f;
              });
              return best && Math.abs(best.x - x) < 45 ? num(best.t) : null;
            };
            var st = pick(stX), lt = pick(ltX);
            if (st !== null) acc.records.push(mkRecord(acc, 'Net Short-Term Gain/Loss', period, st, 'Gain or (Loss) Summary', 'medium'));
            if (lt !== null) acc.records.push(mkRecord(acc, 'Net Long-Term Gain/Loss', period, lt, 'Gain or (Loss) Summary', 'medium'));
          });
        }
      }

      // -- Income Summary: a table to the right of Asset Allocation; scope by x.
      var isHeader = null;
      page.forEach(function (line) {
        line.f.forEach(function (f) { if (/^Income Summary$/.test(f.t)) isHeader = { y: line.y, x: f.x }; });
      });
      if (isHeader) {
        var x0 = isHeader.x - 20;
        var rows = [];
        page.forEach(function (line) {
          if (line.y >= isHeader.y) return;
          var frags = line.f.filter(function (f) { return f.x >= x0; });
          if (!frags.length) return;
          rows.push({ y: line.y, f: frags });
        });
        var pendingLabel = null;
        var done = false;
        rows.forEach(function (line) {
          if (done) return;
          var moneys = moneyFrags(line);
          var label = labelOf(line);
          if (/Federal Tax Status|Tax-Exemp|This Period|YTD/.test(label) && moneys.length < 4) return;
          if (moneys.length === 4) {
            var name = label || pendingLabel || '';
            pendingLabel = name;
            return void emit(name, moneys, line);
          }
          if (!moneys.length && label && !/^i$/.test(label)) {
            if (lastEmit && lastEmit.pendingTail) { lastEmit.rename(label); lastEmit = null; return; }
            pendingLabel = label;
          }
        });
        var lastEmit = null;
        function emit(name, moneys, line) {
          var recs = [
            mkRecord(acc, '', 'This Period', num(moneys[0].t), 'Income Summary'),
            mkRecord(acc, '', 'This Period', num(moneys[1].t), 'Income Summary'),
            mkRecord(acc, '', 'This Year', num(moneys[2].t), 'Income Summary'),
            mkRecord(acc, '', 'This Year', num(moneys[3].t), 'Income Summary')
          ];
          var setName = function (n) {
            n = titleCase(n);
            recs[0].TranType = n + ' (Tax-Exempt)';
            recs[1].TranType = n + ' (Taxable)';
            recs[2].TranType = n + ' (Tax-Exempt)';
            recs[3].TranType = n + ' (Taxable)';
          };
          setName(name);
          recs.forEach(function (r) { acc.records.push(r); });
          lastEmit = {
            pendingTail: !name || /Total Capital Gains$/.test(name),
            rename: function (tail) { setName((name ? name + ' ' : '') + tail); }
          };
          if (/^Total Income/.test(name)) done = true;
        }
      }
    });

    // De-dup Income Summary label continuation quirks and empty names
    acc.records = acc.records.filter(function (r) { return r.TranType; });

    // Recon: beginning + flows = ending (This Period)
    ['This Period', 'This Year'].forEach(function (period) {
      var rows = acc.records.filter(function (r) { return r.Section === 'Account Summary' && r['Reporting Period'] === period; });
      var begin = null, end = null, sum = 0;
      rows.forEach(function (r) {
        if (r.TranType === 'Beginning Account Value') begin = r.Amount;
        else if (r.TranType === 'Ending Account Value') end = r.Amount;
        else sum += r.Amount;
      });
      if (begin !== null && end !== null) {
        var expected = Math.round((begin + sum) * 100) / 100;
        acc.recon.push({
          name: 'Account Summary (' + period + '): beginning + flows = ending',
          expected: end, actual: expected,
          ok: Math.abs(expected - end) < 0.011,
          residual: Math.round((expected - end) * 100) / 100
        });
      }
    });

    return [acc];
  }

  // ------------------------------------------------------------------
  // Fidelity (built to the klr03-all vocabulary; verify on a real file)
  // ------------------------------------------------------------------
  function parseFidelity(pages, filename) {
    var accounts = {};
    var order = [];
    var reportDate = '';

    var all = pages.map(function (p) { return p.map(lineText).join('\n'); }).join('\n');
    var dm = all.match(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4} - (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/);
    if (dm) reportDate = ymd(dm[4], monthNum(dm[2]), dm[3]);

    function accFor(number) {
      if (!accounts[number]) {
        accounts[number] = {
          custodian: 'Fidelity', number: number, entity: '', reportDate: reportDate,
          source: filename, records: [], recon: [], warnings: []
        };
        order.push(number);
      }
      return accounts[number];
    }

    var COVER = /^(Beginning Account Value|Beginning Net Account Value|Additions|Subtractions|Change in Investment Value|Ending Account Value|Ending Net Account Value|Accrued Interest \(AI\)|Accrued Interest|Ending Account Value Incl\.? AI|Ending Net Account Value Incl\.? AI)$/;
    var SUMMARY = /^(Taxable Income|Taxable Dividends|Taxable Interest|Short-term Capital Gains|Long-term Capital Gains|Tax-exempt Income|Tax-exempt Dividends|Tax-exempt Interest|Return of Capital|Liquidations|Exchanges In|Exchanges Out|Total Income|Transaction Costs, Fees & Charges|Taxes Withheld|Additions|Subtractions|Deposits|Withdrawals|Core Account Income|Other Income)$/;
    var GAINS = /^(Net Short-term Gain\/Loss|Net Long-term Gain\/Loss|Net Gain\/Loss|Short-term Gain|Short-term Loss|Long-term Gain|Long-term Loss)$/;

    var current = null;
    var section = null;

    pages.forEach(function (page) {
      page.forEach(function (line) {
        var t = lineText(line);
        var am = t.match(/\b([A-Z0-9]?\d{2,3}-\d{6})\b/);
        if (am) current = accFor(am[1]);
        if (/Account Summary/i.test(t)) section = 'Account Summary';
        else if (/Gains and Losses|Realized Gains and Losses/i.test(t)) section = 'Gains and Losses';
        else if (/Account Value.*This Period|Your Account Value/i.test(t) || /^Account # /.test(t)) section = 'Cover Page';
        if (!current) return;

        var label = labelOf(line).replace(/:$/, '');
        var normalized = label.replace(/^Ending Net Account Value/, 'Ending Account Value').replace(/^Beginning Net Account Value/, 'Beginning Account Value');
        var moneys = moneyFrags(line);
        // Dash-as-zero: Fidelity prints "-" for zero; those frags are not money tokens,
        // so also accept lines with one money + a dash.
        var vals = [];
        line.f.forEach(function (f) {
          if (isMoney(f.t)) vals.push(num(f.t));
          else if (f.t === '-') vals.push(0);
        });
        if (vals.length < 2) return;

        var sec = null, tran = null;
        if (COVER.test(label)) { sec = 'Cover Page'; tran = normalized; }
        else if (SUMMARY.test(label) && section === 'Account Summary') { sec = 'Account Summary'; tran = label; }
        else if (GAINS.test(label)) { sec = 'Gains and Losses'; tran = label; }
        if (!sec) return;

        var dupe = current.records.some(function (r) {
          return r.Section === sec && r.TranType === tran && r['Reporting Period'] === 'This Period';
        });
        if (dupe) return;
        current.records.push(mkRecord(current, tran, 'This Period', vals[0], sec, 'medium'));
        current.records.push(mkRecord(current, tran, 'This Year', vals[vals.length - 1], sec, 'medium'));
      });
    });

    order.forEach(function (k) {
      var acc = accounts[k];
      ['This Period', 'This Year'].forEach(function (period) {
        var rows = acc.records.filter(function (r) { return r.Section === 'Cover Page' && r['Reporting Period'] === period; });
        var begin = null, end = null, sum = 0;
        rows.forEach(function (r) {
          if (r.TranType === 'Beginning Account Value') begin = r.Amount;
          else if (r.TranType === 'Ending Account Value') end = r.Amount;
          else if (/Accrued Interest|Incl\.? AI/.test(r.TranType)) return;
          else sum += r.Amount;
        });
        if (begin !== null && end !== null) {
          var expected = Math.round((begin + sum) * 100) / 100;
          acc.recon.push({
            name: 'Cover Page (' + period + '): beginning + activity = ending',
            expected: end, actual: expected,
            ok: Math.abs(expected - end) < 0.011,
            residual: Math.round((expected - end) * 100) / 100
          });
        }
      });
      if (!acc.records.length) acc.warnings.push(filename + ': account ' + k + ' matched no records');
    });

    return order.map(function (k) { return accounts[k]; });
  }

  // ------------------------------------------------------------------
  function parseDocument(doc) {
    var custodian = detectCustodian(doc.pages);
    if (custodian === 'Goldman Sachs') return { custodian: custodian, accounts: parseGoldman(doc.pages, doc.filename) };
    if (custodian === 'JP Morgan') return { custodian: custodian, accounts: parseJPM(doc.pages, doc.filename) };
    if (custodian === 'Schwab') return { custodian: custodian, accounts: parseSchwab(doc.pages, doc.filename) };
    if (custodian === 'Fidelity') return { custodian: custodian, accounts: parseFidelity(doc.pages, doc.filename) };
    return { custodian: null, accounts: [], error: 'Custodian not recognized. Supported: Fidelity, Goldman Sachs, JP Morgan, Schwab.' };
  }

  return { parseDocument: parseDocument, detectCustodian: detectCustodian, num: num, isMoney: isMoney };
})();

if (typeof module !== 'undefined') module.exports = KLSCAN;


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
