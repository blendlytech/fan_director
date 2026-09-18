import { describe, expect, it } from 'vitest'
import { PILOT_V1 } from '../../shared/catalog/pilot-v1.ts'
import type { CatalogContent, Selection } from '../../shared/domain/types.ts'
import { defaultSelections } from '../../shared/domain/ranges.ts'
import { validateCatalogForPublish } from '../src/publish'
import { bodyOf, boutique, call, clerkUser, fanIdFor, publishedBoutique, publishNext, testEnv } from './helpers'

const off = { adultAllowed: false }
const base = defaultSelections(PILOT_V1, off)

function sel(...changes: [string, string | null][]): Selection[] {
  // Starts from Maya's defaults with Vintage and the detailed greeting ($145), then swaps items.
  let s: Selection[] = [...base, { itemId: 'maya_setting_vintage', qty: 1 }]
    .map((x) => (x.itemId === 'maya_greeting_standard' ? { itemId: 'maya_greeting_detailed', qty: 1 } : x))
  for (const [from, to] of changes) {
    s = s.filter((x) => x.itemId !== from)
    if (to) s.push({ itemId: to, qty: 1 })
  }
  return s
}
const withMinute = (s: Selection[], qty = 1) => [...s, { itemId: 'maya_extra_minute', qty }]

const quote = (creatorId: string, body: Record<string, unknown>, opts: Parameters<typeof call>[2] = {}) =>
  call('POST', `/api/creators/${creatorId}/quote`, { body, ...opts })
const draftPath = (creatorId: string, id: string) => `/api/creators/${creatorId}/drafts/${id}`
const draftBody = (catalogVersionId: string, expectedRevision: number, draft: Record<string, unknown> = {}) => ({
  expectedRevision,
  catalogVersionId,
  draft: { selections: sel(), fanDisplayName: null, customRequest: null, fanScript: null, notes: [], budget: null, ...draft },
})

describe('GET /api/creators/:id/catalog', () => {
  it("returns Maya's published catalog with derived ranges, templates and rendered limits", async () => {
    const b = await publishedBoutique(PILOT_V1)
    const res = await call('GET', `/api/creators/${b.creatorId}/catalog`, { origin: null })
    expect(res.status).toBe(200)
    const body = await bodyOf(res)
    expect(body.catalogVersionId).toBe(b.catalogVersionId)
    expect(body.categories.map((c: any) => c.key)).toEqual(['length_format', 'setting', 'wardrobe', 'personalization_delivery', 'rights_quality'])
    expect(body.ranges).toEqual({
      maya_setting_vintage: { min: 12_500, max: 59_000 },
      maya_setting_floral: { min: 13_500, max: 61_000 },
      maya_setting_backstage: { min: 10_500, max: 55_000 },
    })
    expect(body.templates.map((t: any) => t.key)).toEqual(['just_us', 'follow_my_lead', 'in_uniform', 'up_close'])
    expect(body.boundaries.hardNo.map((l: any) => l.text)).toEqual(['Anything explicit', 'Anything political', 'Brand mentions or ads'])
    expect(body.boundaries.platform).toHaveLength(10)
  })

  it('never sends adult categories while any switch is off (§5.4)', async () => {
    const { creatorId } = await boutique() // has a visible adult category with an item
    const plain = await bodyOf(await call('GET', `/api/creators/${creatorId}/catalog`))
    expect(JSON.stringify(plain)).not.toContain('item_adult')
    // Platform switch on, but the creator's switch and compliance record are off.
    const platformOnly = await bodyOf(await call('GET', `/api/creators/${creatorId}/catalog`, { env: { ADULT_CATALOG_ENABLED: 'true' } }))
    expect(JSON.stringify(platformOnly)).not.toContain('item_adult')
  })

  it('includes adult content only when every switch allows it (test process only)', async () => {
    const { creatorId } = await boutique()
    await testEnv.DB.batch([
      testEnv.DB.prepare('UPDATE creator SET adult_content_enabled = 1 WHERE id = ?').bind(creatorId),
      testEnv.DB.prepare(
        `INSERT INTO compliance_status (creator_id, identity_verified, age_verified, records_complete, payouts_enabled, adult_catalog_approved, updated_at)
         VALUES (?, 1, 1, 1, 1, 1, ?)`,
      ).bind(creatorId, new Date().toISOString()),
    ])
    const on = await bodyOf(await call('GET', `/api/creators/${creatorId}/catalog`, { env: { ADULT_CATALOG_ENABLED: 'true' } }))
    expect(JSON.stringify(on)).toContain('item_adult')
    const off = await bodyOf(await call('GET', `/api/creators/${creatorId}/catalog`))
    expect(JSON.stringify(off)).not.toContain('item_adult')
  })

  it('is 404 for an unknown creator', async () => {
    expect((await call('GET', '/api/creators/cr_nobody/catalog')).status).toBe(404)
  })
})

