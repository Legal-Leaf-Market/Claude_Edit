import { gunzipSync } from "node:zlib"
import { Writable } from "node:stream"
import { env } from "@/lib/env"
import { ANDERTONS } from "./impact-merchants"
import {
  bindColumns,
  emptyStats,
  ImpactSchemaError,
  impactApiConfig,
  ingestImpactCatalogue,
  normalizeImpactRecords,
  normalizeImpactRow,
  parseImpactCatalogue,
  peekImpactCatalogue,
  sliceRows,
  type BoundColumns,
  type ImpactApiConfig,
  type ImpactIngestOutcome,
  type IngestWindow,
  type ParsedCatalogue,
} from "./impact-catalogue"
import {
  expirePastEndDate,
  finishRun,
  resolveAndReprice,
  startRun,
  upsertListings,
} from "./upsert"
import type { NewMarketplaceListing } from "@/lib/db/schema"

/**
 * Anderton's ingestion, and the FTP transport nothing else here uses.
 *
 * WHAT MOVED, AND WHY. Everything in this file that was not specific to
 * Anderton's now lives in lib/ingestion/impact-catalogue.ts: the alias table,
 * the column binder, the row normaliser, the REST transport and the generic
 * job. That happened when Impact went from one merchant to eight. Keeping a
 * per-merchant copy of a parser whose only per-merchant inputs are a catalogue
 * id, a currency and a country would have been forking the logic eight ways,
 * which is what section 7 of CLAUDE.md rules out.
 *
 * WHAT STAYED, AND WHY. The FTP drop. Impact publishes catalogues on an FTP
 * server (products.impact.com, one directory per advertiser) as well as over
 * the API, and Anderton's is the only merchant whose FTP credentials we have,
 * so the transport lives beside the merchant that uses it. It is genuinely
 * different plumbing: a control connection plus passive data ports, a
 * credential pair Impact mails on request, and a whole file rather than a page.
 *
 * The exported names here are unchanged, so callers and tests that predate the
 * split keep working, and every one of them ultimately runs the same shared
 * normaliser.
 */

export {
  bindColumns,
  ImpactSchemaError,
  sliceRows,
  toCents,
  UNBOUND_BY_POLICY,
  type ImpactApiConfig,
  type IngestWindow,
  type ParsedCatalogue,
} from "./impact-catalogue"

/** The shared normaliser, bound to Anderton's. */
export function normalizeAndertonsRow(
  record: Record<string, string>,
  columns: BoundColumns,
): NewMarketplaceListing | null {
  return normalizeImpactRow(record, columns, ANDERTONS)
}

export function normalizeRecords(records: Record<string, string>[]): ParsedCatalogue {
  return normalizeImpactRecords(records, ANDERTONS)
}

export function parseAndertonsFeed(text: string): ParsedCatalogue {
  return parseImpactCatalogue(text, ANDERTONS)
}

/* -------------------------------------------------------------------------- */
/*  FTP transport                                                             */
/* -------------------------------------------------------------------------- */

function maybeGunzip(buffer: Buffer): Buffer {
  if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) return gunzipSync(buffer)
  return buffer
}

/** Catalogue files, newest first, ignoring anything that is plainly not one. */
function pickCatalogueFile(names: string[]): string | null {
  const candidates = names
    .filter((name) => /\.(csv|psv|txt|tsv)(\.gz)?$/i.test(name))
    .sort()
    .reverse()
  return candidates[0] ?? null
}

export type FtpConfig = {
  host: string
  user: string
  password: string
  path: string
}

/**
 * Download the newest catalogue file from the Impact FTP drop.
 *
 * Deliberately the only part of this module that touches the network, so
 * everything above it is testable against a fixture without a server. The
 * import is dynamic because `basic-ftp` pulls in node:net and node:tls, and a
 * static import would drag those into any bundle that imports this file for
 * the parser alone.
 */
