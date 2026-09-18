import { describe, expect, it } from 'vitest'
import { PILOT_V1 } from '../../shared/catalog/pilot-v1.ts'
import type { CatalogContent } from '../../shared/domain/types.ts'
import { purgeExpired } from '../src/ai/retention'
import { bodyOf, testEnv } from './helpers'
import { directorSetup, option, reply, verdict } from './ai-helpers'

const detailed = () => ({ reply: reply({ options: [option('Richer greeting', [['maya_greeting_detailed', 1]])] }) })

async function requestRow(requestId: string) {
  return testEnv.DB.prepare('SELECT * FROM ai_request WHERE id = ?').bind(requestId).first<Record<string, any>>()
}
async function calls(requestId: string) {
  const { results } = await testEnv.DB.prepare('SELECT purpose, model, cost_state FROM ai_call WHERE ai_request_id = ? ORDER BY created_at').bind(requestId).all<Record<string, any>>()
  return results
}

describe('AI Director: a normal turn', () => {
  it('returns a server-built, server-priced suggestion and leaves the draft alone', async () => {
    const s = await directorSetup()
    s.director.push(detailed())
    const before = await s.draft()
    const res = await s.turn('Could we make the greeting a bit more special?')
    expect(res.status).toBe(200)
    const body = await bodyOf(res)
    expect(body.reply).toBe('Here’s one way to do it. Nothing changes until you add it.')
    expect(body.suggestions).toHaveLength(1)
    expect(body.suggestions[0]).toMatchObject({
      title: 'Detailed Greeting',
      deltaCents: 2_000,
      newTotalCents: 14_500,
      budgetDifferenceCents: 500,
      askFirst: [],
    })
    expect(body.footer).toBe('Prices come from Maya’s catalog, not from the Director. Nothing changes until you add it.')
    // The model's own label and note never reach the fan.
    expect(JSON.stringify(body)).not.toContain('Richer greeting')
    expect(body.repliesLeft).toBe(19)
    expect(await s.draft()).toEqual(before)

    const row = await requestRow(body.requestId)
    expect(row).toMatchObject({ status: 'succeeded', outcome: 'reply', counts_toward_limit: 1, fallback_used: 0, attempts: 1, model: 'qwen/qwen3-235b-a22b-2507' })
    expect(row?.prompt_version).toBe('director-v1+retry-v1')
    expect(row?.classifier_version).toBe('openai/gpt-oss-safeguard-20b@classifier-v1')
    expect(row?.copy_version).toBe('director-copy-v1')
    expect((await calls(body.requestId)).map((c) => c.purpose)).toEqual(['classify_input', 'director', 'classify_output'])
    expect((await calls(body.requestId)).every((c) => c.cost_state === 'reconciled')).toBe(true)
  })

  it('sends the model only fan-facing data, with the enum locked to allowed ids', async () => {
    const s = await directorSetup()
    s.director.push(detailed())
    await s.turn('Make the greeting richer')
    const sent = s.director.calls[0]
    const enumIds = (sent.schema as any).properties.options.items.properties.wants.items.properties.itemId.enum
    expect(enumIds).toEqual(['maya_extra_minute', 'maya_greeting_detailed', 'maya_greeting_standard', 'maya_setting_backstage', 'maya_setting_floral', 'maya_setting_vintage'])
    const data = sent.messages[1].content
    expect(data).not.toMatch(/synthetic|isSynthetic|maya_delivery_rush|maya_resolution_4k|@|clerk/i)
    expect(sent.temperature).toBe(0.2)
    expect(sent.routing).toBe('router')
    expect(s.classifier.calls[0].routing).toBe('groq')
  })

  it('accepting a suggestion applies the stored selections and bumps the revision', async () => {
    const s = await directorSetup()
    s.director.push(detailed())
    const body = await bodyOf(await s.turn('Richer greeting please'))
    const rev = await s.revision()
    const res = await s.api('POST', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${body.suggestions[0].id}/accept`, { expectedRevision: rev })
    expect(res.status).toBe(200)
    const accepted = await bodyOf(res)
    expect(accepted.draft.revision).toBe(rev + 1)
    expect(accepted.quote.total).toBe(14_500)
    expect(accepted.draft.selections.map((x: any) => x.itemId)).toContain('maya_greeting_detailed')
    // A second accept is refused.
    const again = await s.api('POST', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${body.suggestions[0].id}/accept`, { expectedRevision: rev + 1 })
    expect(again.status).toBe(409)
  })

  it('a suggestion is out of date once the draft moved on, and is never applied', async () => {
    const s = await directorSetup()
    s.director.push({ reply: reply({ options: [option('a', [['maya_greeting_detailed', 1]]), option('b', [['maya_extra_minute', 1]])] }) })
    const body = await bodyOf(await s.turn('Richer, or longer?'))
    expect(body.reply).toBe('Two ways to do it. Pick one, both, or neither.')
    const [first, second] = body.suggestions
    const rev = await s.revision()
    expect((await s.api('POST', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${first.id}/accept`, { expectedRevision: rev })).status).toBe(200)
    const stale = await s.api('POST', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${second.id}/accept`, { expectedRevision: rev + 1 })
    expect(stale.status).toBe(409)
    expect((await bodyOf(stale)).error).toBe('suggestion_out_of_date')
    const draft = await s.draft()
    expect(draft.revision).toBe(rev + 1)
    expect(draft.selections.some((x: any) => x.itemId === 'maya_extra_minute')).toBe(false)
  })

  it('declining records "not added" and the suggestion can no longer be accepted', async () => {
    const s = await directorSetup()
    s.director.push(detailed())
    const body = await bodyOf(await s.turn('Richer greeting'))
    const id = body.suggestions[0].id
    const d = await s.api('POST', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${id}/decline`, {})
    expect(await bodyOf(d)).toEqual({ id, status: 'declined' })
    const a = await s.api('POST', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${id}/accept`, { expectedRevision: await s.revision() })
    expect(a.status).toBe(409)
  })

  it('another fan can neither see nor accept the suggestion', async () => {
    const s = await directorSetup()
    const other = await directorSetup()
    s.director.push(detailed())
    const body = await bodyOf(await s.turn('Richer greeting'))
    const res = await other.api('POST', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${body.suggestions[0].id}/accept`, { expectedRevision: 1 })
    expect(res.status).toBe(404)
    expect((await other.api('GET', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director`)).status).toBe(404)
  })
})

