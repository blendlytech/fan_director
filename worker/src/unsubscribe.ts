import { ApiError, assertSameOrigin, clientIp, json, userAgent } from './http'
import type { Deps, Env } from './types'

/**
 * One-click unsubscribe (doc 11 §5.8, design 23 U1–U5).
 *
 * Token: `v1.<payload>.<signature>`, both parts base64url.
 *   payload   = JSON { f: fanId, c: creatorId, t: issuedAt (unix seconds) }
 *   signature = HMAC-SHA256(UNSUBSCRIBE_SIGNING_KEY, "v1." + payload)
 * The key is a Worker secret. The token holds no email address. The signature
 * is checked with crypto.subtle.verify (constant time) before the database is
 * touched, so an altered token never reaches a query.
 *
 * GET only reads: mail scanners open links on their own, so opening the link
 * must never change consent. POST, from the page's Unsubscribe button, writes.
 */

const VERSION = 'v1'
const B64URL = /^[A-Za-z0-9_-]+$/
const MAX_TOKEN_LENGTH = 512
const ID = /^[A-Za-z0-9_-]{1,64}$/

export type LinkState = 'confirm' | 'already_unsubscribed' | 'invalid'

interface TokenPayload {
  fanId: string
  creatorId: string
  issuedAt: number
}

function toB64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(text: string): Uint8Array | null {
  if (!B64URL.test(text)) return null
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    // Reject non-canonical encodings so one payload has exactly one token.
    return toB64url(bytes) === text ? bytes : null
  } catch {
    return null
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0))
  if (raw.byteLength < 32) throw new Error('UNSUBSCRIBE_SIGNING_KEY must be at least 32 bytes')
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** For the future sender (and tests). There is no HTTP route that issues tokens. */
export async function issueUnsubscribeToken(
  env: Pick<Env, 'UNSUBSCRIBE_SIGNING_KEY'>,
  fanId: string,
  creatorId: string,
  issuedAt: Date,
): Promise<string> {
  if (!ID.test(fanId) || !ID.test(creatorId)) throw new Error('invalid ids')
  const payload = toB64url(
    new TextEncoder().encode(JSON.stringify({ f: fanId, c: creatorId, t: Math.floor(issuedAt.getTime() / 1000) })),
  )
  const signed = `${VERSION}.${payload}`
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.UNSUBSCRIBE_SIGNING_KEY), new TextEncoder().encode(signed))
  return `${signed}.${toB64url(new Uint8Array(sig))}`
}

/** Returns the payload only if the format, version and signature are all good. */
export async function verifyUnsubscribeToken(
  env: Pick<Env, 'UNSUBSCRIBE_SIGNING_KEY'>,
  token: string,
): Promise<TokenPayload | null> {
  if (token.length > MAX_TOKEN_LENGTH) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== VERSION) return null
  const payloadBytes = fromB64url(parts[1])
  const sigBytes = fromB64url(parts[2])
  if (!payloadBytes || !sigBytes || sigBytes.byteLength !== 32) return null

  const ok = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(env.UNSUBSCRIBE_SIGNING_KEY),
    sigBytes,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )
  if (!ok) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(payloadBytes))
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const p = parsed as Record<string, unknown>
  if (Object.keys(p).sort().join(',') !== 'c,f,t') return null
  if (typeof p.f !== 'string' || !ID.test(p.f) || typeof p.c !== 'string' || !ID.test(p.c)) return null
  if (!Number.isInteger(p.t) || (p.t as number) < 0) return null
  return { fanId: p.f, creatorId: p.c, issuedAt: p.t as number }
}

interface LatestRow {
  status: 'subscribed' | 'unsubscribed'
}

async function latest(env: Env, fanId: string, creatorId: string): Promise<LatestRow | null> {
  return env.DB.prepare(
    `SELECT status FROM marketing_consent WHERE fan_id = ? AND creator_id = ? ORDER BY seq DESC LIMIT 1`,
  )
    .bind(fanId, creatorId)
    .first<LatestRow>()
}

async function creatorName(env: Env, creatorId: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT display_name FROM creator WHERE id = ?').bind(creatorId).first<{ display_name: string }>()
  return row?.display_name ?? null
}

/**
 * The link withdraws whatever is current for that fan and creator, including a
 * later resubscription: pressing Unsubscribe in any of their news emails means
 * "stop". It never writes on GET.
 */
async function resolve(env: Env, token: string): Promise<{ state: LinkState; payload?: TokenPayload; creator?: string }> {
  const payload = await verifyUnsubscribeToken(env, token)
  if (!payload) return { state: 'invalid' }
  const creator = await creatorName(env, payload.creatorId)
  if (!creator) return { state: 'invalid' }
  const row = await latest(env, payload.fanId, payload.creatorId)
  // No history means nothing was ever sent under this pair; treat as not subscribed.
  if (!row || row.status === 'unsubscribed') return { state: 'already_unsubscribed', payload, creator }
  return { state: 'confirm', payload, creator }
}

/** GET: read-only state for the confirm page. Writes nothing, ever. */
export async function getUnsubscribe(env: Env, token: string): Promise<Response> {
  const { state, creator } = await resolve(env, token)
  if (state === 'invalid') return json(200, { state })
  return json(200, { state, creatorName: creator })
}

/** POST: appends the withdrawal. Success is reported only after the row exists. */
export async function postUnsubscribe(request: Request, env: Env, deps: Deps, token: string): Promise<Response> {
  assertSameOrigin(request, env.APP_ORIGIN)
  const { state, payload, creator } = await resolve(env, token)
  if (state === 'invalid') return json(200, { state })
  if (state === 'already_unsubscribed' || !payload) return json(200, { state: 'already_unsubscribed', creatorName: creator })

  // Single statement, so two presses can't both append: the row is written only
  // if the latest row is still a subscription, copying its email and wording.
  let changes: number
  try {
    const result = await env.DB.prepare(
      `INSERT INTO marketing_consent (id, fan_id, creator_id, email, status, wording_version, source, ip, user_agent, created_at)
       SELECT ?, fan_id, creator_id, email, 'unsubscribed', wording_version, 'unsubscribe_page', ?, ?, ?
         FROM marketing_consent
        WHERE seq = (SELECT MAX(seq) FROM marketing_consent WHERE fan_id = ? AND creator_id = ?)
          AND status = 'subscribed'`,
    )
      .bind(crypto.randomUUID(), clientIp(request), userAgent(request), deps.now().toISOString(), payload.fanId, payload.creatorId)
      .run()
    changes = result.meta.changes
  } catch {
    // Design 23 U5: still subscribed, try again.
    throw new ApiError(503, 'unsubscribe_failed')
  }
  if (changes !== 1) return json(200, { state: 'already_unsubscribed', creatorName: creator })
  return json(200, { state: 'done', creatorName: creator })
}
