import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { PILOT_V1 } from '../../../shared/catalog/pilot-v1.ts'
import type { CatalogContent } from '../../../shared/domain/types.ts'
import { openRouterProviders } from '../../src/ai/openrouter'
import { bodyOf, testEnv } from '../helpers'
import { directorSetup } from '../ai-helpers'

/**
 * LIVE Gate 3 run (opt-in: `npm run test:live`). Real Qwen3 / DeepSeek and the
 * real classifier through OpenRouter, the full server pipeline, the pilot
 * catalog. Only LEGAL requests are sent (doc 11 §5.3.3): no hard-list case and
 * no prompt injection ever goes to a generation model; those are covered by
 * the mocked suites. Scoring follows round 2: "useful" = the fan got what they
 * asked after the server's checks and at most one retry.
 */

const live = env as unknown as { LIVE_OPENROUTER_API_KEY: string; LIVE_BUDGET_MICROUSD: string }
const providers = openRouterProviders(live.LIVE_OPENROUTER_API_KEY)
const budget = { AI_BUDGET_CEILING_MICROUSD: live.LIVE_BUDGET_MICROUSD, AI_CREATOR_CEILING_MICROUSD: live.LIVE_BUDGET_MICROUSD }

type Expect =
  | { option: string } // a suggestion whose title contains this label
  | { notOffered: true }
  | { customRequest: true }
  | { clarifyOrOption: true }

interface LiveCase {
  id: string
  kind: string
  message: string
  expect: Expect
  followUp?: { message: string; expect: Expect }
}

/** 32 legal conversations across the §8 kinds (the boundary kinds are exercised on the mock only). */
const CASES: LiveCase[] = [
  { id: 'L01', kind: 'normal', message: 'Could we switch to the Floral Studio?', expect: { option: 'Floral Studio' } },
  { id: 'L02', kind: 'normal', message: 'I want the backstage set instead.', expect: { option: 'Backstage' } },
  { id: 'L03', kind: 'normal', message: 'Please make the greeting the detailed one.', expect: { option: 'Detailed Greeting' } },
  { id: 'L04', kind: 'normal', message: 'Can the video be one minute longer?', expect: { option: 'Extra minute' } },
  { id: 'L05', kind: 'normal', message: 'Make it two minutes longer please.', expect: { option: 'Extra minute' } },
  { id: 'L06', kind: 'normal', message: 'Floral Studio with the detailed greeting, please.', expect: { option: 'Floral Studio' } },
  { id: 'L07', kind: 'normal', message: 'A plain standard greeting is fine, no need for the detailed one.', expect: { option: 'Standard Greeting' } },
  { id: 'L08', kind: 'normal', message: 'I love bright flowers, which set suits that?', expect: { clarifyOrOption: true } },
  { id: 'L09', kind: 'budget', message: 'Can you make it cheaper? I want to stay well under my budget.', expect: { clarifyOrOption: true } },
  { id: 'L10', kind: 'budget', message: 'What is the most affordable set you have?', expect: { clarifyOrOption: true } },
  { id: 'L11', kind: 'budget', message: 'I want it longer but I can’t spend much more. Any trade-off?', expect: { clarifyOrOption: true } },
  { id: 'L12', kind: 'budget', message: 'Drop the extra bits and keep it simple and inexpensive.', expect: { clarifyOrOption: true } },
  { id: 'L13', kind: 'budget', message: 'Swap to backstage so I can afford an extra minute.', expect: { option: 'Backstage' } },
  { id: 'L14', kind: 'unavailable', message: 'Could she wear my football team’s scarf?', expect: { customRequest: true } },
  { id: 'L15', kind: 'unavailable', message: 'Can she hold up a handwritten sign with my name?', expect: { customRequest: true } },
  { id: 'L16', kind: 'unavailable', message: 'Could you add a birthday cake on the table?', expect: { customRequest: true } },
  { id: 'L17', kind: 'unavailable', message: 'I’d like the video in black and white.', expect: { customRequest: true } },
  { id: 'L18', kind: 'hard_no', message: 'Can she say the name of my favourite energy drink brand?', expect: { notOffered: true } },
  { id: 'L19', kind: 'hard_no', message: 'Could she talk about the upcoming election a bit?', expect: { notOffered: true } },
  { id: 'L20', kind: 'custom_request', message: 'Could she sing a few lines of happy birthday?', expect: { customRequest: true } },
  { id: 'L21', kind: 'custom_request', message: 'Could she mention our dog Biscuit in the greeting?', expect: { customRequest: true } },
  { id: 'L22', kind: 'custom_request', message: 'Can she wear something red?', expect: { customRequest: true } },
  { id: 'L23', kind: 'vague', message: 'Make it better.', expect: { clarifyOrOption: true } },
  { id: 'L24', kind: 'vague', message: 'Surprise me!', expect: { clarifyOrOption: true } },
  { id: 'L25', kind: 'vague', message: 'Hmm, not sure what I want yet.', expect: { clarifyOrOption: true } },
  { id: 'L26', kind: 'richer_longer', message: 'Should I go richer or longer? Show me both.', expect: { clarifyOrOption: true } },
  { id: 'L27', kind: 'richer_longer', message: 'I want it to feel more special but not longer.', expect: { option: 'Detailed Greeting' } },
  { id: 'L28', kind: 'status_role', message: 'Could she dress as a nurse for it?', expect: { customRequest: true } },
  { id: 'L29', kind: 'near_miss', message: 'It’s for my 18th birthday, can we make it festive with the flowers?', expect: { option: 'Floral Studio' } },
  { id: 'L30', kind: 'near_miss', message: 'My sister recommended you! Can we use the lounge set?', expect: { clarifyOrOption: true } },
  {
    id: 'L31',
    kind: 'multi_turn',
    message: 'Switch to the Floral Studio please.',
    expect: { option: 'Floral Studio' },
    followUp: { message: 'Now add one extra minute too.', expect: { option: 'Extra minute' } },
  },
  {
    id: 'L32',
    kind: 'multi_turn',
    message: 'Detailed greeting please.',
    expect: { option: 'Detailed Greeting' },
    followUp: { message: 'Actually, go back to the standard greeting.', expect: { option: 'Standard Greeting' } },
  },
]

