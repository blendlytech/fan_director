import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { PILOT_V1 } from '../../../shared/catalog/pilot-v1.ts'
import { effectiveLimits, renderBoundaries } from '../../../shared/domain/boundaries.ts'
import { DEFAULT_CREATOR_PROFILE } from '../../../shared/domain/creatorProfile.ts'
import type { CatalogContent } from '../../../shared/domain/types.ts'
import { CLASSIFIER_VERSION, classifierRequest, readVerdict } from '../../src/ai/classifier'
import { DIRECTOR_MODELS } from '../../src/ai/models'
import { openRouterProviders } from '../../src/ai/openrouter'
import { DIRECTOR_PROMPT_VERSION, RETRY_PROMPT_VERSION } from '../../src/ai/prompts/director-v1'
import { checkTexts, RULESET_VERSION } from '../../src/rules/check'
import { bodyOf, testEnv } from '../helpers'
import { directorSetup } from '../ai-helpers'
import {
  contractProblems, SCRIPT_MAX_TOKENS, SCRIPT_PROMPT_VERSION, SCRIPT_SCHEMA, SCRIPT_SCHEMA_NAME, SCRIPT_TEMPERATURE,
  SCRIPT_TIMEOUT_MS, scriptSystemPrompt, scriptTexts, type ShootingScript,
} from './script-preview-v0'

/**
 * LIVE recording of the two demo conversations (opt-in, owner-approved
 * 2026-10-01). Real Qwen3 and the real classifier through OpenRouter, the
 * real Director pipeline, Maya's pilot catalog with adult content switched on
 * INSIDE THIS TEST PROCESS ONLY (doc 11 §5.4; the same switch as
 * director.live.test.ts). Nothing adult is seeded or deployed.
 *
 * The conversation is driven step by step through demo-relay.mjs, so each
 * fan message is written after reading the Director's real reply. Every raw
 * OpenRouter exchange is recorded (without the Authorization header) next to
 * what the fan saw, in the git-ignored worker/.live-recordings/.
 *
 *   node test/live/demo-relay.mjs <run-id>        (in one terminal)
 *   npx vitest run --config vitest.live.config.ts test/live/demo-recording
 *
 * Without the relay running, every test here is skipped.
 */

const RELAY = 'http://127.0.0.1:8789'
const live = env as unknown as { LIVE_OPENROUTER_API_KEY: string; LIVE_BUDGET_MICROUSD: string }
const budget = { AI_BUDGET_CEILING_MICROUSD: live.LIVE_BUDGET_MICROUSD, AI_CREATOR_CEILING_MICROUSD: live.LIVE_BUDGET_MICROUSD }
const ADULT_ON = { ...budget, ADULT_CATALOG_ENABLED: 'true' }

interface Exchange {
  url: string
  startedAt: string
  finishedAt: string
  status: number | null
  /** The JSON body sent to OpenRouter (no headers, so no key). */
  request: unknown
  /** OpenRouter's body exactly as received. */
  responseText: string | null
  error: string | null
}

/** fetch, recording each exchange. The provider sees the same status and body. */
function recordingFetch(sink: Exchange[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const entry: Exchange = {
      url: String(input), startedAt: new Date().toISOString(), finishedAt: '', status: null,
      request: typeof init?.body === 'string' ? JSON.parse(init.body) : null, responseText: null, error: null,
    }
    sink.push(entry)
    try {
      const res = await fetch(input, init)
      entry.status = res.status
      const text = await res.text()
      entry.responseText = text
      entry.finishedAt = new Date().toISOString()
      return new Response(text, { status: res.status, headers: res.headers })
    } catch (err) {
      entry.error = err instanceof Error ? err.name : 'unknown'
      entry.finishedAt = new Date().toISOString()
      throw err
    }
  }) as typeof fetch
}

type Step =
  | { type: 'setup'; lookbook: Record<string, string[]>; draft?: Record<string, unknown> }
  | { type: 'message'; text: string }
  | { type: 'accept' | 'decline'; suggestion: number }
  | { type: 'edit'; draft: Record<string, unknown> }
  | { type: 'script'; style: Record<string, string>; assumptions: string[]; customRequest: string | null }
  | { type: 'done' }

async function relayUp(): Promise<boolean> {
  try {
    return (await fetch(`${RELAY}/ping`, { signal: AbortSignal.timeout(3_000) })).status === 204
  } catch {
    return false
  }
}

async function next(kase: string, step: number): Promise<Step> {
  for (;;) {
    const res = await fetch(`${RELAY}/next?case=${kase}&step=${step}`)
    if (res.status === 200) return (await res.json()) as Step
  }
}

