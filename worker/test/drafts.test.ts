import { describe, expect, it } from 'vitest'
import { bodyOf, boutique, call, clerkUser, draftBody, fanIdFor, testEnv } from './helpers'

const path = (creatorId: string, draftId: string) => `/api/creators/${creatorId}/drafts/${draftId}`

describe('draft save and reload', () => {
  it('saves a new draft and reloads it for its owner', async () => {
    const { creatorId, catalogVersionId } = await boutique()
    const fan = clerkUser()
    const id = crypto.randomUUID()
    const saved = await call('PUT', path(creatorId, id), {
      token: await fan.token(),
      body: draftBody(catalogVersionId, 0, { fanDisplayName: 'Sam', notes: [{ id: 1, text: 'soft light' }], budget: 12000 }),
    })
    expect(saved.status).toBe(200)
    const savedBody = await bodyOf(saved)
    expect(savedBody.draft.revision).toBe(1)
    // Phase 2: the server's quote comes back with every save, and flags are server-set.
    expect(savedBody.quote.total).toBe(5000)
    expect(savedBody.quote.budgetDifference).toBe(7000)
    expect(savedBody.stale).toBe(false)
    expect(savedBody.draft.boundaryFlags).toEqual([])

    const reloaded = await bodyOf(await call('GET', path(creatorId, id), { token: await fan.token() }))
    expect(reloaded.draft).toEqual(savedBody.draft)
    expect(reloaded.draft.fanDisplayName).toBe('Sam')
  })

  it('increments the revision on update and rejects a stale revision with the current draft', async () => {
    const { creatorId, catalogVersionId } = await boutique()
    const fan = clerkUser()
    const id = crypto.randomUUID()
    const token = await fan.token()
    await call('PUT', path(creatorId, id), { token, body: draftBody(catalogVersionId, 0) })
    const second = await call('PUT', path(creatorId, id), { token, body: draftBody(catalogVersionId, 1, { budget: 100 }) })
    expect((await bodyOf(second)).draft.revision).toBe(2)

    const stale = await call('PUT', path(creatorId, id), { token, body: draftBody(catalogVersionId, 1, { budget: 999 }) })
    expect(stale.status).toBe(409)
    const staleBody = await bodyOf(stale)
    expect(staleBody.error).toBe('revision_conflict')
    expect(staleBody.current.revision).toBe(2)
    expect(staleBody.current.budget).toBe(100)
  })

  it('lets exactly one of two concurrent updates at the same revision win', async () => {
    const { creatorId, catalogVersionId } = await boutique()
    const fan = clerkUser()
    const id = crypto.randomUUID()
    const token = await fan.token()
    await call('PUT', path(creatorId, id), { token, body: draftBody(catalogVersionId, 0) })
    const results = await Promise.all([
      call('PUT', path(creatorId, id), { token, body: draftBody(catalogVersionId, 1, { budget: 1 }) }),
      call('PUT', path(creatorId, id), { token, body: draftBody(catalogVersionId, 1, { budget: 2 }) }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
  })
})

describe('draft isolation (Gate 1 criteria)', () => {
  it('one fan cannot read, update or overwrite another fan\'s draft by id', async () => {
    const { creatorId, catalogVersionId } = await boutique()
    const alice = clerkUser()
    const bob = clerkUser()
    const id = crypto.randomUUID()
    await call('PUT', path(creatorId, id), { token: await alice.token(), body: draftBody(catalogVersionId, 0, { budget: 500 }) })

    const read = await call('GET', path(creatorId, id), { token: await bob.token() })
    expect(read.status).toBe(404)
    expect(await bodyOf(read)).toEqual({ error: 'not_found' })

    for (const rev of [0, 1]) {
      const write = await call('PUT', path(creatorId, id), { token: await bob.token(), body: draftBody(catalogVersionId, rev, { budget: 1 }) })
      expect(write.status).toBe(404)
      expect(await bodyOf(write)).toEqual({ error: 'not_found' })
    }

    const aliceView = await bodyOf(await call('GET', path(creatorId, id), { token: await alice.token() }))
    expect(aliceView.draft.budget).toBe(500)
    expect(aliceView.draft.revision).toBe(1)
  })

  it('a draft in one creator\'s boutique cannot be read through another creator', async () => {
    const maya = await boutique('Maya')
    const nina = await boutique('Nina')
    const fan = clerkUser()
    const id = crypto.randomUUID()
    const token = await fan.token()
    await call('PUT', path(maya.creatorId, id), { token, body: draftBody(maya.catalogVersionId, 0) })

    expect((await call('GET', path(nina.creatorId, id), { token })).status).toBe(404)
    const moved = await call('PUT', path(nina.creatorId, id), { token, body: draftBody(nina.catalogVersionId, 1) })
    expect(moved.status).toBe(404)
  })

  it('two creators\' own identities cannot read each other\'s boutique drafts', async () => {
    const maya = await boutique('Maya')
    const nina = await boutique('Nina')
    const id = crypto.randomUUID()
    const mayaToken = await maya.owner.token({ claims: { fva: [0, 0] } })
    await call('PUT', path(maya.creatorId, id), { token: mayaToken, body: draftBody(maya.catalogVersionId, 0) })
    const ninaToken = await nina.owner.token({ claims: { fva: [0, 0] } })
    expect((await call('GET', path(maya.creatorId, id), { token: ninaToken })).status).toBe(404)
    expect((await call('GET', path(nina.creatorId, id), { token: ninaToken })).status).toBe(404)
  })

  it('rejects another creator\'s catalog version (tenant mismatch)', async () => {
    const maya = await boutique('Maya')
    const nina = await boutique('Nina')
    const res = await call('PUT', path(maya.creatorId, crypto.randomUUID()), {
      token: await clerkUser().token(),
      body: draftBody(nina.catalogVersionId, 0),
    })
    expect(res.status).toBe(422)
    expect((await bodyOf(res)).error).toBe('catalog_version_mismatch')
  })

  it('pauses and closes fan accounts', async () => {
    const { creatorId, catalogVersionId } = await boutique()
    for (const [status, code] of [['suspended', 'account_paused'], ['closed', 'account_closed']]) {
      const fan = clerkUser()
      const fanId = await fanIdFor(fan)
      await testEnv.DB.prepare('UPDATE fan SET status = ? WHERE id = ?').bind(status, fanId).run()
      const res = await call('PUT', path(creatorId, crypto.randomUUID()), { token: await fan.token(), body: draftBody(catalogVersionId, 0) })
      expect(res.status).toBe(403)
      expect((await bodyOf(res)).error).toBe(code)
    }
  })
})

describe('draft tampering', () => {
  const selectionCases: [string, unknown][] = [
    ['an unknown item', [{ itemId: 'item_unknown', qty: 1 }]],
    ['a hidden item', [{ itemId: 'item_hidden', qty: 1 }]],
    ['an item in a hidden category', [{ itemId: 'item_in_hidden_category', qty: 1 }]],
    ['an adult item while the adult switch is off', [{ itemId: 'item_adult', qty: 1 }]],
    ['an over-limit quantity', [{ itemId: 'item_minutes', qty: 6 }]],
    ['a quantity on a fixed item', [{ itemId: 'item_visible', qty: 2 }]],
  ]
  for (const [name, selections] of selectionCases) {
    it(`rejects ${name}`, async () => {
      const { creatorId, catalogVersionId } = await boutique()
      const res = await call('PUT', path(creatorId, crypto.randomUUID()), {
        token: await clerkUser().token(),
        body: draftBody(catalogVersionId, 0, { selections }),
      })
      expect(res.status).toBe(422)
      expect((await bodyOf(res)).error).toBe('selection_rejected')
    })
  }

  const payloadCases: [string, (b: ReturnType<typeof draftBody>) => unknown][] = [
    ['browser boundary flags', (b) => ({ ...b, draft: { ...b.draft, boundaryFlags: [] } })],
    ['a browser price', (b) => ({ ...b, draft: { ...b.draft, selections: [{ itemId: 'item_visible', qty: 1, amount: 1 }] } })],
    ['a browser quote', (b) => ({ ...b, quote: { total: 1 } })],
    ['a browser tenant id', (b) => ({ ...b, draft: { ...b.draft, creatorId: 'cr_other' } })],
    ['a duplicate selection', (b) => ({ ...b, draft: { ...b.draft, selections: [{ itemId: 'item_visible', qty: 1 }, { itemId: 'item_visible', qty: 1 }] } })],
    ['a zero quantity', (b) => ({ ...b, draft: { ...b.draft, selections: [{ itemId: 'item_visible', qty: 0 }] } })],
    ['a fan script over 3,000 characters', (b) => ({ ...b, draft: { ...b.draft, fanScript: 'x'.repeat(3001) } })],
    ['a nickname over 40 characters', (b) => ({ ...b, draft: { ...b.draft, fanDisplayName: 'x'.repeat(41) } })],
    ['a negative budget', (b) => ({ ...b, draft: { ...b.draft, budget: -1 } })],
    ['a missing field', (b) => ({ ...b, draft: { selections: [] } })],
  ]
  for (const [name, mutate] of payloadCases) {
    it(`rejects ${name}`, async () => {
      const { creatorId, catalogVersionId } = await boutique()
      const res = await call('PUT', path(creatorId, crypto.randomUUID()), {
        token: await clerkUser().token(),
        body: mutate(draftBody(catalogVersionId, 0)),
      })
      expect(res.status).toBe(400)
      expect((await bodyOf(res)).error).toBe('invalid_draft')
    })
  }

  it('caps the body size and requires JSON', async () => {
    const { creatorId, catalogVersionId } = await boutique()
    const token = await clerkUser().token()
    const big = await call('PUT', path(creatorId, crypto.randomUUID()), {
      token,
      rawBody: JSON.stringify({ ...draftBody(catalogVersionId, 0), pad: 'x'.repeat(40_000) }),
    })
    expect(big.status).toBe(413)
    const text = await call('PUT', path(creatorId, crypto.randomUUID()), {
      token, rawBody: '{}', headers: { 'Content-Type': 'text/plain' },
    })
    expect(text.status).toBe(415)
  })

  it('refuses cross-origin and origin-less writes', async () => {
    const { creatorId, catalogVersionId } = await boutique()
    const token = await clerkUser().token()
    for (const origin of ['https://evil.test', null]) {
      const res = await call('PUT', path(creatorId, crypto.randomUUID()), { token, origin, body: draftBody(catalogVersionId, 0) })
      expect(res.status).toBe(403)
      expect((await bodyOf(res)).error).toBe('cross_origin')
    }
  })
})
