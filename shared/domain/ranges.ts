import { categoryAvailable, itemAvailable, type IndexedItem } from './catalog.ts'
import { quote } from './quote.ts'
import type { CatalogContent, Cents, GateOptions, Selection, Template } from './types.ts'
import { qtyRange, validateSelections } from './validate.ts'

/** Above this many combinations a range isn't computed; publishing such a catalog is refused. */
export const MAX_RANGE_COMBINATIONS = 50_000

/**
 * One selection slot: a group, or a category without groups. Its choices are
 * every allowed set of its visible items, at every allowed quantity.
 */
function slotChoices(entries: IndexedItem[], min: number, max: number): Selection[][] {
  const choices: Selection[][] = []
  const walk = (start: number, picked: Selection[]) => {
    if (picked.length >= min && picked.length <= max) choices.push(picked)
    if (picked.length === max) return
    for (let i = start; i < entries.length; i++) {
      const range = qtyRange(entries[i])
      for (let qty = range.min; qty <= range.max; qty++) {
        walk(i + 1, [...picked, { itemId: entries[i].item.id, qty }])
      }
    }
  }
  walk(0, [])
  return choices
}

function slotsOf(content: CatalogContent, opts: GateOptions): { entries: IndexedItem[]; min: number; max: number }[] {
  const slots: { entries: IndexedItem[]; min: number; max: number }[] = []
  for (const category of content.categories) {
    if (!categoryAvailable(category, opts)) continue
    const visible = category.items
      .filter((item) => itemAvailable(item, category, opts))
      .map((item) => ({ item, category }))
    if (category.groups?.length) {
      for (const g of category.groups) {
        slots.push({ entries: visible.filter((e) => e.item.groupKey === g.key), min: g.min, max: g.max })
      }
    } else {
      slots.push({ entries: visible, min: category.selection.min, max: category.selection.max })
    }
  }
  return slots
}

/**
 * The cheapest and dearest valid total with `fixedItemId` chosen (for example
 * one setting), derived from the catalog's selection groups (Gate 0 decision
 * 2). Every combination is validated and quoted, so requires/excludes, the
 * resale rule and percentage lines are all respected. Returns null if nothing
 * valid can be built, or if the catalog has too many combinations.
 */
export function priceRange(
  content: CatalogContent,
  fixedItemId: string,
  opts: GateOptions,
): { min: Cents; max: Cents } | null {
  const all = slotsOf(content, opts)
  if (!all.some((slot) => slot.entries.some((e) => e.item.id === fixedItemId))) return null
  const slots = all.map((slot) => {
    const fixed = slot.entries.find((e) => e.item.id === fixedItemId)
    if (!fixed) return slotChoices(slot.entries, slot.min, slot.max)
    // The fixed item's slot offers only the choices that contain it.
    return slotChoices(slot.entries, slot.min, slot.max).filter((c) => c.some((s) => s.itemId === fixedItemId))
  })
  const count = slots.reduce((n, choices) => n * choices.length, 1)
  if (count === 0 || count > MAX_RANGE_COMBINATIONS) return null

  let min = Infinity
  let max = -Infinity
  const walk = (i: number, picked: Selection[]) => {
    if (i === slots.length) {
      const q = quote(content, '', { selections: picked, customRequest: null, budget: null }, opts)
      if (q.ok) {
        min = Math.min(min, q.value.total)
        max = Math.max(max, q.value.total)
      }
      return
    }
    for (const choice of slots[i]) walk(i + 1, [...picked, ...choice])
  }
  walk(0, [])
  return Number.isFinite(min) ? { min, max } : null
}

/** How many combinations `priceRange` would walk. Used by the publish check. */
export function combinationCount(content: CatalogContent, opts: GateOptions): number {
  return slotsOf(content, opts).reduce((n, slot) => n * slotChoices(slot.entries, slot.min, slot.max).length, 1)
}

/** The visible items a new draft starts with, at their lowest quantity. */
export function defaultSelections(content: CatalogContent, opts: GateOptions): Selection[] {
  const picks: Selection[] = []
  for (const category of content.categories) {
    for (const item of category.items) {
      if (item.isDefault && itemAvailable(item, category, opts)) {
        picks.push({ itemId: item.id, qty: qtyRange({ item, category }).min })
      }
    }
  }
  return picks
}

/**
 * Templates a fan may start from: visible, allowed by the adult gate, and
 * still valid against this version. An invalid template is hidden, never
 * repaired (doc 11 §5.7).
 */
export function validTemplates(content: CatalogContent, opts: GateOptions): Template[] {
  return content.templates
    .filter((t) => !t.hidden && (t.contentRating === 'general' || opts.adultAllowed))
    .filter((t) => validateSelections(content, t.selections, opts).ok)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
