import { categoryAvailable, indexItems, isAdult, type IndexedItem } from './catalog.ts'
import type { CatalogContent, GateOptions, Result, Selection } from './types.ts'

export interface ResolvedSelection extends IndexedItem {
  qty: number
}

/** The quantity range an item accepts. Anything not priced per unit is exactly 1. */
export function qtyRange(entry: IndexedItem): { min: number; max: number } {
  const p = entry.item.pricing
  return p.kind === 'per_unit' ? { min: p.minQty, max: p.maxQty } : { min: 1, max: 1 }
}

/**
 * Checks a full set of selections against one catalog version (doc 11 §6
 * quote rules). The first problem found is returned as a typed error; the
 * selections are never "fixed" to make them pass.
 */
export function validateSelections(
  content: CatalogContent,
  selections: readonly Selection[],
  opts: GateOptions,
): Result<ResolvedSelection[]> {
  const index = indexItems(content)
  const resolved: ResolvedSelection[] = []
  const seen = new Set<string>()

  for (const { itemId, qty } of selections) {
    const entry = index.get(itemId)
    if (!entry || seen.has(itemId)) return { ok: false, error: { code: 'unknown_item', itemId } }
    seen.add(itemId)
    if (isAdult(entry.item, entry.category) && !opts.adultAllowed) {
      return { ok: false, error: { code: 'adult_disabled', itemId } }
    }
    if (entry.item.hidden || entry.category.hidden) return { ok: false, error: { code: 'item_unavailable', itemId } }
    const range = qtyRange(entry)
    if (!Number.isInteger(qty) || qty < range.min || qty > range.max) {
      return { ok: false, error: { code: 'qty_out_of_range', itemId, ...range } }
    }
    resolved.push({ ...entry, qty })
  }

  // Selection limits: per group where a category has groups, otherwise per category.
  for (const category of content.categories) {
    if (!categoryAvailable(category, opts)) continue
    const inCategory = resolved.filter((r) => r.category === category)
    const slots = category.groups?.length
      ? category.groups.map((g) => ({
          groupKey: g.key as string | null,
          min: g.min,
          max: g.max,
          count: inCategory.filter((r) => r.item.groupKey === g.key).length,
        }))
      : [{ groupKey: null, min: category.selection.min, max: category.selection.max, count: inCategory.length }]
    if (category.groups?.length) {
      // An item outside every group can't be counted, so it can't be chosen.
      const stray = inCategory.find((r) => !category.groups!.some((g) => g.key === r.item.groupKey))
      if (stray) return { ok: false, error: { code: 'item_unavailable', itemId: stray.item.id } }
    }
    for (const slot of slots) {
      if (slot.count < slot.min || slot.count > slot.max) {
        return { ok: false, error: { code: 'group_count', categoryKey: category.key, ...slot } }
      }
    }
  }

  for (const r of resolved) {
    for (const needed of r.item.requires ?? []) {
      if (!seen.has(needed)) return { ok: false, error: { code: 'requires_missing', itemId: r.item.id, requires: needed } }
    }
    for (const banned of r.item.excludes ?? []) {
      if (seen.has(banned)) return { ok: false, error: { code: 'excluded_pair', itemId: r.item.id, excludes: banned } }
    }
  }

  // A video with the fan's name or script is never resold (§5.7).
  const personal = resolved.filter((r) => r.item.traits?.some((t) => t === 'uses_name' || t === 'uses_script'))
  const resale = resolved.filter((r) => r.item.traits?.includes('resale'))
  if (personal.length > 0 && resale.length > 0) {
    return {
      ok: false,
      error: { code: 'personalised_video_resale_forbidden', itemIds: [...personal, ...resale].map((r) => r.item.id) },
    }
  }

  return { ok: true, value: resolved }
}
