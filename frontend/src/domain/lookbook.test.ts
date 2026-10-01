import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CREATOR_PROFILE,
  fanCategories,
  parseCreatorProfile,
  PROFILE_LIMITS,
  starterProfile,
  withProfileLimits,
  type CreatorProfile,
} from '../../../shared/domain/creatorProfile.ts'
import { buildSelectionInventory, SELECTION_INVENTORY_SCHEMA } from '../../../shared/domain/selectionInventory.ts'
import { lookbookCopy, lookbookErrorMessage } from '../copy/creatorLookbook'
import { DEMO_VIEW as view } from '../state/catalog'
import { sceneCardSnapshot } from '../state/selectionInventory'
import { buildLineItems, INITIAL_DRAFT, localQuote, sumOf, type Draft } from './sceneCard'

const anyImage = { imageAllowed: () => true }
const clone = (p: CreatorProfile): CreatorProfile => structuredClone(p)

function snapshot(draft: Draft = INITIAL_DRAFT) {
  const quote = localQuote(view, draft)
  const lineItems = buildLineItems(view, draft, quote)
  return sceneCardSnapshot({ view, draft, lineItems, total: quote.total, deliveryDays: quote.deliveryDaysFromPayment })
}

describe('the lookbook profile', () => {
  it('reads the demo profile back unchanged', () => {
    const parsed = parseCreatorProfile(DEFAULT_CREATOR_PROFILE, anyImage)
    expect(parsed).toEqual({ ok: true, profile: DEFAULT_CREATOR_PROFILE })
  })

  it('refuses rather than trims what it can’t store', () => {
    const tooLong = clone(DEFAULT_CREATOR_PROFILE)
    tooLong.categories[0].name = 'x'.repeat(PROFILE_LIMITS.categoryName + 1)
    expect(parseCreatorProfile(tooLong, anyImage)).toEqual({ ok: false, field: 'categories.0.name' })

    const duplicate = clone(DEFAULT_CREATOR_PROFILE)
    duplicate.categories[1].name = 'CLOTHING'
    expect(parseCreatorProfile(duplicate, anyImage)).toEqual({ ok: false, field: 'categories.1.name' })

    const tooManyLimits = clone(DEFAULT_CREATOR_PROFILE)
    tooManyLimits.boundaries.hardNo = Array.from({ length: 11 }, (_, i) => `Limit ${i}`)
    expect(parseCreatorProfile(tooManyLimits, anyImage)).toEqual({ ok: false, field: 'boundaries.hardNo' })

    const notMine = parseCreatorProfile(DEFAULT_CREATOR_PROFILE, { imageAllowed: (url) => url.startsWith('/api/media/') })
    expect(notMine).toEqual({ ok: false, field: 'categories.0.items.0.image' })
  })

  it('drops blank limit lines and keeps the starter adult categories adult', () => {
    const edited = clone(DEFAULT_CREATOR_PROFILE)
    edited.boundaries.askFirst = ['  Wardrobe changes ', '', '   ']
    const fetishes = edited.categories.find((c) => c.id === 'fetishes')!
    delete fetishes.contentRating
    const parsed = parseCreatorProfile(edited, anyImage)
    expect(parsed.ok && parsed.profile.boundaries.askFirst).toEqual(['Wardrobe changes'])
    expect(parsed.ok && parsed.profile.categories.find((c) => c.id === 'fetishes')?.contentRating).toBe('adult')
  })

  it('shows fans no adult category unless adult content is allowed', () => {
    const ids = (adultAllowed: boolean) => fanCategories(DEFAULT_CREATOR_PROFILE, { adultAllowed }).map((c) => c.id)
    expect(ids(false)).toEqual(['clothing', 'scene', 'accessories', 'props', 'costumes'])
    expect(ids(true)).toContain('fetishes')
  })

  it('starts a real creator from their own name and none of the demo’s images', () => {
    const starter = starterProfile('Rae Studio')
    expect(starter.brand.name).toBe('Rae Studio')
    expect(starter.categories.flatMap((c) => c.items)).toEqual([])
  })

  it('adds the creator’s own limits after the catalog’s, without repeats', () => {
    const merged = withProfileLimits(view.boundaries, { hardNo: ['No feet', 'anything explicit'], askFirst: ['Wardrobe changes'] })
    const texts = merged.hardNo.map((l) => l.text)
    expect(texts.slice(0, view.boundaries.hardNo.length)).toEqual(view.boundaries.hardNo.map((l) => l.text))
    expect(texts.filter((t) => t.toLowerCase() === 'anything explicit')).toHaveLength(1)
    expect(texts).toContain('No feet')
    expect(merged.askFirst.map((l) => l.text)).toContain('Wardrobe changes')
    expect(merged.platform).toBe(view.boundaries.platform)
  })
})

