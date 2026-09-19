/* -------------------------------------------------------------------------- */
/*  Scene Card domain model for the fan journey.                              */
/*                                                                            */
/*  Every price comes from Maya's catalog (shared/catalog, or the server's    */
/*  copy in staging), priced by the shared quote module in integer cents.     */
/*  The estimated total is ALWAYS the quote's total, and the Scene Card only  */
/*  ever hides $0 lines, so the lines shown always add up to it. No screen    */
/*  may print a total as fixed copy. See docs/specs/11 §3 rule 3.             */
/*                                                                            */
/*  "Richer" and "longer" are the Director's suggestions, not catalog items   */
/*  (doc 11 §6): selectionsOf() turns the Director's choices into catalog     */
/*  selections.                                                                */
/* -------------------------------------------------------------------------- */

import { renderBoundaries, type RenderedBoundaries } from '../../../shared/domain/boundaries.ts'
import { itemAvailable } from '../../../shared/domain/catalog.ts'
import { quote } from '../../../shared/domain/quote.ts'
import { defaultSelections, priceRange } from '../../../shared/domain/ranges.ts'
import type { CatalogContent, Item, Quote, Selection } from '../../../shared/domain/types.ts'

/** The fan never sees adult content in Phases 0–3 (doc 11 §5.4). */
const GATE = { adultAllowed: false }

/* ------------------------------ Fan data --------------------------------- */

/** The demo fan's stated budget, in cents. Fan data, not catalog data. */
export const BUDGET = 15_000

/** The standing brief the fan opened with, shown when they have added no notes. */
export const FAN_BRIEF =
  'For my partner’s anniversary. They love 80s aesthetics. Something atmospheric and warm.'

/* ---------------------------- Presentation ------------------------------- */

/** A setting's catalog item key, e.g. "vintage". */
export type SettingId = string
export type FocusId = 'richer' | 'longer'

type SettingPresentation = {
  /** Thumbnail used in the Director's choice cards. */
  image: string
  /** Wider crop used for the Review hero. Several of these 404: always render
   *  them through <SceneImage>, which falls back to an on-brand placeholder. */
  imageLarge: string
  alt: string
  sceneTitle: string
  /** One-line description of the finished scene, shown on the Review page. */
  sceneDescription: string
  lineLabel: string
}

/** Imagery and scene copy for the designed settings, keyed by catalog item key. */
const SETTING_PRESENTATION: Record<string, SettingPresentation> = {
  vintage: {
    image:
      'https://images.unsplash.com/photo-1551028150-64b9e398f678?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    imageLarge:
      'https://images.unsplash.com/photo-1551028150-64b9e398f678?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    alt: 'Warmly lit vintage lounge with velvet seating and soft lamps',
    sceneTitle: 'Vintage Lounge Greeting',
    sceneDescription:
      'A cinematic, atmospheric personal greeting set in a cozy vintage lounge. Perfect for anniversaries and intimate celebrations.',
    lineLabel: 'Vintage Lounge Setup',
  },
  floral: {
    image:
      'https://images.unsplash.com/photo-1563241527-2004cb630db0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    imageLarge:
      'https://images.unsplash.com/photo-1563241527-2004cb630db0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    alt: 'Bright studio table arranged with fresh cut flowers',
    sceneTitle: 'Floral Studio Greeting',
    sceneDescription:
      'A bright, airy greeting surrounded by seasonal blooms. Ideal for cheerful celebrations and uplifting messages.',
    lineLabel: 'Floral Studio Setup',
  },
  backstage: {
    image:
      'https://images.unsplash.com/photo-1517457224219-c60317e3df1c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    imageLarge:
      'https://images.unsplash.com/photo-1517457224219-c60317e3df1c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    alt: 'Backstage dressing area with mirror lights and hanging garments',
    sceneTitle: 'Backstage Greeting',
    sceneDescription:
      'A raw, candid greeting filmed between takes. A glimpse behind the scenes for a more personal, unpolished connection.',
    lineLabel: 'Backstage Setup',
  },
}

