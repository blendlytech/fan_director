import { HARD_LIST_KEYS, type HardListKey } from '../../../shared/domain/hardList.ts'
import { normalize } from '../rules/normalize'
import { CHILD_PATTERN } from '../rules/ruleset-v1'
import { CLASSIFIER_MODEL } from './models'
import { CLASSIFIER_PROMPT_VERSION, classifierPolicy, type ClassifierPolicyInput } from './prompts/classifier-v1'
import type { CompletionRequest } from './provider'

/**
 * The classifier layer of the hard list (doc 11 §5.3.3). It fails closed: a
 * reply that can't be read counts as "unavailable", never as "allowed".
 * Childlike always means `minors`: a `prohibited_roles` verdict is escalated
 * when the classifier says childlike or the text itself mentions a child.
 */

export const CLASSIFIER_VERSION = `${CLASSIFIER_MODEL}@${CLASSIFIER_PROMPT_VERSION}`
export const CLASSIFIER_MAX_TOKENS = 400
export const CLASSIFIER_TIMEOUT_MS = 5_000

export interface ClassifierVerdict {
  /** The hard-list key, or null when the text is allowed. */
  key: HardListKey | null
  /** Custom creator limits the text asks for (ids known to the caller only). */
  limitIds: string[]
  escalated: boolean
}

export function classifierRequest(text: string, policy: ClassifierPolicyInput): CompletionRequest {
  return {
    model: CLASSIFIER_MODEL,
    messages: [
      { role: 'system', content: classifierPolicy(policy) },
      { role: 'user', content: text },
    ],
    schema: null,
    schemaName: 'hard_list_verdict',
    maxTokens: CLASSIFIER_MAX_TOKENS,
    temperature: 0,
    routing: 'groq',
    timeoutMs: CLASSIFIER_TIMEOUT_MS,
  }
}

/** Null means the reply was unreadable: the caller must fail closed. */
export function readVerdict(content: string, text: string, knownLimitIds: ReadonlySet<string>): ClassifierVerdict | null {
  let data: unknown
  try {
    const trimmed = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
    data = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null
  const d = data as Record<string, unknown>
  if (typeof d.violation !== 'boolean') return null

  const limitIds = Array.isArray(d.limitIds)
    ? [...new Set(d.limitIds.filter((x): x is string => typeof x === 'string' && knownLimitIds.has(x)))]
    : []

  if (!d.violation) return { key: null, limitIds, escalated: false }
  // A violation without a key we know is unreadable, not "allowed".
  if (typeof d.key !== 'string' || !(HARD_LIST_KEYS as readonly string[]).includes(d.key)) return null
  let key = d.key as HardListKey
  let escalated = false
  if (key === 'prohibited_roles' && (d.childlike === true || CHILD_PATTERN.test(normalize(text).norm))) {
    key = 'minors'
    escalated = true
  }
  return { key, limitIds, escalated }
}
