import { isAdult, type IndexedItem } from '../../../shared/domain/catalog.ts'
import { normalize } from '../rules/normalize'
import { checkText } from '../rules/check'

/**
 * Did the fan ask for something intimate? (doc 11 §8 Phase 3: "strip adult
 * items from an option unless the fan's message asked for something
 * intimate".) Deterministic, versioned, and only consulted when adult content
 * is allowed, which is never in a deployed environment (§5.4).
 *
 * Yes when the message uses the explicit-content words of the rules layer, or
 * names one of the adult items on offer.
 */
export const INTIMATE_CHECK_VERSION = 'intimate-v1'

const EXPLICIT = { limits: { checklist: { non_explicit_only: { enabled: true, mode: 'hard_no' as const } } } }

export function mentionsIntimate(message: string, allowed: readonly IndexedItem[]): boolean {
  if (checkText(message, EXPLICIT).limits.length > 0) return true
  const norm = ` ${normalize(message).norm} `
  return allowed.some((e) => {
    if (!isAdult(e.item, e.category)) return false
    const label = normalize(e.item.label).norm.trim()
    return label.length >= 3 && norm.includes(` ${label} `)
  })
}