export type SettingOption = SettingPresentation & {
  id: SettingId
  itemId: string
  name: string
  blurb: string
  /** Cents, from the catalog. */
  price: number
}

export type FocusOption = {
  id: FocusId
  name: string
  blurb: string
  icon: string
}

/* ------------------------------ Catalog view ------------------------------ */

/** Everything the fan screens read from one catalog version. */
export type CatalogView = {
  versionId: string
  creatorName: string
  content: CatalogContent
  settings: SettingOption[]
  focusOptions: FocusOption[]
  baseMinutes: number
  /** Cents per extra minute. */
  perExtraMinute: number
  maxExtraMinutes: number
  deliveryDays: number
  boundaries: RenderedBoundaries
  /**
   * Entrance price ranges by setting, in cents. Null in the public demo, which
   * keeps its own ranges over the Director's choices (doc 11 §4.1); staging
   * derives them from the catalog's selection groups (Gate 0 decision 2).
   */
  ranges: Record<SettingId, { min: number; max: number }> | null
  itemIds: { base: string; extraMinute: string; greetingStandard: string; greetingDetailed: string }
}

function itemByKey(content: CatalogContent, key: string): Item {
  for (const category of content.categories) {
    const item = category.items.find((i) => i.key === key && itemAvailable(i, category, GATE))
    if (item) return item
  }
  throw new Error(`The catalog has no "${key}" item`)
}

export function catalogView(
  content: CatalogContent,
  versionId: string,
  opts: { creatorName: string; ranges: 'demo' | 'derived' | Record<string, { min: number; max: number }>; boundaries?: RenderedBoundaries },
): CatalogView {
  const base = itemByKey(content, 'base_video')
  const extra = itemByKey(content, 'extra_minute')
  const baseMinutes = base.effects?.minutes ?? 0
  const settingCategory = content.categories.find((c) => c.key === 'setting')
  const settings: SettingOption[] = (settingCategory?.items ?? [])
    .filter((item) => settingCategory && itemAvailable(item, settingCategory, GATE))
    .map((item) => ({
      id: item.key,
      itemId: item.id,
      name: item.label,
      blurb: item.description ?? '',
      price: item.pricing.kind === 'fixed' ? item.pricing.amount : 0,
      ...(SETTING_PRESENTATION[item.key] ?? {
        image: '',
        imageLarge: '',
        alt: item.label,
        sceneTitle: `${item.label} Greeting`,
        sceneDescription: item.description ?? '',
        lineLabel: `${item.label} Setup`,
      }),
    }))

  let ranges: CatalogView['ranges'] = null
  if (opts.ranges === 'derived') {
    ranges = {}
    for (const s of settings) {
      const range = priceRange(content, s.itemId, GATE)
      if (range) ranges[s.id] = range
    }
  } else if (opts.ranges !== 'demo') {
    ranges = {}
    for (const s of settings) if (opts.ranges[s.itemId]) ranges[s.id] = opts.ranges[s.itemId]
  }

  return {
    versionId,
    creatorName: opts.creatorName,
    content,
    settings,
    focusOptions: [
      { id: 'richer', name: 'Richer Setting', blurb: `Keep ${baseMinutes} mins, add detailed personalized greeting`, icon: 'lucide:sparkles' },
      { id: 'longer', name: 'Longer Video', blurb: `Extend to ${baseMinutes + 1} mins, standard greeting`, icon: 'lucide:clock' },
    ],
    baseMinutes,
    perExtraMinute: extra.pricing.kind === 'per_unit' ? extra.pricing.amountPerUnit : 0,
    maxExtraMinutes: extra.pricing.kind === 'per_unit' ? extra.pricing.maxQty : 0,
    deliveryDays: content.delivery.standardDaysFromPayment,
    boundaries: opts.boundaries ?? renderBoundaries(content.boundaries, opts.creatorName, GATE),
    ranges,
    itemIds: {
      base: base.id,
      extraMinute: extra.id,
      greetingStandard: itemByKey(content, 'greeting_standard').id,
      greetingDetailed: itemByKey(content, 'greeting_detailed').id,
    },
  }
}

