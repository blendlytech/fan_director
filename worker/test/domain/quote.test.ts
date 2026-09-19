import { describe, expect, it } from 'vitest'
import { normalizeContent, visibleContent } from '../../../shared/domain/catalog.ts'
import { percentOf, quote } from '../../../shared/domain/quote.ts'
import { defaultSelections, priceRange, validTemplates } from '../../../shared/domain/ranges.ts'
import type { Selection } from '../../../shared/domain/types.ts'
import { PILOT_V1 } from '../../../shared/catalog/pilot-v1.ts'

const off = { adultAllowed: false }
const on = { adultAllowed: true }

/** Maya's defaults plus the given overrides, keyed by item id. */
function draft(...extra: [string, number][]): Selection[] {
  const picks = new Map(defaultSelections(PILOT_V1, off).map((s) => [s.itemId, s.qty]))
  for (const [itemId, qty] of extra) picks.set(itemId, qty)
  return [...picks].filter(([, qty]) => qty > 0).map(([itemId, qty]) => ({ itemId, qty }))
}
function swap(selections: Selection[], from: string, to: string): Selection[] {
  return selections.map((s) => (s.itemId === from ? { itemId: to, qty: 1 } : s))
}
function priced(selections: Selection[], budget: number | null = null) {
  const q = quote(PILOT_V1, 'cv_maya_1', { selections, customRequest: null, budget }, off)
  if (!q.ok) throw new Error(`expected a quote, got ${JSON.stringify(q.error)}`)
  return q.value
}

const richer = () => swap(draft(['maya_setting_vintage', 1]), 'maya_greeting_standard', 'maya_greeting_detailed')

describe('doc 10 §9 reference figures, in cents', () => {
  it('$90 base + $35 lounge + $20 greeting = $145, leaving $5 of $150', () => {
    const q = priced(richer(), 15_000)
    expect(q.total).toBe(14_500)
    expect(q.budgetDifference).toBe(500)
  })

  it('adding the $40 minute gives $185, $35 over; removing it restores $145', () => {
    const longer = priced([...richer(), { itemId: 'maya_extra_minute', qty: 1 }], 15_000)
    expect(longer.total).toBe(18_500)
    expect(longer.budgetDifference).toBe(-3_500)
    expect(priced(richer(), 15_000).total).toBe(14_500)
  })

  it('the demo e2e path: Backstage, longer, extra minute = $185', () => {
    const q = priced(draft(['maya_setting_backstage', 1], ['maya_extra_minute', 2]))
    expect(q.total).toBe(18_500)
    expect(q.minutes).toBe(5)
  })

  it('has no budget line without a budget (budget is optional)', () => {
    expect(priced(richer()).budgetDifference).toBeNull()
  })
})

describe('quote lines', () => {
  it('lists every selected item in catalog order, with $0 lines kept', () => {
    const q = priced(richer())
    expect(q.lines.map((l) => l.key)).toEqual([
      'base_video',
      'orientation_vertical',
      'vintage',
      'creators_choice',
      'greeting_detailed',
      'name_none',
      'delivery_standard',
      'rights_resell',
      'resolution_hd',
    ])
    expect(q.total).toBe(q.lines.reduce((sum, l) => sum + l.amount, 0))
    expect(q.minutes).toBe(3)
    expect(q.deliveryDaysFromPayment).toBe(7)
  })

  it('prices percentage lines on the fixed and per-unit subtotal, never on each other', () => {
    // 9000 + 3500 + 2500 (4K) = 15000; exclusive +50% and rush +50% are 7500 each.
    const selections = swap(
      swap(swap(draft(['maya_setting_vintage', 1]), 'maya_resolution_hd', 'maya_resolution_4k'), 'maya_rights_resell', 'maya_rights_exclusive'),
      'maya_delivery_standard',
      'maya_delivery_rush',
    )
    const q = priced(selections)
    expect(q.lines.find((l) => l.key === 'rights_exclusive')).toMatchObject({ amount: 7_500, label: 'Just for you (exclusive) (+50%)' })
    expect(q.lines.find((l) => l.key === 'delivery_rush')).toMatchObject({ amount: 7_500, label: 'Rush delivery (+50%)' })
    expect(q.total).toBe(30_000)
    expect(q.deliveryDaysFromPayment).toBe(2)
  })

  it('rounds each percentage line to the nearest cent, half up', () => {
    expect(percentOf(3_335, 5_000)).toBe(1_668) // 1667.5
    expect(percentOf(3_333, 5_000)).toBe(1_667) // 1666.5 rounds up
    expect(percentOf(1, 4_900)).toBe(0) // 0.49
    expect(percentOf(1, 5_000)).toBe(1) // 0.5
    expect(percentOf(999, 1_250)).toBe(125) // 124.875
  })

  it('never prices the custom request, and marks it pending', () => {
    const q = quote(PILOT_V1, 'v', { selections: richer(), customRequest: 'A red dress', budget: null }, off)
    expect(q.ok && q.value.total).toBe(14_500)
    expect(q.ok && q.value.customRequestPending).toBe(true)
  })

  it('never lets delivery drop below one day', () => {
    const fast = normalizeContent({
      delivery: { standardDaysFromPayment: 2 },
      categories: [{ key: 'c', contentRating: 'general', hidden: false, selection: { min: 1, max: 1 }, items: [
        { id: 'fast', contentRating: 'general', hidden: false, pricing: { kind: 'fixed', amount: 100 }, effects: { deliveryDaysDelta: -10 } },
      ] }],
    })
    const q = quote(fast, 'v', { selections: [{ itemId: 'fast', qty: 1 }], customRequest: null, budget: null }, off)
    expect(q.ok && q.value.deliveryDaysFromPayment).toBe(1)
  })
})

