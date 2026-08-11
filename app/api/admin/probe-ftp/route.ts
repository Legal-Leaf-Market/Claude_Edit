import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin/gate"
import { env } from "@/lib/env"
import { probeFtpHost } from "@/lib/ingestion/ftp-probe"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Ask Impact's FTP host what it speaks, from the runtime that has to talk to it.
 *
 * The pull came back "431 Service is unavailable", which is RFC 2228's
 * security range rather than a login failure: the server refused the AUTH TLS
 * command, not the credential. Four things could produce that, and they have
 * four different fixes, from a one-line client change to needing a different
 * library entirely. Rather than deploy a guess and read the next error, this
 * reads the server's own replies.
 *
 * It has to run HERE rather than from a laptop or a build sandbox, because
 * "outbound FTP is blocked from this runtime" is itself one of the candidate
 * answers and only this network can rule it out.
 *
 * NO CREDENTIAL IS SENT, on any port. See lib/ingestion/ftp-probe.ts: the
 * script is FEAT, AUTH TLS, QUIT, and nothing else. Probing a connection whose
 * security is the open question is the last place to put a password on the
 * wire to find out.
 *
 * Gated like every other /api/admin route, and POST only, because it does open
 * sockets to a third party.
 */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const host = env.impact.andertonsFtpHost
  const startedAt = Date.now()

  try {
    const result = await probeFtpHost(host)
    return NextResponse.json({
      ...result,
      seconds: Math.round((Date.now() - startedAt) / 100) / 10,
    })
  } catch (error) {
    return NextResponse.json(
      {
        host,
        error: error instanceof Error ? error.message : String(error),
        seconds: Math.round((Date.now() - startedAt) / 100) / 10,
      },
      { status: 500 },
    )
  }
}
