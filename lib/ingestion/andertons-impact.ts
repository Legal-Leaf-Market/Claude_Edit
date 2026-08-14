import { gunzipSync } from "node:zlib"
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
 * 1. IT ARRIVES BY SFTP, NOT HTTPS. Awin, CJ and LinkConnector all publish an
 *    authenticated feed URL. Impact drops catalogues on a file server
 *    (products.impact.com, one directory per advertiser) and the publisher
 *    pulls them.
 *
 *    SFTP rather than FTP, which was measured rather than read off the docs.
 *    Impact's documentation says "FTP" throughout and this module was written
 *    against basic-ftp on that basis; probing the host found port 21 denying
 *    FEAT before any credential and refusing AUTH TLS with a 431, port 990 not
 *    listening at all, and port 22 answering SSH-2.0-APACHE-SSHD-2.14.0. See
 *    fetchAndertonsCatalogue below, and lib/ingestion/ftp-probe.ts for the
 *    probe that settled it without sending a password anywhere.
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

export type SftpConfig = {
  host: string
  port: number
  user: string
  password: string
  path: string
}

/**
 * Download the newest catalogue file from the Impact drop, over SFTP.
 *
 * IT IS SFTP, NOT FTPS, AND THAT WAS MEASURED RATHER THAN ASSUMED. Everything
 * here was originally written against `basic-ftp` on the reasonable reading of
 * Impact's own docs, which say "FTP" throughout. Probing the host settled it:
 *
 *   port 21   220 banner, then 530 Access denied to FEAT before any
 *             credential, then 431 to AUTH TLS. 431 is RFC 2228's security
 *             range, so TLS is refused outright rather than being unavailable
 *             temporarily. That port is a dead end, and the only thing it
 *             offers instead is plaintext FTP, which would put the password on
 *             the wire in clear.
 *   port 990  connection timed out, so implicit FTPS is not listening.
 *   port 22   SSH-2.0-APACHE-SSHD-2.14.0.
 *
 * An SSH banner means the drop speaks SSH, and `basic-ftp` cannot speak SSH at
 * all. This was never a wrong option on the right library; it was the wrong
 * library, which is exactly the distinction the probe exists to draw and the
 * reason it sends no credential while drawing it.
 *
 * The credential pair Impact mails out is therefore an SSH login. Same pair,
 * different protocol.
 *
 * Deliberately the only part of this module that touches a file server, so
 * everything above it stays testable against a fixture. The import is dynamic
 * because ssh2 pulls in native crypto bindings, and a static import would drag
 * them into any bundle that wants this file for the parser alone.
 */
export type DropListing = {
  connected: boolean
  /** The directory these entries actually came from. */
  path: string
  /** What was configured, when that turned out not to exist. */
  configuredPath?: string
  /** True when the configured path was missing and this is a fallback. */
  configuredPathMissing?: boolean
  files: { name: string; sizeBytes: number; modified: string | null }[]
  /** The file a pull would actually take, by the same rule the pull uses. */
  chosen: string | null
}

/**
 * Where to look when the configured directory is not there.
 *
 * The home directory first, because an SFTP account serving one publisher is
 * usually chrooted or dropped straight into its own directory, and "." is
 * whatever the server considers that. Root second, for the case where it is
 * not.
 */
const FALLBACK_PATHS = [".", "/"]

/**
 * Is this drop a DELTA rather than a full snapshot?
 *
 * THE MOST DANGEROUS THING ON THIS TRANSPORT, and it was discovered by
 * listing: the account's home directory contains exactly one directory,
 * INCREMENTAL. An incremental feed carries what CHANGED, not the catalogue.
 *
 * Everything downstream was written for a full snapshot. `expirePastEndDate`
 * retires every active row the run did not see, which is correct after a
 * snapshot and catastrophic after a delta: a delta of forty changed products
 * would retire the other 27,000, every one of them a live listing, with
 * nothing thrown and the run reported as a success. That is the same failure
 * as expiring at the API paging ceiling, and it is worse here because the
 * delta will usually be small.
 *
 * Detected from the PATH rather than from the file contents because it has to
 * be known before anything is written, and because Impact names these
 * directories rather than marking the rows. A false positive costs nothing:
 * skipping expiry leaves stale rows visible until a full pull runs, which is
 * the error this project already chooses in every other tie.
 */
