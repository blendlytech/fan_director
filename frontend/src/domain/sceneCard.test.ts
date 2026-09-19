import { describe, it, expect } from 'vitest'
import type { Draft, FocusId, SettingId } from './sceneCard'
import {
  BUDGET,
  FAN_BRIEF,
  INITIAL_DRAFT,
  briefOf,
  buildLineItems,
  currency,
  draftsFor,
  extraMinutesOf,
  includedComponents,
  localQuote,
  minutesOf,
  money,
  previewTotal,
  priceRangeOf,
  selectionsOf,
  sumOf,
} from './sceneCard'
import { DEMO_VIEW as view, STAGING_INITIAL_VIEW, viewFromServer } from '../state/catalog'

/** The Scene Card rows for a draft, priced by the shared quote module. */
const linesOf = (draft: Draft) => buildLineItems(view, draft, localQuote(view, draft))

/* -------------------------------------------------------------------------- */
/*  The catalog view: every figure comes from Maya's catalog, in cents         */
/* -------------------------------------------------------------------------- */

describe('the catalog view', () => {
  it("reads Maya's prices, minutes and delivery from the catalog", () => {
    expect(view.settings.map((s) => [s.id, s.name, s.price])).toEqual([
      ['vintage', 'Vintage Lounge', 3_500],
      ['floral', 'Floral Studio', 4_500],
      ['backstage', 'Backstage', 1_500],
    ])
    expect(view.baseMinutes).toBe(3)
    expect(view.perExtraMinute).toBe(4_000)
    expect(view.deliveryDays).toBe(7)
  })

  it('keeps the designed blurbs, built from the base minutes', () => {
    expect(view.focusOptions.map((f) => f.blurb)).toEqual([
      'Keep 3 mins, add detailed personalized greeting',
      'Extend to 4 mins, standard greeting',
    ])
  })

  it("maps the Director's choices onto catalog items, with the hidden $0 defaults", () => {
    const keys = selectionsOf(view, { ...INITIAL_DRAFT, focus: 'longer', extraMinute: true })
    expect(keys).toContainEqual({ itemId: 'maya_extra_minute', qty: 2 })
    expect(keys).toContainEqual({ itemId: 'maya_greeting_standard', qty: 1 })
    expect(keys).toContainEqual({ itemId: 'maya_rights_resell', qty: 1 })
    expect(keys).not.toContainEqual({ itemId: 'maya_greeting_detailed', qty: 1 })
  })
})

/* -------------------------------------------------------------------------- */
/*  buildLineItems                                                            */
/* -------------------------------------------------------------------------- */