async function record(kase: string, step: number, data: unknown): Promise<void> {
  await fetch(`${RELAY}/record?case=${kase}&step=${step}`, { method: 'POST', body: JSON.stringify(data) })
}

function adultFixture(): CatalogContent {
  return {
    ...PILOT_V1,
    boundaries: { ...PILOT_V1.boundaries, checklist: { ...PILOT_V1.boundaries.checklist, non_explicit_only: { enabled: false, mode: 'hard_no' } } },
  }
}

const allItems = PILOT_V1.categories.flatMap((c) => c.items)
const labelOf = (id: string) => allItems.find((i) => i.id === id)?.label ?? id

const up = await relayUp()

describe.skipIf(!up)('LIVE: record the demo conversations (adult on in-process only)', () => {
  it('records each case the relay hands out', async () => {
    const cases = ((await next('_run', 0)) as unknown as { cases: string[] }).cases
    for (const kase of cases) {
      const exchanges: Exchange[] = []
      const providers = openRouterProviders(live.LIVE_OPENROUTER_API_KEY, recordingFetch(exchanges))
      const setup = (await next(kase, 0)) as Extract<Step, { type: 'setup' }>
      const content = adultFixture()
      const s = await directorSetup({ providers, content, env: ADULT_ON, draft: setup.draft })
      await testEnv.DB.batch([
        testEnv.DB.prepare('UPDATE creator SET adult_content_enabled = 1 WHERE id = ?').bind(s.creatorId),
        testEnv.DB.prepare(
          `INSERT INTO compliance_status (creator_id, identity_verified, age_verified, records_complete, payouts_enabled, adult_catalog_approved, updated_at)
           VALUES (?, 1, 1, 1, 1, 1, ?)`,
        ).bind(s.creatorId, new Date().toISOString()),
      ])
      const draftNow = async () => bodyOf(await s.api('GET', `/api/creators/${s.creatorId}/drafts/${s.draftId}`))
      await record(kase, 0, {
        case: kase, step: 0, action: setup, at: new Date().toISOString(),
        versions: { prompt: `${DIRECTOR_PROMPT_VERSION}+${RETRY_PROMPT_VERSION}`, classifier: CLASSIFIER_VERSION, ruleset: RULESET_VERSION, primaryModel: DIRECTOR_MODELS[0] },
        adult: 'on in-process only (adultFixture + ADULT_CATALOG_ENABLED + compliance row)',
        lookbook: setup.lookbook, draftAfter: await draftNow(),
      })

      let last: Record<string, any> | null = null
      for (let step = 1; ; step += 1) {
        const action = await next(kase, step)
        exchanges.length = 0
        const out: Record<string, unknown> = { case: kase, step, action, at: new Date().toISOString() }
        if (action.type === 'done') {
          await record(kase, step, { ...out, draftAfter: await draftNow() })
          break
        }
        if (action.type === 'message') {
          const res = await s.turn(action.text)
          const body = await bodyOf(res)
          last = body
          out.httpStatus = res.status
          out.fanVisible = body
          if (res.status === 200) {
            out.aiRequest = await testEnv.DB.prepare(
              `SELECT id, status, outcome, model, attempts, fallback_used, prompt_version, classifier_version, ruleset_version, copy_version, detail_json, created_at, finished_at
                 FROM ai_request WHERE id = ?`,
            ).bind(body.requestId).first()
            out.aiCalls = (await testEnv.DB.prepare('SELECT * FROM ai_call WHERE ai_request_id = ? ORDER BY created_at').bind(body.requestId).all()).results
          }
        } else if (action.type === 'accept' || action.type === 'decline') {
          const sug = last?.suggestions?.[action.suggestion]
          if (!sug) throw new Error(`${kase} step ${step}: no suggestion ${action.suggestion} in the last reply`)
          const path = `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${sug.id}/${action.type}`
          const res = await s.api('POST', path, action.type === 'accept' ? { expectedRevision: await s.revision() } : undefined)
          out.httpStatus = res.status
          out.result = await bodyOf(res)
        } else if (action.type === 'edit') {
          // A manual change on the fan's own screen (no AI): the same PUT the app sends.
          const current = (await draftNow()).draft
          const { id: _i, creatorId: _c, catalogVersionId, revision, boundaryFlags: _b, ...draft } = current
          const res = await s.api('PUT', `/api/creators/${s.creatorId}/drafts/${s.draftId}`, {
            expectedRevision: revision, catalogVersionId, draft: { ...draft, ...action.draft },
          })
          out.httpStatus = res.status
          out.result = await bodyOf(res)
        } else if (action.type === 'script') {
          out.script = await runScript(kase, providers, action, await draftNow(), s.creatorId)
        }
        out.draftAfter = await draftNow()
        out.exchanges = exchanges.slice()
        await record(kase, step, out)
      }
    }
    expect(cases.length).toBeGreaterThan(0)
  }, 7_200_000)
})

