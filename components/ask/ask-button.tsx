import { env } from "@/lib/env"
import { AskPanel } from "@/components/ask/ask-panel"

/**
 * Server component whose only job is the gate.
 *
 * Reading env here rather than inside the client panel means an unconfigured
 * deployment never ships the panel's JavaScript at all, and there is no way to
 * end up with a visible button that answers 503. Same shape as every other
 * isConfigured check in this codebase: the feature is absent, not broken.
 */
export function AskButton() {
  if (!env.groq.isConfigured) return null
  return <AskPanel />
}
