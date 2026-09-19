import type { Boundaries, CatalogContent, Category, GateOptions, Item, Pricing, Template } from './types.ts'

/**
 * Reads stored catalog JSON into the full contract. Versions published in
 * Phase 1 predate most fields, so anything missing falls back to the safe
 * reading: a missing `hidden` means hidden, and a missing rating means adult.
 */
export function normalizeContent(raw: unknown): CatalogContent {
  const obj = (isRecord(raw) ? raw : {}) as Record<string, unknown>
  const categories = (Array.isArray(obj.categories) ? obj.categories : []).map(normalizeCategory)
  return {
    currency: 'USD',
    categories,
    boundaries: normalizeBoundaries(obj.boundaries),
    delivery: {
      standardDaysFromPayment: positiveInt((obj.delivery as Record<string, unknown> | undefined)?.standardDaysFromPayment, 7),
    },
    pricingNote: typeof obj.pricingNote === 'string' ? obj.pricingNote : null,
    templates: (Array.isArray(obj.templates) ? obj.templates : []).map(normalizeTemplate),
  }
}

function normalizeCategory(raw: unknown, index: number): Category {
  const c = (isRecord(raw) ? raw : {}) as Record<string, unknown>
  const items = (Array.isArray(c.items) ? c.items : []).map(normalizeItem)
  const key = str(c.key, `category_${index}`)
  const selection = isRecord(c.selection)
    ? { min: nonNegInt(c.selection.min, 0), max: nonNegInt(c.selection.max, items.length) }
    : { min: 0, max: items.length }
  const groups = Array.isArray(c.groups)
    ? c.groups.filter(isRecord).map((g) => ({
        key: str(g.key, ''),
        label: str(g.label, str(g.key, '')),
        min: nonNegInt(g.min, 0),
        max: nonNegInt(g.max, 0),
      }))
    : undefined
  return {
    id: str(c.id, key),
    key,
    label: str(c.label, key),
    description: typeof c.description === 'string' ? c.description : undefined,
    origin: c.origin === 'creator' ? 'creator' : 'starter',
    contentRating: c.contentRating === 'general' ? 'general' : 'adult',
    selection,
    groups,
    sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : index,
    hidden: c.hidden !== false,
    items,
  }
}

function normalizeItem(raw: unknown, index: number): Item {
  const i = (isRecord(raw) ? raw : {}) as Record<string, unknown>
  const id = str(i.id, '')
  return {
    id,
    key: str(i.key, id),
    label: str(i.label, id),
    description: typeof i.description === 'string' ? i.description : undefined,
    origin: i.origin === 'creator' ? 'creator' : 'starter',
    contentRating: i.contentRating === 'general' ? 'general' : 'adult',
    pricing: normalizePricing(i.pricing),
    effects: isRecord(i.effects)
      ? {
          minutes: typeof i.effects.minutes === 'number' ? i.effects.minutes : undefined,
          deliveryDaysDelta: typeof i.effects.deliveryDaysDelta === 'number' ? i.effects.deliveryDaysDelta : undefined,
        }
      : undefined,
    groupKey: typeof i.groupKey === 'string' ? i.groupKey : undefined,
    requires: strings(i.requires),
    excludes: strings(i.excludes),
    traits: strings(i.traits)?.filter((t): t is 'uses_name' | 'uses_script' | 'resale' =>
      t === 'uses_name' || t === 'uses_script' || t === 'resale'),
    isDefault: i.isDefault === true ? true : undefined,
    hidden: i.hidden !== false,
    sortOrder: typeof i.sortOrder === 'number' ? i.sortOrder : index,
  }
}

