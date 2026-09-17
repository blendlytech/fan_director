import { isFirstSignUp, type FanIdentity } from './auth'
import { verifiedPrimaryEmail } from './clerk'
import { ApiError, clientIp, json, readJsonBody, userAgent } from './http'
import type { Deps, Env } from './types'
import { assertOnlyKeys, LIMITS } from './validation'

/**
 * News consent (doc 11 §5.8). The server records every grant and withdrawal as
 * a new row; the email comes from Clerk's verified primary address, never from
 * the browser; the browser sends only the wording *version* it showed.
 * No production wording exists until the owner approves it, so until then
 * every grant fails with `unknown_wording`.
 */

interface Wording {
  version: string
  label: string
  helper: string
}

async function activeCreator(env: Env, creatorId: string): Promise<{ id: string; display_name: string }> {
  const creator = await env.DB.prepare(`SELECT id, display_name FROM creator WHERE id = ? AND status = 'active'`)
    .bind(creatorId)
    .first<{ id: string; display_name: string }>()
  if (!creator) throw new ApiError(404, 'not_found')
  return creator
}

async function currentWording(env: Env): Promise<Wording | null> {
  return env.DB.prepare('SELECT version, label, helper FROM consent_wording ORDER BY created_at DESC, version DESC LIMIT 1').first<Wording>()
}

async function latestRow(env: Env, fanId: string, creatorId: string) {
  return env.DB.prepare(
    `SELECT status, email, wording_version FROM marketing_consent
      WHERE fan_id = ? AND creator_id = ? ORDER BY seq DESC LIMIT 1`,
  )
    .bind(fanId, creatorId)
    .first<{ status: 'subscribed' | 'unsubscribed'; email: string; wording_version: string }>()
}

async function assertWording(env: Env, version: unknown): Promise<string> {
  if (typeof version !== 'string' || version.length < 1 || version.length > 40) {
    throw new ApiError(400, 'invalid_consent', { field: 'wordingVersion' })
  }
  const row = await env.DB.prepare('SELECT version FROM consent_wording WHERE version = ?').bind(version).first()
  if (!row) throw new ApiError(422, 'unknown_wording')
  return version
}

async function verifiedEmail(deps: Deps, fan: FanIdentity): Promise<string> {
  const user = await deps.clerk.getUser(fan.claims.userId)
  const email = user ? verifiedPrimaryEmail(user) : null
  if (!email) throw new ApiError(409, 'email_not_verified')
  return email
}

function consentInsert(
  env: Env,
  request: Request,
  deps: Deps,
  row: { fanId: string; creatorId: string; email: string; status: string; wordingVersion: string; source: string },
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO marketing_consent (id, fan_id, creator_id, email, status, wording_version, source, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    row.fanId,
    row.creatorId,
    row.email,
    row.status,
    row.wordingVersion,
    row.source,
    clientIp(request),
    userAgent(request),
    deps.now().toISOString(),
  )
}

/** GET: current status, the wording to show, and whether to show the one-time step. */
export async function getConsent(env: Env, deps: Deps, fan: FanIdentity, creatorId: string): Promise<Response> {
  const creator = await activeCreator(env, creatorId)
  const [row, wording, answered] = await Promise.all([
    latestRow(env, fan.fanId, creatorId),
    currentWording(env),
    env.DB.prepare('SELECT 1 FROM consent_onboarding WHERE fan_id = ?').bind(fan.fanId).first(),
  ])
  // The step needs wording to show, must not have been answered, and appears
  // only straight after a first sign-up (conservative on any doubt).
  const showStep = wording !== null && !answered && (await isFirstSignUp(fan.claims, deps))
  return json(200, {
    creatorId: creator.id,
    creatorName: creator.display_name,
    status: row?.status ?? 'none',
    wording,
    onboarding: { show: showStep },
  })
}

