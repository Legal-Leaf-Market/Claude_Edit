import { gzipSync } from "node:zlib"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The Anderton's catalogue transport, which is SFTP and was FTPS until a probe
 * said otherwise.
 *
 * Impact's documentation says "FTP" throughout, so this module was written
 * against basic-ftp and every failure looked like a wrong option. Probing
 * products.impact.com settled it: port 21 denies FEAT before any credential
 * and refuses AUTH TLS with a 431, port 990 does not listen, and port 22
 * answers SSH-2.0-APACHE-SSHD-2.14.0. An SSH banner means the library was
 * wrong rather than its settings.
 *
 * These pin the parts of that switch which would fail silently: connecting on
 * the wrong port, mistaking a directory for a catalogue file, decoding a
 * gzipped download as text before unzipping it, and leaking a connection when
 * the download throws.
 */

const connect = vi.fn()
const list = vi.fn()
const get = vi.fn()
const end = vi.fn()

vi.mock("ssh2-sftp-client", () => ({
  default: class {
    connect = connect
    list = list
    get = get
    end = end
  },
}))

const { fetchAndertonsCatalogue, listAndertonsDrop } = await import("@/lib/ingestion/andertons-impact")

const CONFIG = {
  host: "products.impact.com",
  port: 22,
  user: "publisher",
  password: "secret",
  path: "/Andertons-Music-Company/",
}

/** An SFTP listing entry. "-" is a plain file, "d" a directory, as with ls. */
function entry(name: string, type: "-" | "d" = "-") {
  return { type, name, size: 10, modifyTime: 0, accessTime: 0, rights: {}, owner: 0, group: 0 }
}

describe("the Anderton's SFTP transport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    connect.mockResolvedValue(undefined)
    end.mockResolvedValue(undefined)
  })

  it("connects over SSH on the configured port, with the credential as an SSH login", async () => {
    list.mockResolvedValue([entry("catalogue.csv")])
    get.mockResolvedValue(Buffer.from("Sku\tName\tUrl\n"))

    await fetchAndertonsCatalogue(CONFIG)

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "products.impact.com",
        port: 22,
        username: "publisher",
        password: "secret",
      }),
    )
  })

  /*
   * A directory named like a catalogue would otherwise be picked and then fail
   * on download with something unrelated to the actual mistake.
   */
  it("ignores directories when picking the catalogue file", async () => {
    list.mockResolvedValue([entry("archive.csv", "d"), entry("current.csv")])
    get.mockResolvedValue(Buffer.from("ok"))

    await fetchAndertonsCatalogue(CONFIG)

    expect(get).toHaveBeenCalledWith("/Andertons-Music-Company/current.csv")
  })

  it("takes the newest catalogue file when the drop keeps several", async () => {
    list.mockResolvedValue([
      entry("andertons-2026-08-09.csv"),
      entry("andertons-2026-08-11.csv"),
      entry("andertons-2026-08-10.csv"),
    ])
    get.mockResolvedValue(Buffer.from("ok"))

    await fetchAndertonsCatalogue(CONFIG)

    expect(get).toHaveBeenCalledWith("/Andertons-Music-Company/andertons-2026-08-11.csv")
  })

  /*
   * Impact gzips the larger catalogues. Decoding those bytes as UTF-8 before
   * unzipping produces mojibake that the header binder then rejects with a
   * message about missing columns, which points at the wrong thing entirely.
   */
  it("gunzips a compressed catalogue rather than decoding it as text", async () => {
    const body = "Sku\tName\tUrl\nAND-1\tVictory V4\thttps://example.com\n"
    list.mockResolvedValue([entry("catalogue.csv.gz")])
    get.mockResolvedValue(gzipSync(Buffer.from(body)))

    await expect(fetchAndertonsCatalogue(CONFIG)).resolves.toBe(body)
  })

  it("says what it saw when the directory holds no catalogue at all", async () => {
    list.mockResolvedValue([entry("readme.pdf"), entry("logs", "d")])

    await expect(fetchAndertonsCatalogue(CONFIG)).rejects.toThrow(/readme\.pdf/)
  })

  /** A leaked SSH connection is a socket held open until the process dies. */
  it("closes the connection even when the download fails", async () => {
    list.mockResolvedValue([entry("catalogue.csv")])
    get.mockRejectedValue(new Error("permission denied"))

    await expect(fetchAndertonsCatalogue(CONFIG)).rejects.toThrow(/permission denied/)
    expect(end).toHaveBeenCalled()
  })

  it("does not let a failure to close mask the real error", async () => {
    list.mockResolvedValue([entry("catalogue.csv")])
    get.mockRejectedValue(new Error("permission denied"))
    end.mockRejectedValue(new Error("socket already gone"))

    await expect(fetchAndertonsCatalogue(CONFIG)).rejects.toThrow(/permission denied/)
  })
})

/**
 * Listing the drop without downloading it.
 *
 * The cheap step in front of the expensive one. A pull is 27,052 rows against
 * a 300 second ceiling, so a rejected login or a wrong directory surfaces as a
 * slow failure that reads exactly like the size problem it is not.
 */
describe("listing the Anderton's drop", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    connect.mockResolvedValue(undefined)
    end.mockResolvedValue(undefined)
  })

  it("reports the file a pull would take, chosen by the same rule the pull uses", async () => {
    list.mockResolvedValue([entry("andertons-2026-08-10.csv"), entry("andertons-2026-08-11.csv")])

    const listing = await listAndertonsDrop(CONFIG)

    expect(listing.connected).toBe(true)
    expect(listing.chosen).toBe("andertons-2026-08-11.csv")
  })

  it("downloads nothing", async () => {
    list.mockResolvedValue([entry("catalogue.csv")])

    await listAndertonsDrop(CONFIG)

    expect(get).not.toHaveBeenCalled()
  })

  /*
   * A drop that turns out to be one directory per date is a path problem, and
   * an empty file list would hide it. Directories are listed by name so the
   * next thing to try is visible rather than deduced.
   */
  it("shows directories too, so a wrong path is visible rather than empty", async () => {
    list.mockResolvedValue([entry("2026-08-11", "d"), entry("readme.txt")])

    const listing = await listAndertonsDrop(CONFIG)

    expect(listing.files.map((f) => f.name)).toContain("2026-08-11/")
  })

  it("reports no chosen file rather than guessing when none looks like a catalogue", async () => {
    list.mockResolvedValue([entry("readme.pdf")])

    const listing = await listAndertonsDrop(CONFIG)

    expect(listing.chosen).toBeNull()
    expect(listing.connected).toBe(true)
  })

  it("closes the connection", async () => {
    list.mockResolvedValue([entry("catalogue.csv")])
    await listAndertonsDrop(CONFIG)
    expect(end).toHaveBeenCalled()
  })
})
