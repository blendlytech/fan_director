import { describe, expect, it } from 'vitest'
import { effectiveLimits, renderBoundaries } from '../../../shared/domain/boundaries.ts'
import { HARD_LIST_KEYS } from '../../../shared/domain/hardList.ts'
import type { Boundaries } from '../../../shared/domain/types.ts'
import { PILOT_V1 } from '../../../shared/catalog/pilot-v1.ts'

const off = { adultAllowed: false }

describe('renderBoundaries', () => {
  it("renders Maya's pilot limits, hard no first, then the full hard list", () => {
    const r = renderBoundaries(PILOT_V1.boundaries, 'Maya', off)
    expect(r.hardNo.map((l) => l.text)).toEqual(['Anything explicit', 'Anything political', 'Brand mentions or ads'])
    expect(r.askFirst).toEqual([])
    expect(r.platform.map((p) => p.key)).toEqual([...HARD_LIST_KEYS])
    expect(r.wardrobeCreatorCurated).toBe(true)
    expect(r.customRequestPolicy).toBe('review')
  })

  it('uses Option 1 for prohibited_roles, two lines (§5.6 item 22)', () => {
    const roles = renderBoundaries(PILOT_V1.boundaries, 'Maya', off).platform.find((p) => p.key === 'prohibited_roles')
    expect(roles?.lines).toEqual([
      'School, babysitter or family roles, including step-family',
      'Playing someone else’s partner, or a named character from a film, show, game or anime',
    ])
  })

  it("puts the creator's name into the real-people rule", () => {
    const r = renderBoundaries(PILOT_V1.boundaries, 'Maya', off)
    expect(r.platform.find((p) => p.key === 'real_third_parties')?.lines).toEqual([
      'Real people other than Maya, Maya’s verified partners and you',
    ])
  })

  const b: Boundaries = {
    checklist: {
      non_explicit_only: { enabled: false, mode: 'ask_me' },
      no_political_content: { enabled: true, mode: 'ask_me' },
      no_brand_mentions: { enabled: false, mode: 'hard_no' },
      unlabelled_key: { enabled: true, mode: 'hard_no' },
    },
    custom: [
      { id: 'c1', text: '  Filming outdoors ', mode: 'hard_no' },
      { id: 'c2', text: 'Scenes with my partner, Leo', mode: 'ask_me' },
      { id: 'c3', text: '   ', mode: 'ask_me' },
    ],
    wardrobeCreatorCurated: false,
    customRequestPolicy: 'decline',
  }

  it("shows custom limits in the creator's own words, grouped by mode", () => {
    const r = renderBoundaries(b, 'Maya', off)
    expect(r.hardNo.map((l) => l.text)).toEqual(['Anything explicit', 'Filming outdoors'])
    expect(r.askFirst.map((l) => l.text)).toEqual(['Anything political', 'Scenes with my partner, Leo'])
  })

  it('never shows a raw key', () => {
    const texts = JSON.stringify(renderBoundaries(b, 'Maya', off))
    expect(texts).not.toContain('unlabelled_key')
  })

  it('forces "non-explicit only" on as a hard no while adult content is off', () => {
    expect(effectiveLimits(b, off).checklist.non_explicit_only).toEqual({ enabled: true, mode: 'hard_no' })
    expect(effectiveLimits(b, { adultAllowed: true }).checklist.non_explicit_only).toEqual({ enabled: false, mode: 'ask_me' })
  })
})