export function isIncrementalDrop(path: string): boolean {
  return /incremental|delta|changes?\b/i.test(path)
}

/**
 * Is this listing entry something a catalogue could be?
 *
 * SFTP reports "-" for a plain file, "d" for a directory and "l" for a
 * SYMLINK, and the first version of this module dropped symlinks from both
 * buckets. That is not a cosmetic gap: a drop that publishes
 * "latest.csv -> 2026-08-11.csv", which is a completely ordinary way to run
 * one, would have listed as EMPTY and been reported as the merchant delivering
 * nothing. Blaming a third party for a filter of ours is the worst failure
 * available here, so symlinks count as files and an empty listing means empty.
 */
function isFileLike(type: string): boolean {
  return type === "-" || type === "l"
}

function isMissingDirectory(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /No such file|ENOENT/i.test(message)
}

/**
 * Open the drop, list it, and close. No download.
 *
 * THE CHEAP STEP BEFORE THE EXPENSIVE ONE. A pull of this catalogue is 27,052
 * rows against a 300 second ceiling, so an attempt that fails on the login or
 * on the directory path costs several minutes and reports a timeout, which
 * looks exactly like the size problem it is not. Listing costs a second and
 * separates them outright: it either authenticates or it does not, and the
 * directory either holds a catalogue or names what it holds instead.
 *
 * Same shape of reasoning as the peek on the API side and the port probe
 * before that. The pattern is worth stating plainly, because this source has
 * now cost four round trips of guessing: when a step is slow, expensive or
 * hard to interpret, put a fast and unambiguous one in front of it.
 *
 * `chosen` runs the real selection rule, so the answer to "which file would a
 * pull take" comes from the code that would take it rather than from reading
 * the list and assuming.
 */
export async function listAndertonsDrop(config: SftpConfig): Promise<DropListing> {
  const { default: SftpClient } = await import("ssh2-sftp-client")
  const client = new SftpClient()

  try {
    await client.connect({
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      readyTimeout: 30_000,
    })

    /*
     * WHEN THE CONFIGURED PATH IS NOT THERE, SHOW WHAT IS.
     *
     * IMPACT_ANDERTONS_FTP_PATH defaults to a guessed directory name, and a
     * guess that is wrong throws ENOENT after a SUCCESSFUL login. Reporting
     * only "no such directory" would leave the next step as another guess and
     * another deploy, which is how this source has already burned several
     * round trips. Listing the home directory instead turns the failure into
     * the answer: the real path is almost always one of the names in it.
     *
     * Only a missing directory falls back. A permission error is a different
     * problem with a different fix and must not be papered over by quietly
     * listing somewhere else.
     */
    let listing: Awaited<ReturnType<typeof client.list>> | null = null
    let listedPath = config.path
    let missing = false

    try {
      listing = await client.list(config.path)
    } catch (error) {
      if (!isMissingDirectory(error)) throw error
      missing = true

      for (const candidate of FALLBACK_PATHS) {
        try {
          listing = await client.list(candidate)
          listedPath = candidate
          break
        } catch (fallbackError) {
          if (!isMissingDirectory(fallbackError)) throw fallbackError
        }
      }

      if (!listing) throw error
    }

    const files = listing
      .filter((f) => isFileLike(f.type))
      .map((f) => ({
        name: f.name,
        sizeBytes: f.size,
        modified: f.modifyTime ? new Date(f.modifyTime).toISOString() : null,
      }))

    const directories = listing.filter((f) => f.type === "d").map((f) => f.name)

    /*
     * DESCEND ONE LEVEL WHILE DISCOVERING, and only while discovering.
     *
     * The first real listing came back as a single entry, INCREMENTAL/, which
     * answers "where am I" and not "what do I set the path to". Stopping there
     * would cost another environment change and another deploy to learn what
     * is inside it, and this source has already spent several of those. One
     * level is enough to turn the listing into the answer, and it only runs on
     * the discovery path, so a normal list stays a single round trip.
     *
     * Bounded deliberately: a handful of directories, and failures skipped
     * rather than thrown, since a directory this account cannot open is
     * information too and must not lose the rest of the listing.
     */
    const children: { name: string; sizeBytes: number; modified: string | null }[] = []
    if (missing) {
      for (const dir of directories.slice(0, 5)) {
        const childPath = `${listedPath.replace(/\/+$/, "")}/${dir}`
        try {
          const inner = await client.list(childPath)
          for (const f of inner.slice(0, 40)) {
            children.push({
              name: `${dir}/${f.name}${f.type === "d" ? "/" : ""}`,
              sizeBytes: isFileLike(f.type) ? f.size : 0,
              modified: f.modifyTime ? new Date(f.modifyTime).toISOString() : null,
            })
          }
        } catch {
          children.push({ name: `${dir}/  (could not be opened)`, sizeBytes: 0, modified: null })
        }
      }
    }

    return {
      connected: true,
      path: listedPath,
      ...(missing ? { configuredPath: config.path, configuredPathMissing: true } : {}),
      // Directories included by name only, since a drop that turns out to be
      // one directory per date is a path problem rather than an empty one.
      files: [
        ...files,
        ...directories.map((name) => ({ name: `${name}/`, sizeBytes: 0, modified: null })),
        ...children,
      ],
      // Never claim a pull target from a fallback directory: the file a pull
      // would take is the one under the CONFIGURED path, and that path does
      // not exist yet.
      chosen: missing ? null : pickCatalogueFile(files.map((f) => f.name)),
    }
  } finally {
    await client.end().catch(() => {})
  }
}

