import { indexItems, isAdult, itemAvailable, type IndexedItem } from './catalog.ts'
import type { CatalogContent, GateOptions, Item, Category, Result, Selection, SelectionError } from './types.ts'
import { qtyRange, validateSelections } from './validate.ts'

/**
 * The AI Director's side of the response contract (doc 11 §8 Phase 3). The
 * model only names catalog item ids; this module turns what it named into a
 * complete, validated set of selections. Pricing, flags and every fan-facing
 * sentence stay with the caller.
 */

/**
 * Where an item is chosen: its group, or its category when the category has
 * no groups. The Director only offers slots the fan screens can show.
 */
export function slotOf(item: Item, category: Category): string {
  return item.groupKey ?? category.key
}

/**
 * The slots the staging screens show today (Phase 2 decision 6). Everything
 * else stays at its $0 default until design 20 is built, so the Director
 * never offers it.
 */
export const DIRECTOR_SLOTS_V1: readonly string[] = ['setting', 'greeting', 'extra_minutes']

export interface AllowedItemsOptions {
  slots: readonly string[]
  /** Items the server's limit check turned down (a creator's hard no). */
  excluded?: (item: Item, category: Category) => boolean
}

/**
 * The item ids the model may name this turn: the enum of the per-request
 * schema. Published, visible, in a slot the screens show, not a hard no, and
 * adult only when §5.4 allows it.
 */
export function allowedItems(content: CatalogContent, gate: GateOptions, opts: AllowedItemsOptions): IndexedItem[] {
  const out: IndexedItem[] = []
  for (const category of content.categories) {
    for (const item of category.items) {
      if (!itemAvailable(item, category, gate)) continue
      if (!opts.slots.includes(slotOf(item, category))) continue
      if (opts.excluded?.(item, category)) continue
      out.push({ item, category })
    }
  }
  return out
}

/** One option exactly as the model returned it, after the schema check. */
export interface DirectorOption {
  label: string
  wants: Selection[]
  removes: string[]
}

export type DropReason =
  | { code: 'unknown_item'; itemId: string }
  | { code: 'requires_unavailable'; itemId: string; requires: string }
  | { code: 'adult_not_asked'; itemIds: string[] }
  | { code: 'no_change' }
  | { code: 'invalid'; error: SelectionError }

export interface OptionChange {
  itemId: string
  label: string
  /** 0 when the item is removed. */
  qty: number
  /** The quantity before, 0 when the item is new. */
  before: number
}

export interface BuiltOption {
  selections: Selection[]
  /** Items added or whose quantity changed, in catalog order. */
  adds: OptionChange[]
  /** Items taken out, in catalog order. */
  removes: OptionChange[]
  /** Adult items taken out because the fan didn't ask for anything intimate. */
  strippedAdult: string[]
}

export interface BuildOptions {
  /** The enum for this turn. Anything else is refused, whatever the schema said. */
  allowed: ReadonlySet<string>
  /** Whether the fan's message asked for something intimate (only matters when adult content is allowed). */
  intimate: boolean
}

/**
 * Builds one option on top of the current selections:
 *
 * 1. Apply `removes`. A choose-exactly-one group left empty gets its default
 *    item back ("no detailed greeting" means the standard one).
 * 2. Apply each `wants` item. In a choose-one slot it replaces the current
 *    member; its `requires` items are added; `qty` is capped to the item's range.
 * 3. Validate the result with the shared rules (groups, requires/excludes,
 *    gating, the resale rule).
 *
 * A problem drops the option with a typed reason. It never changes the draft.
 */