describe('POST /api/creators/:id/quote', () => {
  it('computes the doc 10 §9 figures exactly, in cents', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const q145 = await bodyOf(await quote(b.creatorId, { catalogVersionId: b.catalogVersionId, selections: sel(), budget: 15_000 }))
    expect(q145.quote.total).toBe(14_500)
    expect(q145.quote.budgetDifference).toBe(500)
    const q185 = await bodyOf(await quote(b.creatorId, { catalogVersionId: b.catalogVersionId, selections: withMinute(sel()), budget: 15_000 }))
    expect(q185.quote.total).toBe(18_500)
    expect(q185.quote.budgetDifference).toBe(-3_500)
    const back = await bodyOf(await quote(b.creatorId, { catalogVersionId: b.catalogVersionId, selections: sel(), budget: 15_000 }))
    expect(back.quote.total).toBe(14_500)
    expect(back.stale).toBe(false)
  })

  it('prices percentage lines on the subtotal and reports delivery from payment', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const selections = sel(['maya_rights_resell', 'maya_rights_exclusive'], ['maya_delivery_standard', 'maya_delivery_rush'])
    const q = (await bodyOf(await quote(b.creatorId, { catalogVersionId: b.catalogVersionId, selections, budget: null }))).quote
    // Subtotal 9000 + 3500 + 2000 = 14500; +50% twice = 7250 each.
    expect(q.lines.filter((l: any) => l.pricingKind === 'percent').map((l: any) => l.amount)).toEqual([7_250, 7_250])
    expect(q.total).toBe(29_000)
    expect(q.deliveryDaysFromPayment).toBe(2)
    expect(q.budgetDifference).toBeNull()
  })

  it('rejects a personalised video that may be resold, with a typed error', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const res = await quote(b.creatorId, { catalogVersionId: b.catalogVersionId, selections: sel(['maya_name_none', 'maya_name_once']), budget: null })
    expect(res.status).toBe(422)
    expect(await bodyOf(res)).toMatchObject({ error: 'personalised_video_resale_forbidden' })
  })

  describe('rejects a tampered request', () => {
    it('unknown item', async () => {
      const b = await publishedBoutique(PILOT_V1)
      const res = await quote(b.creatorId, { catalogVersionId: b.catalogVersionId, selections: [...sel(), { itemId: 'free_upgrade', qty: 1 }], budget: null })
      expect(res.status).toBe(422)
      expect(await bodyOf(res)).toEqual({ error: 'selection_rejected', reason: 'unknown_item', itemId: 'free_upgrade' })
    })
    it('over-limit quantity', async () => {
      const b = await publishedBoutique(PILOT_V1)
      const res = await quote(b.creatorId, { catalogVersionId: b.catalogVersionId, selections: withMinute(sel(), 3), budget: null })
      expect(await bodyOf(res)).toMatchObject({ error: 'selection_rejected', reason: 'qty_out_of_range', max: 2 })
    })
    it('hidden item and hidden category', async () => {
      const { creatorId, catalogVersionId } = await boutique()
      for (const itemId of ['item_hidden', 'item_in_hidden_category']) {
        const res = await quote(creatorId, { catalogVersionId, selections: [{ itemId, qty: 1 }], budget: null })
        expect(await bodyOf(res)).toMatchObject({ error: 'selection_rejected', reason: 'item_unavailable' })
      }
    })
    it('adult item', async () => {
      const { creatorId, catalogVersionId } = await boutique()
      const res = await quote(creatorId, { catalogVersionId, selections: [{ itemId: 'item_adult', qty: 1 }], budget: null })
      expect(await bodyOf(res)).toMatchObject({ error: 'selection_rejected', reason: 'adult_disabled' })
    })
    it('edited price, total or quote', async () => {
      const b = await publishedBoutique(PILOT_V1)
      const good = { catalogVersionId: b.catalogVersionId, selections: sel(), budget: null }
      for (const tampered of [
        { ...good, total: 100 },
        { ...good, quote: { total: 100 } },
        { ...good, selections: [{ itemId: 'maya_base_video', qty: 1, amount: 1 }] },
        { ...good, selections: [{ itemId: 'maya_base_video', qty: 1, price: 0 }] },
      ]) {
        const res = await quote(b.creatorId, tampered)
        expect(res.status).toBe(400)
        expect((await bodyOf(res)).error).toBe('invalid_quote')
      }
    })
    it('a missing required choice', async () => {
      const b = await publishedBoutique(PILOT_V1)
      const res = await quote(b.creatorId, { catalogVersionId: b.catalogVersionId, selections: sel(['maya_setting_vintage', null]), budget: null })
      expect(await bodyOf(res)).toMatchObject({ error: 'selection_rejected', reason: 'group_count', categoryKey: 'setting' })
    })
    it("another creator's catalog version", async () => {
      const a = await publishedBoutique(PILOT_V1)
      const other = await publishedBoutique(PILOT_V1)
      const res = await quote(a.creatorId, { catalogVersionId: other.catalogVersionId, selections: sel(), budget: null })
      expect(res.status).toBe(422)
      expect((await bodyOf(res)).error).toBe('catalog_version_mismatch')
    })
    it('a cross-site request', async () => {
      const b = await publishedBoutique(PILOT_V1)
      const res = await quote(b.creatorId, { catalogVersionId: b.catalogVersionId, selections: sel(), budget: null }, { origin: 'https://evil.test' })
      expect(res.status).toBe(403)
    })
  })
})

