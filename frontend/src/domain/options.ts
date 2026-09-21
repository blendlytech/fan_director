/* -------------------------------------------------------------------------- */
/*  Design 20 (commission options) and design 24 B–D, staging only.            */
/*                                                                            */
/*  The option groups the Director doesn't choose (name, rights, quality,     */
/*  delivery, the fan's own script) and the templates at the entrance. Every  */
/*  amount comes from the shared quote module on the draft's catalog version, */
/*  the same code the server prices with, so an option's label always equals */
/*  what the server will charge for that choice on this draft.                */
/*                                                                            */
/*  The resale rule (doc 11 §5.7): a video that says the fan's name or uses   */
/*  their script is personal, and a personal video can't be resold. The UI    */
/*  keeps the draft valid by never offering that combination (design 20 B);   */
/*  the server's `personalised_video_resale_forbidden` is design 24 D.        */
/* -------------------------------------------------------------------------- */

import { itemAvailable } from '../../../shared/domain/catalog.ts'
import { quote } from '../../../shared/domain/quote.ts'
import { validTemplates } from '../../../shared/domain/ranges.ts'
import type { Item, ItemTrait, Selection } from '../../../shared/domain/types.ts'
import { draftFromSelections, money, selectionsOf, textOf, type CatalogView, type Draft } from './sceneCard'

const GATE = { adultAllowed: false }

/** The groups design 20 B shows, in its order, with the fan-facing titles. */
export const OPTION_GROUPS = [
  { key: 'name_use', title: 'Your name in the video' },
  { key: 'rights', title: 'Who gets the video' },
  { key: 'resolution', title: 'Video quality' },
  { key: 'delivery', title: 'Delivery' },
] as const

export type OptionGroupKey = (typeof OPTION_GROUPS)[number]['key']

/** The fan's own script is an on/off item in its own group (design 20 D). */
export const SCRIPT_GROUP = 'fan_script'

/** Design 24 B: the name field's limit (the server's too). */
export const NAME_MAX = 40
/** Design 20 D: the script's limit (the server's too). */
export const SCRIPT_MAX = 3_000

export interface OptionChoice {
  item: Item
  selected: boolean
  /** "Included", "+$15" or "+50% · $85": the price of picking it on this draft. */
  priceLabel: string
  /** Set when the choice can't be picked; shown next to it (design 20 B). */
  unavailableReason: string | null
}

export interface OptionGroup {
  key: OptionGroupKey
  title: string
  choices: OptionChoice[]
}

function available(view: CatalogView): { item: Item }[] {
  const out: { item: Item }[] = []
  for (const category of view.content.categories) {
    for (const item of category.items) if (itemAvailable(item, category, GATE)) out.push({ item })
  }
  return out.sort((a, b) => a.item.sortOrder - b.item.sortOrder)
}

function itemsIn(view: CatalogView, groupKey: string): Item[] {
  return available(view)
    .map((a) => a.item)
    .filter((i) => i.groupKey === groupKey)
}

function itemById(view: CatalogView, itemId: string): Item | undefined {
  return available(view).find((a) => a.item.id === itemId)?.item
}

function hasTrait(view: CatalogView, selections: Selection[], trait: ItemTrait): boolean {
  return selections.some((s) => itemById(view, s.itemId)?.traits?.includes(trait))
}

/** Which personal parts the draft has: they make resale unavailable. */
export function personalParts(view: CatalogView, draft: Draft): { name: boolean; script: boolean } {
  const selections = selectionsOf(view, draft)
  return { name: hasTrait(view, selections, 'uses_name'), script: hasTrait(view, selections, 'uses_script') }
}

export function hasScript(view: CatalogView, draft: Draft): boolean {
  return personalParts(view, draft).script
}

export function scriptItem(view: CatalogView): Item | undefined {
  return itemsIn(view, SCRIPT_GROUP)[0]
}

