import { requireCreator, requireFan } from './auth'
import { httpClerk } from './clerk'
import { getConsent, postConsent, postOnboarding } from './consent'
import { getDraft, putDraft } from './drafts'
import { ApiError, assertSameOrigin, errorResponse, json, MUTATING } from './http'
import type { Deps, Env } from './types'
import { getUnsubscribe, postUnsubscribe } from './unsubscribe'
import { assertId } from './validation'

const BROWSE_COOKIE = 'fds_browse'
const BROWSE_TTL_SECONDS = 60 * 60 * 24 * 30

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Opaque cookie for signed-out browsing. It identifies nothing and no route
 * accepts it as authentication; only its hash is stored.
 */
async function createBrowseSession(env: Env, deps: Deps): Promise<Response> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  const now = deps.now()
  await env.DB.prepare('INSERT INTO fan_session (id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), await sha256Hex(token), now.toISOString(), new Date(now.getTime() + BROWSE_TTL_SECONDS * 1000).toISOString())
    .run()
  return json(201, { ok: true }, {
    'Set-Cookie': `${BROWSE_COOKIE}=${token}; Path=/; Max-Age=${BROWSE_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  })
}

type Handler = (request: Request, env: Env, deps: Deps, params: string[]) => Promise<Response>

const routes: { method: string; pattern: RegExp; handler: Handler }[] = [
  { method: 'GET', pattern: /^\/api\/health$/, handler: async () => json(200, { ok: true }) },
  { method: 'POST', pattern: /^\/api\/browse-session$/, handler: (_r, env, deps) => createBrowseSession(env, deps) },
  {
    method: 'GET',
    pattern: /^\/api\/session$/,
    handler: async (request, env, deps) => {
      const fan = await requireFan(request, env, deps)
      return json(200, { signedIn: true, fanId: fan.fanId })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/creator\/me$/,
    handler: async (request, env, deps) => {
      const creator = await requireCreator(request, env, deps)
      return json(200, { creatorId: creator.creatorId, displayName: creator.displayName })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/creators\/([^/]+)\/drafts\/([^/]+)$/,
    handler: async (request, env, deps, [creatorId, draftId]) => {
      assertId(creatorId)
      return getDraft(env, await requireFan(request, env, deps), creatorId, draftId)
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/creators\/([^/]+)\/drafts\/([^/]+)$/,
    handler: async (request, env, deps, [creatorId, draftId]) => {
      assertId(creatorId)
      return putDraft(request, env, deps, await requireFan(request, env, deps), creatorId, draftId)
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/creators\/([^/]+)\/consent$/,
    handler: async (request, env, deps, [creatorId]) => {
      assertId(creatorId)
      return getConsent(env, deps, await requireFan(request, env, deps), creatorId)
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/creators\/([^/]+)\/consent$/,
    handler: async (request, env, deps, [creatorId]) => {
      assertId(creatorId)
      return postConsent(request, env, deps, await requireFan(request, env, deps), creatorId)
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/creators\/([^/]+)\/consent-onboarding$/,
    handler: async (request, env, deps, [creatorId]) => {
      assertId(creatorId)
      return postOnboarding(request, env, deps, await requireFan(request, env, deps), creatorId)
    },
  },
  { method: 'GET', pattern: /^\/api\/unsubscribe\/([^/]+)$/, handler: async (_r, env, _d, [token]) => getUnsubscribe(env, token) },
  { method: 'POST', pattern: /^\/api\/unsubscribe\/([^/]+)$/, handler: (request, env, deps, [token]) => postUnsubscribe(request, env, deps, token) },
]

export async function handleApi(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url)
  try {
    const matching = routes.filter((r) => r.pattern.test(url.pathname))
    if (matching.length === 0) throw new ApiError(404, 'not_found')
    const route = matching.find((r) => r.method === request.method)
    if (!route) throw new ApiError(405, 'method_not_allowed')
    if (MUTATING.has(request.method)) assertSameOrigin(request, env.APP_ORIGIN)
    const params = route.pattern.exec(url.pathname)!.slice(1).map((p) => {
      try {
        return decodeURIComponent(p)
      } catch {
        throw new ApiError(404, 'not_found')
      }
    })
    return await route.handler(request, env, deps, params)
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err)
    // Never leak internals; details stay out of logs too (observability is off).
    return errorResponse(new ApiError(500, 'internal_error'))
  }
}

export function createHandler(makeDeps: (env: Env) => Deps): ExportedHandler<Env> {
  return {
    async fetch(request, env) {
      const url = new URL(request.url)
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        return handleApi(request, env, makeDeps(env))
      }
      return env.ASSETS.fetch(request)
    },
  }
}

export default createHandler((env) => ({ clerk: httpClerk(env.CLERK_SECRET_KEY), now: () => new Date() }))