describe('draft saves: validation, the rules layer and creator limits', () => {
  it('returns the server quote and no flags for a plain draft', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const fan = clerkUser()
    const res = await call('PUT', draftPath(b.creatorId, crypto.randomUUID()), { token: await fan.token(), body: draftBody(b.catalogVersionId, 0, { budget: 15_000 }) })
    expect(res.status).toBe(200)
    const body = await bodyOf(res)
    expect(body.quote.total).toBe(14_500)
    expect(body.draft.boundaryFlags).toEqual([])
  })

  it('rejects a tampered selection on save', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const fan = clerkUser()
    const res = await call('PUT', draftPath(b.creatorId, crypto.randomUUID()), {
      token: await fan.token(),
      body: draftBody(b.catalogVersionId, 0, { selections: withMinute(sel(), 9) }),
    })
    expect(await bodyOf(res)).toMatchObject({ error: 'selection_rejected', reason: 'qty_out_of_range' })
  })

  it("stores an ask-me flag and blocks a hard-no, using the creator's limits", async () => {
    const content: CatalogContent = {
      ...PILOT_V1,
      boundaries: { ...PILOT_V1.boundaries, checklist: { ...PILOT_V1.boundaries.checklist, no_brand_mentions: { enabled: true, mode: 'ask_me' } } },
    }
    const b = await publishedBoutique(content)
    const fan = clerkUser()
    const token = await fan.token()
    const flagged = await call('PUT', draftPath(b.creatorId, crypto.randomUUID()), {
      token, body: draftBody(b.catalogVersionId, 0, { notes: [{ id: 1, text: 'wear my Nike hoodie' }] }),
    })
    expect(flagged.status).toBe(200)
    expect((await bodyOf(flagged)).draft.boundaryFlags).toEqual([
      { source: 'notes', limit: { kind: 'checklist', key: 'no_brand_mentions' }, mode: 'ask_me' },
    ])

    const blocked = await call('PUT', draftPath(b.creatorId, crypto.randomUUID()), {
      token, body: draftBody(b.catalogVersionId, 0, { customRequest: 'mention the election' }),
    })
    expect(blocked.status).toBe(422)
    expect(await bodyOf(blocked)).toEqual({
      error: 'creator_limit_blocked', limit: { kind: 'checklist', key: 'no_political_content' }, label: 'Anything political', field: 'custom_request',
    })
  })

  it('blocks a hard-list request, keeps only its subject, and saves nothing', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const fan = clerkUser()
    const id = crypto.randomUUID()
    const res = await call('PUT', draftPath(b.creatorId, id), {
      token: await fan.token(), body: draftBody(b.catalogVersionId, 0, { notes: [{ id: 1, text: 'pretend to be my stepsister in the kitchen' }] }),
    })
    expect(res.status).toBe(422)
    expect(await bodyOf(res)).toEqual({
      error: 'hard_list_blocked', key: 'prohibited_roles', lines: ['School, babysitter or family roles, including step-family'], field: 'notes',
    })
    expect((await call('GET', draftPath(b.creatorId, id), { token: await fan.token() })).status).toBe(404)
    const fanId = await fanIdFor(fan)
    const { results } = await testEnv.DB.prepare(`SELECT detail_json FROM audit_event WHERE actor_id = ? AND action = 'hard_list_block'`).bind(fanId).all<{ detail_json: string }>()
    expect(results).toHaveLength(1)
    expect(JSON.parse(results[0].detail_json)).toEqual({ key: 'prohibited_roles', subject: 'family role', layer: 'rules', version: 'rules-v1', field: 'notes' })
    expect(results[0].detail_json).not.toContain('kitchen')
  })

  it('turns AI off and flags the fan at the third block in 24 hours, not before', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const fan = clerkUser()
    const fanId = await fanIdFor(fan)
    const restriction = () => testEnv.DB.prepare('SELECT * FROM fan_restriction WHERE fan_id = ?').bind(fanId).first<Record<string, any>>()
    for (let i = 1; i <= 3; i++) {
      const res = await call('PUT', draftPath(b.creatorId, crypto.randomUUID()), {
        token: await fan.token(), body: draftBody(b.catalogVersionId, 0, { customRequest: 'can we meet in person' }),
      })
      expect((await bodyOf(res)).error).toBe('hard_list_blocked')
      if (i < 3) expect(await restriction()).toBeNull()
    }
    expect(await restriction()).toMatchObject({ reason: 'block_threshold' })
    expect((await restriction())!.ai_disabled_at).toBeTruthy()
    expect((await restriction())!.review_flagged_at).toBeTruthy()
  })

  it('opens a safety case on a minors hit, suspends the fan and keeps the full request', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const fan = clerkUser()
    const fanId = await fanIdFor(fan)
    const res = await call('PUT', draftPath(b.creatorId, crypto.randomUUID()), {
      token: await fan.token(), body: draftBody(b.catalogVersionId, 0, { customRequest: 'in the story she is 15' }),
    })
    expect(res.status).toBe(403)
    expect(await bodyOf(res)).toEqual({ error: 'account_paused' })
    const safetyCase = await testEnv.DB.prepare('SELECT * FROM safety_case WHERE fan_id = ?').bind(fanId).first<Record<string, any>>()
    expect(safetyCase).toMatchObject({ category: 'minors', status: 'open', creator_id: b.creatorId })
    const evidence = await testEnv.DB.prepare('SELECT * FROM safety_case_evidence WHERE case_id = ?').bind(safetyCase!.id).first<Record<string, any>>()
    expect(JSON.parse(evidence!.request_json).content.customRequest).toBe('in the story she is 15')
    expect(evidence).toMatchObject({ ip: '203.0.113.7', user_agent: 'vitest' })
    await expect(testEnv.DB.prepare('DELETE FROM safety_case_evidence WHERE id = ?').bind(evidence!.id).run()).rejects.toThrow()
    expect((await call('GET', '/api/session', { token: await fan.token() })).status).toBe(403)
  })

  it('refuses custom requests when the creator declines them', async () => {
    const b = await publishedBoutique({ ...PILOT_V1, boundaries: { ...PILOT_V1.boundaries, customRequestPolicy: 'decline' } })
    const fan = clerkUser()
    const res = await call('PUT', draftPath(b.creatorId, crypto.randomUUID()), {
      token: await fan.token(), body: draftBody(b.catalogVersionId, 0, { customRequest: 'a red dress' }),
    })
    expect(await bodyOf(res)).toEqual({ error: 'custom_requests_not_accepted' })
  })

  it('limits the custom request to 1,000 characters (§5.1)', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const fan = clerkUser()
    const res = await call('PUT', draftPath(b.creatorId, crypto.randomUUID()), {
      token: await fan.token(), body: draftBody(b.catalogVersionId, 0, { customRequest: 'x'.repeat(1_001) }),
    })
    expect(await bodyOf(res)).toEqual({ error: 'invalid_draft', field: 'customRequest' })
  })
})