describe('buildLineItems', () => {
  it('INITIAL_DRAFT (vintage, richer, no extra minute) has no runtime line', () => {
    const items = linesOf(INITIAL_DRAFT)

    expect(items.map((item) => item.id)).toEqual(['video', 'setup', 'greeting'])

    const [video, setup, greeting] = items
    expect(video.amount).toBe(9_000)
    expect(video.label).toBe('3-Minute Video')
    expect(setup.amount).toBe(3_500)
    expect(greeting.amount).toBe(2_000)
    expect(sumOf(items)).toBe(14_500)
  })

  it('longer focus adds a +1 min runtime line right after video, with a $0 standard greeting', () => {
    const items = linesOf({ ...INITIAL_DRAFT, focus: 'longer', extraMinute: false })

    expect(items.map((item) => item.id)).toEqual(['video', 'runtime', 'setup', 'greeting'])

    const runtime = items[1]
    expect(runtime.label).toBe('Extra Runtime (+1 min)')
    expect(runtime.amount).toBe(4_000)

    const greeting = items[items.length - 1]
    expect(greeting.label).toBe('Standard Greeting')
    expect(greeting.amount).toBe(0)
  })

  it('longer + extraMinute stacks to +2 min and mentions 5 minutes total', () => {
    const runtime = linesOf({ ...INITIAL_DRAFT, focus: 'longer', extraMinute: true }).find((item) => item.id === 'runtime')

    expect(runtime?.amount).toBe(8_000)
    expect(runtime?.label).toBe('Extra Runtime (+2 min)')
    expect(runtime?.detail).toBe('$40 per additional minute · 5 minutes total')
  })

  it('richer + extraMinute keeps the $20 personalized greeting alongside a +1 min runtime', () => {
    const items = linesOf({ ...INITIAL_DRAFT, focus: 'richer', extraMinute: true })
    expect(items.find((item) => item.id === 'runtime')?.amount).toBe(4_000)
    expect(items.find((item) => item.id === 'greeting')).toMatchObject({ label: 'Personalized Greeting', amount: 2_000 })
  })

  it('the setup line always follows the chosen setting', () => {
    for (const setting of view.settings) {
      const setup = linesOf({ ...INITIAL_DRAFT, setting: setting.id }).find((item) => item.id === 'setup')
      expect(setup?.label).toBe(setting.lineLabel)
      expect(setup?.amount).toBe(setting.price)
    }
  })

  it('flags required vs. optional lines correctly', () => {
    const richer = linesOf(INITIAL_DRAFT)
    expect(richer.find((item) => item.id === 'video')).toMatchObject({ added: false, removable: false, edits: 'focus' })
    expect(richer.find((item) => item.id === 'setup')).toMatchObject({ added: true, removable: false, edits: 'setting' })
    expect(richer.find((item) => item.id === 'greeting')).toMatchObject({ added: true, removable: false, edits: 'focus' })
    const runtime = linesOf({ ...INITIAL_DRAFT, focus: 'longer' }).find((item) => item.id === 'runtime')
    expect(runtime).toMatchObject({ added: true, removable: true, edits: 'focus' })
  })

  it('shows only the designed rows, and those rows always add up to the quote total', () => {
    for (const setting of view.settings) {
      for (const draft of draftsFor(view, setting.id)) {
        const q = localQuote(view, draft)
        const items = buildLineItems(view, draft, q)
        expect(items.every((item) => ['video', 'runtime', 'setup', 'greeting'].includes(item.id))).toBe(true)
        expect(sumOf(items)).toBe(q.total)
      }
    }
  })

  it('never hides a line that costs something', () => {
    const q = localQuote(view, INITIAL_DRAFT)
    const priced = { ...q, lines: [...q.lines, { itemId: 'x', key: 'x', categoryKey: 'c', groupKey: null, label: '4K', qty: 1, amount: 2_500, pricingKind: 'fixed' as const }] }
    expect(buildLineItems(view, INITIAL_DRAFT, priced).map((i) => i.label)).toContain('4K')
  })

  it('notes never change the price', () => {
    const withNotes: Draft = { ...INITIAL_DRAFT, notes: [{ id: 1, text: 'Please make it extra sparkly' }] }
    expect(sumOf(linesOf(withNotes))).toBe(sumOf(linesOf(INITIAL_DRAFT)))
  })
})

/* -------------------------------------------------------------------------- */
/*  sumOf / previewTotal                                                      */
/* -------------------------------------------------------------------------- */

describe('sumOf', () => {
  it('returns 0 for an empty list', () => {
    expect(sumOf([])).toBe(0)
  })

  it('sums line item amounts', () => {
    const items = linesOf({ ...INITIAL_DRAFT, focus: 'longer', extraMinute: true })
    expect(sumOf(items)).toBe(items.reduce((total, item) => total + item.amount, 0))
  })
})