/* --------------------------------- Draft ---------------------------------- */

export type LineItemId = 'video' | 'runtime' | 'setup' | 'greeting' | `other:${string}`

export type EditTarget = 'setting' | 'focus'

export type LineItem = {
  id: LineItemId
  label: string
  /** Shorter label for the Review page's price breakdown. */
  shortLabel: string
  detail: string
  /** Integer cents, from the quote. The estimated total is always the quote's total. */
  amount: number
  /** Renders the rose "Added" badge for options the fan chose. */
  added: boolean
  /** Only optional add-ons can be removed; required components cannot. */
  removable: boolean
  /** Which conversation control edits this line. */
  edits: EditTarget
}

export type FanNote = { id: number; text: string }

/** The Director's choices. selectionsOf() turns them into catalog selections. */
export type Draft = {
  setting: SettingId
  focus: FocusId
  extraMinute: boolean
  notes: FanNote[]
  /**
   * Staging only (designs 17 and 18): the draft's catalog selections as the
   * server holds them. When set, they ARE the draft's choices, and setting,
   * focus and extraMinute are kept as their closest reading for the demo-era
   * screens. The public demo never sets this, so it behaves exactly as before.
   */
  selections?: Selection[]
  /** Staging only: a custom request the fan confirmed. Never priced (doc 11 §5.1). */
  customRequest?: string | null
}

export const INITIAL_DRAFT: Draft = {
  setting: 'vintage',
  focus: 'richer',
  extraMinute: false,
  notes: [],
}

export function settingOf(view: CatalogView, draft: Draft): SettingOption {
  return view.settings.find((option) => option.id === draft.setting) ?? view.settings[0]
}

export function focusOf(view: CatalogView, draft: Draft): FocusOption {
  return view.focusOptions.find((option) => option.id === draft.focus) ?? view.focusOptions[0]
}

/** Extra minutes beyond the base, from the focus choice and the add-on. */
export function extraMinutesOf(draft: Draft): number {
  return (draft.focus === 'longer' ? 1 : 0) + (draft.extraMinute ? 1 : 0)
}

export function minutesOf(view: CatalogView, draft: Draft): number {
  return view.baseMinutes + extraMinutesIn(view, draft)
}

/** Extra minutes, read from the selections when the draft has them (staging). */
export function extraMinutesIn(view: CatalogView, draft: Draft): number {
  if (!draft.selections) return extraMinutesOf(draft)
  return draft.selections.find((s) => s.itemId === view.itemIds.extraMinute)?.qty ?? 0
}

export type GreetingId = 'standard' | 'detailed'

/** Which greeting the draft has. */
export function greetingOf(view: CatalogView, draft: Draft): GreetingId {
  if (!draft.selections) return draft.focus === 'richer' ? 'detailed' : 'standard'
  return draft.selections.some((s) => s.itemId === view.itemIds.greetingDetailed) ? 'detailed' : 'standard'
}

/**
 * A draft read from server selections (staging). setting, focus and
 * extraMinute get their closest demo-era reading; the selections stay the
 * truth, so combinations the demo can't build (a standard greeting with no
 * extra minute) still price and show correctly.
 */
export function draftFromSelections(
  view: CatalogView,
  selections: Selection[],
  rest: { notes: FanNote[]; customRequest: string | null },
): Draft {
  const setting = view.settings.find((s) => selections.some((x) => x.itemId === s.itemId)) ?? view.settings[0]
  const detailed = selections.some((s) => s.itemId === view.itemIds.greetingDetailed)
  const extra = selections.find((s) => s.itemId === view.itemIds.extraMinute)?.qty ?? 0
  return {
    setting: setting.id,
    focus: detailed ? 'richer' : 'longer',
    extraMinute: detailed ? extra > 0 : extra > 1,
    notes: rest.notes,
    selections: selections.map((s) => ({ ...s })),
    customRequest: rest.customRequest,
  }
}

/**
 * The changes for one pick in the catalog sheet (design 17 F): a setting, a
 * greeting or a number of extra minutes. Returned as a Partial<Draft> for the
 * reducer, so it's one undoable step.
 */
