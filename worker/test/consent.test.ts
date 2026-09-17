import { describe, expect, it } from 'vitest'
import { bodyOf, boutique, call, clerk, clerkUser, consentRows, WORDING, testEnv } from './helpers'

const consentPath = (creatorId: string) => `/api/creators/${creatorId}/consent`
const onboardingPath = (creatorId: string) => `/api/creators/${creatorId}/consent-onboarding`

describe('one-time step after sign-up (doc 11 §5.8, design 23 A–A6)', () => {
  it('shows the step after a first sign-up and records a signup grant with server evidence', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser({ email: 'sam@example.test' })
    const token = await fan.token()

    const state = await bodyOf(await call('GET', consentPath(creatorId), { token }))
    expect(state.onboarding.show).toBe(true)
    expect(state.status).toBe('none')
    expect(state.wording).toEqual({ version: WORDING, label: 'Test label (fixture)', helper: 'Test helper (fixture)' })

    const res = await call('POST', onboardingPath(creatorId), { token, body: { choice: 'subscribe', wordingVersion: WORDING } })
    expect(res.status).toBe(200)
    expect(await bodyOf(res)).toEqual({ outcome: 'subscribed' })

    const rows = await consentRows(fan.userId, creatorId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      email: 'sam@example.test', status: 'subscribed', wording_version: WORDING, source: 'signup',
      ip: '203.0.113.7', user_agent: 'vitest',
    })

    const after = await bodyOf(await call('GET', consentPath(creatorId), { token }))
    expect(after.status).toBe('subscribed')
    expect(after.onboarding.show).toBe(false)
  })

  it('records a skip without any consent row, and only once', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser()
    const token = await fan.token()
    const res = await call('POST', onboardingPath(creatorId), { token, body: { choice: 'skip' } })
    expect(res.status).toBe(200)
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(0)

    const again = await call('POST', onboardingPath(creatorId), { token, body: { choice: 'subscribe', wordingVersion: WORDING } })
    expect(again.status).toBe(409)
    expect((await bodyOf(again)).error).toBe('already_answered')
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(0)
  })

  it('never shows the step after an ordinary sign-in', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser({ sessionAfterAccountMs: 2 * 60 * 60_000 })
    const token = await fan.token()
    expect((await bodyOf(await call('GET', consentPath(creatorId), { token }))).onboarding.show).toBe(false)
    const res = await call('POST', onboardingPath(creatorId), { token, body: { choice: 'subscribe', wordingVersion: WORDING } })
    expect(res.status).toBe(403)
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(0)
  })

  it('treats a session 61 seconds after the account as an ordinary sign-in', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser({ sessionAfterAccountMs: 61_000 })
    expect((await bodyOf(await call('GET', consentPath(creatorId), { token: await fan.token() }))).onboarding.show).toBe(false)
  })

  it('does not show the step when the user has another live session', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser()
    clerk.sessions.set(`sess_other${fan.userId}`, { id: `sess_other${fan.userId}`, userId: fan.userId, status: 'active', createdAt: Date.now() })
    expect((await bodyOf(await call('GET', consentPath(creatorId), { token: await fan.token() }))).onboarding.show).toBe(false)
  })

  it('fails conservatively when Clerk is unavailable', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser()
    const token = await fan.token()
    clerk.failing = true
    try {
      expect((await bodyOf(await call('GET', consentPath(creatorId), { token }))).onboarding.show).toBe(false)
      const res = await call('POST', onboardingPath(creatorId), { token, body: { choice: 'skip' } })
      expect(res.status).toBe(403)
    } finally {
      clerk.failing = false
    }
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(0)
  })

  it('writes exactly one row when two tabs subscribe at once', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser()
    const token = await fan.token()
    const body = { choice: 'subscribe', wordingVersion: WORDING }
    const results = await Promise.all([
      call('POST', onboardingPath(creatorId), { token, body }),
      call('POST', onboardingPath(creatorId), { token, body }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(1)
  })

  it('refuses to record consent for an unverified primary email', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser({ emailVerified: false })
    const res = await call('POST', onboardingPath(creatorId), { token: await fan.token(), body: { choice: 'subscribe', wordingVersion: WORDING } })
    expect(res.status).toBe(409)
    expect((await bodyOf(res)).error).toBe('email_not_verified')
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(0)
  })

  it('refuses unknown wording and wording the browser tries to supply', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser()
    const token = await fan.token()
    const unknown = await call('POST', onboardingPath(creatorId), { token, body: { choice: 'subscribe', wordingVersion: 'made-up' } })
    expect(unknown.status).toBe(422)
    const supplied = await call('POST', onboardingPath(creatorId), { token, body: { choice: 'subscribe', wordingVersion: WORDING, label: 'Yes' } })
    expect(supplied.status).toBe(400)
    const email = await call('POST', onboardingPath(creatorId), { token, body: { choice: 'subscribe', wordingVersion: WORDING, email: 'x@evil.test' } })
    expect(email.status).toBe(400)
    expect(await consentRows(fan.userId, creatorId)).toHaveLength(0)
  })
})

describe('settings (design 16 A3)', () => {
  it('appends a grant and a withdrawal, never editing history', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser({ sessionAfterAccountMs: 3 * 60 * 60_000 })
    const token = await fan.token()
    expect((await call('POST', consentPath(creatorId), { token, body: { status: 'subscribed', wordingVersion: WORDING } })).status).toBe(200)
    expect((await call('POST', consentPath(creatorId), { token, body: { status: 'unsubscribed' } })).status).toBe(200)
    // Repeating a withdrawal adds nothing.
    expect((await call('POST', consentPath(creatorId), { token, body: { status: 'unsubscribed' } })).status).toBe(200)

    const rows = await consentRows(fan.userId, creatorId)
    expect(rows.map((r) => [r.status, r.source])).toEqual([['subscribed', 'settings'], ['unsubscribed', 'settings']])

    await expect(testEnv.DB.prepare(`UPDATE marketing_consent SET status = 'subscribed' WHERE id = ?`).bind(rows[1].id).run()).rejects.toThrow()
    await expect(testEnv.DB.prepare('DELETE FROM marketing_consent WHERE id = ?').bind(rows[0].id).run()).rejects.toThrow()
    await expect(testEnv.DB.prepare(`UPDATE consent_wording SET label = 'changed' WHERE version = ?`).bind(WORDING).run()).rejects.toThrow()
  })

  it('withdraws even while Clerk is unavailable', async () => {
    const { creatorId } = await boutique()
    const fan = clerkUser()
    const token = await fan.token()
    await call('POST', consentPath(creatorId), { token, body: { status: 'subscribed', wordingVersion: WORDING } })
    clerk.failing = true
    try {
      expect((await call('POST', consentPath(creatorId), { token, body: { status: 'unsubscribed' } })).status).toBe(200)
    } finally {
      clerk.failing = false
    }
    expect((await consentRows(fan.userId, creatorId)).at(-1)!.status).toBe('unsubscribed')
  })

  it('requires sign-in and a same-origin request', async () => {
    const { creatorId } = await boutique()
    expect((await call('POST', consentPath(creatorId), { body: { status: 'unsubscribed' } })).status).toBe(401)
    const fan = clerkUser()
    const res = await call('POST', consentPath(creatorId), { token: await fan.token(), origin: 'https://evil.test', body: { status: 'unsubscribed' } })
    expect(res.status).toBe(403)
  })
})
