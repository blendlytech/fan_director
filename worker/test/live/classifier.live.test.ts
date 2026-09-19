import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { HARD_LIST_KEYS } from '../../../shared/domain/hardList.ts'
import { classifierRequest, readVerdict } from '../../src/ai/classifier'
import { reserve, reconcile } from '../../src/ai/ledger'
import { reservationFor } from '../../src/ai/models'
import { openRouterProviders } from '../../src/ai/openrouter'
import { checkText } from '../../src/rules/check'
import { MUST_ALLOW, MUST_BLOCK } from '../fixtures/hardlist'
import { publishedBoutique, testEnv } from '../helpers'
import { PILOT_V1 } from '../../../shared/catalog/pilot-v1.ts'

/**
 * LIVE classifier layer on the §5.3.3 sets (opt-in: `npm run test:live`).
 * gpt-oss-safeguard-20b, pinned to Groq through OpenRouter. Only short,
 * non-graphic classification inputs are sent; `minors` cases never contain
 * sexual description (checked below before anything is sent). Both rates are
 * reported, for the classifier alone and for rules + classifier together.
 */

const live = env as unknown as { LIVE_OPENROUTER_API_KEY: string; LIVE_BUDGET_MICROUSD: string }
const provider = openRouterProviders(live.LIVE_OPENROUTER_API_KEY).classifier
const policy = { creatorName: 'Maya', performers: [], customLimits: [] }
const EXPLICIT = { limits: { checklist: { non_explicit_only: { enabled: true, mode: 'hard_no' as const } } } }
const MAX_CHARS = 160

describe('LIVE: classifier on the must-block and must-allow sets', () => {
  it('reports both rates', async () => {
    const { creatorId } = await publishedBoutique(PILOT_V1)
    const ceiling = Number(live.LIVE_BUDGET_MICROUSD)

    const blocks = MUST_BLOCK.map((c) => ({ key: c.key, text: c.text ?? (c.messages ?? []).join('\n') }))
    // What may be sent (§5.3.3): short, and minors cases without sexual wording.
    const excluded = blocks.filter((c) => c.text.length > MAX_CHARS || (c.key === 'minors' && checkText(c.text, EXPLICIT).limits.length > 0))
    expect(excluded.filter((c) => c.key === 'minors')).toEqual([])
    const sendBlocks = blocks.filter((c) => !excluded.includes(c))
    const sendAllows = MUST_ALLOW.filter((t) => t.length <= MAX_CHARS)

    async function classify(text: string) {
      const req = classifierRequest(text, policy)
      const r = await reserve(testEnv, {
        creatorId, requestId: null, purpose: 'classify_input', model: req.model, attempt: 1,
        amountMicroUsd: reservationFor(req.model, req.messages.reduce((n, m) => n + m.content.length, 0), req.maxTokens),
        ceilings: { global: ceiling, creator: ceiling }, now: new Date(),
      })
      if (!r) throw new Error('live budget exhausted')
      const res = await provider.complete(req)
      await reconcile(testEnv, r, { actualMicroUsd: res.usage?.costMicroUsd ?? r.amountMicroUsd, now: new Date() })
      return res.ok ? readVerdict(res.content, text, new Set()) : null
    }

    let blocked = 0, rightKey = 0, unreadableB = 0, allowed = 0, falseBlocks = 0, unreadableA = 0, combinedMiss = 0
    const perKey: Record<string, { n: number; blocked: number }> = Object.fromEntries(HARD_LIST_KEYS.map((k) => [k, { n: 0, blocked: 0 }]))
    const misses: string[] = []
    for (const c of sendBlocks) {
      const v = await classify(c.text)
      perKey[c.key].n += 1
      if (v === null) unreadableB += 1 // fails closed: counts as blocked in the product
      if (v === null || v.key !== null) { blocked += 1; perKey[c.key].blocked += 1 }
      else misses.push(c.key)
      if (v?.key === c.key) rightKey += 1
      if ((v === null || v.key === null) && checkText(c.text).hardList === null) combinedMiss += 1
    }
    const falseKeys: string[] = []
    for (const t of sendAllows) {
      const v = await classify(t)
      if (v === null) unreadableA += 1
      if (v !== null && v.key === null) allowed += 1
      else if (v !== null) { falseBlocks += 1; falseKeys.push(v.key!) }
    }
    console.log(
      `LIVE classifier: must-block ${blocked}/${sendBlocks.length} blocked (right key ${rightKey}, unreadable ${unreadableB}); ` +
        `must-allow ${allowed}/${sendAllows.length} allowed (false blocks ${falseBlocks}: ${JSON.stringify(falseKeys)}; unreadable ${unreadableA}); ` +
        `rules+classifier misses ${combinedMiss}; excluded from sending ${excluded.length}; per key ${JSON.stringify(perKey)}; missed keys ${JSON.stringify(misses)}`,
    )
    expect(sendBlocks.length).toBeGreaterThanOrEqual(100)
    expect(sendAllows.length).toBeGreaterThanOrEqual(100)
  })
})
