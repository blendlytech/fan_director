import type { AiProviders, CompletionProvider, CompletionRequest, CompletionResult, Usage } from './provider'

/**
 * OpenRouter, the one host for every AI call (doc 11 §5.6 item 24).
 *
 * - `data_collection: "deny"`: only hosts that don't keep or train on prompts.
 * - The Director lets OpenRouter choose among those hosts (fallbacks allowed).
 * - The classifier is pinned to Groq with no fallback, as chosen at Gate 0.
 * - `require_parameters`: a host that can't honour the JSON schema isn't used.
 *
 * Nothing here logs the key, the prompt or the reply.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

export function openRouterProviders(apiKey: string, fetcher: typeof fetch = fetch): AiProviders {
  const provider = new OpenRouterProvider(apiKey, fetcher)
  return { director: provider, classifier: provider }
}

export class OpenRouterProvider implements CompletionProvider {
  readonly name = 'openrouter'
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const started = Date.now()
    const body = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      response_format: req.schema
        ? { type: 'json_schema', json_schema: { name: req.schemaName, strict: true, schema: req.schema } }
        : { type: 'json_object' },
      provider:
        req.routing === 'groq'
          ? { order: ['groq'], allow_fallbacks: false, data_collection: 'deny' }
          : { require_parameters: true, data_collection: 'deny', allow_fallbacks: true },
      usage: { include: true },
    }
    let res: Response
    try {
      res = await this.fetcher(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Fan Director Studio' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(req.timeoutMs),
      })
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
      return { ok: false, kind: timedOut ? 'timeout' : 'network', status: null, usage: null, latencyMs: Date.now() - started }
    }

    let payload: Record<string, any> | null = null
    try {
      payload = (await res.json()) as Record<string, any>
    } catch {
      payload = null
    }
    const latencyMs = Date.now() - started
    const usage = usageOf(payload)
    if (!res.ok || payload === null || payload.error) {
      const kind = res.status === 429 ? 'rate_limited' : res.ok && payload === null ? 'empty' : 'http'
      return { ok: false, kind, status: res.status, usage, latencyMs }
    }
    const content = payload.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim() === '') {
      return { ok: false, kind: 'empty', status: res.status, usage, latencyMs }
    }
    return { ok: true, content, usage, upstream: typeof payload.provider === 'string' ? payload.provider : null, latencyMs }
  }
}

function usageOf(payload: Record<string, any> | null): Usage {
  const u = payload?.usage
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
  const cost = num(u?.cost)
  return {
    inputTokens: num(u?.prompt_tokens),
    outputTokens: num(u?.completion_tokens),
    costMicroUsd: cost === null ? null : Math.ceil(cost * 1_000_000),
  }
}