/** POST from account settings (design 16 A3): subscribe or unsubscribe. */
export async function postConsent(
  request: Request,
  env: Env,
  deps: Deps,
  fan: FanIdentity,
  creatorId: string,
): Promise<Response> {
  await activeCreator(env, creatorId)
  const body = await readJsonBody(request, LIMITS.consentBodyBytes)
  assertOnlyKeys(body, ['status', 'wordingVersion'], 'invalid_consent')
  const current = await latestRow(env, fan.fanId, creatorId)

  if (body.status === 'subscribed') {
    const wordingVersion = await assertWording(env, body.wordingVersion)
    const email = await verifiedEmail(deps, fan)
    try {
      await consentInsert(env, request, deps, {
        fanId: fan.fanId, creatorId, email, status: 'subscribed', wordingVersion, source: 'settings',
      }).run()
    } catch {
      throw new ApiError(503, 'save_failed')
    }
    return json(200, { status: 'subscribed' })
  }

  if (body.status === 'unsubscribed') {
    if (body.wordingVersion !== undefined) throw new ApiError(400, 'invalid_consent', { field: 'wordingVersion' })
    // Withdrawal never waits on Clerk: it applies to the address that was subscribed.
    if (!current || current.status === 'unsubscribed') return json(200, { status: current ? 'unsubscribed' : 'none' })
    try {
      await consentInsert(env, request, deps, {
        fanId: fan.fanId, creatorId, email: current.email, status: 'unsubscribed',
        wordingVersion: current.wording_version, source: 'settings',
      }).run()
    } catch {
      throw new ApiError(503, 'save_failed')
    }
    return json(200, { status: 'unsubscribed' })
  }

  throw new ApiError(400, 'invalid_consent', { field: 'status' })
}

/** POST from the one-time step after sign-up (design 23 A–A6). */
export async function postOnboarding(
  request: Request,
  env: Env,
  deps: Deps,
  fan: FanIdentity,
  creatorId: string,
): Promise<Response> {
  await activeCreator(env, creatorId)
  const body = await readJsonBody(request, LIMITS.consentBodyBytes)
  assertOnlyKeys(body, ['choice', 'wordingVersion'], 'invalid_consent')
  if (body.choice !== 'subscribe' && body.choice !== 'skip') throw new ApiError(400, 'invalid_consent', { field: 'choice' })

  const answered = () => env.DB.prepare('SELECT 1 FROM consent_onboarding WHERE fan_id = ?').bind(fan.fanId).first()
  if (await answered()) throw new ApiError(409, 'already_answered')
  if (!(await isFirstSignUp(fan.claims, deps))) throw new ApiError(403, 'onboarding_not_available')

  const now = deps.now().toISOString()
  if (body.choice === 'skip') {
    if (body.wordingVersion !== undefined) throw new ApiError(400, 'invalid_consent', { field: 'wordingVersion' })
    // A skip writes no consent row (doc 11 §5.8), only that the step is done.
    const result = await env.DB.prepare(
      `INSERT INTO consent_onboarding (fan_id, creator_id, outcome, completed_at) VALUES (?, ?, 'skipped', ?)
       ON CONFLICT (fan_id) DO NOTHING`,
    )
      .bind(fan.fanId, creatorId, now)
      .run()
    if (result.meta.changes !== 1) throw new ApiError(409, 'already_answered')
    return json(200, { outcome: 'skipped' })
  }

  const wordingVersion = await assertWording(env, body.wordingVersion)
  const email = await verifiedEmail(deps, fan)
  try {
    // One transaction: the onboarding row's primary key makes a second tab's
    // batch fail as a whole, so it can't add a second consent row.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO consent_onboarding (fan_id, creator_id, outcome, completed_at) VALUES (?, ?, 'subscribed', ?)`,
      ).bind(fan.fanId, creatorId, now),
      consentInsert(env, request, deps, {
        fanId: fan.fanId, creatorId, email, status: 'subscribed', wordingVersion, source: 'signup',
      }),
    ])
  } catch {
    if (await answered()) throw new ApiError(409, 'already_answered')
    throw new ApiError(503, 'save_failed')
  }
  return json(200, { outcome: 'subscribed' })
}