describe('the selection inventory (the AI playback hand-off)', () => {
  const inventory = (choices: Record<string, string[]>, profile = DEFAULT_CREATOR_PROFILE) => buildSelectionInventory({
    source: 'demo', profile, choices, adultAllowed: false, boundaries: view.boundaries, sceneCard: snapshot(),
  })

  it('lists every fan-visible category, with picks or model’s preference', () => {
    const result = inventory({ clothing: ['swimsuit'], props: ['oil', 'glasses'] })
    expect(result.schema).toBe(SELECTION_INVENTORY_SCHEMA)
    expect(result.categories.map((c) => c.categoryId)).toEqual(['clothing', 'scene', 'accessories', 'props', 'costumes'])
    expect(result.categories[0].choice).toEqual({ kind: 'selected', items: [{ itemId: 'swimsuit', name: 'Black one-piece swimsuit', image: '/lookbook/swimsuit.webp' }] })
    expect(result.categories[1].choice).toEqual({ kind: 'model_preference' })
    // The creator's order, not the order the fan clicked in.
    expect(result.categories[3].choice).toMatchObject({ kind: 'selected', items: [{ itemId: 'glasses' }, { itemId: 'oil' }] })
  })

  it('leaves out unknown items, picks past the limit, adult categories and in-browser image data', () => {
    const profile = clone(DEFAULT_CREATOR_PROFILE)
    profile.categories[0].items.push({ id: 'robe', name: 'Robe', image: 'data:image/webp;base64,AAAA', custom: true })
    const result = inventory({ clothing: ['robe', 'bra', 'ghost'], fetishes: ['anything'] }, profile)
    expect(result.categories[0].choice).toEqual({ kind: 'selected', items: [{ itemId: 'bra', name: 'Black satin bra', image: '/lookbook/bra.webp' }] })
    expect(result.categories.some((c) => c.categoryId === 'fetishes')).toBe(false)

    const robeOnly = inventory({ clothing: ['robe'] }, profile)
    expect(robeOnly.categories[0].choice).toEqual({ kind: 'selected', items: [{ itemId: 'robe', name: 'Robe', image: null }] })
  })

  it('carries the limits and a Scene Card whose total is its lines’ sum', () => {
    const result = inventory({})
    expect(result.boundaries.hardNo).toEqual(view.boundaries.hardNo.map((l) => l.text))
    expect(result.boundaries.askFirst).toEqual(expect.arrayContaining(['Wardrobe changes', 'Props and accessories']))
    expect(result.boundaries.platform.length).toBeGreaterThan(0)
    const card = result.sceneCard
    expect(card.catalogVersionId).toBe(view.versionId)
    expect(card.settingKey).toBe('vintage')
    expect(card.totalCents).toBe(card.lineItems.reduce((sum, line) => sum + line.amountCents, 0))
    expect(card.totalCents).toBe(sumOf(buildLineItems(view, INITIAL_DRAFT, localQuote(view, INITIAL_DRAFT))))
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })
})

describe('the lookbook editor’s wording', () => {
  it('never says the demo saved anything', () => {
    const demoLines = [lookbookCopy.introDemo, lookbookCopy.itemAddedDemo, lookbookCopy.brandNoteDemo]
    for (const line of demoLines) expect(line, line).not.toMatch(/\bsaved?\b(?! anything)/i)
    expect(lookbookCopy.introDemo).toMatch(/resets when you refresh/)
  })

  it('tells a creator what saving does, and that fans don’t see the lookbook yet', () => {
    expect(lookbookCopy.introAccount).toMatch(/creator account/)
    expect(lookbookCopy.itemAddedAccount).toMatch(/Save changes/)
    expect(lookbookCopy.fansDontSeeYet).toMatch(/Fans don’t see/)
  })

  it('turns every server refusal into a sentence, never a code', () => {
    for (const code of ['revision_conflict', 'unknown_media', 'adult_content_disabled', 'media_storage_unavailable', 'media_limit_reached', 'invalid_image', 'invalid_profile', 'body_too_large', 'network', 'not_a_creator', 'whatever']) {
      const message = lookbookErrorMessage(400, code, {})
      expect(message).not.toMatch(/_/)
      expect(message.length).toBeGreaterThan(20)
    }
  })
})
