import type { AiProviders, CompletionProvider, CompletionRequest, CompletionResult } from './provider'

/**
 * A scripted provider for tests. Each call takes the next queued step; an
 * empty queue answers with `fallback`. Every request is recorded, so a test
 * can prove what was (or wasn't) sent to the model.
 */
export type MockStep =
  | { reply: string | Record<string, unknown>; costMicroUsd?: number; upstream?: string }
  | { fail: 'timeout' | 'network' | 'http' | 'rate_limited' | 'empty' }
  | ((req: CompletionRequest) => MockStep)

export class MockProvider implements CompletionProvider {
  readonly name = 'mock'
  readonly calls: CompletionRequest[] = []
  private queue: MockStep[] = []

  constructor(private fallback: MockStep = { fail: 'http' }) {}

  push(...steps: MockStep[]): this {
    this.queue.push(...steps)
    return this
  }

  setFallback(step: MockStep): this {
    this.fallback = step
    return this
  }

  reset(): this {
    this.queue = []
    this.calls.length = 0
    return this
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.calls.push(req)
    let step = this.queue.shift() ?? this.fallback
    while (typeof step === 'function') step = step(req)
    if ('fail' in step) {
      return { ok: false, kind: step.fail, status: step.fail === 'rate_limited' ? 429 : null, usage: null, latencyMs: 1 }
    }
    const content = typeof step.reply === 'string' ? step.reply : JSON.stringify(step.reply)
    return {
      ok: true,
      content,
      usage: { inputTokens: 100, outputTokens: 50, costMicroUsd: step.costMicroUsd ?? 20 },
      upstream: step.upstream ?? 'MockHost',
      latencyMs: 1,
    }
  }
}

export function mockProviders(): { providers: AiProviders; director: MockProvider; classifier: MockProvider } {
  const director = new MockProvider()
  // The classifier allows by default; tests queue violations explicitly.
  const classifier = new MockProvider({ reply: { violation: false, key: null, childlike: false, limitIds: [] } })
  return { providers: { director, classifier }, director, classifier }
}
