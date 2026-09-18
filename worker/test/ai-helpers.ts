import { defaultSelections } from '../../shared/domain/ranges.ts'
import type { CatalogContent, Selection } from '../../shared/domain/types.ts'
import { PILOT_V1 } from '../../shared/catalog/pilot-v1.ts'
import { handleApi } from '../src/index'
import { mockProviders, type MockProvider } from '../src/ai/mock'
import type { Deps, Env } from '../src/types'
import { bodyOf, clerk, clerkUser, ORIGIN, publishedBoutique, testEnv, type TestUser } from './helpers'

/**
 * Test harness for the AI Director. Every provider is the scripted mock: no
 * test here ever reaches a real model (doc 11 §5.3.3: injection and hard-list
 * cases are never sent to a provider).
 */

/** Test-process configuration only (doc 11 §5.4): never a deployed value. */
export const AI_ON: Partial<Env> = {
  AI_ENABLED: 'true',
  AI_BUDGET_CEILING_MICROUSD: '1000000000',
  AI_CREATOR_CEILING_MICROUSD: '1000000000',
}

/** Maya's starting draft: the catalog defaults with the Vintage Lounge ($125). */
export function startSelections(content: CatalogContent = PILOT_V1): Selection[] {
  const picks = new Map(defaultSelections(content, { adultAllowed: false }).map((s) => [s.itemId, s.qty]))
  for (const id of ['maya_setting_vintage', 'maya_setting_floral', 'maya_setting_backstage']) picks.delete(id)
  picks.set('maya_setting_vintage', 1)
  return [...picks].map(([itemId, qty]) => ({ itemId, qty }))
}

export interface DirectorSetup {
  creatorId: string
  catalogVersionId: string
  fan: TestUser
  token: string
  draftId: string
  director: MockProvider
  classifier: MockProvider
  deps: Deps
  env: Partial<Env>
  /** POST a turn. */
  turn: (message: string, opts?: { expectedRevision?: number; requestId?: string; env?: Partial<Env> }) => Promise<Response>
  /** Any API call with this fan's token and the mocked providers. */
  api: (method: string, path: string, body?: unknown, env?: Partial<Env>) => Promise<Response>
  revision: () => Promise<number>
  draft: () => Promise<Record<string, any>>
}

export async function directorSetup(opts: {
  content?: CatalogContent
  aiEnabledForCreator?: boolean
  draft?: Record<string, unknown>
  env?: Partial<Env>
  name?: string
} = {}): Promise<DirectorSetup> {
  const content = opts.content ?? PILOT_V1
  const b = await publishedBoutique(content, opts.name ?? 'Maya')
  if (opts.aiEnabledForCreator !== false) {
    await testEnv.DB.prepare('UPDATE creator SET ai_enabled = 1 WHERE id = ?').bind(b.creatorId).run()
  }
  const fan = clerkUser()
  const token = await fan.token({ expiresIn: 3600 })
  const { providers, director, classifier } = mockProviders()
  const deps: Deps = { clerk, now: () => new Date(), ai: providers }
  const env = { ...AI_ON, ...opts.env }

  const api = async (method: string, path: string, body?: unknown, extraEnv?: Partial<Env>) => {
    const headers: Record<string, string> = { 'User-Agent': 'vitest', 'CF-Connecting-IP': '203.0.113.7', Origin: ORIGIN, Authorization: `Bearer ${token}` }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    return handleApi(
      new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
      { ...testEnv, ...env, ...extraEnv },
      deps,
    )
  }

  const draftId = crypto.randomUUID()
  const created = await api('PUT', `/api/creators/${b.creatorId}/drafts/${draftId}`, {
    expectedRevision: 0,
    catalogVersionId: b.catalogVersionId,
    draft: { selections: startSelections(content), fanDisplayName: null, customRequest: null, fanScript: null, notes: [], budget: 15_000, ...opts.draft },
  })
  if (created.status !== 200) throw new Error(`draft setup failed: ${created.status} ${JSON.stringify(await bodyOf(created))}`)

  const draft = async () => (await bodyOf(await api('GET', `/api/creators/${b.creatorId}/drafts/${draftId}`))).draft
  const revision = async () => (await draft()).revision as number
  const turn: DirectorSetup['turn'] = async (message, t = {}) =>
    api(
      'POST',
      `/api/creators/${b.creatorId}/drafts/${draftId}/director`,
      { requestId: t.requestId ?? crypto.randomUUID(), expectedRevision: t.expectedRevision ?? (await revision()), message },
      t.env,
    )
  return { ...b, fan, token, draftId, director, classifier, deps, env, turn, api, revision, draft }
}

/** A valid Director reply, with any fields overridden. */
export function reply(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { options: [], notOffered: [], customRequest: null, clarifyingQuestion: null, note: null, ...over }
}

export function option(label: string, wants: [string, number][], removes: string[] = []) {
  return { label, wants: wants.map(([itemId, qty]) => ({ itemId, qty })), removes }
}

/** The classifier's verdict, as the mock returns it. */
export function verdict(key: string | null, extra: { childlike?: boolean; limitIds?: string[] } = {}) {
  return { reply: { violation: key !== null, key, childlike: extra.childlike ?? false, limitIds: extra.limitIds ?? [] } }
}

/** Every string anywhere in a JSON value, for "no hostile text reached the fan" checks. */
export function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(allStrings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings)
  return []
}
