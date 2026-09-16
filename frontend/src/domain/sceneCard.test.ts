import { describe, it, expect } from 'vitest'
import type { Draft, SettingId, FocusId } from './sceneCard'
import {
  BUDGET,
  BASE_VIDEO_PRICE,
  BASE_MINUTES,
  PER_EXTRA_MINUTE,
  PERSONALIZED_GREETING_PRICE,
  SETTINGS,
  INITIAL_DRAFT,
  FAN_BRIEF,
  buildLineItems,
  sumOf,
  previewTotal,
  draftsFor,
  priceRangeOf,
  minutesOf,
  extraMinutesOf,
  briefOf,
  money,
  currency,
  includedComponents,
} from './sceneCard'

/* -------------------------------------------------------------------------- */
/*  buildLineItems                                                            */
/* -------------------------------------------------------------------------- */

describe('buildLineItems', () => {
  it('INITIAL_DRAFT (vintage, richer, no extra minute) has no runtime line', () => {
    const items = buildLineItems(INITIAL_DRAFT)

    expect(items.map((item) => item.id)).toEqual(['video', 'setup', 'greeting'])

    const [video, setup, greeting] = items
    expect(video.amount).toBe(BASE_VIDEO_PRICE)
    expect(setup.amount).toBe(35)
    expect(greeting.amount).toBe(PERSONALIZED_GREETING_PRICE)
    expect(sumOf(items)).toBe(145)
  })

  it('longer focus adds a +1 min runtime line right after video, with a $0 standard greeting', () => {
    const draft: Draft = { ...INITIAL_DRAFT, focus: 'longer', extraMinute: false }
    const items = buildLineItems(draft)

    expect(items.map((item) => item.id)).toEqual(['video', 'runtime', 'setup', 'greeting'])

    const runtime = items[1]
    expect(runtime.label).toBe('Extra Runtime (+1 min)')
    expect(runtime.amount).toBe(PER_EXTRA_MINUTE)

    const greeting = items[items.length - 1]
    expect(greeting.label).toBe('Standard Greeting')
    expect(greeting.amount).toBe(0)
  })

  it('longer + extraMinute stacks to +2 min and mentions 5 minutes total', () => {
    const draft: Draft = { ...INITIAL_DRAFT, focus: 'longer', extraMinute: true }
    const items = buildLineItems(draft)
    const runtime = items.find((item) => item.id === 'runtime')

    expect(runtime).toBeDefined()
    expect(runtime?.amount).toBe(80)
    expect(runtime?.label).toBe('Extra Runtime (+2 min)')
    expect(runtime?.detail).toContain('5 minutes total')
  })

  it('richer + extraMinute keeps the $20 personalized greeting alongside a +1 min runtime', () => {
    const draft: Draft = { ...INITIAL_DRAFT, focus: 'richer', extraMinute: true }
    const items = buildLineItems(draft)
    const runtime = items.find((item) => item.id === 'runtime')
    const greeting = items.find((item) => item.id === 'greeting')

    expect(runtime?.amount).toBe(40)
    expect(greeting?.label).toBe('Personalized Greeting')
    expect(greeting?.amount).toBe(PERSONALIZED_GREETING_PRICE)
  })

  it('the setup line always follows the chosen setting', () => {
    for (const setting of SETTINGS) {
      const draft: Draft = { ...INITIAL_DRAFT, setting: setting.id }
      const setup = buildLineItems(draft).find((item) => item.id === 'setup')

      expect(setup?.label).toBe(setting.lineLabel)
      expect(setup?.amount).toBe(setting.price)
    }
  })

  it('flags required vs. optional lines correctly', () => {
    const richer = buildLineItems(INITIAL_DRAFT)
    const video = richer.find((item) => item.id === 'video')
    const setup = richer.find((item) => item.id === 'setup')
    const greeting = richer.find((item) => item.id === 'greeting')

    expect(video).toMatchObject({ added: false, removable: false, edits: 'focus' })
    expect(setup).toMatchObject({ added: true, removable: false, edits: 'setting' })
    expect(greeting).toMatchObject({ added: true, removable: false, edits: 'focus' })

    const longer: Draft = { ...INITIAL_DRAFT, focus: 'longer' }
    const runtime = buildLineItems(longer).find((item) => item.id === 'runtime')
    expect(runtime).toMatchObject({ added: true, removable: true, edits: 'focus' })
  })

  it('notes never change the price', () => {
    const withoutNotes: Draft = { ...INITIAL_DRAFT, notes: [] }
    const withNotes: Draft = {
      ...INITIAL_DRAFT,
      notes: [{ id: 1, text: 'Please make it extra sparkly' }],
    }

    expect(sumOf(buildLineItems(withNotes))).toBe(sumOf(buildLineItems(withoutNotes)))
  })
})