function withSelections(view: CatalogView, draft: Draft, selections: Selection[], text = textOf(draft)): Partial<Draft> {
  const { selections: next, ...derived } = draftFromSelections(view, selections, text)
  return { ...derived, selections: next, notes: draft.notes }
}

/**
 * The selections after picking `itemId` in its group. Picking a name option
 * while the video is set to resale also picks the rights option that isn't
 * resale, so the draft never breaks the resale rule. Nothing else changes by
 * itself (design 24 C: "The rights choice never changes by itself").
 */
function picked(view: CatalogView, selections: Selection[], itemId: string): Selection[] {
  const item = itemById(view, itemId)
  if (!item?.groupKey) return selections
  const inGroup = new Set(itemsIn(view, item.groupKey).map((i) => i.id))
  let next = selections.filter((s) => !inGroup.has(s.itemId))
  next.push({ itemId, qty: 1 })
  const personal = item.traits?.includes('uses_name') || item.traits?.includes('uses_script')
  if (personal && hasTrait(view, next, 'resale')) {
    const exclusive = itemsIn(view, 'rights').find((i) => !i.traits?.includes('resale'))
    if (exclusive) {
      const rights = new Set(itemsIn(view, 'rights').map((i) => i.id))
      next = next.filter((s) => !rights.has(s.itemId))
      next.push({ itemId: exclusive.id, qty: 1 })
    }
  }
  return next
}

/** One pick in design 20 B, as one undoable change. */
export function pickOption(view: CatalogView, draft: Draft, itemId: string): Partial<Draft> {
  return withSelections(view, draft, picked(view, selectionsOf(view, draft), itemId))
}

/**
 * Adds or removes "Your own script" (design 20 D). Removing it also discards
 * the text; the screen asks first when there is any (design 24 C2).
 */
export function setScript(view: CatalogView, draft: Draft, on: boolean): Partial<Draft> {
  const item = scriptItem(view)
  if (!item) return {}
  const selections = selectionsOf(view, draft).filter((s) => s.itemId !== item.id)
  if (on) return withSelections(view, draft, picked(view, selections, item.id))
  return withSelections(view, draft, selections, { ...textOf(draft), fanScript: null })
}

function totalOf(view: CatalogView, selections: Selection[]): number | null {
  const result = quote(view.content, view.versionId, { selections, customRequest: null, budget: null }, GATE)
  return result.ok ? result.value.total : null
}

/** The label for one choice, priced on the current draft. */
function priceLabel(view: CatalogView, draft: Draft, item: Item): string {
  const pricing = item.pricing
  if (pricing.kind === 'included') return 'Included'
  if (pricing.kind === 'fixed') return `+${money(pricing.amount)}`
  if (pricing.kind === 'percent') {
    const next = picked(view, selectionsOf(view, draft), item.id)
    const result = quote(view.content, view.versionId, { selections: next, customRequest: null, budget: null }, GATE)
    const line = result.ok ? result.value.lines.find((l) => l.itemId === item.id) : undefined
    const percent = `+${pricing.basisPoints / 100}%`
    return line ? `${percent} · ${money(line.amount)}` : percent
  }
  return `+${money(pricing.amountPerUnit)}`
}

function resaleReason(view: CatalogView, draft: Draft): string | null {
  const { name, script } = personalParts(view, draft)
  if (name && script) return 'Not available: this video says your name and uses your script, so only you get it.'
  if (name) return 'Not available: this video says your name, so only you get it.'
  if (script) return 'Not available: this video uses your script, so only you get it.'
  return null
}

/** Design 20 B: the option groups for the Scene Card, priced on this draft. */
export function optionGroups(view: CatalogView, draft: Draft): OptionGroup[] {
  const selected = new Set(selectionsOf(view, draft).map((s) => s.itemId))
  const blocked = resaleReason(view, draft)
  return OPTION_GROUPS.map(({ key, title }) => ({
    key,
    title,
    choices: itemsIn(view, key).map((item) => ({
      item,
      selected: selected.has(item.id),
      priceLabel: priceLabel(view, draft, item),
      unavailableReason: item.traits?.includes('resale') && !selected.has(item.id) ? blocked : null,
    })),
  })).filter((group) => group.choices.length > 0)
}

