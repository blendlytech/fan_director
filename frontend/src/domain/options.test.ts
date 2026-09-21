import { describe, expect, it } from 'vitest'
import { validateSelections } from '../../../shared/domain/validate.ts'
import {
  applyTemplate,
  choiceLabel,
  optionGroups,
  personalParts,
  pickOption,
  resaleResolutions,
  sendBlockers,
  setScript,
  templateCards,
  templateDropsScript,
  videoNotice,
} from './options'
import { draftFromSelections, INITIAL_DRAFT, localQuote, selectionsOf, type Draft } from './sceneCard'
import { STAGING_INITIAL_VIEW as view } from '../state/catalog'

/* Design 20 and design 24 B–D on Maya's pilot catalog. */

const start: Draft = draftFromSelections(view, selectionsOf(view, INITIAL_DRAFT), { notes: [], customRequest: null })
const apply = (d: Draft, changes: Partial<Draft>): Draft => ({ ...d, ...changes })
const valid = (d: Draft) => validateSelections(view.content, selectionsOf(view, d), { adultAllowed: false }).ok
const choice = (d: Draft, group: string, itemId: string) =>
  optionGroups(view, d).find((g) => g.key === group)!.choices.find((c) => c.item.id === itemId)!

describe('design 20 B: option groups', () => {
  it('shows name, rights, quality and delivery in the designed order, with the defaults selected', () => {
    const groups = optionGroups(view, start)
    expect(groups.map((g) => g.title)).toEqual(['Your name in the video', 'Who gets the video', 'Video quality', 'Delivery'])
    const selected = groups.flatMap((g) => g.choices.filter((c) => c.selected).map((c) => c.item.id))
    expect(selected).toEqual(['maya_name_none', 'maya_rights_resell', 'maya_resolution_hd', 'maya_delivery_standard'])
  })

  it('prices each choice on this draft: included, fixed, and percent with its amount', () => {
    expect(choice(start, 'name_use', 'maya_name_none').priceLabel).toBe('Included')
    expect(choice(start, 'name_use', 'maya_name_throughout').priceLabel).toBe('+$15')
    expect(choice(start, 'resolution', 'maya_resolution_4k').priceLabel).toBe('+$25')
    // 50% of the $145 subtotal (video $90, Vintage $35, detailed greeting $20).
    expect(choice(start, 'rights', 'maya_rights_exclusive').priceLabel).toBe('+50% · $72.50')
    expect(choice(start, 'delivery', 'maya_delivery_rush').priceLabel).toBe('+50% · $72.50')
  })

  it('design 20 C: a personal, exclusive 4K draft totals $255 like the design', () => {
    let d = apply(start, pickOption(view, start, 'maya_name_once'))
    d = apply(d, pickOption(view, d, 'maya_resolution_4k'))
    expect(localQuote(view, d, null).total).toBe(25_500)
  })
})

describe('the resale rule (doc 11 §5.7)', () => {
  it('picking a name while resale is on also makes the video just for the fan', () => {
    const d = apply(start, pickOption(view, start, 'maya_name_once'))
    const ids = selectionsOf(view, d).map((s) => s.itemId)
    expect(ids).toContain('maya_rights_exclusive')
    expect(ids).not.toContain('maya_rights_resell')
    expect(valid(d)).toBe(true)
  })

  it('resale is unavailable, with its reason, while the video says the name', () => {
    const d = apply(start, pickOption(view, start, 'maya_name_once'))
    expect(choice(d, 'rights', 'maya_rights_resell').unavailableReason).toBe(
      'Not available: this video says your name, so only you get it.',
    )
    expect(choice(start, 'rights', 'maya_rights_resell').unavailableReason).toBeNull()
  })

  it('the reason names the script, or both', () => {
    const script = apply(start, setScript(view, start, true))
    expect(choice(script, 'rights', 'maya_rights_resell').unavailableReason).toMatch(/uses your script/)
    const both = apply(script, pickOption(view, script, 'maya_name_once'))
    expect(choice(both, 'rights', 'maya_rights_resell').unavailableReason).toMatch(/says your name and uses your script/)
  })

  it('removing the name never changes the rights by itself (design 24 C)', () => {
    let d = apply(start, pickOption(view, start, 'maya_name_once'))
    d = apply(d, pickOption(view, d, 'maya_name_none'))
    expect(selectionsOf(view, d).map((s) => s.itemId)).toContain('maya_rights_exclusive')
    expect(personalParts(view, d)).toEqual({ name: false, script: false })
  })

  it('every pick keeps the draft valid', () => {
    let d = start
    for (const id of ['maya_name_throughout', 'maya_resolution_4k', 'maya_delivery_rush', 'maya_name_none', 'maya_rights_resell']) {
      d = apply(d, pickOption(view, d, id))
      expect(valid(d)).toBe(true)
    }
  })
})