describe('a new catalog version never re-prices a draft silently', () => {
  const pricier: CatalogContent = {
    ...PILOT_V1,
    categories: PILOT_V1.categories.map((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === 'maya_setting_vintage' ? { ...i, pricing: { kind: 'fixed' as const, amount: 4_000 } } : i)),
    })),
  }

  it('marks the quote stale, keeps the old price, and re-prices only when the fan accepts', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const fan = clerkUser()
    const id = crypto.randomUUID()
    await call('PUT', draftPath(b.creatorId, id), { token: await fan.token(), body: draftBody(b.catalogVersionId, 0) })
    const v2 = await publishNext(b, pricier)

    const read = await bodyOf(await call('GET', draftPath(b.creatorId, id), { token: await fan.token() }))
    expect(read.stale).toBe(true)
    expect(read.quote.total).toBe(14_500)
    expect(read.quote.catalogVersionId).toBe(b.catalogVersionId)
    expect(read.current).toMatchObject({ catalogVersionId: v2, ok: true, quote: { total: 15_000 } })

    const quoted = await bodyOf(await call('GET', `${draftPath(b.creatorId, id)}/quote`, { token: await fan.token() }))
    expect(quoted).toMatchObject({ stale: true, quote: { total: 14_500 } })

    const edit = await call('PUT', draftPath(b.creatorId, id), { token: await fan.token(), body: draftBody(b.catalogVersionId, 1, { budget: 20_000 }) })
    expect(edit.status).toBe(409)
    expect(await bodyOf(edit)).toMatchObject({ error: 'catalog_version_stale', currentCatalogVersionId: v2 })

    const accepted = await call('POST', `${draftPath(b.creatorId, id)}/accept-catalog-version`, {
      token: await fan.token(), body: { expectedRevision: 1, catalogVersionId: v2 },
    })
    expect(accepted.status).toBe(200)
    const after = await bodyOf(accepted)
    expect(after).toMatchObject({ stale: false, draft: { revision: 2, catalogVersionId: v2 }, quote: { total: 15_000 } })
  })

  it('refuses to move a draft that the new version no longer allows, and changes nothing', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const fan = clerkUser()
    const id = crypto.randomUUID()
    await call('PUT', draftPath(b.creatorId, id), { token: await fan.token(), body: draftBody(b.catalogVersionId, 0) })
    const noDetailed: CatalogContent = {
      ...PILOT_V1,
      categories: PILOT_V1.categories.map((c) => ({ ...c, items: c.items.filter((i) => i.id !== 'maya_greeting_detailed') })),
    }
    const v2 = await publishNext(b, noDetailed)
    const res = await call('POST', `${draftPath(b.creatorId, id)}/accept-catalog-version`, {
      token: await fan.token(), body: { expectedRevision: 1, catalogVersionId: v2 },
    })
    expect(await bodyOf(res)).toEqual({ error: 'selection_rejected', reason: 'unknown_item', itemId: 'maya_greeting_detailed' })
    const read = await bodyOf(await call('GET', draftPath(b.creatorId, id), { token: await fan.token() }))
    expect(read.draft).toMatchObject({ revision: 1, catalogVersionId: b.catalogVersionId })
    expect(read.current).toMatchObject({ ok: false, error: 'selection_rejected' })
  })

  it('never lets a new draft start on a retired version', async () => {
    const b = await publishedBoutique(PILOT_V1)
    const v2 = await publishNext(b, pricier)
    const fan = clerkUser()
    const res = await call('PUT', draftPath(b.creatorId, crypto.randomUUID()), { token: await fan.token(), body: draftBody(b.catalogVersionId, 0) })
    expect(res.status).toBe(409)
    expect(await bodyOf(res)).toEqual({ error: 'catalog_version_stale', currentCatalogVersionId: v2 })
  })

  it("doesn't reveal another fan's draft through the accept route", async () => {
    const b = await publishedBoutique(PILOT_V1)
    const owner = clerkUser()
    const id = crypto.randomUUID()
    await call('PUT', draftPath(b.creatorId, id), { token: await owner.token(), body: draftBody(b.catalogVersionId, 0) })
    const v2 = await publishNext(b, pricier)
    const other = clerkUser()
    for (const path of [`${draftPath(b.creatorId, id)}/accept-catalog-version`, `${draftPath(b.creatorId, id)}/quote`]) {
      const res = path.endsWith('quote')
        ? await call('GET', path, { token: await other.token() })
        : await call('POST', path, { token: await other.token(), body: { expectedRevision: 1, catalogVersionId: v2 } })
      expect(res.status).toBe(404)
    }
  })
})