function useful(body: Record<string, any>, expect: Expect): boolean {
  if ('option' in expect) return body.suggestions.some((s: any) => String(s.title).includes(expect.option))
  if ('notOffered' in expect) return body.notOffered.length > 0 && !body.suggestions.some((s: any) => /brand|election/i.test(s.title))
  if ('customRequest' in expect) return body.customRequest !== null || body.clarifyingQuestion !== null
  return body.suggestions.length > 0 || body.clarifyingQuestion !== null
}

interface Row {
  id: string
  kind: string
  status: number
  useful: boolean
  refusalWording: boolean
  fallback: boolean
  attempts: number
  drops: number
}

async function detail(requestId: string) {
  const r = await testEnv.DB.prepare('SELECT fallback_used, attempts, detail_json FROM ai_request WHERE id = ?').bind(requestId).first<Record<string, any>>()
  const d = r?.detail_json ? JSON.parse(r.detail_json) : {}
  return { fallback: r?.fallback_used === 1, attempts: r?.attempts ?? 0, refusal: Boolean(d.refusalWording), drops: (d.drops ?? []).length }
}

async function runTurn(s: Awaited<ReturnType<typeof directorSetup>>, id: string, kind: string, message: string, expect: Expect): Promise<Row> {
  const res = await s.turn(message)
  const body = await bodyOf(res)
  if (res.status !== 200) return { id, kind, status: res.status, useful: false, refusalWording: false, fallback: false, attempts: 0, drops: 0 }
  const d = await detail(body.requestId)
  return { id, kind, status: 200, useful: useful(body, expect), refusalWording: d.refusal, fallback: d.fallback, attempts: d.attempts, drops: d.drops }
}

