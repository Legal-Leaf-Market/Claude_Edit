import net from "node:net"

/**
 * Ask an FTP host what it actually speaks, before trying to log into it.
 *
 * WHY THIS EXISTS. The Anderton's pull reached Impact's server and came back
 * with "431 Service is unavailable". 431 is not a login failure: it is RFC
 * 2228's security range ("need some unavailable resource to process
 * security"), returned in reply to the AUTH TLS command that `basic-ftp`
 * sends when `secure: true`. So the server is refusing the TLS negotiation
 * itself, and the question is what it wants instead: explicit FTPS on a
 * different port, implicit FTPS on 990, plain FTP, or SFTP over SSH, which is
 * a completely different protocol that `basic-ftp` cannot speak at all.
 *
 * Guessing between those costs a deploy cycle each time. Asking costs one.
 * This is the same discipline section 3 applies to the eBay feed and the
 * Anderton's header row: read what the server actually sends rather than
 * writing code against an assumption about it.
 *
 * IT NEVER SENDS A CREDENTIAL. No USER, no PASS, on any port, under any
 * outcome. A probe that logged in would put the password on a plaintext wire
 * on exactly the connection whose security is in question, which is the one
 * thing worth avoiding here. It sends FEAT and AUTH TLS, reads the replies,
 * and quits.
 */

export type PortProbe = {
  port: number
  /** What we expected to find here, so a reader can interpret the transcript. */
  expecting: string
  reached: boolean
  /** Everything the server said, verbatim, in order. */
  transcript: string[]
  error?: string
}

export type ProbeResult = {
  host: string
  ports: PortProbe[]
  /** A plain-English reading of the transcripts. Never the whole story. */
  reading: string
}

/** FTP replies are complete when a line starts with the code and a space. */
function isCompleteReply(buffer: string): boolean {
  const lines = buffer.split(/\r?\n/).filter(Boolean)
  const last = lines[lines.length - 1]
  return Boolean(last && /^\d{3} /.test(last))
}

/**
 * Run a fixed command script against one port and collect what comes back.
 *
 * Commands are only ever sent after a complete reply to the previous one, so
 * a server that answers slowly is waited for rather than talked over.
 */
function probePort(
  host: string,
  port: number,
  expecting: string,
  commands: string[],
  timeoutMs: number,
): Promise<PortProbe> {
  return new Promise((resolve) => {
    const transcript: string[] = []
    let buffer = ""
    let sent = 0
    let settled = false
    let reached = false

    const socket = net.createConnection({ host, port, timeout: timeoutMs })
    socket.setEncoding("utf8")

    const finish = (error?: string) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve({ port, expecting, reached, transcript, error })
    }

    socket.on("connect", () => {
      reached = true
    })

    socket.on("data", (chunk: string) => {
      buffer += chunk

      /*
       * An SSH server identifies itself the instant the socket opens and never
       * speaks FTP. Recognising that here is the whole point of probing 22:
       * it is the difference between a configuration fix and needing an
       * entirely different client library.
       */
      if (/^SSH-/.test(buffer)) {
        transcript.push(buffer.trim())
        finish()
        return
      }

      if (!isCompleteReply(buffer)) return

      transcript.push(buffer.trim())
      buffer = ""

      if (sent < commands.length) {
        const command = commands[sent++]
        transcript.push(`>>> ${command}`)
        socket.write(`${command}\r\n`)
      } else {
        finish()
      }
    })

    socket.on("timeout", () => finish(reached ? "Connected, then the server went quiet." : "Connection timed out."))
    socket.on("error", (error: NodeJS.ErrnoException) => finish(`${error.code ?? "error"}: ${error.message}`))
    socket.on("close", () => finish())
  })
}

/**
 * Read the transcripts and say what they mean.
 *
 * Deliberately hedged wording throughout. This reports what the server said,
 * and a reading of it, rather than a verdict: the transcripts are included so
 * the reading can be checked rather than trusted, the same way the Ask
 * assistant carries the lookups behind its answers (section 14).
 */
