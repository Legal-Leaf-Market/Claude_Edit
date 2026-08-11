import { describe, expect, it } from "vitest"
import { interpret, type PortProbe } from "@/lib/ingestion/ftp-probe"

/**
 * The probe's reading of an FTP server's replies.
 *
 * Only `interpret` is tested, because it is the only part with a decision in
 * it. The socket half is a fixed command script against a real host and there
 * is nothing to assert about it that would not just be asserting that node:net
 * works.
 *
 * What matters here is that a reading never points at the wrong fix. Telling
 * someone to switch to implicit FTPS when the drop is actually SFTP costs a
 * deploy cycle, which is the exact cost this whole probe exists to avoid.
 */

function probe(port: number, overrides: Partial<PortProbe> = {}): PortProbe {
  return { port, expecting: "", reached: true, transcript: [], ...overrides }
}

describe("interpret", () => {
  /**
   * The one that changes the most. An SSH banner means basic-ftp is the wrong
   * library outright, not a wrong option on the right library, so it is
   * checked before anything else and beats every other signal.
   */
  it("calls out SFTP the moment it sees an SSH banner", () => {
    const reading = interpret([
      probe(21, { reached: false, error: "ECONNREFUSED" }),
      probe(990, { reached: false }),
      probe(22, { transcript: ["SSH-2.0-OpenSSH_8.9p1"] }),
    ])
    expect(reading).toMatch(/SFTP/)
    expect(reading).toMatch(/ssh2-sftp-client/)
    expect(reading).not.toMatch(/implicit/)
  })

  it("says to retry when AUTH TLS is actually accepted", () => {
    const reading = interpret([
      probe(21, { transcript: ["220 Impact FTP", ">>> FEAT", "211-Features:\r\n AUTH TLS\r\n211 End", ">>> AUTH TLS", "234 AUTH TLS OK."] }),
      probe(990, { reached: false }),
      probe(22, { reached: false }),
    ])
    expect(reading).toMatch(/retry/i)
    expect(reading).not.toMatch(/implicit/)
  })

  /** The live symptom: 431 on 21, with 990 answering. */
  it("points at implicit FTPS when 21 refuses security but 990 answers", () => {
    const reading = interpret([
      probe(21, { transcript: ["220 Ready", ">>> AUTH TLS", "431 Service is unavailable."] }),
      probe(990, { reached: true }),
      probe(22, { reached: false }),
    ])
    expect(reading).toMatch(/implicit/)
    expect(reading).toMatch(/990/)
  })

  /**
   * Plaintext FTP is never recommended as a fallback, only named as a
   * possibility with the decision left to a human. Silently downgrading would
   * put this credential in clear on the public internet, which is not a
   * choice to make inside a catch block.
   */
  it("refuses to recommend plaintext when nothing else answers", () => {
    const reading = interpret([
      probe(21, { transcript: ["220 Ready", ">>> AUTH TLS", "431 Service is unavailable."] }),
      probe(990, { reached: false }),
      probe(22, { reached: false }),
    ])
    expect(reading).toMatch(/plaintext/)
    expect(reading).toMatch(/deliberately|decision/)
    expect(reading).not.toMatch(/switch to plaintext|use plaintext/i)
  })

  /**
   * A serverless runtime with outbound TCP blocked looks identical to a dead
   * host, and the reading has to say so rather than blaming the host.
   */
  it("does not blame the hostname when nothing answers at all", () => {
    const reading = interpret([
      probe(21, { reached: false, error: "Connection timed out." }),
      probe(990, { reached: false }),
      probe(22, { reached: false }),
    ])
    expect(reading).toMatch(/blocked/)
    expect(reading).toMatch(/host is wrong/)
  })
})
