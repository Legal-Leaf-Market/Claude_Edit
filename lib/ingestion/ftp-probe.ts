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