export function changeChoice(
  view: CatalogView,
  draft: Draft,
  pick: { setting?: SettingId; greeting?: GreetingId; extraMinutes?: number },
): Partial<Draft> {
  const current = selectionsOf(view, draft)
  const { extraMinute, greetingStandard, greetingDetailed } = view.itemIds
  let next = current.map((s) => ({ ...s }))
  if (pick.setting !== undefined) {
    const option = view.settings.find((s) => s.id === pick.setting)
    if (option) {
      const settingIds = new Set(view.settings.map((s) => s.itemId))
      next = next.filter((s) => !settingIds.has(s.itemId))
      next.push({ itemId: option.itemId, qty: 1 })
    }
  }
  if (pick.greeting !== undefined) {
    next = next.filter((s) => s.itemId !== greetingStandard && s.itemId !== greetingDetailed)
    next.push({ itemId: pick.greeting === 'detailed' ? greetingDetailed : greetingStandard, qty: 1 })
  }
  if (pick.extraMinutes !== undefined) {
    const qty = Math.max(0, Math.min(view.maxExtraMinutes, Math.round(pick.extraMinutes)))
    next = next.filter((s) => s.itemId !== extraMinute)
    if (qty > 0) next.push({ itemId: extraMinute, qty })
  }
  const { selections, ...derived } = draftFromSelections(view, next, { notes: draft.notes, customRequest: draft.customRequest ?? null })
  return { ...derived, selections, notes: draft.notes }
}

/** The fan's most recent note, falling back to the brief they opened with. */
export function briefOf(draft: Draft): string {
  return draft.notes.length > 0 ? draft.notes[draft.notes.length - 1].text : FAN_BRIEF
}

/**
 * The catalog selections for the Director's choices: the catalog's defaults
 * for everything the screens don't show yet (doc 11 §5.6 item 22), plus the
 * setting, the greeting and the extra minutes.
 */
export function selectionsOf(view: CatalogView, draft: Draft): Selection[] {
  if (draft.selections) return draft.selections.map((s) => ({ ...s }))
  const { base, extraMinute, greetingStandard, greetingDetailed } = view.itemIds
  const setting = settingOf(view, draft)
  const picks = defaultSelections(view.content, GATE).filter(
    (s) => s.itemId !== greetingStandard && s.itemId !== greetingDetailed && s.itemId !== extraMinute && s.itemId !== base,
  )
  picks.push({ itemId: base, qty: 1 })
  const extra = extraMinutesOf(draft)
  if (extra > 0) picks.push({ itemId: extraMinute, qty: extra })
  picks.push({ itemId: setting.itemId, qty: 1 })
  picks.push({ itemId: draft.focus === 'richer' ? greetingDetailed : greetingStandard, qty: 1 })
  return picks
}

/** The shared quote module's price for a draft. Staging shows the server's instead once it arrives. */
export function localQuote(view: CatalogView, draft: Draft, budget: number | null = BUDGET): Quote {
  const result = quote(view.content, view.versionId, { selections: selectionsOf(view, draft), customRequest: null, budget }, GATE)
  if (!result.ok) throw new Error(`The Director built an invalid draft: ${result.error.code}`)
  return result.value
}

/**
 * The Scene Card's rows, built from a quote. Rows the designs show get their
 * designed wording; any other line is shown only if it costs something, so a
 * hidden $0 default never hides money and the rows always add up to the total.
 */
