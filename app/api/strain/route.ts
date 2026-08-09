import { generateObject } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { z } from "zod"

export const runtime = "nodejs"

// Talk to Groq directly with the user's Groq API key (free tier), rather than
// routing through the Vercel AI Gateway (which no longer serves Groq models).
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

const StrainProfile = z.object({
  type: z
    .enum(["Sativa", "Indica", "Hybrid", "Unknown"])
    .describe("Dominant classification of the strain"),
  thca: z
    .string()
    .describe(
      'Typical THCa potency range as a percentage, e.g. "18-24%". If you know the strain\'s ' +
        "usual THC range, report that same range here labeled as THCa. NEVER answer \"N/A\" or " +
        "\"unknown\" — always give your best estimated percentage range based on the closest known " +
        "strains or typical modern hemp/cannabis flower potency.",
    ),
  effects: z.array(z.string()).min(2).max(5).describe("Common reported effects"),
  flavors: z.array(z.string()).min(2).max(5).describe("Dominant flavor / aroma notes"),
  lineage: z.string().describe('Parent genetics if known, e.g. "Gelato x Zkittlez". Use "Unknown" if unclear.'),
  description: z.string().describe("One or two concise sentences describing the strain"),
})

export type StrainProfile = z.infer<typeof StrainProfile>

// Simple in-memory cache so repeated hovers for the same strain are instant
// and don't re-bill the model. Keyed by normalized strain name.
const cache = new Map<string, StrainProfile>()

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name")?.trim()
  if (!name) {
    return Response.json({ error: "Missing strain name" }, { status: 400 })
  }

  const key = name.toLowerCase()
  const cached = cache.get(key)
  if (cached) {
    return Response.json({ name, profile: cached, cached: true })
  }

  try {
    const { object } = await generateObject({
      // Groq's GPT-OSS models are the ones that support strict json_schema
      // structured outputs (llama models do not). Free-tier eligible.
      model: groq("openai/gpt-oss-20b"),
      schema: StrainProfile,
      prompt:
        `Provide a concise, factual cannabis/hemp strain profile for the strain named "${name}". ` +
        `This is for an informational THCa hemp marketplace. Report potency as a THCa percentage ` +
        `range: if you know the strain's typical THC range, use that same range and label it THCa. ` +
        `Always provide your best estimated THCa percentage range — never "N/A"; if the strain is ` +
        `unfamiliar, estimate from the closest known strains or typical modern flower potency. ` +
        `If the name is not a recognizable strain, infer the most likely profile from the name and ` +
        `set type to "Unknown". Keep the description to one or two sentences and avoid medical claims.`,
    })

    cache.set(key, object)
    return Response.json({ name, profile: object, cached: false })
  } catch (err) {
    console.log("[v0] strain profile error:", (err as Error).message)
    return Response.json({ error: "Could not generate strain profile" }, { status: 500 })
  }
}
