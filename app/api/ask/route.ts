import { NextResponse, type NextRequest } from "next/server"
import { ask, AskUnavailableError, type AskTurn } from "@/lib/ai/ask"
import { env } from "@/lib/env"
import { consumeDailyBudget } from "@/lib/ingestion/rate-limit"

export const dynamic = "force-dynamic"

/** Longest question accepted. A paragraph is a question; a page is someone testing the box. */
const MAX_QUESTION_CHARS = 500

/** How many prior turns come back with each request. Enough for follow-ups, not a transcript. */
const MAX_HISTORY_TURNS = 6

/**
 * POST /api/ask
 *
 * The assistant endpoint. Unlike /api/cron/*, this fails closed by being
 * ABSENT rather than by 503ing loudly: an unset GROQ_API_KEY is a feature that
 * is not turned on, not a misconfiguration, and the button that calls this is
 * not rendered in that case either. It still answers 503 with a plain reason
 * for anyone who finds the route directly.
 *
 * Rate limited per IP because this endpoint spends real money per call and is
 * unauthenticated by design (a shopper should be able to ask a question
 * without making an account). The counter reuses the same daily-budget helper
 * the eBay feed guard uses, so it is shared across instances when Redis is
 * configured and per-process otherwise, which is the same honest compromise
 * documented there.
 */
export async function POST(request: NextRequest) {
  if (!env.groq.isConfigured) {
    return NextResponse.json(
      { error: "The assistant is not configured on this deployment." },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const payload = body as { question?: unknown; history?: unknown }
  const question = typeof payload.question === "string" ? payload.question.trim() : ""

  if (!question) {
    return NextResponse.json({ error: "Ask something first." }, { status: 400 })
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json(
      { error: `Keep it under ${MAX_QUESTION_CHARS} characters.` },
      { status: 400 },
    )
  }

  // x-forwarded-for is spoofable, so this is a speed bump rather than a
  // control. It is the right size of defence for the risk: the ceiling on
  // abuse is the Groq bill, not data loss, and anything stronger would mean
  // putting the assistant behind a login it does not need.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"

  const budget = await consumeDailyBudget(`ask:${ip}`, env.groq.hourlyLimitPerIp).catch(() => null)
  if (budget && !budget.allowed) {
    return NextResponse.json(
      { error: "That is a lot of questions for one day. Try again tomorrow." },
      { status: 429 },
    )
  }

  const history: AskTurn[] = Array.isArray(payload.history)
    ? payload.history
        .filter(
          (turn): turn is AskTurn =>
            turn != null &&
            typeof turn === "object" &&
            (("role" in turn && (turn as AskTurn).role === "user") ||
              (turn as AskTurn).role === "assistant") &&
            typeof (turn as AskTurn).content === "string",
        )
        .slice(-MAX_HISTORY_TURNS)
        .map((turn) => ({ role: turn.role, content: turn.content.slice(0, MAX_QUESTION_CHARS) }))
    : []

  try {
    const result = await ask(question, history)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AskUnavailableError) {
      console.error(`[ask] unavailable: ${error.message}`)
      return NextResponse.json(
        { error: "The assistant is not answering right now. Search still works." },
        { status: 503 },
      )
    }
    console.error("[ask] failed:", error)
    return NextResponse.json({ error: "Something went wrong answering that." }, { status: 500 })
  }
}