/* -------------------------------------------------------------------------- */
/*  sumOf                                                                     */
/* -------------------------------------------------------------------------- */

describe('sumOf', () => {
  it('returns 0 for an empty list', () => {
    expect(sumOf([])).toBe(0)
  })

  it('sums line item amounts and matches buildLineItems for a draft', () => {
    const draft: Draft = { ...INITIAL_DRAFT, focus: 'longer', extraMinute: true }
    const items = buildLineItems(draft)
    const manualSum = items.reduce((total, item) => total + item.amount, 0)

    expect(sumOf(items)).toBe(manualSum)
    expect(sumOf(items)).toBe(sumOf(buildLineItems(draft)))
  })
})

/* -------------------------------------------------------------------------- */
/*  previewTotal                                                              */
/* -------------------------------------------------------------------------- */

describe('previewTotal', () => {
  it('equals sumOf(buildLineItems({ ...draft, ...changes }))', () => {
    const changes: Partial<Draft> = { focus: 'longer', extraMinute: true }
    expect(previewTotal(INITIAL_DRAFT, changes)).toBe(
      sumOf(buildLineItems({ ...INITIAL_DRAFT, ...changes })),
    )
  })

  it('does not mutate the passed draft', () => {
    const draft: Draft = { ...INITIAL_DRAFT, notes: [] }
    const snapshot = { ...draft, notes: [...draft.notes] }

    previewTotal(draft, { focus: 'longer', extraMinute: true })

    expect(draft).toEqual(snapshot)
  })

  it('vintage + longer (no extra minute) previews to 165', () => {
    expect(previewTotal(INITIAL_DRAFT, { focus: 'longer' })).toBe(165)
  })
})

/* -------------------------------------------------------------------------- */
/*  Every buildable draft: exact totals and the over-budget rule              */
/* -------------------------------------------------------------------------- */

