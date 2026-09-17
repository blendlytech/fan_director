import { describe, expect, it } from 'vitest'
import { issueUnsubscribeToken, verifyUnsubscribeToken } from '../src/unsubscribe'
import { bodyOf, boutique, call, clerkUser, consentRows, fanIdFor, testEnv, WORDING } from './helpers'

const link = (token: string) => `/api/unsubscribe/${token}`

/** A fan subscribed to a creator through settings, with a signed link for them. */
async function subscribedFan(name = 'Maya') {
  const { creatorId } = await boutique(name)
  const fan = clerkUser()
  const fanId = await fanIdFor(fan)
  const res = await call('POST', `/api/creators/${creatorId}/consent`, {
    token: await fan.token(),
    body: { status: 'subscribed', wordingVersion: WORDING },
  })
  expect(res.status).toBe(200)
  const token = await issueUnsubscribeToken(testEnv, fanId, creatorId, new Date())
  return { creatorId, fan, fanId, token }
}

async function totalRows(): Promise<number> {
  return (await testEnv.DB.prepare('SELECT COUNT(*) AS n FROM marketing_consent').first<{ n: number }>())!.n
}

function b64urlJson(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('GET never changes consent (review item 4)', () => {
  it('returns the confirm state and writes nothing, even when repeated', async () => {
    const { creatorId, fan, token } = await subscribedFan()
    const before = await totalRows()
    for (let i = 0; i < 3; i++) {
      const res = await call('GET', link(token), { origin: null })
      expect(res.status).toBe(200)
      expect(await bodyOf(res)).toEqual({ state: 'confirm', creatorName: 'Maya' })
    }
    expect(await totalRows()).toBe(before)
    const rows = await consentRows(fan.userId, creatorId)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('subscribed')
  })

  it('writes nothing for an invalid token', async () => {
    const before = await totalRows()
    const res = await call('GET', link('v1.bm9wZQ.bm9wZQ'), { origin: null })
    expect(await bodyOf(res)).toEqual({ state: 'invalid' })
    expect(await totalRows()).toBe(before)
  })

  it('HEAD and other methods cannot unsubscribe either', async () => {
    const { creatorId, fan, token } = await subscribedFan()
    for (const method of ['HEAD', 'PUT', 'DELETE', 'PATCH']) {
      await call(method, link(token))
    }
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(1)
  })
})

describe('POST unsubscribes', () => {
  it('appends exactly one withdrawal with source unsubscribe_page, then reports already unsubscribed', async () => {
    const { creatorId, fan, token } = await subscribedFan()
    const res = await call('POST', link(token))
    expect(res.status).toBe(200)
    expect(await bodyOf(res)).toEqual({ state: 'done', creatorName: 'Maya' })

    const rows = await consentRows(fan.userId, creatorId)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({
      status: 'unsubscribed', source: 'unsubscribe_page', email: rows[0].email, wording_version: WORDING,
      ip: '203.0.113.7', user_agent: 'vitest',
    })

    const again = await call('POST', link(token))
    expect(await bodyOf(again)).toEqual({ state: 'already_unsubscribed', creatorName: 'Maya' })
    const get = await call('GET', link(token), { origin: null })
    expect((await bodyOf(get)).state).toBe('already_unsubscribed')
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(2)
  })

  it('writes one row when the button is pressed twice at once', async () => {
    const { creatorId, fan, token } = await subscribedFan()
    const results = await Promise.all([call('POST', link(token)), call('POST', link(token))])
    const states = (await Promise.all(results.map(bodyOf))).map((b) => b.state).sort()
    expect(states).toEqual(['already_unsubscribed', 'done'])
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(2)
  })

  it('refuses a cross-origin POST without writing', async () => {
    const { creatorId, fan, token } = await subscribedFan()
    const res = await call('POST', link(token), { origin: 'https://evil.test' })
    expect(res.status).toBe(403)
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(1)
  })

  it('withdraws a later resubscription too: every link means "stop"', async () => {
    const { creatorId, fan, token } = await subscribedFan()
    await call('POST', link(token))
    await call('POST', `/api/creators/${creatorId}/consent`, { token: await fan.token(), body: { status: 'subscribed', wordingVersion: WORDING } })
    expect((await bodyOf(await call('GET', link(token), { origin: null }))).state).toBe('confirm')
    expect((await bodyOf(await call('POST', link(token)))).state).toBe('done')
    expect((await consentRows(fan.userId, creatorId)).map((r) => r.status)).toEqual(['subscribed', 'unsubscribed', 'subscribed', 'unsubscribed'])
  })

  it('only affects the fan and creator named in the token', async () => {
    const maya = await subscribedFan('Maya')
    const nina = await subscribedFan('Nina')
    await call('POST', link(maya.token))
    expect((await consentRows(nina.fan.userId, nina.creatorId)).map((r) => r.status)).toEqual(['subscribed'])
  })
})

describe('signed token (review item 5)', () => {
  it('rejects an altered payload on GET and POST without touching consent', async () => {
    const victim = await subscribedFan()
    const attacker = await subscribedFan()
    const [v, , sig] = attacker.token.split('.')
    const forged = `${v}.${b64urlJson({ f: victim.fanId, c: victim.creatorId, t: 1 })}.${sig}`
    expect(await bodyOf(await call('GET', link(forged), { origin: null }))).toEqual({ state: 'invalid' })
    expect(await bodyOf(await call('POST', link(forged)))).toEqual({ state: 'invalid' })
    expect(await consentRows(victim.fan.userId, victim.creatorId)).toHaveLength(1)
  })

  it('rejects an altered signature', async () => {
    const { creatorId, fan, token } = await subscribedFan()
    const i = token.length - 10
    const altered = token.slice(0, i) + (token[i] === 'A' ? 'B' : 'A') + token.slice(i + 1)
    expect(await bodyOf(await call('POST', link(altered)))).toEqual({ state: 'invalid' })
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(1)
  })

  it('rejects a token signed with a different key', async () => {
    const { creatorId, fan, fanId } = await subscribedFan()
    const otherKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    const token = await issueUnsubscribeToken({ UNSUBSCRIBE_SIGNING_KEY: otherKey }, fanId, creatorId, new Date())
    expect(await bodyOf(await call('POST', link(token)))).toEqual({ state: 'invalid' })
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(1)
  })

  it('rejects malformed, truncated, re-versioned and padded tokens', async () => {
    const { fanId, creatorId, token } = await subscribedFan()
    const [, payload, sig] = token.split('.')
    for (const bad of [
      '', 'v1', `v1.${payload}`, `v2.${payload}.${sig}`, `${token}.extra`, `v1.${payload}.${sig}=`,
      `v1.${payload}.${sig.slice(0, -2)}`, 'x'.repeat(600), `v1.${payload}.${sig}`.replace('v1', 'V1'),
    ]) {
      expect(await verifyUnsubscribeToken(testEnv, bad)).toBeNull()
    }
    expect(await verifyUnsubscribeToken(testEnv, token)).toMatchObject({ fanId, creatorId })
  })

  it('carries no email address', async () => {
    const { token } = await subscribedFan()
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    expect(Object.keys(payload).sort()).toEqual(['c', 'f', 't'])
    expect(token).not.toContain('%40')
    expect(token).not.toContain('@')
  })

  it('treats a valid signature for an unknown creator as invalid', async () => {
    const token = await issueUnsubscribeToken(testEnv, 'fan_missing', 'cr_missing', new Date())
    expect(await bodyOf(await call('GET', link(token), { origin: null }))).toEqual({ state: 'invalid' })
  })
})