describe('catalog publish checks (check point 4 of §5.3.3)', () => {
  it("passes Maya's pilot catalog", () => {
    expect(validateCatalogForPublish(PILOT_V1)).toEqual([])
  })

  it('refuses hard-list text, naming the item and the rule', () => {
    const bad: CatalogContent = {
      ...PILOT_V1,
      pricingNote: 'I film on Sundays',
      categories: PILOT_V1.categories.map((c) => ({
        ...c,
        items: c.items.map((i) => (i.id === 'maya_setting_floral' ? { ...i, description: 'schoolgirl theme' } : i)),
      })),
      boundaries: {
        ...PILOT_V1.boundaries,
        custom: [
          { id: 'c1', text: 'No deepfakes or lookalikes', mode: 'hard_no' },
          { id: 'c2', text: 'Ask me first, text me at 555-123-4567', mode: 'ask_me' },
        ],
      },
    }
    expect(validateCatalogForPublish(bad)).toEqual([
      { code: 'hard_list', where: 'item maya_setting_floral description', key: 'prohibited_roles' },
      { code: 'hard_list', where: 'custom limit c2', key: 'solicitation' },
    ])
  })

  it('refuses adult items, broken references and unlabelled limits', () => {
    const bad: CatalogContent = {
      ...PILOT_V1,
      categories: PILOT_V1.categories.map((c) =>
        c.key === 'props' ? { ...c, items: [{ ...PILOT_V1.categories[1].items[0], id: 'toy', contentRating: 'adult' }] } :
        c.key === 'setting' ? { ...c, items: c.items.map((i) => ({ ...i, requires: ['missing_item'] })) } : c),
      boundaries: { ...PILOT_V1.boundaries, checklist: { ...PILOT_V1.boundaries.checklist, secret_key: { enabled: true, mode: 'hard_no' } } },
    }
    const problems = validateCatalogForPublish(bad).map((p) => (p.code === 'structure' ? `${p.where}: ${p.detail}` : p.key))
    expect(problems).toContain('category props: adult categories must stay hidden and empty')
    expect(problems).toContain('item toy: adult items are not allowed')
    expect(problems).toContain('item maya_setting_vintage: refers to unknown item missing_item')
    expect(problems).toContain('limit secret_key: has no approved fan-facing label')
  })
})
