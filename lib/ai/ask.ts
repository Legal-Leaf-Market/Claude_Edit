import "server-only"
import { env } from "@/lib/env"
import type { SearchHit } from "@/lib/search/types"
import { runTool, TOOL_SPECS } from "@/lib/ai/tools"

/**
 * The assistant loop: Groq, plus the allowlisted database tools.
 *
 * Groq exposes an OpenAI-compatible /chat/completions endpoint, so this is a
 * plain fetch rather than an SDK. That is deliberate: the whole surface used
 * here is messages, tools and tool_calls, adding a dependency to get it would
 * be adding a dependency to save twenty lines, and a raw fetch keeps the
 * timeout and abort handling visible instead of buried in a client's defaults.
 *
 * The loop is the standard shape: send the conversation, and if the model
 * comes back with tool_calls, run them, append the results, and send again.
 * MAX_ROUNDS caps it. Two rounds covers nearly everything ("what Big Muffs are
 * under $80" is one search; "is this a good price for a Big Muff" is a market
 * price lookup then a search), and the cap exists so a model that loops on a
 * failing tool costs one wasted request rather than an unbounded number.
 */

const MAX_ROUNDS = 4
const REQUEST_TIMEOUT_MS = 25_000

/**
 * The system prompt.
 *
 * Most of it is about what NOT to say. This is a price comparison site: an
 * invented price or an invented "in stock at" is worse than no answer, because
 * a shopper will act on it and find out at the checkout. So the prompt spends
 * its length on the failure modes rather than on persona.
 */
const SYSTEM_PROMPT = `You are the assistant on Gear Avail, a music gear price aggregator. You answer questions by querying the site's own live database through the tools provided.

HARD RULES

1. Prices, availability and stock come ONLY from tool results. Never state a price, a store, or that something is in stock unless a tool in this conversation returned it. If you did not look it up, say you did not.
2. When a tool says there is no market price because the sample is too small, report exactly that. Do not estimate one, do not average the listings yourself, do not say "roughly". A market price below the site's sample floor is not published, on purpose.
3. When a search returns nothing, say nothing matched and that the catalogue only carries what its live feeds stock. Do not suggest the gear does not exist, and do not name a store that was not in a result.
4. Artist rig and record information comes only from lookup_artist_rig and find_rigs_by_record. It is a curated set, so it is incomplete. If a player is not in it, say they are not written up yet rather than answering from memory. Gear attribution from memory is exactly the kind of thing that sounds right and is wrong.
5. Signal chain order is a convention, not a law. Say what the conventional order is and why, then say that plenty of records were made by ignoring it. Power figures are typical draws by effect type, never the spec of a specific pedal, and must be described that way.
6. Never claim any artist, band or store endorses, sponsors or is affiliated with Gear Avail.

STYLE

Short. Two to five sentences for most questions. You are talking to a musician who wants an answer, not a summary of everything you found. Listings you found are shown to the user as cards underneath your answer, so do not list them again line by line: refer to them ("the cheapest one is at zZounds") and let the cards carry the detail.

Never use em dashes. Use a comma, a colon or parentheses.

Do not open with "Great question" or any variation. Answer the question.`

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

type ToolCall = {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export type AskTurn = { role: "user" | "assistant"; content: string }

export type AskResult = {
  answer: string
  /** Listings the tools returned, deduped, for the UI to render as cards. */
  hits: SearchHit[]
  /** One line per lookup actually performed, so the answer is checkable. */
  traces: string[]
}

export class AskUnavailableError extends Error {}

async function callGroq(
  messages: ChatMessage[],
  { withTools = true }: { withTools?: boolean } = {},
): Promise<{
  content: string | null
  toolCalls: ToolCall[]
}> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${env.groq.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groq.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.groq.model,
        messages,
        // Withheld on the final forced answer, so "stop asking for lookups"
        // is enforced by the request rather than left to the prompt.
        ...(withTools ? { tools: TOOL_SPECS, tool_choice: "auto" } : {}),
        // Low but not zero. Zero makes the refusals ("nothing matched") read
        // identically every time, which feels broken rather than consistent.
        temperature: 0.3,
        max_tokens: 900,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new AskUnavailableError(
        `Groq returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      )
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]
    }
    const message = data.choices?.[0]?.message
    return { content: message?.content ?? null, toolCalls: message?.tool_calls ?? [] }
  } catch (error) {
    if (error instanceof AskUnavailableError) throw error
    if (error instanceof Error && error.name === "AbortError") {
      throw new AskUnavailableError("Groq timed out")
    }
    throw new AskUnavailableError(error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timeout)
  }
}

function parseArgs(raw: string): Record<string, unknown> {
  // Models occasionally emit arguments that are not valid JSON. An empty object
  // lets the tool apply its own defaults and answer something, which beats
  // failing the turn over a stray trailing comma.
  try {
    const parsed = JSON.parse(raw || "{}")
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Answer one question, with up to MAX_ROUNDS of tool use.
 *
 * `history` is the prior turns of this conversation, already trimmed by the
 * caller. It is passed through rather than kept here because this module holds
 * no state: every request carries its own conversation, which is what lets the
 * route stay stateless and the panel keep its transcript client side.
 */
export async function ask(question: string, history: AskTurn[] = []): Promise<AskResult> {
  if (!env.groq.isConfigured) {
    throw new AskUnavailableError("GROQ_API_KEY is not set")
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: question },
  ]

  const hitsById = new Map<string, SearchHit>()
  const traces: string[] = []

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { content, toolCalls } = await callGroq(messages)

    if (toolCalls.length === 0) {
      return {
        answer: content?.trim() || "I could not put an answer together for that one.",
        hits: [...hitsById.values()],
        traces,
      }
    }

    // The assistant turn carrying the tool calls has to go back verbatim, or
    // the follow-up tool messages have nothing to attach to and the API
    // rejects the next request.
    messages.push({ role: "assistant", content, tool_calls: toolCalls })

    for (const call of toolCalls) {
      const result = await runTool(call.function.name, parseArgs(call.function.arguments))
      traces.push(result.trace)
      for (const hit of result.hits ?? []) hitsById.set(hit.id, hit)
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.summary,
      })
    }
  }

  // Out of rounds with tool calls still coming. Rather than return nothing,
  // ask once more with tools withheld so the model has to answer from what it
  // has already gathered.
  const { content } = await callGroq(
    [
      ...messages,
      {
        role: "user",
        content:
          "Answer now using only what the tools above returned. Do not request any more lookups.",
      },
    ],
    { withTools: false },
  )

  return {
    answer: content?.trim() || "I ran out of lookups on that one. Try narrowing the question.",
    hits: [...hitsById.values()],
    traces,
  }
}