/** "Says “Sam” once": design 24 B2 puts the saved name into the option labels. */
export function choiceLabel(item: Item, name: string | null | undefined): string {
  if (!name || !item.traits?.includes('uses_name')) return item.label
  return item.label.replace(/your name/i, `“${name}”`)
}

/** Design 20 C / C2: the notice under the total. Null when the draft has neither rights item. */
export function videoNotice(view: CatalogView, draft: Draft): 'exclusive' | 'resale' | null {
  const selections = selectionsOf(view, draft)
  const rights = itemsIn(view, 'rights').filter((i) => selections.some((s) => s.itemId === i.id))
  if (rights.length === 0) return null
  return rights.some((i) => i.traits?.includes('resale')) ? 'resale' : 'exclusive'
}

/** Why the draft can't be sent yet, in the design 24 wording. Empty when nothing blocks it. */
export function sendBlockers(view: CatalogView, draft: Draft): string[] {
  const { name, script } = personalParts(view, draft)
  const out: string[] = []
  if (name && !draft.fanDisplayName?.trim()) out.push(`Add the name ${view.creatorName} should use`)
  if (script && !draft.fanScript?.trim()) out.push('Write your script, or remove this option')
  return out
}

export interface TemplateCard {
  id: string
  label: string
  description: string
  /** The template's own build, priced: the "From" price (design 20 A). */
  fromPrice: number
  selections: Selection[]
}

/** Design 20 A: the templates the fan can start from, each with its price. */
export function templateCards(view: CatalogView): TemplateCard[] {
  const cards: TemplateCard[] = []
  for (const t of validTemplates(view.content, GATE)) {
    const total = totalOf(view, t.selections)
    if (total !== null) {
      cards.push({ id: t.id, label: t.label, description: t.description ?? '', fromPrice: total, selections: t.selections })
    }
  }
  return cards
}

/**
 * Starts the draft from a template. The fan's name stays on the draft; a
 * script is kept only if the template also has the script item (the screen
 * asks before discarding one, design 24 C2).
 */
export function applyTemplate(view: CatalogView, draft: Draft, card: TemplateCard): Partial<Draft> {
  const keepsScript = card.selections.some((s) => itemById(view, s.itemId)?.traits?.includes('uses_script'))
  return withSelections(view, draft, card.selections.map((s) => ({ ...s })), {
    ...textOf(draft),
    fanScript: keepsScript ? (draft.fanScript ?? null) : null,
  })
}

/** Would starting from this template discard the fan's script? */
export function templateDropsScript(view: CatalogView, draft: Draft, card: TemplateCard): boolean {
  if (!draft.fanScript?.trim()) return false
  return !card.selections.some((s) => itemById(view, s.itemId)?.traits?.includes('uses_script'))
}

/**
 * Design 24 D: the two ways out of a resale conflict the server reported,
 * each priced. "Keep" makes the video just for the fan; "remove" drops the
 * personal parts and keeps resale.
 */
export function resaleResolutions(view: CatalogView, draft: Draft) {
  const selections = selectionsOf(view, draft)
  const exclusive = itemsIn(view, 'rights').find((i) => !i.traits?.includes('resale'))
  const noName = itemsIn(view, 'name_use').find((i) => !i.traits?.includes('uses_name'))
  const script = scriptItem(view)
  const keep = exclusive ? picked(view, selections, exclusive.id) : null
  let remove = selections.filter((s) => s.itemId !== script?.id)
  if (noName) remove = picked(view, remove, noName.id)
  return {
    keep: keep ? { changes: withSelections(view, draft, keep), total: totalOf(view, keep) } : null,
    remove: {
      changes: withSelections(view, draft, remove, { ...textOf(draft), fanScript: null }),
      total: totalOf(view, remove),
    },
  }
}
