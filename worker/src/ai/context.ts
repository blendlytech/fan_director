import { hardListLines, HARD_LIST_KEYS } from '../../../shared/domain/hardList.ts'
import { slotOf } from '../../../shared/domain/director.ts'
import { isAdult, type IndexedItem } from '../../../shared/domain/catalog.ts'
import type { CatalogContent, Selection } from '../../../shared/domain/types.ts'

/**
 * What the provider sees (doc 11 §8 Phase 3, "Context sent to the provider").
 * Fan-facing fields only: never internal flags (Phase 0 leaked "synthetic
 * performer" this way), contact details, payment data or other fans' data.
 * Ask-me limits stay on the server, which attaches those flags itself.
 */

export interface ContextInput {
  content: CatalogContent
  creatorName: string
  partners: string[]
  /** The enum for this turn, in catalog order. */
  allowed: IndexedItem[]
  /** Labels of the creator's hard-no limits, as the fan sees them. */
  doesNotOffer: string[]
  fanName: string | null
  current: Selection[]
  /** Earlier fan messages in this draft's conversation, oldest first. */
  earlierMessages: string[]
  /** What the fan did with earlier suggestions: titles only. */
  decisions: { title: string; status: 'accepted' | 'declined' }[]
  message: string
}

const EARLIER_MESSAGES = 3
const EARLIER_CHARS = 300

export function providerContext(input: ContextInput): Record<string, unknown> {
  const allowedIds = new Set(input.allowed.map((e) => e.item.id))
  const catalog = input.content.categories
    .map((category) => {
      const items = input.allowed.filter((e) => e.category === category)
      if (items.length === 0) return null
      const groups = new Map<string, { min: number; max: number }>()
      for (const e of items) {
        const g = category.groups?.find((x) => x.key === e.item.groupKey)
        groups.set(slotOf(e.item, category), g ? { min: g.min, max: g.max } : category.selection)
      }
      return {
        category: category.label,
        choose: [...groups].map(([slot, r]) => ({ group: slot, rule: r.min === r.max ? `exactly ${r.min}` : `${r.min} to ${r.max}` })),
        items: items.map((e) => ({
          id: e.item.id,
          label: e.item.label,
          ...(e.item.description ? { description: e.item.description } : {}),
          group: slotOf(e.item, category),
          ...(e.item.pricing.kind === 'per_unit' ? { maxQty: e.item.pricing.maxQty } : {}),
          ...(isAdult(e.item, category) ? { rating: 'adult' } : {}),
          priceCents: priceOf(e),
        })),
      }
    })
    .filter((c) => c !== null)

  const labels = new Map(input.allowed.map((e) => [e.item.id, e.item.label]))
  return {
    creator: input.creatorName,
    verifiedPartners: input.partners,
    fanName: input.fanName,
    catalog,
    currentDraft: input.current
      .filter((s) => allowedIds.has(s.itemId))
      .map((s) => ({ itemId: s.itemId, label: labels.get(s.itemId), qty: s.qty })),
    creatorDoesNotOffer: input.doesNotOffer,
    platformRules: HARD_LIST_KEYS.flatMap((k) => hardListLines(k, input.creatorName)),
    conversationSoFar: {
      earlierFanMessages: input.earlierMessages.slice(-EARLIER_MESSAGES).map((m) => m.slice(0, EARLIER_CHARS)),
      earlierSuggestions: input.decisions.slice(-4),
    },
    fanMessage: input.message,
  }
}

function priceOf(e: IndexedItem): number | string {
  const p = e.item.pricing
  if (p.kind === 'fixed') return p.amount
  if (p.kind === 'per_unit') return p.amountPerUnit
  if (p.kind === 'included') return 0
  return `+${p.basisPoints / 100}%`
}