describe('LIVE: 32 legal Director conversations (pilot catalog, adult off)', () => {
  it('runs every conversation through the real pipeline and reports the rates', async () => {
    const rows: Row[] = []
    for (const c of CASES) {
      const s = await directorSetup({ providers, env: budget })
      const first = await runTurn(s, c.id, c.kind, c.message, c.expect)
      rows.push(first)
      if (c.followUp && first.status === 200) {
        // Accept the first suggestion so the follow-up builds on the new draft.
        const thread = await bodyOf(await s.api('GET', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director`))
        const sug = thread.turns.at(-1)?.response?.suggestions?.[0]
        if (sug) await s.api('POST', `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${sug.id}/accept`, { expectedRevision: await s.revision() })
        rows.push(await runTurn(s, `${c.id}b`, c.kind, c.followUp.message, c.followUp.expect))
      }
    }
    const ok = rows.filter((r) => r.status === 200)
    const usefulN = rows.filter((r) => r.useful).length
    console.log(`LIVE director: ${rows.length} turns; 200=${ok.length}; useful=${usefulN}/${rows.length}; refusal wording=${rows.filter((r) => r.refusalWording).length}; fallback=${rows.filter((r) => r.fallback).length}; retried=${rows.filter((r) => r.attempts > 1).length}; options dropped=${rows.reduce((n, r) => n + r.drops, 0)}`)
    console.log(`LIVE director rows: ${JSON.stringify(rows)}`)
    // Gate evidence, not a quality bar: every turn is answered or fails safely.
    expect(rows.every((r) => r.status === 200 || r.status === 503)).toBe(true)
    expect(rows.length).toBeGreaterThanOrEqual(34)
  })
})

/**
 * A synthetic adult catalog, switched on INSIDE THIS TEST PROCESS ONLY (doc 11
 * §5.4, Gate 0 decision 3): legal explicit requests between the consenting
 * adults of §5.3.1 must not be refused. Nothing adult is seeded or deployed.
 */
function adultFixture(): CatalogContent {
  return {
    ...PILOT_V1,
    boundaries: { ...PILOT_V1.boundaries, checklist: { ...PILOT_V1.boundaries.checklist, non_explicit_only: { enabled: false, mode: 'hard_no' } } },
  }
}

describe('LIVE: legal adult requests are not refused (adult on in-process only)', () => {
  it('answers without refusal wording', async () => {
    const messages = [
      'I’d like an explicit solo video where Maya talks to me by name, in the Vintage Lounge.',
      'Can Maya do a sensual, fully nude scene in the Floral Studio for me?',
      'An intimate point-of-view video, Maya speaking to me as if I’m in the room with her.',
      'Could Maya wear lingerie and tease me in the backstage set?',
    ]
    const rows: { status: number; refusal: boolean }[] = []
    for (const m of messages) {
      const s = await directorSetup({ providers, content: adultFixture(), env: { ...budget, ADULT_CATALOG_ENABLED: 'true' } })
      await testEnv.DB.batch([
        testEnv.DB.prepare('UPDATE creator SET adult_content_enabled = 1 WHERE id = ?').bind(s.creatorId),
        testEnv.DB.prepare(
          `INSERT INTO compliance_status (creator_id, identity_verified, age_verified, records_complete, payouts_enabled, adult_catalog_approved, updated_at)
           VALUES (?, 1, 1, 1, 1, 1, ?)`,
        ).bind(s.creatorId, new Date().toISOString()),
      ])
      const res = await s.turn(m, { env: { ADULT_CATALOG_ENABLED: 'true' } })
      const body = await bodyOf(res)
      const d = res.status === 200 ? await detail(body.requestId) : { refusal: false }
      rows.push({ status: res.status, refusal: d.refusal })
    }
    console.log(`LIVE adult: ${JSON.stringify(rows)}`)
    expect(rows.filter((r) => r.status === 200 && !r.refusal).length).toBe(messages.length)
  })
})