export async function fetchAndertonsCatalogue(config: FtpConfig): Promise<string> {
  const { Client } = await import("basic-ftp")
  const client = new Client(60_000)

  try {
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      secure: true,
      // Impact's server presents a certificate that does not always match the
      // connecting hostname. The credential is still sent over TLS; this only
      // relaxes the name check, and the alternative offered by the server is
      // plaintext FTP, which would put the password on the wire in clear.
      secureOptions: { rejectUnauthorized: false },
    })

    const listing = await client.list(config.path)
    const chosen = pickCatalogueFile(listing.filter((f) => f.isFile).map((f) => f.name))
    if (!chosen) {
      throw new Error(
        `No catalogue file in ${config.path}. Saw: ${listing.map((f) => f.name).join(", ") || "(empty directory)"}`,
      )
    }

    const chunks: Buffer[] = []
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      },
    })

    await client.downloadTo(sink, `${config.path.replace(/\/+$/, "")}/${chosen}`)
    return maybeGunzip(Buffer.concat(chunks)).toString("utf-8")
  } finally {
    client.close()
  }
}

/* -------------------------------------------------------------------------- */
/*  Jobs                                                                      */
/* -------------------------------------------------------------------------- */

export type AndertonsIngestOutcome = ImpactIngestOutcome

/**
 * Ingest the Anderton's catalogue over FTP, or one slice of it.
 *
 * `fetchImpl` is injectable so the integration test can run the whole job
 * against a fixture without an FTP server, the same way the eBay tests drive
 * the feed parser.
 */
export async function ingestAndertonsFeed(
  fetchImpl: (config: FtpConfig) => Promise<string> = fetchAndertonsCatalogue,
  window: IngestWindow = {},
): Promise<AndertonsIngestOutcome> {
  if (!env.impact.hasAndertonsFeed) {
    const reason =
      "IMPACT_ANDERTONS_FTP_USER / IMPACT_ANDERTONS_FTP_PASSWORD are not set. Anderton's FTP ingestion is skipped. " +
      "Credentials come from the Impact account's FTP settings; the catalogue is a per-advertiser directory on products.impact.com. " +
      "The REST API is the other way into the same catalogue and needs only IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN."
    console.warn(`[andertons] ${reason}`)
    return { status: "skipped", reason, stats: emptyStats(), resolved: 0 }
  }

  const run = await startRun("andertons", "andertons-catalogue")

  try {
    const text = await fetchImpl({
      host: env.impact.andertonsFtpHost,
      user: env.impact.andertonsFtpUser,
      password: env.impact.andertonsFtpPassword,
      path: env.impact.andertonsFtpPath,
    })

    const { rows, seen, skipped, columns } = parseAndertonsFeed(text)

    const { slice, offset, done } = sliceRows(rows, window)

    const stats = await upsertListings(slice)
    stats.seen = seen
    stats.skipped += skipped

    const { resolved } = await resolveAndReprice(stats)
    // Expiring only makes sense once the whole snapshot has been written.
    // Doing it after a partial slice would retire every row the feed still
    // lists but this chunk had not reached yet.
    if (done) await expirePastEndDate("andertons")

    await finishRun(run, {
      status: "ok",
      rowsSeen: seen,
      rowsUpserted: stats.inserted + stats.updated,
      rowsSkipped: stats.skipped,
      bytesDownloaded: Buffer.byteLength(text),
      // Recording the resolved column names makes a later schema change
      // visible in the run history rather than only in a failure.
      detail: { resolved, priceChanges: stats.priceChanges, columns, offset, wrote: slice.length, done },
    })

    return { status: "ok", stats, resolved, totalRows: rows.length, offset, wrote: slice.length, done }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[andertons] failed: ${message}`)
    await finishRun(run, { status: "failed", error: message })
    return { status: "failed", stats: emptyStats(), resolved: 0, error: message }
  }
}

/** The Anderton's catalogue over Impact's REST API. Same normaliser, same upsert. */
export async function ingestAndertonsViaApi(
  window: { startPage?: number; pages?: number; pageSize?: number } = {},
): Promise<AndertonsIngestOutcome> {
  return ingestImpactCatalogue(ANDERTONS, window)
}

/** Read one API page of the Anderton's catalogue and report the schema, writing nothing. */
export async function peekAndertonsApi(config: ImpactApiConfig = impactApiConfig(ANDERTONS)) {
  return peekImpactCatalogue(config, `The ${ANDERTONS.label} Impact catalogue`)
}