/** An unreadable price is never guessed: the item becomes unselectable instead. */
function normalizePricing(raw: unknown): Pricing {
  const p = (isRecord(raw) ? raw : {}) as Record<string, unknown>
  switch (p.kind) {
    case 'fixed':
      return { kind: 'fixed', amount: nonNegInt(p.amount, 0) }
    case 'per_unit':
      return {
        kind: 'per_unit',
        unitLabel: str(p.unitLabel, 'unit'),
        amountPerUnit: nonNegInt(p.amountPerUnit, 0),
        minQty: positiveInt(p.minQty, 1),
        maxQty: positiveInt(p.maxQty, 1),
      }
    case 'percent':
      return { kind: 'percent', basisPoints: nonNegInt(p.basisPoints, 0) }
    case 'included':
      return { kind: 'included' }
    default:
      // Zero range: no quantity is ever in range, so selecting it is rejected.
      return { kind: 'per_unit', unitLabel: 'unit', amountPerUnit: 0, minQty: 1, maxQty: 0 }
  }
}

function normalizeTemplate(raw: unknown, index: number): Template {
  const t = (isRecord(raw) ? raw : {}) as Record<string, unknown>
  const key = str(t.key, `template_${index}`)
  return {
    id: str(t.id, key),
    key,
    label: str(t.label, key),
    description: typeof t.description === 'string' ? t.description : undefined,
    contentRating: t.contentRating === 'general' ? 'general' : 'adult',
    selections: (Array.isArray(t.selections) ? t.selections : []).filter(isRecord).map((s) => ({
      itemId: str(s.itemId, ''),
      qty: positiveInt(s.qty, 1),
    })),
    hidden: t.hidden !== false,
    sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : index,
  }
}

function normalizeBoundaries(raw: unknown): Boundaries {
  const b = (isRecord(raw) ? raw : {}) as Record<string, unknown>
  const checklist: Boundaries['checklist'] = {}
  if (isRecord(b.checklist)) {
    for (const [key, entry] of Object.entries(b.checklist)) {
      if (!isRecord(entry)) continue
      checklist[key] = { enabled: entry.enabled === true, mode: entry.mode === 'ask_me' ? 'ask_me' : 'hard_no' }
    }
  }
  const custom = (Array.isArray(b.custom) ? b.custom : []).filter(isRecord).map((c, i) => ({
    id: str(c.id, `custom_${i}`),
    text: str(c.text, ''),
    mode: c.mode === 'ask_me' ? ('ask_me' as const) : ('hard_no' as const),
  }))
  return {
    checklist,
    custom,
    wardrobeCreatorCurated: b.wardrobeCreatorCurated !== false,
    customRequestPolicy: b.customRequestPolicy === 'decline' ? 'decline' : 'review',
  }
}

/* ------------------------------ Lookups -------------------------------- */

export interface IndexedItem {
  item: Item
  category: Category
}

export function indexItems(content: CatalogContent): Map<string, IndexedItem> {
  const index = new Map<string, IndexedItem>()
  for (const category of content.categories) {
    for (const item of category.items) index.set(item.id, { item, category })
  }
  return index
}

export function isAdult(item: Item, category: Category): boolean {
  return item.contentRating !== 'general' || category.contentRating !== 'general'
}

/** Whether a fan may see or choose this category at all. */
export function categoryAvailable(category: Category, opts: GateOptions): boolean {
  return !category.hidden && (category.contentRating === 'general' || opts.adultAllowed)
}

export function itemAvailable(item: Item, category: Category, opts: GateOptions): boolean {
  return !item.hidden && !category.hidden && (!isAdult(item, category) || opts.adultAllowed)
}

/**
 * The catalog as a fan may see it: adult content removed unless allowed, and
 * hidden categories and items dropped. Filtering happens on the server; the
 * browser never receives what it may not show.
 */
export function visibleContent(content: CatalogContent, opts: GateOptions): CatalogContent {
  return {
    ...content,
    categories: content.categories
      .filter((c) => categoryAvailable(c, opts))
      .map((c) => ({ ...c, items: c.items.filter((i) => itemAvailable(i, c, opts)) })),
    templates: content.templates.filter((t) => !t.hidden && (t.contentRating === 'general' || opts.adultAllowed)),
  }
}

/* ------------------------------ Helpers -------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback
}
function strings(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined
}
function nonNegInt(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : fallback
}
function positiveInt(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= 1 ? (value as number) : fallback
}
