/**
 * Streaming delimited-text parser (RFC 4180 shaped).
 *
 * Awin product feeds are comma delimited with quoted fields, and the
 * description column routinely contains commas, embedded quotes and newlines.
 * A `split(",")` parser looks fine against a hand-made fixture and then
 * silently shreds every third row of the real feed, so this does the actual
 * state machine.
 *
 * Delimiter is configurable because Awin also publishes pipe and tab variants.
 */

export type CsvOptions = {
  delimiter?: string
  quote?: string
  /** When false, the first row is data and columns are named c0, c1, ... */
  hasHeader?: boolean
}

/** Parse a whole document into rows keyed by header name. */
export function parseCsv(text: string, options: CsvOptions = {}): Record<string, string>[] {
  const rows = parseCsvRows(text, options)
  return rowsToRecords(rows, options.hasHeader !== false)
}

/** Parse into raw cell arrays, preserving row structure. */
export function parseCsvRows(text: string, options: CsvOptions = {}): string[][] {
  const delimiter = options.delimiter ?? ","
  const quote = options.quote ?? '"'

  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0

  // Strip a UTF-8 BOM: left in place it becomes part of the first header name
  // and every lookup for that column silently misses.
  if (text.charCodeAt(0) === 0xfeff) i = 1

  const endField = () => {
    row.push(field)
    field = ""
  }
  const endRow = () => {
    endField()
    // Ignore blank trailing lines rather than emitting a one-empty-cell row.
    if (row.length > 1 || row[0] !== "") rows.push(row)
    row = []
  }

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === quote) {
        // A doubled quote inside a quoted field is a literal quote.
        if (text[i + 1] === quote) {
          field += quote
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === quote && field === "") {
      inQuotes = true
      i += 1
      continue
    }
    if (char === delimiter) {
      endField()
      i += 1
      continue
    }
    if (char === "\r") {
      // Swallow CR; the LF that follows ends the row.
      i += 1
      continue
    }
    if (char === "\n") {
      endRow()
      i += 1
      continue
    }
    field += char
    i += 1
  }

  if (field !== "" || row.length > 0) endRow()
  return rows
}

/* -------------------------------------------------------------------------- */
/*  Incremental record splitting, for feeds too large to hold in memory       */
/* -------------------------------------------------------------------------- */

export type CsvRecordSplitter = {
  /** Feed a chunk of text; returns whatever complete records it completed. */
  push(chunk: string): string[]
  /** Emit any trailing record not terminated by a newline. */
  flush(): string[]
}

/**
 * Split a stream of feed text into complete logical records.
 *
 * WHY THIS EXISTS. parseCsv above takes a whole document, which is right for
 * every feed whose file comfortably fits in memory. Zoro's LinkConnector feed
 * does not: it is a ~3.5M SKU industrial catalogue of which we keep only the
 * musical-instrument rows, so buffering the file to find the few thousand rows
 * we want is the same mistake section 3 of CLAUDE.md warns about for the eBay
 * bootstrap feed.
 *
 * A `split("\n")` will not do the job. A quoted description field may legally
 * contain a newline, so record boundaries have to be found with quote state
 * carried across chunk boundaries, exactly as the whole-document parser does.
 *
 * Two subtleties this handles that a naive quote toggle gets wrong:
 *
 *  - A quote only OPENS a quoted field at the start of a field. Music listings
 *    are full of inch marks ('16" Crash Cymbal'), and in an unquoted field
 *    those must stay literal. Toggling on them would swallow every newline up
 *    to the next quote and shred the rest of the file.
 *  - A doubled quote inside a quoted field is an escaped literal quote, so
 *    closing on the first and immediately reopening on the second keeps the
 *    state correct without needing lookahead across a chunk boundary.
 *
 * Records come back WITHOUT the terminating newline. Feed each one to
 * parseCsvRows to get its cells, so the same state machine does the field-level
 * parsing and there is only one CSV implementation to be wrong.
 */
export function createCsvRecordSplitter(options: CsvOptions = {}): CsvRecordSplitter {
  const delimiter = options.delimiter ?? ","
  const quote = options.quote ?? '"'

  let pending = ""
  let inQuotes = false
  let atFieldStart = true
  let justClosedQuote = false
  let seenAnyChar = false

  function consume(chunk: string, out: string[]): void {
    for (const char of chunk) {
      // Strip a UTF-8 BOM: left in place it becomes part of the first header
      // name and every lookup for that column silently misses.
      if (!seenAnyChar) {
        seenAnyChar = true
        if (char === "﻿") continue
      }

      if (inQuotes) {
        if (char === quote) {
          inQuotes = false
          justClosedQuote = true
        }
        pending += char
        continue
      }

      if (char === quote && (atFieldStart || justClosedQuote)) {
        inQuotes = true
        justClosedQuote = false
        atFieldStart = false
        pending += char
        continue
      }
      justClosedQuote = false

      if (char === delimiter) {
        atFieldStart = true
        pending += char
        continue
      }
      if (char === "\n") {
        out.push(pending)
        pending = ""
        atFieldStart = true
        continue
      }
      pending += char
      atFieldStart = false
    }
  }

  return {
    push(chunk: string): string[] {
      const out: string[] = []
      consume(chunk, out)
      return out
    },
    flush(): string[] {
      // An unterminated quoted field at end of input is a truncated download,
      // not a record. Emitting it would hand the caller a half row whose
      // columns are shifted; dropping it lets the run's skipped count show it.
      if (inQuotes || pending.trim() === "") {
        pending = ""
        return []
      }
      const last = pending
      pending = ""
      return [last]
    },
  }
}

/** Pair header names with one record's cells, the way parseCsv does per row. */
export function zipRecord(header: string[], cells: string[]): Record<string, string> {
  const record: Record<string, string> = {}
  for (let i = 0; i < header.length; i++) record[header[i]] = (cells[i] ?? "").trim()
  return record
}

function rowsToRecords(rows: string[][], hasHeader: boolean): Record<string, string>[] {
  if (rows.length === 0) return []
  const header = hasHeader ? rows[0].map((h) => h.trim()) : rows[0].map((_, i) => `c${i}`)
  const body = hasHeader ? rows.slice(1) : rows

  return body.map((cells) => {
    const record: Record<string, string> = {}
    for (let i = 0; i < header.length; i++) record[header[i]] = (cells[i] ?? "").trim()
    return record
  })
}

/**
 * Guess the delimiter from the header line.
 *
 * Counting candidates on the first line only is enough and is robust to a
 * description field full of commas further down the file.
 */
export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? ""
  const candidates = [",", "\t", "|", ";"]
  let best = ","
  let bestCount = -1
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }
  return best
}