export function interpret(ports: PortProbe[]): string {
  const byPort = new Map(ports.map((p) => [p.port, p]))
  const all = (p: PortProbe | undefined) => (p?.transcript ?? []).join(" ")

  const ssh = ports.find((p) => /^SSH-/m.test(all(p)))
  if (ssh) {
    return `Port ${ssh.port} answered with an SSH banner, so this drop is SFTP rather than FTP. basic-ftp cannot speak SFTP at all: that needs an SSH client (ssh2-sftp-client), and the credential pair is an SSH login rather than an FTP one.`
  }

  const explicit = byPort.get(21)
  const explicitText = all(explicit)
  if (explicit?.reached) {
    if (/^234|\n234| 234 /.test(explicitText)) {
      return "Port 21 accepted AUTH TLS (234). Explicit FTPS is supported and the original 431 was probably transient or rate limited, so the existing client is right and the pull is worth simply retrying."
    }
    if (/431|534|500|502|504/.test(explicitText)) {
      const implicit = byPort.get(990)
      if (implicit?.reached) {
        return "Port 21 refused AUTH TLS but port 990 accepted a connection, which is the implicit-FTPS port. Switch the client to secure: \"implicit\" on 990 rather than explicit TLS on 21."
      }
      return "Port 21 refused AUTH TLS and nothing answered on 990 or 22. The server may only offer plaintext FTP, which is not something to switch to silently: sending this credential in clear is a decision to take deliberately, not a fallback to bury in a catch block. Check the FEAT reply above for what it does advertise."
    }
    return "Port 21 answered but the replies do not clearly say which security modes it supports. The FEAT listing above is the authoritative answer."
  }

  const anyReached = ports.filter((p) => p.reached)
  if (anyReached.length === 0) {
    return "Nothing answered on any port. Either outbound FTP is blocked from this runtime, or the host is wrong. Note that a serverless runtime blocking outbound TCP would look exactly like this."
  }

  return `Port 21 did not answer, but ${anyReached.map((p) => p.port).join(" and ")} did. Read the transcripts above.`
}

/**
 * Turn an FTP failure into the next thing to actually do.
 *
 * Kept as a pure function on a string so it is testable, and separate from the
 * route so the wording can be fixed without touching the request handling.
 *
 * The reply codes matter more than the text here. FTP servers write whatever
 * prose they like beside a code, and Impact's "431 Service is unavailable"
 * reads like an outage while the code says something much more specific.
 */
