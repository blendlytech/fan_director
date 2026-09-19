import { describe, expect, it } from 'vitest'
import {
  allowedItems,
  buildOption,
  DIRECTOR_SLOTS_V1,
  optionTitle,
  sameSelections,
  type DirectorOption,
} from '../../../shared/domain/director.ts'
import { defaultSelections } from '../../../shared/domain/ranges.ts'
import type { CatalogContent, Selection } from '../../../shared/domain/types.ts'
import { PILOT_V1 } from '../../../shared/catalog/pilot-v1.ts'

const off = { adultAllowed: false }
const on = { adultAllowed: true }

/** Maya's defaults with the Vintage Lounge: $90 + $35 = $125. */
function start(): Selection[] {
  const picks = new Map(defaultSelections(PILOT_V1, off).map((s) => [s.itemId, s.qty]))
  for (const id of ['maya_setting_vintage', 'maya_setting_floral', 'maya_setting_backstage']) picks.delete(id)
  picks.set('maya_setting_vintage', 1)
  return [...picks].map(([itemId, qty]) => ({ itemId, qty }))
}

const ids = (content: CatalogContent, gate = off, excluded?: (id: string) => boolean) =>
  new Set(allowedItems(content, gate, { slots: DIRECTOR_SLOTS_V1, excluded: excluded && ((i) => excluded(i.id)) }).map((e) => e.item.id))

const opt = (wants: [string, number][], removes: string[] = []): DirectorOption => ({
  label: 'model label',
  wants: wants.map(([itemId, qty]) => ({ itemId, qty })),
  removes,
})

function build(option: DirectorOption, current = start(), content = PILOT_V1, gate = off, intimate = false) {
  return buildOption(content, current, option, gate, { allowed: ids(content, gate), intimate })
}

/**
 * A synthetic adult category, switched on inside this test process only
 * (doc 11 §5.4, Gate 0 decision 3). Never seeded, never deployed.
 */
function withAdultFixture(): CatalogContent {
  return {
    ...PILOT_V1,
    categories: PILOT_V1.categories.map((c) =>
      c.key !== 'props'
        ? c
        : {
            ...c,
            hidden: false,
            selection: { min: 0, max: 1 },
            items: [
              { id: 'fx_adult_prop', key: 'fx_prop', label: 'Synthetic prop A', origin: 'starter', contentRating: 'adult', pricing: { kind: 'fixed', amount: 1_000 }, hidden: false, sortOrder: 0 },
            ],
          },
    ),
  }
}
const ADULT_SLOTS = [...DIRECTOR_SLOTS_V1, 'props']

describe('allowedItems: the per-request enum', () => {
  it('holds only the settings, greetings and the extra minute for Maya', () => {
    expect([...ids(PILOT_V1)].sort()).toEqual([
      'maya_extra_minute',
      'maya_greeting_detailed',
      'maya_greeting_standard',
      'maya_setting_backstage',
      'maya_setting_floral',
      'maya_setting_vintage',
    ])
  })

  it('leaves out slots the screens cannot show yet (rush, 4K, exclusive, name, script)', () => {
    const enumIds = ids(PILOT_V1)
    for (const id of ['maya_delivery_rush', 'maya_resolution_4k', 'maya_rights_exclusive', 'maya_name_throughout', 'maya_fan_script']) {
      expect(enumIds.has(id)).toBe(false)
    }
  })

  it('leaves out an item the server turned down as a hard no', () => {
    expect(ids(PILOT_V1, off, (id) => id === 'maya_setting_backstage').has('maya_setting_backstage')).toBe(false)
  })

  it('leaves out hidden items', () => {
    const hidden: CatalogContent = {
      ...PILOT_V1,
      categories: PILOT_V1.categories.map((c) =>
        c.key === 'setting' ? { ...c, items: c.items.map((i) => (i.id === 'maya_setting_floral' ? { ...i, hidden: true } : i)) } : c,
      ),
    }
    expect(ids(hidden).has('maya_setting_floral')).toBe(false)
  })

  it('never holds an adult item while adult content is off, even in a listed slot', () => {
    const content = withAdultFixture()
    const enumIds = new Set(allowedItems(content, off, { slots: ADULT_SLOTS }).map((e) => e.item.id))
    expect(enumIds.has('fx_adult_prop')).toBe(false)
    const allowedOn = new Set(allowedItems(content, on, { slots: ADULT_SLOTS }).map((e) => e.item.id))
    expect(allowedOn.has('fx_adult_prop')).toBe(true)
  })
})