describe('total pricing and the over-budget rule across every buildable draft', () => {
  const table: Array<{
    setting: SettingId
    focus: FocusId
    extraMinute: boolean
    total: number
    over: boolean
  }> = [
    { setting: 'vintage', focus: 'richer', extraMinute: false, total: 145, over: false },
    { setting: 'vintage', focus: 'richer', extraMinute: true, total: 185, over: true },
    { setting: 'vintage', focus: 'longer', extraMinute: false, total: 165, over: true },
    { setting: 'vintage', focus: 'longer', extraMinute: true, total: 205, over: true },
    { setting: 'floral', focus: 'richer', extraMinute: false, total: 155, over: true },
    { setting: 'floral', focus: 'richer', extraMinute: true, total: 195, over: true },
    { setting: 'floral', focus: 'longer', extraMinute: false, total: 175, over: true },
    { setting: 'floral', focus: 'longer', extraMinute: true, total: 215, over: true },
    { setting: 'backstage', focus: 'richer', extraMinute: false, total: 125, over: false },
    { setting: 'backstage', focus: 'richer', extraMinute: true, total: 165, over: true },
    { setting: 'backstage', focus: 'longer', extraMinute: false, total: 145, over: false },
    { setting: 'backstage', focus: 'longer', extraMinute: true, total: 185, over: true },
  ]

  it.each(table)(
    '$setting / $focus / extraMinute=$extraMinute totals $total (over=$over)',
    ({ setting, focus, extraMinute, total, over }) => {
      const draft: Draft = { ...INITIAL_DRAFT, setting, focus, extraMinute }
      const actualTotal = sumOf(buildLineItems(draft))

      expect(actualTotal).toBe(total)

      const difference = BUDGET - actualTotal
      expect(difference < 0).toBe(over)
    },
  )

  it('the over-budget rule is strictly "< 0": a total exactly at budget is not over', () => {
    // None of the 12 buildable drafts land exactly on BUDGET, so this pins the
    // rule itself rather than a real draft.
    expect(BUDGET - BUDGET < 0).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/*  draftsFor / priceRangeOf — entrance-card price ranges                     */
/* -------------------------------------------------------------------------- */

describe('draftsFor', () => {
  it('returns four drafts per setting, all with that setting and no notes', () => {
    for (const setting of SETTINGS) {
      const drafts = draftsFor(setting.id)
      expect(drafts).toHaveLength(4)
      for (const draft of drafts) {
        expect(draft.setting).toBe(setting.id)
        expect(draft.notes).toEqual([])
      }
    }
  })
})

describe('priceRangeOf', () => {
  const ranges: Record<SettingId, { min: number; max: number }> = {
    vintage: { min: 145, max: 205 },
    floral: { min: 155, max: 215 },
    backstage: { min: 125, max: 185 },
  }

  it.each(Object.entries(ranges) as Array<[SettingId, { min: number; max: number }]>)(
    '%s ranges from %o',
    (setting, expected) => {
      expect(priceRangeOf(setting)).toEqual(expected)
    },
  )

  it('min/max equal Math.min/max over the derived totals of draftsFor', () => {
    for (const setting of SETTINGS) {
      const totals = draftsFor(setting.id).map((draft) => sumOf(buildLineItems(draft)))
      expect(priceRangeOf(setting.id)).toEqual({
        min: Math.min(...totals),
        max: Math.max(...totals),
      })
    }
  })
})

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

describe('minutesOf / extraMinutesOf', () => {
  const table: Array<{
    focus: FocusId
    extraMinute: boolean
    extraMinutes: number
    minutes: number
  }> = [
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
      expect(minutesOf(draft)).toBe(minutes)
      expect(minutesOf(draft)).toBe(BASE_MINUTES + extraMinutesOf(draft))
    },
  )
})

describe('briefOf', () => {
  it('falls back to FAN_BRIEF when there are no notes', () => {
    expect(briefOf({ ...INITIAL_DRAFT, notes: [] })).toBe(FAN_BRIEF)
  })

  it('returns the last note when notes exist', () => {
    const draft: Draft = {
      ...INITIAL_DRAFT,
      notes: [
        { id: 1, text: 'first note' },
        { id: 2, text: 'most recent note' },
      ],
    }
    expect(briefOf(draft)).toBe('most recent note')
  })
})

describe('money / currency formatting', () => {
  it('money renders whole dollars', () => {
    expect(money(145)).toBe('$145')
  })

  it('currency renders two decimals', () => {
    expect(currency.format(145)).toBe('$145.00')
  })
})

describe('includedComponents', () => {
  it('reflects minutes, setting, and greeting type for the initial (richer) draft', () => {
    const components = includedComponents(INITIAL_DRAFT)

    expect(components).toHaveLength(3)
    expect(components[0]).toMatchObject({ label: 'Duration', value: '3-Minute Video' })
    expect(components[1]).toMatchObject({ label: 'Setting', value: 'Vintage Lounge Setup' })
    expect(components[2]).toMatchObject({ label: 'Personalization', value: 'Detailed Greeting' })
  })

  it('reflects a longer, standard-greeting draft', () => {
    const draft: Draft = { ...INITIAL_DRAFT, focus: 'longer', extraMinute: true }
    const components = includedComponents(draft)

    expect(components[0]).toMatchObject({ label: 'Duration', value: '5-Minute Video' })
    expect(components[2]).toMatchObject({ label: 'Personalization', value: 'Standard Greeting' })
  })
})
