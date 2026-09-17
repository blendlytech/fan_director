import { env } from 'cloudflare:workers'
import { exportSPKI, generateKeyPair, SignJWT, type CryptoKey as JoseKey } from 'jose'
import { handleApi } from '../src/index'
import type { ClerkBackend, ClerkSession, ClerkUser, Deps, Env } from '../src/types'

export const ORIGIN = 'https://app.test'
export const ISSUER = 'https://clerk.test'
export const WORDING = 'test-v1'

// Real RS256 key pairs: the instance key the Worker trusts, and a stranger's.
export const instanceKeys = await generateKeyPair('RS256', { extractable: true })
export const strangerKeys = await generateKeyPair('RS256', { extractable: true })

export const testEnv: Env = { ...(env as unknown as Env), CLERK_JWT_KEY: await exportSPKI(instanceKeys.publicKey as JoseKey) }

/** In-memory stand-in for Clerk's Backend API: the only thing mocked. */
export class FakeClerk implements ClerkBackend {
  users = new Map<string, ClerkUser>()
  sessions = new Map<string, ClerkSession>()
  failing = false

  async getUser(id: string) {
    if (this.failing) throw new Error('clerk down')
    return this.users.get(id) ?? null
  }
  async getSession(id: string) {
    if (this.failing) throw new Error('clerk down')
    return this.sessions.get(id) ?? null
  }
  async listLiveSessions(userId: string) {
    if (this.failing) throw new Error('clerk down')
    return [...this.sessions.values()].filter((s) => s.userId === userId && (s.status === 'active' || s.status === 'pending'))
  }
}

export const clerk = new FakeClerk()
export const deps: Deps = { clerk, now: () => new Date() }