describe('buildOption', () => {
  it('wanting the detailed greeting swaps out the standard one', () => {
    const r = build(opt([['maya_greeting_detailed', 1]]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.selections.some((s) => s.itemId === 'maya_greeting_standard')).toBe(false)
    expect(r.value.adds.map((a) => a.itemId)).toEqual(['maya_greeting_detailed'])
    expect(r.value.removes.map((a) => a.itemId)).toEqual(['maya_greeting_standard'])
    expect(optionTitle(r.value)).toBe('Detailed Greeting')
  })

  it('wanting a setting swaps the current setting', () => {
    const r = build(opt([['maya_setting_floral', 1]]))
    expect(r.ok && r.value.selections.filter((s) => s.itemId.startsWith('maya_setting_')).map((s) => s.itemId)).toEqual(['maya_setting_floral'])
  })

  it('caps qty at the item maximum', () => {
    const r = build(opt([['maya_extra_minute', 9]]))
    expect(r.ok && r.value.selections.find((s) => s.itemId === 'maya_extra_minute')?.qty).toBe(2)
    expect(r.ok && optionTitle(r.value)).toBe('Extra minute × 2')
  })

  it('removing the detailed greeting brings the standard one back', () => {
    const current = build(opt([['maya_greeting_detailed', 1]]))
    if (!current.ok) throw new Error('setup')
    const r = build(opt([], ['maya_greeting_detailed']), current.value.selections)
    expect(r.ok).toBe(true)
    expect(r.ok && r.value.selections.some((s) => s.itemId === 'maya_greeting_standard')).toBe(true)
    expect(r.ok && optionTitle(r.value)).toBe('Standard Greeting')
  })

  it('removing the extra minute leaves the group empty, which is allowed', () => {
    const current = build(opt([['maya_extra_minute', 1]]))
    if (!current.ok) throw new Error('setup')
    const r = build(opt([], ['maya_extra_minute']), current.value.selections)
    expect(r.ok && optionTitle(r.value)).toBe('Without Extra minute')
  })

  it('refuses an id outside the enum, even one in the catalog', () => {
    const r = build(opt([['maya_delivery_rush', 1]]))
    expect(r).toEqual({ ok: false, error: { code: 'unknown_item', itemId: 'maya_delivery_rush' } })
    expect(build(opt([['made_up_item', 1]]))).toEqual({ ok: false, error: { code: 'unknown_item', itemId: 'made_up_item' } })
    expect(build(opt([], ['maya_base_video'])).ok).toBe(false)
  })

  it('drops an option that changes nothing', () => {
    expect(build(opt([['maya_setting_vintage', 1]]))).toEqual({ ok: false, error: { code: 'no_change' } })
  })

  it('removing the only setting is invalid: nothing else fills a slot without a default', () => {
    const r = build(opt([], ['maya_setting_vintage']))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error.code).toBe('invalid')
  })

  it('never changes the current selections it was given', () => {
    const current = start()
    const copy = JSON.stringify(current)
    build(opt([['maya_greeting_detailed', 1], ['maya_extra_minute', 2]]), current)
    expect(JSON.stringify(current)).toBe(copy)
  })

  it('adds a required item, or drops the option when the requirement is outside the enum', () => {
    const content: CatalogContent = {
      ...PILOT_V1,
      categories: PILOT_V1.categories.map((c) =>
        c.key === 'personalization_delivery'
          ? { ...c, items: c.items.map((i) => (i.id === 'maya_greeting_detailed' ? { ...i, requires: ['maya_extra_minute'] } : i)) }
          : c,
      ),
    }
    const r = build(opt([['maya_greeting_detailed', 1]]), start(), content)
    expect(r.ok && r.value.selections.some((s) => s.itemId === 'maya_extra_minute')).toBe(true)

    const hard: CatalogContent = {
      ...content,
      categories: content.categories.map((c) =>
        c.key === 'personalization_delivery'
          ? { ...c, items: c.items.map((i) => (i.id === 'maya_greeting_detailed' ? { ...i, requires: ['maya_resolution_4k'] } : i)) }
          : c,
      ),
    }
    expect(build(opt([['maya_greeting_detailed', 1]]), start(), hard)).toEqual({
      ok: false,
      error: { code: 'requires_unavailable', itemId: 'maya_greeting_detailed', requires: 'maya_resolution_4k' },
    })
  })

  it('strips adult items the fan did not ask for, and keeps them when they did', () => {
    const content = withAdultFixture()
    const allowed = new Set(allowedItems(content, on, { slots: ADULT_SLOTS }).map((e) => e.item.id))
    const surprise = buildOption(content, start(), opt([['maya_greeting_detailed', 1], ['fx_adult_prop', 1]]), on, { allowed, intimate: false })
    expect(surprise.ok).toBe(true)
    expect(surprise.ok && surprise.value.selections.some((s) => s.itemId === 'fx_adult_prop')).toBe(false)
    expect(surprise.ok && surprise.value.strippedAdult).toEqual(['fx_adult_prop'])

    const onlyAdult = buildOption(content, start(), opt([['fx_adult_prop', 1]]), on, { allowed, intimate: false })
    expect(onlyAdult).toEqual({ ok: false, error: { code: 'adult_not_asked', itemIds: ['fx_adult_prop'] } })

    const asked = buildOption(content, start(), opt([['fx_adult_prop', 1]]), on, { allowed, intimate: true })
    expect(asked.ok && asked.value.selections.some((s) => s.itemId === 'fx_adult_prop')).toBe(true)
  })

  it('titles several changes with plain labels', () => {
    const r = build(opt([['maya_greeting_detailed', 1], ['maya_extra_minute', 1]]))
    expect(r.ok && optionTitle(r.value)).toBe('Extra minute and Detailed Greeting')
  })

  it('sameSelections ignores order', () => {
    expect(sameSelections([{ itemId: 'a', qty: 1 }, { itemId: 'b', qty: 2 }], [{ itemId: 'b', qty: 2 }, { itemId: 'a', qty: 1 }])).toBe(true)
    expect(sameSelections([{ itemId: 'a', qty: 1 }], [{ itemId: 'a', qty: 2 }])).toBe(false)
  })
})
