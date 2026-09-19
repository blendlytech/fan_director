import { describe, expect, it } from 'vitest'
import { bodyOf, boutique, call, clerkUser, draftBody, testEnv, type Boutique, type TestUser } from './helpers'

/* Phase 4: sending a draft and the creator's review (doc 10 §5 and §7, doc 11 §5.6 item 26). */

const draftPath = (creatorId: string, draftId: string) => `/api/creators/${creatorId}/drafts/${draftId}`
const creatorToken = (b: Boutique) => b.owner.token({ claims: { fva: [0, 0] } })

interface Setup {
  b: Boutique
  fan: TestUser
  draftId: string
  revision: number
}

async function savedDraft(draft: Record<string, unknown> = {}): Promise<Setup> {
  const b = await boutique()
  const fan = clerkUser()
  const draftId = crypto.randomUUID()
  const res = await call('PUT', draftPath(b.creatorId, draftId), { token: await fan.token(), body: draftBody(b.catalogVersionId, 0, draft) })
  expect(res.status).toBe(200)
  return { b, fan, draftId, revision: (await bodyOf(res)).draft.revision }
}

async function submit(s: Setup, clientRequestId: string = crypto.randomUUID(), revision = s.revision) {
  return call('POST', `${draftPath(s.b.creatorId, s.draftId)}/submit`, {
    token: await s.fan.token(),
    body: { clientRequestId, expectedRevision: revision, catalogVersionId: s.b.catalogVersionId },
  })
}

async function sent(draft: Record<string, unknown> = {}) {
  const s = await savedDraft(draft)
  const res = await submit(s)
  expect(res.status).toBe(201)
  const body = await bodyOf(res)
  return { ...s, id: body.commission.id as string, body }
}

const fanCall = async (s: Setup, method: string, path: string, body?: unknown) => call(method, path, { token: await s.fan.token(), body })
const creatorCall = async (s: Setup, method: string, path: string, body?: unknown) => call(method, path, { token: await creatorToken(s.b), body })
const current = (body: Record<string, any>) => body.versions.find((v: any) => v.id === body.commission.currentVersionId)