/**
 * The isolated script call: a SYNTHETIC approved Scene Card built from the
 * fan's final draft and lookbook picks. No creator approved anything.
 */
async function runScript(
  kase: string,
  providers: ReturnType<typeof openRouterProviders>,
  action: Extract<Step, { type: 'script' }>,
  current: Record<string, any>,
  creatorId: string,
) {
  const setupRecord = (await (await fetch(`${RELAY}/next?case=${kase}&step=0`)).json()) as Extract<Step, { type: 'setup' }>
  const draft = current.draft
  const quote = current.quote
  const creator = 'Maya'
  const rendered = renderBoundaries(adultFixture().boundaries, creator, { adultAllowed: true })
  const lookbook = Object.fromEntries(
    DEFAULT_CREATOR_PROFILE.categories
      .filter((c) => c.contentRating !== 'adult' && !['toys', 'fetishes'].includes(c.id))
      .map((c) => {
        const picked = c.items.filter((i) => (setupRecord.lookbook[c.id] ?? []).includes(i.id)).map((i) => i.name)
        return [c.name, picked.length ? picked : `${creator}'s choice`]
      }),
  )
  const card = {
    label: 'SYNTHETIC approved Scene Card for a demo recording. No creator reviewed or approved it.',
    runtimeMinutes: quote?.minutes ?? null,
    items: (draft.selections as { itemId: string; qty: number }[]).map((x) => (x.qty > 1 ? `${labelOf(x.itemId)} ×${x.qty}` : labelOf(x.itemId))),
    lookbook,
    fanDisplayName: draft.fanDisplayName,
    customRequest: action.customRequest,
    fanScript: draft.fanScript ?? null,
    notes: draft.notes ?? [],
  }
  const data = {
    sceneCard: card,
    performers: [creator],
    styleSettings: action.style,
    creatorHardNo: rendered.hardNo.map((l) => l.text),
    creatorAskFirstAcceptedForThisRequest: [...rendered.askFirst.map((l) => l.text), ...DEFAULT_CREATOR_PROFILE.boundaries.askFirst],
    platformRules: rendered.platform.flatMap((p) => p.lines),
  }
  const started = new Date().toISOString()
  const result = await providers.director.complete({
    model: DIRECTOR_MODELS[0],
    messages: [
      { role: 'system', content: scriptSystemPrompt(creator) },
      { role: 'user', content: `DATA:\n${JSON.stringify(data)}` },
    ],
    schema: SCRIPT_SCHEMA as unknown as Record<string, unknown>,
    schemaName: SCRIPT_SCHEMA_NAME,
    maxTokens: SCRIPT_MAX_TOKENS,
    temperature: SCRIPT_TEMPERATURE,
    routing: 'router',
    timeoutMs: SCRIPT_TIMEOUT_MS,
  })
  const outcome: Record<string, unknown> = {
    promptVersion: SCRIPT_PROMPT_VERSION, model: DIRECTOR_MODELS[0], startedAt: started, assumptions: action.assumptions,
    syntheticApprovedSceneCard: data, providerResult: { ok: result.ok, usage: result.usage, latencyMs: result.latencyMs, ...(result.ok ? { upstream: result.upstream } : { kind: result.kind, status: result.status }) },
  }
  if (!result.ok) return outcome
  let script: ShootingScript
  try {
    script = JSON.parse(result.content) as ShootingScript
  } catch {
    return { ...outcome, parseError: true }
  }
  const texts = scriptTexts(script)
  const limits = effectiveLimits(adultFixture().boundaries, { adultAllowed: true })
  const rules = checkTexts(texts, { limits, verifiedPerformers: 0 })
  const classifier = await providers.classifier.complete(classifierRequest(texts.join('\n'), { creatorName: creator, performers: [], customLimits: [] }))
  const verdict = classifier.ok ? readVerdict(classifier.content, texts.join('\n'), new Set()) : null
  return {
    ...outcome,
    script,
    checks: {
      contract: contractProblems(script, (quote?.minutes ?? 0) * 60),
      rulesHardList: rules.hardList ? { key: rules.hardList.key } : null,
      rulesLimits: rules.limits.map((l) => ({ limitKey: l.limitKey, mode: l.mode })),
      classifier: classifier.ok ? { verdict, usage: classifier.usage, upstream: classifier.upstream } : { failed: classifier.kind },
    },
    creatorId,
  }
}
