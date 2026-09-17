import { SignJWT, type CryptoKey as JoseKey } from 'jose'
import { describe, expect, it } from 'vitest'
import { bodyOf, boutique, call, clerk, clerkUser, sessionToken, strangerKeys, testEnv } from './helpers'

describe('session token verification', () => {
  it('accepts a valid bearer token', async () => {
    const fan = clerkUser()
    const res = await call('GET', '/api/session', { token: await fan.token() })
    expect(res.status).toBe(200)
    expect((await bodyOf(res)).signedIn).toBe(true)
  })

  it('denies a request with no token', async () => {
    const res = await call('GET', '/api/session')
    expect(res.status).toBe(401)
    expect((await bodyOf(res)).error).toBe('not_signed_in')
  })

  it('never trusts the __session cookie on its own', async () => {
    const fan = clerkUser()
    const res = await call('GET', '/api/session', { headers: { Cookie: `__session=${await fan.token()}` } })
    expect(res.status).toBe(401)
  })

  it('never treats the browse-session cookie as authentication', async () => {
    const created = await call('POST', '/api/browse-session')
    expect(created.status).toBe(201)
    const cookie = created.headers.get('Set-Cookie')!
    expect(cookie).toMatch(/HttpOnly; Secure; SameSite=Lax/)
    const res = await call('GET', '/api/session', { headers: { Cookie: cookie.split(';')[0] } })
    expect(res.status).toBe(401)
  })

  const rejected: [string, (u: ReturnType<typeof clerkUser>) => Promise<string>][] = [
    ['an altered signature', async (u) => {
      // Change a middle character: the last one can carry only padding bits.
      const t = await u.token()
      const i = t.length - 20
      return t.slice(0, i) + (t[i] === 'A' ? 'B' : 'A') + t.slice(i + 1)
    }],
    ['an altered payload', async (u) => {
      const [h, , s] = (await u.token()).split('.')
      const other = (await sessionToken('user_attacker', u.sessionId)).split('.')[1]
      return `${h}.${other}.${s}`
    }],
    ['an expired token', (u) => u.token({ expiresIn: -120 })],
    ['a not-yet-valid token', (u) => u.token({ notBefore: Math.floor(Date.now() / 1000) + 600 })],
    ['a wrong issuer', (u) => u.token({ claims: { iss: 'https://evil.test' } })],
    ['a wrong authorized party', (u) => u.token({ claims: { azp: 'https://evil.test' } })],
    ['a missing authorized party', (u) => u.token({ omit: ['azp'] })],
    ['a pending session', (u) => u.token({ claims: { sts: 'pending' } })],
    ['an impersonation session', (u) => u.token({ claims: { act: { sub: 'user_admin' } } })],
    ['a version 1 token', (u) => u.token({ claims: { v: 1 } })],
    ['a token signed by another key', (u) => u.token({ key: strangerKeys.privateKey as JoseKey })],
    ['an HS256 token', async (u) => new SignJWT({ sub: u.userId, sid: u.sessionId, azp: 'https://app.test', v: 2 })
      .setProtectedHeader({ alg: 'HS256' }).setIssuer('https://clerk.test').setIssuedAt().setNotBefore('0s').setExpirationTime('1m')
      .sign(new TextEncoder().encode(testEnv.CLERK_JWT_KEY))],
  ]
  for (const [name, make] of rejected) {
    it(`rejects ${name}`, async () => {
      const res = await call('GET', '/api/session', { token: await make(clerkUser()) })
      expect(res.status).toBe(401)
      expect((await bodyOf(res)).error).toBe('invalid_session')
    })
  }
})

describe('creator second factor (doc 11 §5.6 item 17)', () => {
  it('returns creator data with TOTP enrolled and a verified second factor', async () => {
    const { owner, creatorId } = await boutique()
    const res = await call('GET', '/api/creator/me', { token: await owner.token({ claims: { fva: [3, 1] } }) })
    expect(res.status).toBe(200)
    expect((await bodyOf(res)).creatorId).toBe(creatorId)
  })

  for (const [name, fva] of [
    ['never verified (-1)', [0, -1]],
    ['missing', undefined],
    ['malformed', ['0', 'x']],
    ['the wrong length', [0]],
  ] as const) {
    it(`gives no creator data when fva is ${name}`, async () => {
      const { owner } = await boutique()
      const res = await call('GET', '/api/creator/me', {
        token: await owner.token(fva === undefined ? { omit: ['fva'] } : { claims: { fva } }),
      })
      expect(res.status).toBe(403)
      const body = await bodyOf(res)
      expect(body.error).toBe('second_factor_required')
      expect(body.creatorId).toBeUndefined()
    })
  }

  it('sends a creator without TOTP enrolled to enrolment', async () => {
    const { owner } = await boutique()
    clerk.users.get(owner.userId)!.totpEnabled = false
    const res = await call('GET', '/api/creator/me', { token: await owner.token({ claims: { fva: [0, 0] } }) })
    expect(res.status).toBe(403)
    expect(await bodyOf(res)).toEqual({ error: 'second_factor_required', enrol: true })
  })

  it('refuses a user who was never invited, even with a second factor', async () => {
    const stranger = clerkUser({ totp: true })
    const res = await call('GET', '/api/creator/me', { token: await stranger.token({ claims: { fva: [0, 0] } }) })
    expect(res.status).toBe(403)
    expect((await bodyOf(res)).error).toBe('not_a_creator')
  })

  it('refuses an invitation that is not active yet', async () => {
    const { owner, creatorId } = await boutique()
    await testEnv.DB.prepare(`UPDATE creator SET status = 'invited' WHERE id = ?`).bind(creatorId).run()
    const res = await call('GET', '/api/creator/me', { token: await owner.token({ claims: { fva: [0, 0] } }) })
    expect(res.status).toBe(403)
  })
})

describe('routing', () => {
  it('has no creator draft route in Phase 1 (review item 6)', async () => {
    const { owner } = await boutique()
    const res = await call('GET', `/api/creator/drafts/${crypto.randomUUID()}`, { token: await owner.token({ claims: { fva: [0, 0] } }) })
    expect(res.status).toBe(404)
  })

  it('has no send, submission, AI or token-issuing routes', async () => {
    const fan = clerkUser()
    const token = await fan.token()
    for (const [method, path] of [
      ['POST', '/api/drafts/x/submit'],
      ['POST', '/api/creators/cr/drafts/x/submit'],
      ['POST', '/api/ai/director'],
      ['POST', '/api/email/send'],
      ['POST', '/api/creators/cr/unsubscribe-link'],
    ]) {
      expect((await call(method, path, { token, body: {} })).status).toBe(404)
    }
  })

  it('answers a wrong method with 405 and sets no-store headers', async () => {
    const res = await call('DELETE', '/api/health')
    expect(res.status).toBe(405)
    expect(res.headers.get('Cache-Control')).toBe('no-store, private')
    const health = await call('GET', '/api/health')
    expect(health.status).toBe(200)
    expect(health.headers.get('Referrer-Policy')).toBe('no-referrer')
  })
})
