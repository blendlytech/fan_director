/**
 * The provider seam (doc 11 §8 Phase 3). The turn pipeline only talks to
 * these interfaces, so switching provider or host changes no fan-journey code.
 * Tests use the scripted mock; the Worker uses OpenRouter.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionRequest {
  model: string
  messages: ChatMessage[]
  /** A strict JSON schema for the reply, or null for a JSON object without a schema. */
  schema: Record<string, unknown> | null
  schemaName: string
  maxTokens: number
  temperature: number
  /** 'router' lets the router choose hosts; 'groq' pins the call to Groq. */
  routing: 'router' | 'groq'
  timeoutMs: number
}

export interface Usage {
  inputTokens: number | null
  outputTokens: number | null
  /** What the provider reported charging, in micro-dollars, if it said. */
  costMicroUsd: number | null
}

export type CompletionResult =
  | { ok: true; content: string; usage: Usage; upstream: string | null; latencyMs: number }
  | {
      ok: false
      /** timeout and network are ambiguous: the provider may still bill. */
      kind: 'timeout' | 'network' | 'http' | 'rate_limited' | 'empty'
      status: number | null
      usage: Usage | null
      latencyMs: number
    }

export interface CompletionProvider {
  readonly name: string
  complete(request: CompletionRequest): Promise<CompletionResult>
}

/** What the pipeline receives: one provider for the Director, one for the classifier. */
export interface AiProviders {
  director: CompletionProvider
  classifier: CompletionProvider
}

export function isAmbiguous(result: CompletionResult): boolean {
  return !result.ok && (result.kind === 'timeout' || result.kind === 'network')
}