let counter = 0
export function uid(prefix: string): string {
  counter += 1
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}${counter}`
}

export interface TokenOptions {
  claims?: Record<string, unknown>
  omit?: string[]
  key?: JoseKey
  alg?: string
  expiresIn?: number
  notBefore?: number
}

export async function sessionToken(userId: string, sessionId: string, opts: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: Record<string, unknown> = {
    azp: ORIGIN,
    fva: [0, -1],
    sid: sessionId,
    sub: userId,
    v: 2,
    iss: ISSUER,
    iat: now,
    nbf: opts.notBefore ?? now - 5,
    exp: now + (opts.expiresIn ?? 60),
    ...opts.claims,
  }
  for (const key of opts.omit ?? []) delete payload[key]
  return new SignJWT(payload)
    .setProtectedHeader({ alg: opts.alg ?? 'RS256' })
    .sign(opts.key ?? (instanceKeys.privateKey as JoseKey))
}

export interface TestUser {
  userId: string
  sessionId: string
  token: (opts?: TokenOptions) => Promise<string>
}

/**
 * A Clerk user with one live session. By default the session was created two
 * seconds after the account (a first sign-up); pass `sessionAfterAccountMs` to
 * model an ordinary later sign-in.
 */
export function clerkUser(opts: {
  sessionAfterAccountMs?: number
  emailVerified?: boolean
  totp?: boolean
  email?: string
} = {}): TestUser {
  const userId = uid('user')
  const sessionId = uid('sess')
  const accountCreated = Date.now() - 10 * 60_000
  const emailId = uid('idn')
  clerk.users.set(userId, {
    id: userId,
    primaryEmailAddressId: emailId,
    emailAddresses: [{ id: emailId, emailAddress: opts.email ?? `${userId}@example.test`, verified: opts.emailVerified ?? true }],
    totpEnabled: opts.totp ?? false,
    backupCodeEnabled: opts.totp ?? false,
    banned: false,
    locked: false,
    createdAt: accountCreated,
  })
  clerk.sessions.set(sessionId, {
    id: sessionId,
    userId,
    status: 'active',
    createdAt: accountCreated + (opts.sessionAfterAccountMs ?? 2_000),
  })
  return { userId, sessionId, token: (t) => sessionToken(userId, sessionId, t) }
}

export interface CallOptions {
  token?: string
  body?: unknown
  rawBody?: string
  origin?: string | null
  headers?: Record<string, string>
}

export async function call(method: string, path: string, opts: CallOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { 'User-Agent': 'vitest', 'CF-Connecting-IP': '203.0.113.7', ...opts.headers }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  const origin = opts.origin === undefined ? ORIGIN : opts.origin
  if (origin !== null) headers.Origin = origin
  let body: string | undefined
  if (opts.rawBody !== undefined) body = opts.rawBody
  else if (opts.body !== undefined) body = JSON.stringify(opts.body)
  if (body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  return handleApi(new Request(`${ORIGIN}${path}`, { method, headers, body }), testEnv, deps)
}

export async function bodyOf(res: Response): Promise<Record<string, any>> {
  return (await res.json()) as Record<string, any>
}

const now = () => new Date().toISOString()

export interface Boutique {
  creatorId: string
  catalogVersionId: string
  owner: TestUser
}

/** An active, invited creator whose Clerk user has TOTP, with a published catalog. */
export async function boutique(name = 'Maya'): Promise<Boutique> {
  const creatorId = uid('cr')
  const catalogId = uid('cat')
  const catalogVersionId = uid('cv')
  const owner = clerkUser({ totp: true })
  const content = {
    categories: [
      {
        key: 'setting', contentRating: 'general', hidden: false,
        items: [
          { id: 'item_visible', contentRating: 'general', hidden: false, pricing: { kind: 'fixed', amount: 5000 } },
          { id: 'item_hidden', contentRating: 'general', hidden: true, pricing: { kind: 'fixed', amount: 1000 } },
          { id: 'item_minutes', contentRating: 'general', hidden: false, pricing: { kind: 'per_unit', unitLabel: 'minute', amountPerUnit: 1500, minQty: 1, maxQty: 5 } },
        ],
      },
      {
        key: 'hidden_category', contentRating: 'general', hidden: true,
        items: [{ id: 'item_in_hidden_category', contentRating: 'general', hidden: false, pricing: { kind: 'included' } }],
      },
      {
        key: 'specialty_acts', contentRating: 'adult', hidden: false,
        items: [{ id: 'item_adult', contentRating: 'adult', hidden: false, pricing: { kind: 'fixed', amount: 9000 } }],
      },
    ],
  }
  await testEnv.DB.batch([
    testEnv.DB.prepare(`INSERT INTO creator (id, clerk_user_id, display_name, status, invited_at, created_at) VALUES (?, ?, ?, 'active', ?, ?)`)
      .bind(creatorId, owner.userId, name, now(), now()),
    testEnv.DB.prepare('INSERT INTO catalog (id, creator_id) VALUES (?, ?)').bind(catalogId, creatorId),
    testEnv.DB.prepare(`INSERT INTO catalog_version (id, catalog_id, version, status, content_json, created_at, published_at) VALUES (?, ?, 1, 'published', ?, ?, ?)`)
      .bind(catalogVersionId, catalogId, JSON.stringify(content), now(), now()),
    testEnv.DB.prepare('UPDATE catalog SET current_published_version_id = ? WHERE id = ?').bind(catalogVersionId, catalogId),
    testEnv.DB.prepare(`INSERT INTO consent_wording (version, label, helper, created_at) VALUES (?, 'Test label (fixture)', 'Test helper (fixture)', ?) ON CONFLICT DO NOTHING`)
      .bind(WORDING, now()),
  ])
  return { creatorId, catalogVersionId, owner }
}

export function draftBody(catalogVersionId: string, expectedRevision: number, draft: Record<string, unknown> = {}) {
  return {
    expectedRevision,
    catalogVersionId,
    draft: {
      selections: [{ itemId: 'item_visible', qty: 1 }],
      fanDisplayName: null,
      customRequest: null,
      fanScript: null,
      notes: [],
      budget: null,
      ...draft,
    },
  }
}

export async function consentRows(fanClerkId: string, creatorId: string) {
  const { results } = await testEnv.DB.prepare(
    `SELECT mc.* FROM marketing_consent mc JOIN fan f ON f.id = mc.fan_id
      WHERE f.clerk_user_id = ? AND mc.creator_id = ? ORDER BY mc.seq`,
  )
    .bind(fanClerkId, creatorId)
    .all<Record<string, any>>()
  return results
}

export async function fanIdFor(user: TestUser): Promise<string> {
  const res = await call('GET', '/api/session', { token: await user.token() })
  return (await bodyOf(res)).fanId as string
}
