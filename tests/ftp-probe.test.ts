import { describe, expect, it } from "vitest"
import { explainFtpFailure, interpret, type PortProbe } from "@/lib/ingestion/ftp-probe"

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

/* -------------------------------------------------------------------------- */

/**
 * What an FTP failure tells somebody to go and do next.
 *
 * These assert on the ACTION each message points at, not on its prose, because
 * the prose will get rewritten and the routing is the part that can be wrong.
 * The cost of a wrong routing is a person changing the wrong setting and
 * redeploying to find out, which is the whole thing this is here to stop.
 */
describe("explainFtpFailure", () => {
  /**
   * The live symptom. The prose says "Service is unavailable", which reads as
   * an outage and would send somebody off to wait; the code says the server
   * declined the security negotiation before a password was ever sent.
   */
  it("does not let 431 be mistaken for an outage or a bad password", () => {
    const hint = explainFtpFailure("431 Service is unavailable.", "products.impact.com")
    expect(hint).toMatch(/before any login|before the password is sent/)
    expect(hint).toMatch(/not a bad password/i)
    // The two things actually worth checking, both inside the Impact platform.
    expect(hint).toMatch(/Download via FTP/)
    expect(hint).toMatch(/Email Product Catalog FTP Username and Password/)
  })

  /** A real login rejection routes to the credentials and nothing else. */
  it("sends a 530 to the credentials rather than the hostname", () => {
    const hint = explainFtpFailure("530 Login incorrect.", "products.impact.com")
    expect(hint).toMatch(/rejected the login/)
    expect(hint).toMatch(/not the Impact account login/)
    expect(hint).not.toMatch(/did not resolve/)
  })

  /**
   * The trim shipped, so whitespace is no longer a live theory and repeating
   * it would send somebody to re-check a thing that cannot be wrong.
   */
  it("stops blaming whitespace for ENOTFOUND now that values are trimmed", () => {
    const hint = explainFtpFailure("getaddrinfo ENOTFOUND products.impact.com", "products.impact.com")
    expect(hint).toMatch(/trimmed on read/)
    expect(hint).toMatch(/no longer the cause/)
  })

  it("routes a dead connection to the probe, which can tell a blocked runtime from a wrong host", () => {
    for (const code of ["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET"]) {
      expect(explainFtpFailure(`connect ${code} 35.245.108.230:21`, "products.impact.com")).toMatch(
        /Ask the server/,
      )
    }
  })

  /** Logged in fine, wrong directory: a path problem, not a connection one. */
  it("separates an empty directory from a connection failure", () => {
    const hint = explainFtpFailure("No catalogue file in /Andertons-Music-Company/. Saw: (empty directory)", "h")
    expect(hint).toMatch(/path rather than the connection/)
  })

  it("falls back to the timeout reading when it recognises nothing", () => {
    expect(explainFtpFailure("something nobody has seen before", "h")).toMatch(/300 seconds/)
  })
})

/**
 * SSH failures, which this explainer could not read at all until the drop
 * turned out to be SFTP.
 *
 * Every branch here was originally written against FTP reply codes, so the
 * first real SFTP failure fell through to the generic ending. That ending
 * said "if it failed fast, the message above is the whole story", which reads
 * like a verdict and was actually a shrug. These pin the four SSH failures
 * worth telling apart, and all four are distinguished by what they imply
 * about the CREDENTIAL: two of them mean it worked.
 */
describe("explainFtpFailure on the SFTP transport", () => {
  const HOST = "products.impact.com"

  it("separates a rejected SSH login from a network problem", () => {
    const explained = explainFtpFailure("All configured authentication methods failed", HOST)
    expect(explained).toMatch(/rejected the login/i)
    expect(explained).toMatch(/Email Product Catalog FTP Username and Password/)
  })

  /*
   * The one that would otherwise take longest to guess: ssh2 authenticates by
   * password here, and a key-based account fails identically to a wrong
   * password with nothing in the message saying so.
   */
  it("raises the possibility of a key rather than a password", () => {
    expect(explainFtpFailure("All configured authentication methods failed", HOST)).toMatch(/key/i)
  })

  /*
   * The most misleading fast failure available: it happens AFTER a successful
   * login, so blaming the credential sends the reader at the wrong thing.
   */
  it("says the login worked when the directory is the thing missing", () => {
    const explained = explainFtpFailure("No such file /Andertons-Music-Company/", HOST)
    expect(explained).toMatch(/SUCCEEDED|succeeded/)
    expect(explained).toMatch(/IMPACT_ANDERTONS_FTP_PATH/)
  })

  it("says the login worked when the directory is unreadable", () => {
    expect(explainFtpFailure("Permission denied", HOST)).toMatch(/succeeded/i)
  })

  it("names an algorithm mismatch as configuration rather than credentials", () => {
    expect(explainFtpFailure("Handshake failed: no matching key exchange algorithm", HOST)).toMatch(
      /mismatch|configuration/i,
    )
  })

  /*
   * The FTP branches still have to work: the probe reads raw banners and can
   * still surface a 431 from port 21.
   */
  it("still routes the FTP reply codes it was written for", () => {
    expect(explainFtpFailure("431 Service is unavailable", HOST)).toMatch(/before any login/i)
    expect(explainFtpFailure("530 Access denied", HOST)).toMatch(/rejected the login/i)
  })

  it("admits when it does not recognise a failure, rather than implying it is obvious", () => {
    const explained = explainFtpFailure("something nobody has seen before", HOST)
    expect(explained).toMatch(/not one this explainer recognises/i)
  })
})