describe('previewTotal', () => {
  it('equals the quote total of { ...draft, ...changes }', () => {
    const changes: Partial<Draft> = { focus: 'longer', extraMinute: true }
    expect(previewTotal(view, INITIAL_DRAFT, changes)).toBe(localQuote(view, { ...INITIAL_DRAFT, ...changes }).total)
  })

  it('does not mutate the passed draft', () => {
    const draft: Draft = { ...INITIAL_DRAFT, notes: [] }
    const snapshot = { ...draft, notes: [...draft.notes] }
    previewTotal(view, draft, { focus: 'longer', extraMinute: true })
    expect(draft).toEqual(snapshot)
  })

  it('vintage + longer (no extra minute) previews to $165', () => {
    expect(previewTotal(view, INITIAL_DRAFT, { focus: 'longer' })).toBe(16_500)
  })
})

/* -------------------------------------------------------------------------- */
/*  Every buildable draft: exact totals and the over-budget rule              */
/* -------------------------------------------------------------------------- */

describe('total pricing and the over-budget rule across every buildable draft', () => {
  const table: Array<{ setting: SettingId; focus: FocusId; extraMinute: boolean; total: number; over: boolean }> = [
    { setting: 'vintage', focus: 'richer', extraMinute: false, total: 14_500, over: false },
    { setting: 'vintage', focus: 'richer', extraMinute: true, total: 18_500, over: true },
    { setting: 'vintage', focus: 'longer', extraMinute: false, total: 16_500, over: true },
    { setting: 'vintage', focus: 'longer', extraMinute: true, total: 20_500, over: true },
    { setting: 'floral', focus: 'richer', extraMinute: false, total: 15_500, over: true },
    { setting: 'floral', focus: 'richer', extraMinute: true, total: 19_500, over: true },
    { setting: 'floral', focus: 'longer', extraMinute: false, total: 17_500, over: true },
    { setting: 'floral', focus: 'longer', extraMinute: true, total: 21_500, over: true },
    { setting: 'backstage', focus: 'richer', extraMinute: false, total: 12_500, over: false },
    { setting: 'backstage', focus: 'richer', extraMinute: true, total: 16_500, over: true },
    { setting: 'backstage', focus: 'longer', extraMinute: false, total: 14_500, over: false },
    { setting: 'backstage', focus: 'longer', extraMinute: true, total: 18_500, over: true },
  ]

  it.each(table)(
    '$setting / $focus / extraMinute=$extraMinute totals $total cents (over=$over)',
    ({ setting, focus, extraMinute, total, over }) => {
      const q = localQuote(view, { ...INITIAL_DRAFT, setting, focus, extraMinute })
      expect(q.total).toBe(total)
      expect(BUDGET - q.total < 0).toBe(over)
      expect(q.budgetDifference).toBe(BUDGET - total)
    },
  )

  it('the over-budget rule is strictly "< 0": a total exactly at budget is not over', () => {
    expect(BUDGET - BUDGET < 0).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/*  Entrance-card price ranges                                                */
/* -------------------------------------------------------------------------- */

describe('draftsFor', () => {
  it('returns four drafts per setting, all with that setting and no notes', () => {
    for (const setting of view.settings) {
      const drafts = draftsFor(view, setting.id)
      expect(drafts).toHaveLength(4)
      for (const draft of drafts) {
        expect(draft.setting).toBe(setting.id)
        expect(draft.notes).toEqual([])
      }
    }
  })
})

describe('priceRangeOf', () => {
  it.each([
    ['vintage', { min: 14_500, max: 20_500 }],
    ['floral', { min: 15_500, max: 21_500 }],
    ['backstage', { min: 12_500, max: 18_500 }],
  ] as const)('demo: %s ranges over the Director’s drafts, %o', (setting, expected) => {
    expect(priceRangeOf(view, setting)).toEqual(expected)
  })

  it.each([
    ['vintage', { min: 12_500, max: 59_000 }],
    ['floral', { min: 13_500, max: 61_000 }],
    ['backstage', { min: 10_500, max: 55_000 }],
  ] as const)('staging: %s ranges over the catalog’s selection groups, %o', (setting, expected) => {
    expect(priceRangeOf(STAGING_INITIAL_VIEW, setting)).toEqual(expected)
  })

  it('has no range for a setting the catalog does not offer', () => {
    expect(priceRangeOf(view, 'rooftop')).toBeNull()
  })
})

describe('viewFromServer', () => {
  it("uses the server's ranges and rendered boundaries", () => {
    const body = {
      catalogVersionId: 'cv_x',
      creatorName: 'Maya',
      categories: STAGING_INITIAL_VIEW.content.categories,
      delivery: { standardDaysFromPayment: 7 },
      templates: [],
      pricingNote: null,
      ranges: { maya_setting_vintage: { min: 1, max: 2 } },
      boundaries: STAGING_INITIAL_VIEW.boundaries,
    }
    const server = viewFromServer(body)
    expect(server.versionId).toBe('cv_x')
    expect(priceRangeOf(server, 'vintage')).toEqual({ min: 1, max: 2 })
    expect(priceRangeOf(server, 'floral')).toBeNull()
  })

  it('refuses a response it does not recognise', () => {
    expect(() => viewFromServer({ error: 'not_found' })).toThrow()
  })
})

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

describe('minutesOf / extraMinutesOf', () => {
  const table: Array<{ focus: FocusId; extraMinute: boolean; extraMinutes: number; minutes: number }> = [
    { focus: 'richer', extraMinute: false, extraMinutes: 0, minutes: 3 },
    { focus: 'richer', extraMinute: true, extraMinutes: 1, minutes: 4 },
    { focus: 'longer', extraMinute: false, extraMinutes: 1, minutes: 4 },
    { focus: 'longer', extraMinute: true, extraMinutes: 2, minutes: 5 },
  ]

  it.each(table)(
    'focus=$focus extraMinute=$extraMinute -> extraMinutes=$extraMinutes, minutes=$minutes',
    ({ focus, extraMinute, extraMinutes, minutes }) => {
      const draft: Draft = { ...INITIAL_DRAFT, focus, extraMinute }
      expect(extraMinutesOf(draft)).toBe(extraMinutes)
      expect(minutesOf(view, draft)).toBe(minutes)
      expect(localQuote(view, draft).minutes).toBe(minutes)
    },
  )
})

describe('briefOf', () => {
  it('falls back to FAN_BRIEF when there are no notes', () => {
    expect(briefOf({ ...INITIAL_DRAFT, notes: [] })).toBe(FAN_BRIEF)
  })

  it('returns the last note when notes exist', () => {
    const draft: Draft = { ...INITIAL_DRAFT, notes: [{ id: 1, text: 'first note' }, { id: 2, text: 'most recent note' }] }
    expect(briefOf(draft)).toBe('most recent note')
  })
})

describe('money / currency formatting, from cents', () => {
  it('money renders whole dollars, and cents only when there are some', () => {
    expect(money(14_500)).toBe('$145')
    expect(money(14_750)).toBe('$147.50')
    expect(money(-3_500)).toBe('-$35')
  })

  it('currency renders two decimals', () => {
    expect(currency.format(14_500)).toBe('$145.00')
  })
})

describe('includedComponents', () => {
  it('reflects minutes, setting, and greeting type for the initial (richer) draft', () => {
    const components = includedComponents(view, INITIAL_DRAFT)
    expect(components).toHaveLength(3)
    expect(components[0]).toMatchObject({ label: 'Duration', value: '3-Minute Video' })
    expect(components[1]).toMatchObject({ label: 'Setting', value: 'Vintage Lounge Setup' })
    expect(components[2]).toMatchObject({ label: 'Personalization', value: 'Detailed Greeting' })
  })

  it('reflects a longer, standard-greeting draft', () => {
    const components = includedComponents(view, { ...INITIAL_DRAFT, focus: 'longer', extraMinute: true })
    expect(components[0]).toMatchObject({ label: 'Duration', value: '5-Minute Video' })
    expect(components[2]).toMatchObject({ label: 'Personalization', value: 'Standard Greeting' })
  })
})
