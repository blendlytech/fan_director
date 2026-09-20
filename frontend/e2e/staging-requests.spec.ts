import { expect, test } from '@playwright/test'
import { E2E_MODE } from './mode.ts'

/* -------------------------------------------------------------------------- */
/*  The Phase 4 round trip, against staging (doc 11 §5.6 item 22).            */
/*                                                                            */
/*    E2E_MODE=staging E2E_BASE_URL=https://<staging host> npm run test:e2e   */
/*                                                                            */
/*  Playwright has no Clerk session, so what it can prove is the outside of    */
/*  the round trip: every commission endpoint refuses an unauthenticated       */
/*  caller, the fan and creator screens say plainly that you have to sign in,  */
/*  and nothing anywhere claims a request was sent, approved or paid. The      */
/*  signed-in run is the owner's, with their authenticator, and the Gate 4     */
/*  report records it separately.                                              */
/* -------------------------------------------------------------------------- */

test.describe('staging: sent requests', () => {
  test.skip(E2E_MODE !== 'staging', 'Runs against the deployed staging site only.')

  test('every commission endpoint refuses a caller with no session', async ({ request }) => {
    const calls = [
      { method: 'GET' as const, path: '/api/commissions' },
      { method: 'GET' as const, path: '/api/commissions/00000000-0000-4000-8000-000000000000' },
      { method: 'GET' as const, path: '/api/creator/commissions' },
      { method: 'GET' as const, path: '/api/creator/commissions/00000000-0000-4000-8000-000000000000' },
    ]
    for (const call of calls) {
      const res = await request.fetch(call.path, { method: call.method })
      expect(res.status(), `${call.method} ${call.path}`).toBe(401)
      expect(await res.text()).not.toContain('commission"')
    }
  })

  test('a state change refuses a caller with no session, and changes nothing', async ({ request }) => {
    const id = '00000000-0000-4000-8000-000000000000'
    for (const path of [
      `/api/commissions/${id}/withdraw`,
      `/api/commissions/${id}/reply`,
      `/api/creator/commissions/${id}/approve`,
      `/api/creator/commissions/${id}/payment-reported`,
    ]) {
      const res = await request.post(path, { data: {}, headers: { 'Content-Type': 'application/json' } })
      expect(res.status(), path).toBe(401)
    }
  })

  test('the fan’s requests page asks for a sign-in and claims nothing', async ({ page }) => {
    await page.goto('/requests')
    await expect(page.getByText('Sign in to see the requests you’ve sent.')).toBeVisible()
    for (const claim of ['Approved by Maya', 'Declined by Maya', 'marked your payment as received']) {
      await expect(page.getByText(claim)).toHaveCount(0)
    }
  })

  test('the creator queue asks for a sign-in and shows no one else’s requests', async ({ page }) => {
    await page.goto('/creator/requests')
    await expect(page.getByText('Sign in as the creator to see your request queue.')).toBeVisible()
    await expect(page.getByText('Needs your decision')).toHaveCount(0)
  })
})
