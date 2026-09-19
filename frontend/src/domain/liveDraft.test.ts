import { describe, expect, it } from 'vitest'
import { changeChoice, draftFromSelections, greetingOf, includedComponents, INITIAL_DRAFT, localQuote, minutesOf, selectionsOf } from './sceneCard'
import { STAGING_INITIAL_VIEW as view } from '../state/catalog'

/* Staging-only drafts that carry server selections (designs 17 F and 18). */

const base = selectionsOf(view, INITIAL_DRAFT)

describe('drafts read from server selections', () => {
  it('a demo draft round-trips through its selections unchanged in price', () => {
    const d = draftFromSelections(view, base, { notes: [], customRequest: null })
    expect(d.setting).toBe('vintage')
    expect(d.focus).toBe('richer')
    expect(d.extraMinute).toBe(false)
    expect(localQuote(view, d).total).toBe(localQuote(view, INITIAL_DRAFT).total)
  })

  it('shows combinations the demo could not build: a standard greeting with no extra minute', () => {
    const d = { ...INITIAL_DRAFT, ...changeChoice(view, INITIAL_DRAFT, { greeting: 'standard' }) }
    expect(greetingOf(view, d)).toBe('standard')
    expect(minutesOf(view, d)).toBe(3)
    expect(localQuote(view, d).total).toBe(12_500)
    expect(includedComponents(view, d).map((c) => c.value)).toEqual(['3-Minute Video', 'Vintage Lounge Setup', 'Standard Greeting'])
  })

  it('a detailed greeting with two extra minutes prices every line', () => {
    const d = { ...INITIAL_DRAFT, ...changeChoice(view, INITIAL_DRAFT, { extraMinutes: 2 }) }
    expect(minutesOf(view, d)).toBe(5)
    expect(localQuote(view, d).total).toBe(9_000 + 3_500 + 2_000 + 8_000)
  })

  it('extra minutes are clamped to the catalog maximum', () => {
    const d = { ...INITIAL_DRAFT, ...changeChoice(view, INITIAL_DRAFT, { extraMinutes: 9 }) }
    expect(minutesOf(view, d)).toBe(3 + view.maxExtraMinutes)
  })

  it('choosing a setting swaps it and keeps the rest', () => {
    const d = { ...INITIAL_DRAFT, ...changeChoice(view, INITIAL_DRAFT, { setting: 'floral' }) }
    expect(d.setting).toBe('floral')
    expect(selectionsOf(view, d).filter((s) => s.itemId.startsWith('maya_setting_')).map((s) => s.itemId)).toEqual(['maya_setting_floral'])
    expect(greetingOf(view, d)).toBe('detailed')
  })

  it('the demo draft (no selections) is untouched by the new helpers', () => {
    expect(INITIAL_DRAFT.selections).toBeUndefined()
    expect(greetingOf(view, INITIAL_DRAFT)).toBe('detailed')
    expect(minutesOf(view, { ...INITIAL_DRAFT, focus: 'longer', extraMinute: true })).toBe(5)
  })
})