describe('sending a draft', () => {
  it('creates a request with version 1, fan-accepted, and locks the draft', async () => {
    const s = await sent()
    expect(s.body.commission.status).toBe('in_review')
    expect(s.body.versions).toHaveLength(1)
    expect(s.body.versions[0]).toMatchObject({ seq: 1, author: 'fan', status: 'accepted' })
    expect(s.body.versions[0].terms.totalCents).toBe(5_000)
    expect(s.body.versions[0].contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(s.body.commission.payment).toBeNull()

    const edit = await call('PUT', draftPath(s.b.creatorId, s.draftId), {
      token: await s.fan.token(),
      body: draftBody(s.b.catalogVersionId, s.revision, { notes: [{ id: 1, text: 'one more thing' }] }),
    })
    expect(edit.status).toBe(409)
    expect((await bodyOf(edit)).error).toBe('draft_submitted')

    // After sending, the fan starts a new draft rather than resuming this one.
    const latest = await call('GET', `/api/creators/${s.b.creatorId}/drafts`, { token: await s.fan.token() })
    expect((await bodyOf(latest)).draft).toBeNull()
  })

  it('a retried send returns the same request', async () => {
    const s = await savedDraft()
    const clientRequestId = crypto.randomUUID()
    const first = await submit(s, clientRequestId)
    const again = await submit(s, clientRequestId)
    expect(first.status).toBe(201)
    expect(again.status).toBe(200)
    expect((await bodyOf(again)).commission.id).toBe((await bodyOf(first)).commission.id)
  })

  it('two tabs sending at once make exactly one request', async () => {
    const s = await savedDraft()
    const results = await Promise.all([submit(s), submit(s), submit(s)])
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    for (const r of results.filter((r) => r.status !== 201)) {
      expect(r.status).toBe(409)
      expect((await bodyOf(r)).error).toBe('draft_submitted')
    }
    const { results: rows } = await testEnv.DB.prepare('SELECT id FROM commission WHERE draft_id = ?').bind(s.draftId).all()
    expect(rows).toHaveLength(1)
  })

  it('refuses a stale revision', async () => {
    const s = await savedDraft()
    const res = await submit(s, crypto.randomUUID(), s.revision + 1)
    expect(res.status).toBe(409)
    expect((await bodyOf(res)).error).toBe('revision_conflict')
  })

  it('refuses a draft on an old catalog version', async () => {
    const s = await savedDraft()
    const catalog = await testEnv.DB.prepare('SELECT id FROM catalog WHERE creator_id = ?').bind(s.b.creatorId).first<{ id: string }>()
    const next = crypto.randomUUID()
    const content = await testEnv.DB.prepare('SELECT content_json FROM catalog_version WHERE id = ?').bind(s.b.catalogVersionId).first<{ content_json: string }>()
    const at = new Date().toISOString()
    await testEnv.DB.batch([
      testEnv.DB.prepare(`INSERT INTO catalog_version (id, catalog_id, version, status, content_json, created_at, published_at) VALUES (?, ?, 2, 'published', ?, ?, ?)`)
        .bind(next, catalog!.id, content!.content_json, at, at),
      testEnv.DB.prepare('UPDATE catalog SET current_published_version_id = ? WHERE id = ?').bind(next, catalog!.id),
    ])
    const res = await submit(s)
    expect(res.status).toBe(409)
    expect(await bodyOf(res)).toEqual({ error: 'catalog_version_stale', currentCatalogVersionId: next })
  })

  it("only the draft's owner can send it", async () => {
    const s = await savedDraft()
    const stranger = clerkUser()
    const res = await call('POST', `${draftPath(s.b.creatorId, s.draftId)}/submit`, {
      token: await stranger.token(),
      body: { clientRequestId: crypto.randomUUID(), expectedRevision: s.revision, catalogVersionId: s.b.catalogVersionId },
    })
    expect(res.status).toBe(404)
  })
})

describe('the full round trip', () => {
  it('question → answer → proposal → acceptance → approval → payment reported', async () => {
    const s = await sent()
    const path = `/api/creator/commissions/${s.id}`

    const queue = await bodyOf(await creatorCall(s, 'GET', '/api/creator/commissions'))
    expect(queue.commissions.map((c: any) => c.id)).toContain(s.id)
    expect(queue.counts.in_review).toBeGreaterThanOrEqual(1)

    let res = await creatorCall(s, 'POST', `${path}/question`, { body: 'Should I say your name at the start?' })
    expect(res.status).toBe(200)
    expect((await bodyOf(res)).commission.status).toBe('question_open')

    const fanView = await bodyOf(await fanCall(s, 'GET', `/api/commissions/${s.id}`))
    expect(fanView.commission.actions.sort()).toEqual(['reply', 'withdraw'])
    expect(fanView.messages.map((m: any) => m.kind)).toEqual(['question'])

    res = await fanCall(s, 'POST', `/api/commissions/${s.id}/reply`, { body: 'Yes please, just once.' })
    expect(res.status).toBe(200)
    expect((await bodyOf(res)).commission.status).toBe('in_review')

    const v1 = s.body.versions[0]
    res = await creatorCall(s, 'POST', `${path}/propose`, {
      expectedVersionId: v1.id,
      selections: [
        { itemId: 'item_visible', qty: 1 },
        { itemId: 'item_minutes', qty: 2 },
      ],
      note: 'Added two minutes so there is time for the story.',
    })
    expect(res.status).toBe(200)
    let body = await bodyOf(res)
    expect(body.commission.status).toBe('proposal_open')
    const v2 = current(body)
    expect(v2).toMatchObject({ seq: 2, author: 'creator', status: 'offered' })
    expect(v2.terms.totalCents).toBe(5_000 + 3_000)

    // The creator can't approve terms the fan hasn't accepted.
    res = await creatorCall(s, 'POST', `${path}/approve`, { versionId: v2.id, contentHash: v2.contentHash })
    expect(res.status).toBe(409)
    expect((await bodyOf(res)).reason).toBe('not_in_review')

    res = await fanCall(s, 'POST', `/api/commissions/${s.id}/versions/${v2.id}/accept`, { contentHash: v2.contentHash })
    expect(res.status).toBe(200)
    body = await bodyOf(res)
    expect(body.commission.status).toBe('in_review')
    expect(body.versions.map((v: any) => v.status)).toEqual(['superseded', 'accepted'])

    // Old versions can't approve new scope.
    res = await creatorCall(s, 'POST', `${path}/approve`, { versionId: v1.id, contentHash: v1.contentHash })
    expect(res.status).toBe(409)
    expect((await bodyOf(res)).reason).toBe('version_not_current')
    res = await creatorCall(s, 'POST', `${path}/approve`, { versionId: v2.id, contentHash: v1.contentHash })
    expect((await bodyOf(res)).reason).toBe('hash_mismatch')

    res = await creatorCall(s, 'POST', `${path}/approve`, { versionId: v2.id, contentHash: v2.contentHash })
    expect(res.status).toBe(200)
    body = await bodyOf(res)
    expect(body.commission).toMatchObject({ status: 'approved', approvedVersionId: v2.id, payment: null })

    res = await creatorCall(s, 'POST', `${path}/payment-reported`)
    expect(res.status).toBe(200)
    expect((await bodyOf(res)).commission.payment).toMatchObject({ creatorReported: true })
    res = await creatorCall(s, 'POST', `${path}/payment-reported`)
    expect(res.status).toBe(409)

    // The fan sees the approved terms and a payment the creator reported, never one the platform confirmed.
    const final = await bodyOf(await fanCall(s, 'GET', `/api/commissions/${s.id}`))
    expect(final.commission.status).toBe('approved')
    expect(final.commission.payment.creatorReported).toBe(true)
    expect(final.commission.actions).toEqual([])
    res = await fanCall(s, 'POST', `/api/commissions/${s.id}/withdraw`)
    expect(res.status).toBe(409)
  })

  it('a rejected proposal returns to the accepted terms, which can then be approved', async () => {
    const s = await sent()
    const v1 = s.body.versions[0]
    const proposed = await bodyOf(
      await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/propose`, {
        expectedVersionId: v1.id,
        selections: [{ itemId: 'item_minutes', qty: 1 }],
      }),
    )
    const v2 = current(proposed)
    const res = await fanCall(s, 'POST', `/api/commissions/${s.id}/versions/${v2.id}/reject`)
    const body = await bodyOf(res)
    expect(body.commission).toMatchObject({ status: 'in_review', currentVersionId: v1.id })
    expect(body.versions.map((v: any) => v.status)).toEqual(['accepted', 'rejected'])
    const approved = await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/approve`, { versionId: v1.id, contentHash: v1.contentHash })
    expect(approved.status).toBe(200)
  })

  it('a proposal must change something and must be valid', async () => {
    const s = await sent()
    const v1 = s.body.versions[0]
    let res = await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/propose`, { expectedVersionId: v1.id, selections: [{ itemId: 'item_visible', qty: 1 }] })
    expect((await bodyOf(res)).error).toBe('proposal_unchanged')
    res = await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/propose`, { expectedVersionId: v1.id, selections: [{ itemId: 'item_hidden', qty: 1 }] })
    expect(res.status).toBe(422)
    expect((await bodyOf(res)).error).toBe('proposal_invalid')
  })

  it('accepting a stale proposal hash changes nothing', async () => {
    const s = await sent()
    const v1 = s.body.versions[0]
    const v2 = current(await bodyOf(await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/propose`, {
      expectedVersionId: v1.id, selections: [{ itemId: 'item_minutes', qty: 3 }],
    })))
    const res = await fanCall(s, 'POST', `/api/commissions/${s.id}/versions/${v2.id}/accept`, { contentHash: v1.contentHash })
    expect(res.status).toBe(409)
    expect((await bodyOf(res)).status).toBe('proposal_open')
  })
})

describe('custom requests are priced before approval', () => {
  it('approval waits for a price; the priced proposal counts in the total', async () => {
    const s = await sent({ customRequest: 'Hold up a small candle at the end' })
    const v1 = s.body.versions[0]
    let res = await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/approve`, { versionId: v1.id, contentHash: v1.contentHash })
    expect(res.status).toBe(409)
    expect((await bodyOf(res)).reason).toBe('custom_request_unpriced')

    const v2 = current(await bodyOf(await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/propose`, {
      expectedVersionId: v1.id, selections: [{ itemId: 'item_visible', qty: 1 }], customRequestPriceCents: 1_200,
    })))
    expect(v2.terms.totalCents).toBe(6_200)
    expect(v2.terms.customRequest).toBe('Hold up a small candle at the end')
    await fanCall(s, 'POST', `/api/commissions/${s.id}/versions/${v2.id}/accept`, { contentHash: v2.contentHash })
    res = await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/approve`, { versionId: v2.id, contentHash: v2.contentHash })
    expect(res.status).toBe(200)
  })

  it('a price without a custom request is refused', async () => {
    const s = await sent()
    const res = await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/propose`, {
      expectedVersionId: s.body.versions[0].id, selections: [{ itemId: 'item_minutes', qty: 1 }], customRequestPriceCents: 500,
    })
    expect(res.status).toBe(400)
  })
})

describe('races', () => {
  it('approve and withdraw at once: exactly one wins', async () => {
    const s = await sent()
    const v1 = s.body.versions[0]
    const [approve, withdraw] = await Promise.all([
      creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/approve`, { versionId: v1.id, contentHash: v1.contentHash }),
      fanCall(s, 'POST', `/api/commissions/${s.id}/withdraw`),
    ])
    expect([approve.status, withdraw.status].sort()).toEqual([200, 409])
  })

  it('propose and withdraw at once: exactly one wins', async () => {
    const s = await sent()
    const [propose, withdraw] = await Promise.all([
      creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/propose`, { expectedVersionId: s.body.versions[0].id, selections: [{ itemId: 'item_minutes', qty: 1 }] }),
      fanCall(s, 'POST', `/api/commissions/${s.id}/withdraw`),
    ])
    expect([propose.status, withdraw.status].sort()).toEqual([200, 409])
  })

  it('decline and accept-proposal at once never leave a half-accepted version', async () => {
    const s = await sent()
    const v2 = current(await bodyOf(await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/propose`, {
      expectedVersionId: s.body.versions[0].id, selections: [{ itemId: 'item_minutes', qty: 2 }],
    })))
    await Promise.all([
      creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/decline`, {}),
      fanCall(s, 'POST', `/api/commissions/${s.id}/versions/${v2.id}/accept`, { contentHash: v2.contentHash }),
    ])
    const body = await bodyOf(await fanCall(s, 'GET', `/api/commissions/${s.id}`))
    const accepted = body.versions.filter((v: any) => v.status === 'accepted')
    expect(accepted).toHaveLength(1)
    // Declined either way (decline is allowed after an acceptance too).
    expect(body.commission.status).toBe('declined')
  })
})

describe('who can see and do what', () => {
  it("another fan and another creator see nothing", async () => {
    const s = await sent()
    const stranger = clerkUser()
    expect((await call('GET', `/api/commissions/${s.id}`, { token: await stranger.token() })).status).toBe(404)
    const other = await boutique('Other')
    const res = await call('GET', `/api/creator/commissions/${s.id}`, { token: await other.owner.token({ claims: { fva: [0, 0] } }) })
    expect(res.status).toBe(404)
    const queue = await bodyOf(await call('GET', '/api/creator/commissions', { token: await other.owner.token({ claims: { fva: [0, 0] } }) }))
    expect(queue.commissions).toEqual([])
  })

  it('a fan is not a creator, and a creator needs a second factor', async () => {
    const s = await sent()
    let res = await fanCall(s, 'POST', `/api/creator/commissions/${s.id}/decline`, {})
    expect(res.status).toBe(403)
    expect((await bodyOf(res)).error).toBe('not_a_creator')
    res = await call('POST', `/api/creator/commissions/${s.id}/decline`, { token: await s.b.owner.token(), body: {} })
    expect(res.status).toBe(403)
    expect((await bodyOf(res)).error).toBe('second_factor_required')
  })

  it("the decline's internal note is never shown to the fan", async () => {
    const s = await sent()
    await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/decline`, { reason: 'I can’t film this one.', internalNote: 'PRIVATE-NOTE-123' })
    const fanText = await (await fanCall(s, 'GET', `/api/commissions/${s.id}`)).text()
    expect(fanText).toContain('I can’t film this one.')
    expect(fanText).not.toContain('PRIVATE-NOTE-123')
    const creatorText = await (await creatorCall(s, 'GET', `/api/creator/commissions/${s.id}`)).text()
    expect(creatorText).not.toContain('PRIVATE-NOTE-123')
  })

  it('messages are limited to 500 characters', async () => {
    const s = await sent()
    const res = await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/question`, { body: 'x'.repeat(501) })
    expect(res.status).toBe(400)
  })
})

describe('the hard list after sending', () => {
  it('a minors answer pauses the fan and withholds the request from the creator', async () => {
    const s = await sent()
    await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/question`, { body: 'Anything I should know?' })
    const res = await fanCall(s, 'POST', `/api/commissions/${s.id}/reply`, { body: 'She should say she is 16 in the video' })
    expect(res.status).toBe(403)
    expect(await bodyOf(res)).toEqual({ error: 'account_paused' })

    expect((await creatorCall(s, 'GET', `/api/creator/commissions/${s.id}`)).status).toBe(404)
    const queue = await bodyOf(await creatorCall(s, 'GET', '/api/creator/commissions'))
    expect(queue.commissions.map((c: any) => c.id)).not.toContain(s.id)
    const row = await testEnv.DB.prepare('SELECT status FROM commission WHERE id = ?').bind(s.id).first<{ status: string }>()
    expect(row!.status).toBe('withheld')
    const cases = await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM safety_case sc JOIN fan f ON f.id = sc.fan_id WHERE f.clerk_user_id = ?`).bind(s.fan.userId).first<{ n: number }>()
    expect(cases!.n).toBe(1)
  })

  it('another hard-list answer is blocked and recorded; the question stays open', async () => {
    const s = await sent()
    await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/question`, { body: 'Anything I should know?' })
    const res = await fanCall(s, 'POST', `/api/commissions/${s.id}/reply`, { body: 'Text me on whatsapp and I will pay you there' })
    expect(res.status).toBe(422)
    expect((await bodyOf(res)).error).toBe('hard_list_blocked')
    const view = await bodyOf(await fanCall(s, 'GET', `/api/commissions/${s.id}`))
    expect(view.commission.status).toBe('question_open')
    expect(view.messages).toHaveLength(1)
  })
})