describe('typed rejections, never repaired', () => {
  const reject = (selections: Selection[], opts = off) => {
    const q = quote(PILOT_V1, 'v', { selections, customRequest: null, budget: null }, opts)
    if (q.ok) throw new Error('expected a rejection')
    return q.error
  }

  it('rejects an unknown item', () => {
    expect(reject([...richer(), { itemId: 'made_up', qty: 1 }])).toEqual({ code: 'unknown_item', itemId: 'made_up' })
  })
  it('rejects a duplicate selection', () => {
    expect(reject([...richer(), { itemId: 'maya_base_video', qty: 1 }]).code).toBe('unknown_item')
  })
  it('rejects a quantity over the item limit', () => {
    expect(reject([...richer(), { itemId: 'maya_extra_minute', qty: 3 }])).toEqual({
      code: 'qty_out_of_range', itemId: 'maya_extra_minute', min: 1, max: 2,
    })
  })
  it('rejects qty above 1 on a fixed item', () => {
    expect(reject(richer().map((s) => (s.itemId === 'maya_base_video' ? { ...s, qty: 2 } : s))).code).toBe('qty_out_of_range')
  })
  it('rejects a missing required choice (no setting)', () => {
    expect(reject(draft())).toMatchObject({ code: 'group_count', categoryKey: 'setting', min: 1, count: 0 })
  })
  it('rejects two choices in a choose-one group', () => {
    expect(reject([...richer(), { itemId: 'maya_greeting_standard', qty: 1 }])).toMatchObject({
      code: 'group_count', categoryKey: 'personalization_delivery', groupKey: 'greeting', count: 2,
    })
  })
  it('rejects two settings', () => {
    expect(reject([...richer(), { itemId: 'maya_setting_floral', qty: 1 }])).toMatchObject({ code: 'group_count', categoryKey: 'setting' })
  })
  it('rejects a personalised video that may be resold (§5.7)', () => {
    expect(reject(swap(richer(), 'maya_name_none', 'maya_name_once')).code).toBe('personalised_video_resale_forbidden')
    expect(reject([...richer(), { itemId: 'maya_fan_script', qty: 1 }]).code).toBe('personalised_video_resale_forbidden')
  })
  it('accepts a personalised video that is exclusive', () => {
    const ok = swap(swap(richer(), 'maya_name_none', 'maya_name_throughout'), 'maya_rights_resell', 'maya_rights_exclusive')
    expect(priced(ok).total).toBe(Math.floor(((9_000 + 3_500 + 2_000 + 1_500) * 3) / 2))
  })

  const gated = normalizeContent({
    categories: [
      { key: 'base', contentRating: 'general', hidden: false, selection: { min: 1, max: 1 }, items: [
        { id: 'b', contentRating: 'general', hidden: false, pricing: { kind: 'fixed', amount: 100 } },
      ] },
      { key: 'extras', contentRating: 'general', hidden: false, selection: { min: 0, max: 3 }, items: [
        { id: 'hidden', contentRating: 'general', hidden: true, pricing: { kind: 'fixed', amount: 1 } },
        { id: 'needs_b2', contentRating: 'general', hidden: false, pricing: { kind: 'included' }, requires: ['b2'] },
        { id: 'b2', contentRating: 'general', hidden: false, pricing: { kind: 'included' }, excludes: ['x'] },
        { id: 'x', contentRating: 'general', hidden: false, pricing: { kind: 'included' } },
      ] },
      { key: 'intimate', contentRating: 'adult', hidden: false, selection: { min: 0, max: 1 }, items: [
        { id: 'adult', contentRating: 'adult', hidden: false, pricing: { kind: 'fixed', amount: 1 } },
      ] },
      { key: 'legacy', contentRating: 'general', selection: { min: 0, max: 1 }, items: [
        { id: 'no_flags', pricing: { kind: 'fixed', amount: 1 } },
      ] },
    ],
  })
  const q = (ids: string[], opts = off) =>
    quote(gated, 'v', { selections: ids.map((itemId) => ({ itemId, qty: 1 })), customRequest: null, budget: null }, opts)

  it('rejects a hidden item', () => {
    expect(q(['b', 'hidden'])).toEqual({ ok: false, error: { code: 'item_unavailable', itemId: 'hidden' } })
  })
  it('rejects an adult item while adult content is off', () => {
    expect(q(['b', 'adult'])).toEqual({ ok: false, error: { code: 'adult_disabled', itemId: 'adult' } })
  })
  it('allows an adult item only when the gate allows it (test process only)', () => {
    expect(q(['b', 'adult'], on).ok).toBe(true)
  })
  it('treats a Phase 1 item with no rating or hidden flag as adult and hidden', () => {
    expect(q(['b', 'no_flags'])).toMatchObject({ ok: false, error: { code: 'adult_disabled' } })
  })
  it('enforces requires and excludes', () => {
    expect(q(['b', 'needs_b2'])).toMatchObject({ ok: false, error: { code: 'requires_missing', requires: 'b2' } })
    expect(q(['b', 'b2', 'x'])).toMatchObject({ ok: false, error: { code: 'excluded_pair', excludes: 'x' } })
    expect(q(['b', 'needs_b2', 'b2']).ok).toBe(true)
  })
  it('removes adult and hidden content from what a fan can see', () => {
    const seen = visibleContent(gated, off)
    expect(seen.categories.map((c) => c.key)).toEqual(['base', 'extras'])
    expect(seen.categories[1].items.map((i) => i.id)).toEqual(['needs_b2', 'b2', 'x'])
  })
})

