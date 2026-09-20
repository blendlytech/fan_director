/* -------------------------------------------------------------------------- */
/*  The creator's "propose changes" editor (design 05), staging only.          */
/*                                                                            */
/*  Design 05 draws a free-text "New Total". The server derives every price    */
/*  from the catalog and never accepts one (doc 11 §3 rule 3), so the staging  */
/*  editor changes the *choices* instead, and the only number the creator      */
/*  types is the price of the fan's custom request, which no catalog covers.   */
/*                                                                            */
/*  Everything here is pure. The preview uses the same shared quote module the */
/*  worker prices with, and the screen still shows the server's figures once   */
/*  the proposal comes back.                                                   */
/* -------------------------------------------------------------------------- */

import { categoryAvailable, itemAvailable } from '../../../shared/domain/catalog.ts'
import { quote } from '../../../shared/domain/quote.ts'
import { qtyRange } from '../../../shared/domain/validate.ts'
import type { Category, Item, Quote, Selection } from '../../../shared/domain/types.ts'
import type { CatalogView } from './sceneCard'

const GATE = { adultAllowed: false }

export interface ProposalChoice {
  item: Item
  selected: boolean
  qty: number
  /** Set when the item is priced per unit; the editor shows a quantity control. */
  qtyRange: { min: number; max: number } | null
}

export interface ProposalGroup {
  /** `${categoryKey}:${groupKey ?? ''}` — stable across renders. */
  id: string
  label: string
  min: number
  max: number
  /** A group that takes exactly one choice behaves like a radio set. */
  single: boolean
  choices: ProposalChoice[]
}

function selectedQty(selections: readonly Selection[], itemId: string): number | null {
  return selections.find((s) => s.itemId === itemId)?.qty ?? null
}

function itemsOf(category: Category, groupKey: string | null): Item[] {
  return category.items
    .filter((item) => itemAvailable(item, category, GATE) && (groupKey === null || item.groupKey === groupKey))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * Every choice the creator can change, grouped the way the catalog counts
 * them: per selection group where a category has groups, per category
 * otherwise. That is exactly what `validateSelections` enforces, so an editor
 * that respects these limits can't build a proposal the server will reject
 * for its counts.
 */
export function proposalGroups(view: CatalogView, selections: readonly Selection[]): ProposalGroup[] {
  const out: ProposalGroup[] = []
  for (const category of [...view.content.categories].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!categoryAvailable(category, GATE)) continue
    const slots = category.groups?.length
      ? category.groups.map((g) => ({ key: g.key as string | null, label: g.label, min: g.min, max: g.max }))
      : [{ key: null as string | null, label: category.label, min: category.selection.min, max: category.selection.max }]
    for (const slot of slots) {
      const items = itemsOf(category, slot.key)
      if (items.length === 0) continue
      out.push({
        id: `${category.key}:${slot.key ?? ''}`,
        label: slot.label,
        min: slot.min,
        max: slot.max,
        single: slot.min === 1 && slot.max === 1,
        choices: items.map((item) => {
          const qty = selectedQty(selections, item.id)
          const range = qtyRange({ item, category })
          return {
            item,
            selected: qty !== null,
            qty: qty ?? range.min,
            qtyRange: item.pricing.kind === 'per_unit' ? range : null,
          }
        }),
      })
    }
  }
  return out
}

/**
 * The selections after the creator picks or clears `itemId` in `group`.
 * A single-choice group swaps; a multi-choice group toggles and stops at its
 * maximum. Clearing an item a group needs (`min` ≥ 1) is refused, so the
 * editor can't produce a set the server would reject.
 */
export function toggleChoice(group: ProposalGroup, selections: readonly Selection[], itemId: string): Selection[] {
  const inGroup = new Set(group.choices.map((c) => c.item.id))
  const chosen = selections.filter((s) => inGroup.has(s.itemId))
  const already = chosen.some((s) => s.itemId === itemId)
  const choice = group.choices.find((c) => c.item.id === itemId)
  if (!choice) return [...selections]

  if (already) {
    if (chosen.length <= group.min) return [...selections]
    return selections.filter((s) => s.itemId !== itemId)
  }
  const qty = choice.qtyRange?.min ?? 1
  if (group.single || chosen.length >= group.max) {
    // Replace the oldest choice in a full group; a single-choice group has one.
    const dropping = new Set(chosen.slice(0, chosen.length - group.max + 1).map((s) => s.itemId))
    return [...selections.filter((s) => !dropping.has(s.itemId)), { itemId, qty }]
  }
  return [...selections, { itemId, qty }]
}

/** A new quantity for a per-unit item, clamped to what the catalog allows. */
export function setChoiceQty(group: ProposalGroup, selections: readonly Selection[], itemId: string, qty: number): Selection[] {
  const choice = group.choices.find((c) => c.item.id === itemId)
  if (!choice?.qtyRange) return [...selections]
  const clamped = Math.min(choice.qtyRange.max, Math.max(choice.qtyRange.min, Math.trunc(qty) || choice.qtyRange.min))
  return selections.map((s) => (s.itemId === itemId ? { itemId, qty: clamped } : s))
}

export type ProposalPreview =
  | { ok: true; quote: Quote; totalCents: number }
  | { ok: false; code: string }

/**
 * What these choices would cost, from the same module the worker uses. It is
 * a preview: the screen labels it as one, and the server's own quote replaces
 * it as soon as the proposal is sent.
 */
export function previewProposal(
  view: CatalogView,
  selections: readonly Selection[],
  customRequestPriceCents: number | null,
): ProposalPreview {
  const result = quote(view.content, view.versionId, { selections: [...selections], customRequest: null, budget: null }, GATE)
  if (!result.ok) return { ok: false, code: result.error.code }
  return { ok: true, quote: result.value, totalCents: result.value.total + (customRequestPriceCents ?? 0) }
}

/** Two selection sets are the same request when they hold the same items at the same quantities. */
export function sameSelections(a: readonly Selection[], b: readonly Selection[]): boolean {
  if (a.length !== b.length) return false
  const byId = new Map(b.map((s) => [s.itemId, s.qty]))
  return a.every((s) => byId.get(s.itemId) === s.qty)
}

/**
 * Dollars typed by the creator as integer cents, or `null` for "leave it
 * unpriced". `undefined` means the text isn't a price at all, and the editor
 * refuses to send.
 */
export function parsePriceDollars(text: string): number | null | undefined {
  const trimmed = text.trim().replace(/^\$/, '').replace(/,/g, '')
  if (trimmed === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return undefined
  const cents = Math.round(Number(trimmed) * 100)
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 10_000_000 ? cents : undefined
}
