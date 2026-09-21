import { describe, expect, it } from 'vitest'
import { validateSelections } from '../../../shared/domain/validate.ts'
import type { Selection } from '../../../shared/domain/types.ts'
import { STAGING_INITIAL_VIEW as view } from '../state/catalog'
import { INITIAL_DRAFT, selectionsOf } from './sceneCard'
import {
  parsePriceDollars,
  previewProposal,
  proposalGroups,
  sameSelections,
  setChoiceQty,
  toggleChoice,
  type ProposalGroup,
} from './creatorProposal'

/* The creator's "propose changes" editor (design 05) on Maya's pilot catalog. */

const start: Selection[] = selectionsOf(view, INITIAL_DRAFT)
const valid = (s: readonly Selection[]) => validateSelections(view.content, [...s], { adultAllowed: false }).ok
const groupOf = (selections: readonly Selection[], id: string): ProposalGroup =>
  proposalGroups(view, selections).find((g) => g.id === id)!

describe('the groups the creator can edit', () => {
  it('mirrors the limits the catalog counts by, so every group has a real min and max', () => {
    for (const group of proposalGroups(view, start)) {
      expect(group.choices.length).toBeGreaterThan(0)
      expect(group.min).toBeLessThanOrEqual(group.max)
      expect(group.single).toBe(group.min === 1 && group.max === 1)
    }
  })

  it('marks what the version already holds as selected, at its quantity', () => {
    const withMinutes = start.some((s) => s.qty > 1) ? start : [...start]
    for (const group of proposalGroups(view, withMinutes)) {
      for (const choice of group.choices) {
        const selection = withMinutes.find((s) => s.itemId === choice.item.id)
        expect(choice.selected).toBe(selection !== undefined)
        if (selection) expect(choice.qty).toBe(selection.qty)
      }
    }
  })

  it('offers a quantity control only where the catalog prices per unit', () => {
    for (const group of proposalGroups(view, start)) {
      for (const choice of group.choices) {
        expect(choice.qtyRange !== null).toBe(choice.item.pricing.kind === 'per_unit')
      }
    }
  })
})

describe('changing the choices', () => {
  it('swaps inside a choose-one group and leaves a valid set', () => {
    const settings = proposalGroups(view, start).find((g) => g.single && g.choices.length > 1)!
    const other = settings.choices.find((c) => !c.selected)!
    const next = toggleChoice(settings, start, other.item.id)
    expect(next.filter((s) => settings.choices.some((c) => c.item.id === s.itemId))).toHaveLength(1)
    expect(next.some((s) => s.itemId === other.item.id)).toBe(true)
    expect(valid(next)).toBe(true)
  })

  it('refuses to empty a group the catalog requires, so the server can never see a short set', () => {
    const required = proposalGroups(view, start).find((g) => g.min >= 1 && g.choices.some((c) => c.selected))!
    const chosen = required.choices.find((c) => c.selected)!
    expect(toggleChoice(required, start, chosen.item.id)).toEqual(start)
  })

  it('adds and removes freely in a group that allows none', () => {
    const optional = proposalGroups(view, start).find((g) => g.min === 0 && g.max >= 1)
    if (!optional) return
    const choice = optional.choices.find((c) => !c.selected) ?? optional.choices[0]
    const added = toggleChoice(optional, start, choice.item.id)
    expect(added.some((s) => s.itemId === choice.item.id)).toBe(true)
    const removed = toggleChoice(groupOf(added, optional.id), added, choice.item.id)
    expect(removed.some((s) => s.itemId === choice.item.id)).toBe(false)
    expect(valid(removed)).toBe(true)
  })

  it('clamps a quantity to what the item allows', () => {
    const perUnit = proposalGroups(view, start)
      .flatMap((g) => g.choices.map((c) => ({ g, c })))
      .find(({ c }) => c.qtyRange !== null)
    if (!perUnit) return
    const withItem = toggleChoice(perUnit.g, start, perUnit.c.item.id)
    const group = groupOf(withItem, perUnit.g.id)
    const range = group.choices.find((c) => c.item.id === perUnit.c.item.id)!.qtyRange!
    const tooMany = setChoiceQty(group, withItem, perUnit.c.item.id, range.max + 5)
    expect(tooMany.find((s) => s.itemId === perUnit.c.item.id)!.qty).toBe(range.max)
    const tooFew = setChoiceQty(group, withItem, perUnit.c.item.id, range.min - 5)
    expect(tooFew.find((s) => s.itemId === perUnit.c.item.id)!.qty).toBe(range.min)
    expect(valid(tooMany)).toBe(true)
  })
})

describe('the preview total', () => {
  it('equals the shared quote the server prices with, plus the custom-request price', () => {
    const preview = previewProposal(view, start, 5_000)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.totalCents).toBe(preview.quote.total + 5_000)
  })

  it('reports an invalid set instead of guessing a number', () => {
    const broken = previewProposal(view, [{ itemId: 'not_a_real_item', qty: 1 }], null)
    expect(broken.ok).toBe(false)
  })
})

describe('the custom request price the creator types', () => {
  it('reads dollars as integer cents', () => {
    expect(parsePriceDollars('40')).toBe(4_000)
    expect(parsePriceDollars('40.50')).toBe(4_050)
    expect(parsePriceDollars('$1,250.25')).toBe(125_025)
    expect(parsePriceDollars('0')).toBe(0)
  })

  it('reads an empty field as "not priced yet", never as free', () => {
    expect(parsePriceDollars('')).toBe(null)
    expect(parsePriceDollars('   ')).toBe(null)
  })

  it('refuses anything that isn’t a price, rather than sending a guess', () => {
    for (const bad of ['abc', '4.005', '-5', '1e5', '40.', '100000000']) {
      expect(parsePriceDollars(bad), bad).toBeUndefined()
    }
  })
})

describe('telling a real change from none', () => {
  it('ignores the order of the selections', () => {
    expect(sameSelections(start, [...start].reverse())).toBe(true)
  })

  it('sees a changed quantity and a changed item', () => {
    const changedQty = start.map((s, i) => (i === 0 ? { ...s, qty: s.qty + 1 } : s))
    expect(sameSelections(start, changedQty)).toBe(false)
    expect(sameSelections(start, start.slice(1))).toBe(false)
  })
})
