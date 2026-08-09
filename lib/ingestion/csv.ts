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