export function buildLineItems(view: CatalogView, draft: Draft, q: Quote): LineItem[] {
  const setting = settingOf(view, draft)
  const { base, extraMinute, greetingStandard, greetingDetailed } = view.itemIds
  const minutes = q.minutes
  const items: LineItem[] = []
  for (const line of q.lines) {
    if (line.itemId === base) {
      items.push({
        id: 'video',
        label: line.label,
        shortLabel: `Base Video (${view.baseMinutes}-min)`,
        detail: itemByKey(view.content, 'base_video').description ?? '',
        amount: line.amount,
        added: false,
        removable: false,
        edits: 'focus',
      })
    } else if (line.itemId === extraMinute) {
      items.push({
        id: 'runtime',
        label: `Extra Runtime (+${line.qty} min)`,
        shortLabel: `Extra Runtime (+${line.qty} min)`,
        detail: `${money(view.perExtraMinute)} per additional minute · ${minutes} minutes total`,
        amount: line.amount,
        added: true,
        removable: true,
        edits: 'focus',
      })
    } else if (line.itemId === setting.itemId) {
      items.push({
        id: 'setup',
        label: setting.lineLabel,
        shortLabel: setting.lineLabel,
        detail: 'Set dressing & lighting',
        amount: line.amount,
        added: true,
        removable: false,
        edits: 'setting',
      })
    } else if (line.itemId === greetingDetailed || line.itemId === greetingStandard) {
      const detailed = line.itemId === greetingDetailed
      items.push({
        id: 'greeting',
        label: detailed ? 'Personalized Greeting' : 'Standard Greeting',
        shortLabel: detailed ? 'Detailed Greeting' : 'Standard Greeting',
        detail: itemByKey(view.content, detailed ? 'greeting_detailed' : 'greeting_standard').description ?? '',
        amount: line.amount,
        added: detailed,
        removable: false,
        edits: 'focus',
      })
    } else if (line.amount !== 0) {
      items.push({
        id: `other:${line.itemId}`,
        label: line.label,
        shortLabel: line.label,
        detail: '',
        amount: line.amount,
        added: true,
        removable: false,
        edits: 'focus',
      })
    }
  }
  // Designed order: video, runtime, setup, greeting.
  const order = (id: LineItemId) => ['video', 'runtime', 'setup', 'greeting'].indexOf(id) >>> 0
  return items.sort((a, b) => order(a.id) - order(b.id))
}

export function sumOf(items: readonly LineItem[]): number {
  return items.reduce((running, item) => running + item.amount, 0)
}

/** Total for a hypothetical draft, used to price the choice cards honestly. */
export function previewTotal(view: CatalogView, draft: Draft, changes: Partial<Draft>): number {
  return localQuote(view, { ...draft, ...changes }).total
}

/** Every draft a fan can build on one setting in the Director: each focus, with and without the extra minute. */
export function draftsFor(view: CatalogView, setting: SettingId): Draft[] {
  return view.focusOptions.flatMap((focus) =>
    [false, true].map((extraMinute) => ({ ...INITIAL_DRAFT, setting, focus: focus.id, extraMinute })),
  )
}

/**
 * The entrance cards' price range for a setting, in cents. Staging uses the
 * catalog-derived range; the public demo derives its range from the drafts
 * the Director can build. Never written as copy.
 */
export function priceRangeOf(view: CatalogView, setting: SettingId): { min: number; max: number } | null {
  if (view.ranges) return view.ranges[setting] ?? null
  if (!view.settings.some((s) => s.id === setting)) return null
  const totals = draftsFor(view, setting).map((draft) => localQuote(view, draft).total)
  return { min: Math.min(...totals), max: Math.max(...totals) }
}

/* ---------------------------- Formatting --------------------------------- */

/** "$145" for whole dollars, "$147.50" otherwise: the Director's chips and budget pills. */
export function money(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}$${abs % 100 === 0 ? abs / 100 : (abs / 100).toFixed(2)}`
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** Two decimals from cents: the Review, Confirmation and Saved screens read "$145.00". */
export const currency = { format: (cents: number) => usd.format(cents / 100) }

/** The three "Included Components" tiles on the Review page. */
export function includedComponents(view: CatalogView, draft: Draft) {
  const setting = settingOf(view, draft)
  return [
    { icon: 'lucide:video', label: 'Duration', value: `${minutesOf(view, draft)}-Minute Video` },
    { icon: 'lucide:armchair', label: 'Setting', value: setting.lineLabel },
    {
      icon: 'lucide:message-square-heart',
      label: 'Personalization',
      value: greetingOf(view, draft) === 'detailed' ? 'Detailed Greeting' : 'Standard Greeting',
    },
  ]
}
