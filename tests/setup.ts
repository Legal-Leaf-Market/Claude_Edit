import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Load .env.local for tests.
 *
 * Deliberately hand-rolled rather than pulling in dotenv: the only thing tests
 * need from the environment is DATABASE_URL, and existing process env always
 * wins so CI can override without editing a file.
 */
const envPath = resolve(process.cwd(), ".env.local")

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (process.env[key] === undefined) process.env[key] = value
  }
}

/** True when a database is reachable for the integration-tagged suites. */
export const hasDatabase = Boolean(process.env.DATABASE_URL)