describe('design 20 C / C2: the notice under the total', () => {
  it('says resale by default and exclusive once chosen', () => {
    expect(videoNotice(view, start)).toBe('resale')
    expect(videoNotice(view, apply(start, pickOption(view, start, 'maya_rights_exclusive')))).toBe('exclusive')
  })
})

describe('design 24 B and C: what blocks sending', () => {
  it('a name option without a name blocks sending until it is saved', () => {
    const d = apply(start, pickOption(view, start, 'maya_name_once'))
    expect(sendBlockers(view, d)).toEqual(['Add the name Maya should use'])
    expect(sendBlockers(view, { ...d, fanDisplayName: 'Sam' })).toEqual([])
  })

  it('an empty script blocks sending; a written one does not', () => {
    const d = apply(start, setScript(view, start, true))
    expect(sendBlockers(view, d)).toEqual(['Write your script, or remove this option'])
    expect(sendBlockers(view, { ...d, fanScript: 'Hi Sam.' })).toEqual([])
  })

  it('removing the script item discards the text and the price', () => {
    const on = { ...apply(start, setScript(view, start, true)), fanScript: 'Hi Sam.' }
    expect(localQuote(view, on, null).total - localQuote(view, start, null).total).toBeGreaterThan(0)
    const off = apply(on, setScript(view, on, false))
    expect(off.fanScript).toBeNull()
    expect(personalParts(view, off).script).toBe(false)
  })

  it('the saved name goes into the option labels (design 24 B2)', () => {
    const item = choice(start, 'name_use', 'maya_name_once').item
    expect(choiceLabel(item, 'Sam')).toBe('Says “Sam” once')
    expect(choiceLabel(item, null)).toBe('Says your name once')
  })

  it('picking "No name" keeps the name on the draft', () => {
    const named = { ...apply(start, pickOption(view, start, 'maya_name_once')), fanDisplayName: 'Sam' }
    expect(apply(named, pickOption(view, named, 'maya_name_none')).fanDisplayName).toBe('Sam')
  })
})

describe('design 24 D: resolving a resale conflict', () => {
  // A draft the normal UI can't build: a name with resale (e.g. from another window).
  const conflict: Draft = {
    ...draftFromSelections(
      view,
      [...selectionsOf(view, start).filter((s) => s.itemId !== 'maya_name_none'), { itemId: 'maya_name_once', qty: 1 }],
      { notes: [], customRequest: null, fanDisplayName: 'Sam' },
    ),
  }

  it('the conflict really is invalid', () => {
    expect(valid(conflict)).toBe(false)
  })

  it('both ways out are valid and priced', () => {
    const { keep, remove } = resaleResolutions(view, conflict)
    const kept = apply(conflict, keep!.changes)
    const removed = apply(conflict, remove.changes)
    expect(valid(kept)).toBe(true)
    expect(valid(removed)).toBe(true)
    expect(keep!.total).toBe(localQuote(view, kept, null).total)
    expect(remove.total).toBe(localQuote(view, removed, null).total)
    expect(personalParts(view, removed)).toEqual({ name: false, script: false })
  })
})

describe('design 20 A: templates', () => {
  it('lists the general templates with their own priced build', () => {
    const cards = templateCards(view)
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      const d = apply(start, applyTemplate(view, start, card))
      expect(valid(d)).toBe(true)
      expect(localQuote(view, d, null).total).toBe(card.fromPrice)
    }
  })

  it('asks before a template discards the script', () => {
    const card = templateCards(view)[0]
    const withScript = { ...apply(start, setScript(view, start, true)), fanScript: 'Hi' }
    expect(templateDropsScript(view, withScript, card)).toBe(!card.selections.some((s) => s.itemId === 'maya_fan_script'))
    expect(templateDropsScript(view, start, card)).toBe(false)
  })
})