export function buildOption(
  content: CatalogContent,
  current: readonly Selection[],
  option: DirectorOption,
  gate: GateOptions,
  opts: BuildOptions,
): Result<BuiltOption, DropReason> {
  const index = indexItems(content)
  const sel = new Map<string, number>(current.map((s) => [s.itemId, s.qty]))

  // Adult items stay out unless the fan asked (doc 11 §8: strip, don't refuse).
  const strippedAdult: string[] = []
  let wants = option.wants
  if (gate.adultAllowed && !opts.intimate) {
    wants = wants.filter((w) => {
      const entry = index.get(w.itemId)
      const adult = entry !== undefined && isAdult(entry.item, entry.category)
      if (adult && !sel.has(w.itemId)) strippedAdult.push(w.itemId)
      return !(adult && !sel.has(w.itemId))
    })
  }

  for (const id of [...option.removes, ...wants.map((w) => w.itemId)]) {
    if (!opts.allowed.has(id) || !index.has(id)) return { ok: false, error: { code: 'unknown_item', itemId: id } }
  }

  for (const id of option.removes) {
    const entry = index.get(id)!
    sel.delete(id)
    refillDefault(sel, entry)
  }

  const want = (itemId: string, qty: number, depth: number): DropReason | null => {
    const entry = index.get(itemId)!
    const slot = slotOf(entry.item, entry.category)
    if (slotMax(entry) === 1) {
      for (const member of entry.category.items) {
        if (member.id !== itemId && slotOf(member, entry.category) === slot) sel.delete(member.id)
      }
    }
    const range = qtyRange(entry)
    sel.set(itemId, Math.min(Math.max(qty, range.min), range.max))
    for (const needed of entry.item.requires ?? []) {
      if (sel.has(needed)) continue
      if (!opts.allowed.has(needed) || !index.has(needed) || depth > 4) {
        return { code: 'requires_unavailable', itemId, requires: needed }
      }
      const problem = want(needed, 1, depth + 1)
      if (problem) return problem
    }
    return null
  }
  for (const w of wants) {
    const problem = want(w.itemId, w.qty, 0)
    if (problem) return { ok: false, error: problem }
  }

  const selections = inCatalogOrder(content, sel)
  const before = new Map<string, number>(current.map((s) => [s.itemId, s.qty]))
  const adds: OptionChange[] = []
  const removes: OptionChange[] = []
  for (const { itemId, qty } of selections) {
    const was = before.get(itemId) ?? 0
    if (was !== qty) adds.push({ itemId, label: index.get(itemId)!.item.label, qty, before: was })
  }
  for (const s of inCatalogOrder(content, before)) {
    if (!sel.has(s.itemId)) {
      removes.push({ itemId: s.itemId, label: index.get(s.itemId)?.item.label ?? s.itemId, qty: 0, before: s.qty })
    }
  }
  if (adds.length === 0 && removes.length === 0) {
    return strippedAdult.length
      ? { ok: false, error: { code: 'adult_not_asked', itemIds: strippedAdult } }
      : { ok: false, error: { code: 'no_change' } }
  }

  const checked = validateSelections(content, selections, gate)
  if (!checked.ok) return { ok: false, error: { code: 'invalid', error: checked.error } }
  return { ok: true, value: { selections, adds, removes, strippedAdult } }
}

/** Two built options that end at the same selections are the same option. */
export function sameSelections(a: readonly Selection[], b: readonly Selection[]): boolean {
  if (a.length !== b.length) return false
  const m = new Map(a.map((s) => [s.itemId, s.qty]))
  return b.every((s) => m.get(s.itemId) === s.qty)
}

/**
 * The option title the fan sees, built from item labels only. The model's
 * own `label` is stored for the record and never shown (doc 11 §8).
 */
export function optionTitle(built: BuiltOption): string {
  const named = built.adds.map((c) => (c.qty > 1 ? `${c.label} × ${c.qty}` : c.label))
  if (named.length > 0) return joinLabels(named)
  return `Without ${joinLabels(built.removes.map((c) => c.label))}`
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/* ------------------------------ Helpers -------------------------------- */

function slotMax(entry: IndexedItem): number {
  const group = entry.category.groups?.find((g) => g.key === entry.item.groupKey)
  return group ? group.max : entry.category.selection.max
}

function slotMin(entry: IndexedItem): number {
  const group = entry.category.groups?.find((g) => g.key === entry.item.groupKey)
  return group ? group.min : entry.category.selection.min
}

/** After a removal, a slot that must hold one item gets its default back. */
function refillDefault(sel: Map<string, number>, removed: IndexedItem): void {
  if (slotMin(removed) < 1) return
  const slot = slotOf(removed.item, removed.category)
  const members = removed.category.items.filter((i) => slotOf(i, removed.category) === slot)
  if (members.some((m) => sel.has(m.id))) return
  const fallback = members.find((m) => m.isDefault && m.id !== removed.item.id && !m.hidden)
  if (fallback) sel.set(fallback.id, 1)
}

function inCatalogOrder(content: CatalogContent, sel: ReadonlyMap<string, number>): Selection[] {
  const out: Selection[] = []
  for (const category of content.categories) {
    for (const item of category.items) {
      const qty = sel.get(item.id)
      if (qty !== undefined) out.push({ itemId: item.id, qty })
    }
  }
  // Ids the catalog doesn't know are kept last, so validation reports them.
  for (const [itemId, qty] of sel) if (!out.some((s) => s.itemId === itemId)) out.push({ itemId, qty })
  return out
}