describe('pilot catalog v1', () => {
  it('keeps the adult categories defined, empty, hidden and invisible', () => {
    const adult = PILOT_V1.categories.filter((c) => c.contentRating === 'adult')
    expect(adult.map((c) => c.key)).toEqual(['props', 'participants', 'posing', 'encounter_type', 'specialty_acts'])
    expect(adult.every((c) => c.hidden && c.items.length === 0)).toBe(true)
    expect(visibleContent(PILOT_V1, off).categories.some((c) => c.contentRating === 'adult')).toBe(false)
    expect(visibleContent(PILOT_V1, on).categories.some((c) => c.contentRating === 'adult')).toBe(false)
  })

  it('has four valid general templates', () => {
    expect(validTemplates(PILOT_V1, off).map((t) => t.key)).toEqual(['just_us', 'follow_my_lead', 'in_uniform', 'up_close'])
  })

  it('hides a template that no longer validates, rather than repairing it', () => {
    const broken = {
      ...PILOT_V1,
      templates: PILOT_V1.templates.map((t) =>
        t.key === 'up_close' ? { ...t, selections: [...t.selections, { itemId: 'maya_setting_floral', qty: 1 }] } : t,
      ),
    }
    expect(validTemplates(broken, off).map((t) => t.key)).toEqual(['just_us', 'follow_my_lead', 'in_uniform'])
  })

  it('derives the entrance ranges from the selection groups (Gate 0 decision 2)', () => {
    expect(priceRange(PILOT_V1, 'maya_setting_vintage', off)).toEqual({ min: 12_500, max: 59_000 })
    expect(priceRange(PILOT_V1, 'maya_setting_floral', off)).toEqual({ min: 13_500, max: 61_000 })
    expect(priceRange(PILOT_V1, 'maya_setting_backstage', off)).toEqual({ min: 10_500, max: 55_000 })
  })

  it('gives no range for an item a fan cannot choose', () => {
    expect(priceRange(PILOT_V1, 'made_up', off)).toBeNull()
  })

  it('survives a JSON round trip unchanged (the stored form)', () => {
    expect(normalizeContent(JSON.parse(JSON.stringify(PILOT_V1)))).toEqual(JSON.parse(JSON.stringify(PILOT_V1)))
  })
})
