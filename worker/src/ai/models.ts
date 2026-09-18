/**
 * Models and their prices (doc 11 §5.6 items 13, 14 and 24).
 *
 * The Director tries Qwen3 235B Instruct 2507 first and DeepSeek V3.2 when
 * the first call fails at the provider. The classifier is gpt-oss-safeguard
 * 20B, pinned to Groq. All three go through OpenRouter.
 *
 * Rates: micro-dollars per million tokens, from OpenRouter's public model
 * list (https://openrouter.ai/api/v1/models), fetched 2026-09-18. OpenRouter
 * may route to a host that charges more, so reservations use RESERVE_FACTOR;
 * the ledger then books what the provider actually reports.
 */

export interface ModelRate {
  inputPerMillion: number
  outputPerMillion: number
}

export const RATES_AS_OF = '2026-09-18'

export const DIRECTOR_MODELS = ['qwen/qwen3-235b-a22b-2507', 'deepseek/deepseek-v3.2'] as const
export const CLASSIFIER_MODEL = 'openai/gpt-oss-safeguard-20b'

export const RATES: Record<string, ModelRate> = {
  'qwen/qwen3-235b-a22b-2507': { inputPerMillion: 87_500, outputPerMillion: 350_000 },
  'deepseek/deepseek-v3.2': { inputPerMillion: 269_000, outputPerMillion: 400_000 },
  'openai/gpt-oss-safeguard-20b': { inputPerMillion: 75_000, outputPerMillion: 300_000 },
}

/** Headroom for pricier upstream hosts and token-count estimates. */
export const RESERVE_FACTOR = 2

/** Used when a model has no rate on file: expensive on purpose, so it's never underestimated. */
const UNKNOWN_RATE: ModelRate = { inputPerMillion: 5_000_000, outputPerMillion: 15_000_000 }

export function rateOf(model: string): ModelRate {
  return RATES[model] ?? UNKNOWN_RATE
}

/** A rough token count: about 3 characters per token, rounded up. Errs high. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3)
}

/** The most a call can cost: every input token plus the full output allowance. */
export function reservationFor(model: string, promptChars: number, maxTokens: number): number {
  const rate = rateOf(model)
  const input = Math.ceil(promptChars / 3)
  return Math.ceil(((input * rate.inputPerMillion + maxTokens * rate.outputPerMillion) / 1_000_000) * RESERVE_FACTOR)
}

/** The cost when the provider didn't report one: tokens × rate. */
export function costFromTokens(model: string, inputTokens: number, outputTokens: number): number {
  const rate = rateOf(model)
  return Math.ceil((inputTokens * rate.inputPerMillion + outputTokens * rate.outputPerMillion) / 1_000_000)
}