describe('records that cannot change', () => {
  it('a version’s terms and a decided request are immutable in the database', async () => {
    const s = await sent()
    await expect(testEnv.DB.prepare(`UPDATE commission_version SET terms_json = '{}' WHERE id = ?`).bind(s.body.versions[0].id).run()).rejects.toThrow()
    const v1 = s.body.versions[0]
    await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/approve`, { versionId: v1.id, contentHash: v1.contentHash })
    await expect(testEnv.DB.prepare(`UPDATE commission SET status = 'in_review' WHERE id = ?`).bind(s.id).run()).rejects.toThrow()
    await expect(testEnv.DB.prepare(`UPDATE draft SET submitted_at = NULL WHERE id = ?`).bind(s.draftId).run()).rejects.toThrow()
  })

  it('no response claims the fan paid or was charged', async () => {
    const s = await sent()
    const v1 = s.body.versions[0]
    const texts = [
      JSON.stringify(s.body),
      await (await creatorCall(s, 'POST', `/api/creator/commissions/${s.id}/approve`, { versionId: v1.id, contentHash: v1.contentHash })).text(),
      await (await fanCall(s, 'GET', `/api/commissions/${s.id}`)).text(),
      await (await fanCall(s, 'GET', '/api/commissions')).text(),
    ]
    for (const t of texts) expect(t).not.toMatch(/\bpaid\b|\bcharged\b|payment_confirmed/i)
  })
})