export function explainFtpFailure(message: string, host: string): string {
  /*
   * SSH FIRST, because the transport is SFTP now and these branches were all
   * written for FTP reply codes.
   *
   * This function fell through to its generic ending on the first real SFTP
   * failure, which is the same staleness it exists to prevent: an explainer
   * that silently stops explaining is worse than no explainer, because the
   * fallback text ("if it failed fast, the message above is the whole story")
   * reads like a considered verdict rather than a shrug.
   */
  if (/All configured authentication methods failed/i.test(message)) {
    return [
      `${host} accepted the SSH connection and rejected the login, so the host, the port and the network are all fine and this is the credential alone.`,
      `Two things to check, in this order. First, that the pair came from "Email Product Catalog FTP Username and Password" in the Impact platform (Technical Settings permission required) rather than being the Impact account login: they are different credentials and only the mailed pair works here.`,
      `Second, whether Impact issued a KEY rather than a password for this account. This client currently authenticates by password only, and a key would fail in exactly this way with nothing in the message to say so.`,
    ].join(" ")
  }

  if (/no matching (key exchange|host key|cipher|MAC)/i.test(message)) {
    return `${host} is running Apache SSHD and could not agree an algorithm with this client. That is a configuration mismatch rather than a credential problem: the fix is naming the algorithms the server offers, and the message above says which family failed.`
  }

  if (/Timed out while waiting for handshake/i.test(message)) {
    return `The TCP connection to ${host} opened but no SSH handshake followed, which usually means the port is right for something that is not SSH. Press "Ask the server" below: it reads the banner on 21, 990 and 22 without sending a credential.`
  }

  /*
   * An SFTP list of a directory that is not there throws ENOENT rather than
   * anything resembling an FTP path error, and it happens after a SUCCESSFUL
   * login, which makes it one of the more misleading fast failures available.
   */
  if (/No such file|ENOENT/i.test(message)) {
    return `The SSH login SUCCEEDED and the path is what failed: ${host} has no such directory. IMPACT_ANDERTONS_FTP_PATH is the thing to change, and the "Download via FTP" panel in the Impact platform names the real one. Press "List the drop" after changing it.`
  }

  if (/Permission denied/i.test(message)) {
    return `The SSH login succeeded but this account may not read that directory. That is a permissions question for Impact rather than a setting here: the credential works, so ask which path it is entitled to.`
  }

  /*
   * RFC 2228's security range. 431 in particular is the reply to AUTH TLS, so
   * it is reached BEFORE any credential is sent and cannot be a login problem
   * however much the prose sounds like one.
   *
   * The likeliest cause is not a client option at all. Impact's own partner
   * documentation says the catalogue download host is shown in the platform's
   * "Download via FTP" panel, and that the credentials are a dedicated pair
   * mailed on request rather than the Impact login. products.impact.com is
   * where BRANDS push catalogues up. Talking to the upload host with download
   * credentials would produce exactly this: a real FTP server that answers,
   * and then declines to do business with us.
   */
  if (/\b(431|534|533|522)\b/.test(message)) {
    return [
      `${host} answered, so the hostname and the network are fine, but it refused the TLS negotiation before any login was attempted. That is not a bad password: the reply comes back before the password is sent.`,
      `Two things to check in the Impact platform, in this order. First, the Host in the "Download via FTP" panel of the product catalogue page, which is the partner download server and is not necessarily ${host}. Second, whether these credentials came from "Email Product Catalog FTP Username and Password" (Technical Settings permission required), which is a dedicated pair rather than the Impact account login.`,
      `Press "Ask the server" below for what it says it supports.`,
    ].join(" ")
  }

  if (/\b(530|332)\b/.test(message)) {
    return `${host} accepted the connection and rejected the login. These need to be the catalogue FTP credentials from "Email Product Catalog FTP Username and Password" in the Impact platform, not the Impact account login.`
  }

  if (/ENOTFOUND|EAI_AGAIN/.test(message)) {
    return `${host} did not resolve. Environment values are trimmed on read now, so a stray space is no longer the cause; check the hostname itself against the "Download via FTP" panel in the Impact platform.`
  }

  if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH/.test(message)) {
    return `The connection to ${host} did not complete. Press "Ask the server" below: it tries the three ports this drop could be on and will say whether anything answers at all, which separates a blocked runtime from a wrong host.`
  }

  if (/No catalogue file/.test(message)) {
    return "The login worked and the directory is readable, so this is the path rather than the connection. The message above lists what was actually in it."
  }

  /*
   * The honest ending: this function did not recognise the failure. Say that,
   * rather than implying the message was self-explanatory. An unrecognised
   * SSH error landing here is a prompt to add a branch above, which is exactly
   * what the first real SFTP failure turned out to need.
   */
  return "This failure is not one this explainer recognises, which on the SFTP transport usually means a new branch is needed above rather than that the message is self-explanatory. If it ran for close to 300 seconds it timed out and the work belongs on the worker; if it failed fast, quote the message verbatim and it can be routed properly."
}

/**
 * Probe the three ports that could plausibly be carrying this drop.
 *
 * 21 is explicit FTPS, what the client currently tries. 990 is implicit FTPS,
 * TLS from the first byte. 22 is SSH, and an SSH banner there means the whole
 * client library is the wrong one.
 */
export async function probeFtpHost(host: string, timeoutMs = 12_000): Promise<ProbeResult> {
  const ports = await Promise.all([
    probePort(host, 21, "explicit FTPS (AUTH TLS)", ["FEAT", "AUTH TLS", "QUIT"], timeoutMs),
    probePort(host, 990, "implicit FTPS (TLS from the first byte)", [], timeoutMs),
    probePort(host, 22, "SFTP over SSH", [], timeoutMs),
  ])

  return { host, ports, reading: interpret(ports) }
}
