import { importSPKI, jwtVerify, type CryptoKey as JoseKey } from 'jose'
import { ApiError } from './http'
import type { Deps, Env } from './types'

export interface SessionClaims {
  userId: string
  sessionId: string
  /** [minutes since first factor, minutes since second factor]; -1 = never. */
  fva: [number, number] | null
}

export interface FanIdentity {
  fanId: string
  claims: SessionClaims
}

export interface CreatorIdentity {
  creatorId: string
  displayName: string
  claims: SessionClaims
}

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/
const keyCache = new Map<string, Promise<JoseKey>>()

function publicKey(pem: string): Promise<JoseKey> {
  let key = keyCache.get(pem)
  if (!key) {
    key = importSPKI(pem, 'RS256')
    keyCache.set(pem, key)
  }
  return key
}

/**
 * Verifies a Clerk session token taken from the Authorization header only.
 * The `__session` cookie is never read, so a cookie alone authenticates nothing.
 * Every failure is the same 401 so callers learn nothing about why.
 */
export async function verifySession(request: Request, env: Env): Promise<SessionClaims> {
  const match = BEARER.exec(request.headers.get('Authorization') ?? '')
  if (!match) throw new ApiError(401, 'not_signed_in')

  const invalid = new ApiError(401, 'invalid_session')
  let payload: Record<string, unknown>
  try {
    const verified = await jwtVerify(match[1], await publicKey(env.CLERK_JWT_KEY), {
      algorithms: ['RS256'],
      issuer: env.CLERK_ISSUER,
      clockTolerance: 5,
      requiredClaims: ['exp', 'nbf', 'iat', 'sub', 'sid', 'azp'],
    })
    payload = verified.payload as Record<string, unknown>
  } catch {
    throw invalid
  }

  const allowed = env.CLERK_AUTHORIZED_PARTIES.split(',').map((s) => s.trim()).filter(Boolean)
  if (typeof payload.azp !== 'string' || !allowed.includes(payload.azp)) throw invalid
  // Version 2 tokens carry `fva` in a known shape; refuse anything else.
  if (payload.v !== 2) throw invalid
  // A pending session (e.g. unfinished tasks) is not signed in yet.
  if (payload.sts !== undefined && payload.sts !== 'active') throw invalid
  // Impersonation sessions never reach private data.
  if (payload.act !== undefined) throw invalid
  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw invalid

  return { userId: payload.sub, sessionId: payload.sid, fva: parseFva(payload.fva) }
}

function parseFva(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [first, second] = value
  if (!Number.isInteger(first) || !Number.isInteger(second)) return null
  return [first, second]
}

/** A signed-in fan, created on first sight. Paused or closed fans get no data. */
export async function requireFan(request: Request, env: Env, deps: Deps): Promise<FanIdentity> {
  const claims = await verifySession(request, env)
  await env.DB.prepare(
    `INSERT INTO fan (id, clerk_user_id, status, created_at) VALUES (?, ?, 'active', ?)
     ON CONFLICT (clerk_user_id) DO NOTHING`,
  )
    .bind(crypto.randomUUID(), claims.userId, deps.now().toISOString())
    .run()
  const fan = await env.DB.prepare('SELECT id, status FROM fan WHERE clerk_user_id = ?')
    .bind(claims.userId)
    .first<{ id: string; status: string }>()
  if (!fan) throw new ApiError(503, 'unavailable')
  if (fan.status === 'suspended') throw new ApiError(403, 'account_paused')
  if (fan.status !== 'active') throw new ApiError(403, 'account_closed')
  return { fanId: fan.id, claims }
}

/**
 * A creator: invited by the owner (row linked to this Clerk user and active),
 * with an authenticator app enrolled and a second factor verified in this
 * session. Clerk's "require MFA" would also force fans, so it's enforced here
 * (doc 11 §5.6 item 17).
 */
export async function requireCreator(request: Request, env: Env, deps: Deps): Promise<CreatorIdentity> {
  const claims = await verifySession(request, env)
  const creator = await env.DB.prepare(
    `SELECT id, display_name FROM creator WHERE clerk_user_id = ? AND status = 'active'`,
  )
    .bind(claims.userId)
    .first<{ id: string; display_name: string }>()
  if (!creator) throw new ApiError(403, 'not_a_creator')

  const secondFactorVerified = claims.fva !== null && claims.fva[1] >= 0
  const user = await deps.clerk.getUser(claims.userId)
  if (!user || user.banned || user.locked) throw new ApiError(403, 'not_a_creator')
  if (!user.totpEnabled || !secondFactorVerified) {
    throw new ApiError(403, 'second_factor_required', { enrol: !user.totpEnabled })
  }
  return { creatorId: creator.id, displayName: creator.display_name, claims }
}

export const FIRST_SIGN_UP_WINDOW_MS = 60_000

/**
 * True only right after a fan's first sign-up: this is the user's only live
 * session, and it was created within 60 seconds of the account. Any doubt or
 * Clerk error returns false, so an ordinary sign-in never sees the step.
 * Real Clerk timestamps must be checked in staging (worker/README.md).
 */
export async function isFirstSignUp(claims: SessionClaims, deps: Deps): Promise<boolean> {
  try {
    const [user, session, live] = await Promise.all([
      deps.clerk.getUser(claims.userId),
      deps.clerk.getSession(claims.sessionId),
      deps.clerk.listLiveSessions(claims.userId),
    ])
    if (!user || !session || session.userId !== user.id) return false
    if (live.length !== 1 || live[0].id !== session.id) return false
    return Math.abs(session.createdAt - user.createdAt) <= FIRST_SIGN_UP_WINDOW_MS
  } catch {
    return false
  }
}
