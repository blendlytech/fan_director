import { describe, expect, it } from 'vitest'
import { signUnsubscribeToken } from '../scripts/unsubscribe-token.mjs'
import { issueUnsubscribeToken, verifyUnsubscribeToken } from '../src/unsubscribe'
import { bodyOf, boutique, call, clerkUser, fanIdFor, testEnv, WORDING } from './helpers'

async function subscribedFan(name: string) {
  const { creatorId } = await boutique(name)
  const fan = clerkUser()
  const fanId = await fanIdFor(fan)
  const res = await call('POST', `/api/creators/${creatorId}/consent`, {
    token: await fan.token(),
    body: { status: 'subscribed', wordingVersion: WORDING },
  })
  expect(res.status).toBe(200)
  return { fanId, creatorId }
}

describe('the staging token script signs exactly like the Worker', () => {
  it('produces the same token for the same inputs', async () => {
    const at = new Date('2026-09-17T12:00:00Z')
    const fromScript = await signUnsubscribeToken(testEnv.UNSUBSCRIBE_SIGNING_KEY, 'fan_a', 'cr_a', at)
    expect(fromScript).toBe(await issueUnsubscribeToken(testEnv, 'fan_a', 'cr_a', at))
    expect(await verifyUnsubscribeToken(testEnv, fromScript)).toEqual({
      fanId: 'fan_a',
      creatorId: 'cr_a',
      issuedAt: Math.floor(at.getTime() / 1000),
    })
  })

  it('works end to end: GET confirms, POST unsubscribes', async () => {
    const { fanId, creatorId } = await subscribedFan('Script')
    const token = await signUnsubscribeToken(testEnv.UNSUBSCRIBE_SIGNING_KEY, fanId, creatorId)
    expect(await bodyOf(await call('GET', `/api/unsubscribe/${token}`, { origin: null }))).toEqual({
      state: 'confirm',
      creatorName: 'Script',
    })
    expect(await bodyOf(await call('POST', `/api/unsubscribe/${token}`))).toEqual({ state: 'done', creatorName: 'Script' })
  })

  it('refuses a short key and bad ids', async () => {
    await expect(signUnsubscribeToken(btoa('too short'), 'fan_a', 'cr_a')).rejects.toThrow('32 bytes')
    await expect(signUnsubscribeToken(testEnv.UNSUBSCRIBE_SIGNING_KEY, 'fan a', 'cr_a')).rejects.toThrow('invalid ids')
  })
})