describe('AI Director: switches, limits and failures keep the draft intact', () => {
  it('AI_ENABLED off: 503 "off", no provider call, and manual saving still works', async () => {
    const s = await directorSetup({ env: { AI_ENABLED: 'false' } })
    const res = await s.turn('Richer greeting')
    expect(res.status).toBe(503)
    expect(await bodyOf(res)).toMatchObject({ error: 'ai_unavailable', reason: 'off' })
    expect(s.director.calls).toHaveLength(0)
    expect(s.classifier.calls).toHaveLength(0)
    const d = await s.draft()
    const put = await s.api('PUT', `/api/creators/${s.creatorId}/drafts/${s.draftId}`, {
      expectedRevision: d.revision,
      catalogVersionId: s.catalogVersionId,
      draft: { selections: d.selections.map((x: any) => (x.itemId === 'maya_setting_vintage' ? { itemId: 'maya_setting_floral', qty: 1 } : x)), fanDisplayName: null, customRequest: null, fanScript: null, notes: [], budget: 15_000 },
    })
    expect(put.status).toBe(200)
  })

  it('the creator switch off: 503 "off"', async () => {
    const s = await directorSetup({ aiEnabledForCreator: false })
    expect(await bodyOf(await s.turn('hi'))).toMatchObject({ error: 'ai_unavailable', reason: 'off' })
  })

  it('no ceiling configured: 503 "budget", no provider call', async () => {
    const s = await directorSetup({ env: { AI_BUDGET_CEILING_MICROUSD: undefined } })
    expect(await bodyOf(await s.turn('hi'))).toMatchObject({ error: 'ai_unavailable', reason: 'budget' })
    expect(s.classifier.calls).toHaveLength(0)
  })

  it('a ceiling too small for the reservation: 503 "budget" before any call', async () => {
    const s = await directorSetup({ env: { AI_CREATOR_CEILING_MICROUSD: '5' } })
    const res = await s.turn('Richer greeting')
    expect(await bodyOf(res)).toMatchObject({ error: 'ai_unavailable', reason: 'budget' })
    expect(s.classifier.calls).toHaveLength(0)
    expect(s.director.calls).toHaveLength(0)
  })

  it('the classifier failing closes the turn: no model call, draft unchanged, not counted', async () => {
    const s = await directorSetup()
    s.classifier.push({ fail: 'timeout' })
    const before = await s.draft()
    const res = await s.turn('Richer greeting')
    expect(res.status).toBe(503)
    expect(await bodyOf(res)).toMatchObject({ reason: 'classifier', repliesLeft: 20 })
    expect(s.director.calls).toHaveLength(0)
    expect(await s.draft()).toEqual(before)
  })

  it('an unreadable classifier reply also fails closed', async () => {
    const s = await directorSetup()
    s.classifier.push({ reply: 'sure, looks fine' })
    expect((await s.turn('Richer greeting')).status).toBe(503)
    expect(s.director.calls).toHaveLength(0)
  })

  it('a timed-out classifier call keeps its reservation spent (held)', async () => {
    const s = await directorSetup()
    s.classifier.push({ fail: 'timeout' })
    await s.turn('Richer greeting')
    const row = await testEnv.DB.prepare(`SELECT cost_state FROM ai_call WHERE creator_id = ? AND purpose = 'classify_input'`).bind(s.creatorId).first<{ cost_state: string }>()
    expect(row?.cost_state).toBe('held')
  })

  it('invalid output is retried once with the server errors, then succeeds', async () => {
    const s = await directorSetup()
    s.director.push({ reply: 'not json at all' }, detailed())
    const res = await s.turn('Richer greeting')
    expect(res.status).toBe(200)
    expect(s.director.calls).toHaveLength(2)
    expect(s.director.calls[1].messages.at(-1)?.content).toContain('Your reply was rejected by the server: the reply was not valid JSON')
    expect((await requestRow((await bodyOf(res)).requestId))?.attempts).toBe(2)
  })

  it('invalid twice: 503 "invalid", draft unchanged, reply not used up', async () => {
    const s = await directorSetup()
    s.director.push({ reply: '{"options":' }, { reply: reply({ extra: 1 }) })
    const before = await s.draft()
    const res = await s.turn('Richer greeting')
    expect(await bodyOf(res)).toMatchObject({ error: 'ai_unavailable', reason: 'invalid', repliesLeft: 20 })
    expect(await s.draft()).toEqual(before)
    const status = await bodyOf(await s.api('GET', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director`))
    expect(status.repliesLeft).toBe(20)
  })

  it('a provider failure falls back to DeepSeek once, and says so in the record', async () => {
    const s = await directorSetup()
    s.director.push({ fail: 'rate_limited' }, detailed())
    const res = await s.turn('Richer greeting')
    expect(res.status).toBe(200)
    expect(s.director.calls.map((c) => c.model)).toEqual(['qwen/qwen3-235b-a22b-2507', 'deepseek/deepseek-v3.2'])
    const row = await requestRow((await bodyOf(res)).requestId)
    expect(row).toMatchObject({ fallback_used: 1, model: 'deepseek/deepseek-v3.2' })
  })

  it('both models failing: 503 "provider"', async () => {
    const s = await directorSetup()
    s.director.push({ fail: 'http' }, { fail: 'timeout' })
    expect(await bodyOf(await s.turn('Richer greeting'))).toMatchObject({ reason: 'provider' })
  })

  it('a stale revision is refused before anything runs', async () => {
    const s = await directorSetup()
    const res = await s.turn('Richer greeting', { expectedRevision: 99 })
    expect(res.status).toBe(409)
    expect((await bodyOf(res)).error).toBe('revision_conflict')
    expect(s.classifier.calls).toHaveLength(0)
  })

  it('a message over 2,000 characters is refused', async () => {
    const s = await directorSetup()
    expect((await s.turn('a'.repeat(2_001))).status).toBe(413)
  })

  it('after 20 replies the Director is out of replies (429), and manual edits still work', async () => {
    const s = await directorSetup()
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString()
    const fanId = (await testEnv.DB.prepare('SELECT fan_id FROM draft WHERE id = ?').bind(s.draftId).first<{ fan_id: string }>())!.fan_id
    await testEnv.DB.batch(
      Array.from({ length: 20 }, () =>
        testEnv.DB.prepare(`INSERT INTO ai_request (id, fan_id, creator_id, draft_id, status, created_at, counts_toward_limit) VALUES (?, ?, ?, ?, 'succeeded', ?, 1)`)
          .bind(crypto.randomUUID(), fanId, s.creatorId, s.draftId, at),
      ),
    )
    const res = await s.turn('one more?')
    expect(res.status).toBe(429)
    expect(await bodyOf(res)).toEqual({ error: 'ai_replies_exhausted', repliesLeft: 0 })
  })

  it('one request in flight per draft: concurrent sends get 409', async () => {
    const s = await directorSetup()
    s.director.setFallback(detailed())
    const rev = await s.revision()
    const results = await Promise.all(Array.from({ length: 4 }, () => s.turn('Richer greeting', { expectedRevision: rev })))
    const statuses = results.map((r) => r.status).sort()
    expect(statuses.filter((x) => x === 200).length).toBeGreaterThanOrEqual(1)
    expect(statuses.every((x) => x === 200 || x === 409)).toBe(true)
    // Nothing can be pending at the same time twice: the index forbids it.
    const { results: pending } = await testEnv.DB.prepare(`SELECT id FROM ai_request WHERE draft_id = ? AND status = 'pending'`).bind(s.draftId).all()
    expect(pending).toHaveLength(0)
  })

  it('a pending request blocks a second send with 409', async () => {
    const s = await directorSetup()
    const fanId = (await testEnv.DB.prepare('SELECT fan_id FROM draft WHERE id = ?').bind(s.draftId).first<{ fan_id: string }>())!.fan_id
    await testEnv.DB.prepare(`INSERT INTO ai_request (id, fan_id, creator_id, draft_id, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`)
      .bind(crypto.randomUUID(), fanId, s.creatorId, s.draftId, new Date().toISOString()).run()
    const res = await s.turn('Richer greeting')
    expect(res.status).toBe(409)
    expect((await bodyOf(res)).error).toBe('ai_request_in_flight')
    expect(s.classifier.calls).toHaveLength(0)
  })

  it('resending the same requestId returns the same reply without a new call', async () => {
    const s = await directorSetup()
    s.director.push(detailed())
    const requestId = crypto.randomUUID()
    const first = await bodyOf(await s.turn('Richer greeting', { requestId }))
    const again = await s.turn('Richer greeting', { requestId })
    expect(again.status).toBe(200)
    expect(await bodyOf(again)).toEqual(first)
    expect(s.director.calls).toHaveLength(1)
  })
})

describe('AI Director: the hard list on AI turns', () => {
  it('a rules-layer block: 422 with the label, no provider call at all, audited on the ai_request', async () => {
    const s = await directorSetup()
    const res = await s.turn('an incest theme')
    expect(res.status).toBe(422)
    expect(await bodyOf(res)).toMatchObject({ error: 'hard_list_blocked', key: 'incest', lines: ['Sex between relatives'], field: 'fan_message' })
    expect(s.classifier.calls).toHaveLength(0)
    expect(s.director.calls).toHaveLength(0)
    const audit = await testEnv.DB.prepare(`SELECT subject_kind, detail_json FROM audit_event WHERE action = 'hard_list_block' AND creator_id = ?`).bind(s.creatorId).first<Record<string, string>>()
    expect(audit?.subject_kind).toBe('ai_request')
    expect(audit?.detail_json).not.toContain('incest theme')
    const { results } = await testEnv.DB.prepare(`SELECT status, outcome FROM ai_request WHERE draft_id = ?`).bind(s.draftId).all()
    expect(results).toEqual([{ status: 'rejected', outcome: 'input_blocked' }])
    // The blocked wording is not kept as conversation text.
    const { results: content } = await testEnv.DB.prepare('SELECT fan_message FROM ai_turn_content t JOIN ai_request r ON r.id = t.ai_request_id WHERE r.draft_id = ?').bind(s.draftId).all()
    expect(content).toHaveLength(0)
  })

  it('a minors hit opens a safety case with the request as evidence and pauses the account', async () => {
    const s = await directorSetup()
    const res = await s.turn('She should say she is 16 in the video')
    expect(res.status).toBe(403)
    expect((await bodyOf(res)).error).toBe('account_paused')
    const c = await testEnv.DB.prepare(`SELECT sc.category, e.request_json FROM safety_case sc JOIN safety_case_evidence e ON e.case_id = sc.id WHERE sc.creator_id = ?`)
      .bind(s.creatorId).first<{ category: string; request_json: string }>()
    expect(c?.category).toBe('minors')
    expect(JSON.parse(c!.request_json)).toMatchObject({ subjectKind: 'ai_request', field: 'fan_message', message: 'She should say she is 16 in the video' })
    expect(s.director.calls).toHaveLength(0)
  })

  it('the classifier catches what the rules miss, and a childlike prohibited_roles verdict becomes minors', async () => {
    const s = await directorSetup()
    s.classifier.push(verdict('prohibited_roles', { childlike: true }))
    const res = await s.turn('a paraphrase the rules layer does not know')
    expect(res.status).toBe(403)
    const audit = await testEnv.DB.prepare(`SELECT detail_json FROM audit_event WHERE action = 'hard_list_block' AND creator_id = ?`).bind(s.creatorId).first<{ detail_json: string }>()
    expect(JSON.parse(audit!.detail_json)).toMatchObject({ key: 'minors', layer: 'classifier', version: 'openai/gpt-oss-safeguard-20b@classifier-v1' })
    expect(s.director.calls).toHaveLength(0)
  })

  it('a classifier prohibited_roles verdict without a child stays prohibited_roles (422, not a case)', async () => {
    const s = await directorSetup()
    s.classifier.push(verdict('prohibited_roles'))
    const res = await s.turn('a paraphrase the rules layer does not know')
    expect(res.status).toBe(422)
    expect((await bodyOf(res)).key).toBe('prohibited_roles')
  })

  it('three blocks in 24 hours turn AI off for the fan (503 "restricted")', async () => {
    const s = await directorSetup()
    for (let i = 0; i < 3; i += 1) expect((await s.turn('an incest theme')).status).toBe(422)
    const res = await s.turn('Richer greeting')
    expect(await bodyOf(res)).toMatchObject({ error: 'ai_unavailable', reason: 'restricted' })
  })

  it('hard-list text in the model output is never shown: retried, then unavailable', async () => {
    const s = await directorSetup()
    s.director.push({ reply: reply({ clarifyingQuestion: 'Should it have an incest theme?' }) }, { reply: reply({ note: 'an incest theme' }) })
    const res = await s.turn('Surprise me')
    expect(res.status).toBe(503)
    expect(s.director.calls[1].messages.at(-1)?.content).toContain('Sex between relatives')
  })

  it('the output classifier failing closes the turn too', async () => {
    const s = await directorSetup()
    s.director.push({ reply: reply({ clarifyingQuestion: 'Which setting do you like best?' }) })
    s.classifier.push(verdict(null), { fail: 'http' })
    expect(await bodyOf(await s.turn('Surprise me'))).toMatchObject({ reason: 'classifier' })
  })
})

describe('AI Director: creator limits', () => {
  const withLimits = (custom: { id: string; text: string; mode: 'ask_me' | 'hard_no' }[]): CatalogContent => ({
    ...PILOT_V1,
    boundaries: { ...PILOT_V1.boundaries, custom },
  })

  it('a checklist hard no in the message becomes "Maya doesn’t do this" with the limit label', async () => {
    const s = await directorSetup()
    s.director.push({ reply: reply({ options: [option('x', [['maya_setting_floral', 1]])], notOffered: ['nudity'] }) })
    const body = await bodyOf(await s.turn('Floral studio, and naked please'))
    expect(body.notOffered).toEqual([
      { heading: 'Maya doesn’t do this', body: '“Anything explicit” is one of Maya’s limits, so it’s been left out of your plan. Everything else you asked for is still here.' },
    ])
    expect(body.suggestions).toHaveLength(1)
  })

  it('a custom free-text hard no is detected by the classifier (Gate 2 deviation 2)', async () => {
    const s = await directorSetup({ content: withLimits([{ id: 'lim_outdoors', text: 'Filming outdoors', mode: 'hard_no' }]) })
    s.classifier.push(verdict(null, { limitIds: ['lim_outdoors'] }))
    s.director.push({ reply: reply({ notOffered: ['a beach shoot'] }) })
    const body = await bodyOf(await s.turn('Could we film it on a beach at sunset?'))
    expect(body.notOffered).toContainEqual({
      heading: 'Maya doesn’t do this',
      body: '“Filming outdoors” is one of Maya’s limits, so it’s been left out of your plan. Everything else you asked for is still here.',
    })
    expect(s.classifier.calls[0].messages[0].content).toContain('"lim_outdoors"')
  })

  it('a not-offered entry that matches no limit gets the fixed sentence and never repeats the model', async () => {
    const s = await directorSetup()
    s.director.push({ reply: reply({ notOffered: ['zorbing on the moon'] }) })
    const body = await bodyOf(await s.turn('something odd'))
    expect(body.notOffered).toEqual([{ heading: 'Maya doesn’t do this', body: 'That isn’t something Maya offers, so it’s been left out of your plan. Everything else you asked for is still here.' }])
    expect(JSON.stringify(body)).not.toContain('zorbing')
  })

  it('a custom ask-me limit adds the design 13 C1 notice and the flag sticks to the draft on accept', async () => {
    const s = await directorSetup({ content: withLimits([{ id: 'lim_leo', text: 'Scenes with my partner, Leo', mode: 'ask_me' }]) })
    s.classifier.push(verdict(null, { limitIds: ['lim_leo'] }))
    s.director.push({ reply: reply({ options: [option('x', [['maya_setting_floral', 1]])] }) })
    const body = await bodyOf(await s.turn('Floral studio, and could Leo join?'))
    expect(body.suggestions[0].askFirst).toEqual([
      {
        limit: 'Scenes with my partner, Leo',
        heading: 'Ask Maya first',
        body: 'This touches one of Maya’s limits: “Scenes with my partner, Leo.” You can add it. Maya may say no, or set a price for it after reading your request.',
        accept: 'Add and ask Maya',
        decline: 'Not this one',
        footnote: 'No price is shown for this part yet. Maya sets it.',
      },
    ])
    const res = await s.api('POST', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${body.suggestions[0].id}/accept`, { expectedRevision: await s.revision() })
    const d = await bodyOf(res)
    expect(d.draft.boundaryFlags).toContainEqual({ source: 'suggestion', limit: { kind: 'custom', id: 'lim_leo' }, mode: 'ask_me' })
    // The flag survives a later manual save.
    const put = await s.api('PUT', `/api/creators/${s.creatorId}/drafts/${s.draftId}`, {
      expectedRevision: d.draft.revision,
      catalogVersionId: s.catalogVersionId,
      draft: { selections: d.draft.selections, fanDisplayName: null, customRequest: null, fanScript: null, notes: [], budget: 15_000 },
    })
    expect((await bodyOf(put)).draft.boundaryFlags).toContainEqual({ source: 'suggestion', limit: { kind: 'custom', id: 'lim_leo' }, mode: 'ask_me' })
  })

  it('a custom request is offered for the fan to confirm, never priced, and dropped under a decline policy', async () => {
    const s = await directorSetup()
    s.director.push({ reply: reply({ customRequest: 'wear the fan’s team scarf' }) })
    const body = await bodyOf(await s.turn('Could she wear my team scarf?'))
    expect(body.customRequest).toEqual({
      text: 'wear the fan’s team scarf',
      offer: 'This isn’t in Maya’s catalog. You can add it as a custom request: Maya reads it and sets the price.',
      accept: 'Add as custom request',
      decline: 'Not this one',
    })
    expect(body.suggestions).toEqual([])
    expect((await s.draft()).customRequest).toBeNull()

    const d = await directorSetup({ content: { ...PILOT_V1, boundaries: { ...PILOT_V1.boundaries, customRequestPolicy: 'decline' } } })
    d.director.push({ reply: reply({ customRequest: 'wear a scarf' }) })
    const declined = await bodyOf(await d.turn('Could she wear my scarf?'))
    expect(declined.customRequest).toBeNull()
    expect(declined.notOffered).toHaveLength(1)
  })
})

describe('AI Director: the thread and retention', () => {
  it('GET …/director returns replies left, availability and the thread', async () => {
    const s = await directorSetup()
    s.director.push(detailed())
    await s.turn('Richer greeting')
    const body = await bodyOf(await s.api('GET', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director`))
    expect(body).toMatchObject({ available: true, reason: null, repliesLeft: 19 })
    expect(body.turns).toHaveLength(1)
    expect(body.turns[0].fanMessage).toBe('Richer greeting')
  })

  it('the daily job deletes expired conversation text and frees abandoned requests', async () => {
    const s = await directorSetup()
    s.director.push(detailed())
    const res = await bodyOf(await s.turn('Richer greeting'))
    const later = new Date(Date.now() + 31 * 86_400_000)
    const out = await purgeExpired(testEnv, later)
    expect(out.purged).toBeGreaterThanOrEqual(1)
    const left = await testEnv.DB.prepare('SELECT 1 FROM ai_turn_content WHERE ai_request_id = ?').bind(res.requestId).first()
    expect(left).toBeNull()
    // The record without the wording stays.
    expect((await requestRow(res.requestId))?.status).toBe('succeeded')
  })
})