export async function fetchAndertonsCatalogue(config: SftpConfig): Promise<string> {
  const { default: SftpClient } = await import("ssh2-sftp-client")
  const client = new SftpClient()

  try {
    await client.connect({
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      readyTimeout: 60_000,
    })

    const listing = await client.list(config.path)
    // ssh2-sftp-client marks a plain file with "-", the same convention as ls.
    const chosen = pickCatalogueFile(listing.filter((f) => isFileLike(f.type)).map((f) => f.name))
    if (!chosen) {
      throw new Error(
        `No catalogue file in ${config.path}. Saw: ${listing.map((f) => f.name).join(", ") || "(empty directory)"}`,
      )
    }

    const downloaded = await client.get(`${config.path.replace(/\/+$/, "")}/${chosen}`)
    /*
     * `get` hands back a Buffer when no destination is given, but its type
     * admits a string and a stream too. Normalising here keeps the gzip sniff
     * below working on bytes rather than on a string that has already been
     * decoded, which would corrupt a compressed file beyond recovery.
     */
    const buffer = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(String(downloaded), "binary")
    return maybeGunzip(buffer).toString("utf-8")
  } finally {
    await client.end().catch(() => {})
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
  fetchImpl: (config: SftpConfig) => Promise<string> = fetchAndertonsCatalogue,
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
      port: env.impact.andertonsFtpPort,
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

    /*
     * TWO CONDITIONS, AND BOTH ARE ABOUT THE SAME MISTAKE.
     *
     * Expiring retires every active row this run did not see, so it is only
     * ever correct when "did not see" means "the catalogue no longer lists
     * it". That needs the whole file written (`done`), because expiring after
     * a partial slice retires everything the later slices had not reached.
     *
     * And it needs the file to be a SNAPSHOT. Anderton's drop turned out to
     * serve an INCREMENTAL directory, which carries what changed rather than
     * what exists, and expiring after a delta of forty products would retire
     * the other 27,000. Nothing would throw and the run would report success.
     */
    const incremental = isIncrementalDrop(env.impact.andertonsFtpPath)
    if (done && !incremental) await expirePastEndDate("andertons")

    await finishRun(run, {
      status: "ok",
      rowsSeen: seen,
      rowsUpserted: stats.inserted + stats.updated,
      rowsSkipped: stats.skipped,
      bytesDownloaded: Buffer.byteLength(text),
      // Recording the resolved column names makes a later schema change
      // visible in the run history rather than only in a failure.
      detail: {
        resolved,
        priceChanges: stats.priceChanges,
        columns,
        offset,
        wrote: slice.length,
        done,
        incremental,
        expired: done && !incremental,
      },
    })

    return { status: "ok", stats, resolved, totalRows: rows.length, offset, wrote: slice.length, done, incremental }
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
