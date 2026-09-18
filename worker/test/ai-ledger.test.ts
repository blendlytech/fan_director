import { describe, expect, it } from 'vitest'
import { budgetRow, creatorScope, hold, reconcile, reserve, type ReserveInput } from '../src/ai/ledger'
import { PILOT_V1 } from '../../shared/catalog/pilot-v1.ts'
import { publishedBoutique, testEnv } from './helpers'

const BIG = 1_000_000_000_000

function input(creatorId: string, amount: number, creatorCeiling: number): ReserveInput {
  return {
    creatorId,
    requestId: null,
    purpose: 'director',
    model: 'test/model',
    attempt: 1,
    amountMicroUsd: amount,
    ceilings: { global: BIG, creator: creatorCeiling },
    now: new Date(),
  }
}

async function callRow(id: string) {
  return testEnv.DB.prepare('SELECT * FROM ai_call WHERE id = ?').bind(id).first<Record<string, any>>()
}

describe('AI cost ledger', () => {
  it('reserves, then books the actual cost and releases the rest', async () => {
    const { creatorId } = await publishedBoutique(PILOT_V1)
    const r = await reserve(testEnv, input(creatorId, 1_000, 10_000))
    expect(r).not.toBeNull()
    expect(await budgetRow(testEnv, creatorScope(creatorId))).toEqual({ reserved: 1_000, spent: 0 })
    expect((await callRow(r!.callId))?.cost_state).toBe('reserved')

    await reconcile(testEnv, r!, { actualMicroUsd: 240, inputTokens: 900, outputTokens: 80, upstream: 'Host', latencyMs: 1200, now: new Date() })
    expect(await budgetRow(testEnv, creatorScope(creatorId))).toEqual({ reserved: 0, spent: 240 })
    const row = await callRow(r!.callId)
    expect(row).toMatchObject({ cost_state: 'reconciled', actual_microusd: 240, input_tokens: 900, output_tokens: 80, upstream: 'Host' })
  })

  it('refuses a reservation the budget cannot cover, and writes nothing', async () => {
    const { creatorId } = await publishedBoutique(PILOT_V1)
    expect(await reserve(testEnv, input(creatorId, 6_000, 10_000))).not.toBeNull()
    expect(await reserve(testEnv, input(creatorId, 5_000, 10_000))).toBeNull()
    expect(await budgetRow(testEnv, creatorScope(creatorId))).toEqual({ reserved: 6_000, spent: 0 })
    const { results } = await testEnv.DB.prepare('SELECT id FROM ai_call WHERE creator_id = ?').bind(creatorId).all()
    expect(results).toHaveLength(1)
  })

  it('refuses when the environment ceiling is the one that is short', async () => {
    const { creatorId } = await publishedBoutique(PILOT_V1)
    expect(await reserve(testEnv, { ...input(creatorId, 10, BIG), ceilings: { global: 0, creator: BIG } })).toBeNull()
    expect(await budgetRow(testEnv, creatorScope(creatorId))).toEqual({ reserved: 0, spent: 0 })
  })

  it('an unclear outcome keeps the whole reservation as spent', async () => {
    const { creatorId } = await publishedBoutique(PILOT_V1)
    const r = await reserve(testEnv, input(creatorId, 3_000, 10_000))
    await hold(testEnv, r!, { errorKind: 'timeout', now: new Date() })
    expect(await budgetRow(testEnv, creatorScope(creatorId))).toEqual({ reserved: 0, spent: 3_000 })
    expect((await callRow(r!.callId))?.cost_state).toBe('held')
  })

  it('settling twice changes nothing the second time', async () => {
    const { creatorId } = await publishedBoutique(PILOT_V1)
    const r = await reserve(testEnv, input(creatorId, 2_000, 10_000))
    await reconcile(testEnv, r!, { actualMicroUsd: 500, now: new Date() })
    await reconcile(testEnv, r!, { actualMicroUsd: 500, now: new Date() })
    await hold(testEnv, r!, { now: new Date() })
    expect(await budgetRow(testEnv, creatorScope(creatorId))).toEqual({ reserved: 0, spent: 500 })
  })

  it('concurrent reservations never overrun the ceiling', async () => {
    const { creatorId } = await publishedBoutique(PILOT_V1)
    // 20 calls of 700 against a 10,000 ceiling: at most 14 may succeed.
    const results = await Promise.all(Array.from({ length: 20 }, () => reserve(testEnv, input(creatorId, 700, 10_000))))
    const granted = results.filter((r) => r !== null)
    expect(granted).toHaveLength(14)
    const row = await budgetRow(testEnv, creatorScope(creatorId))
    expect(row.reserved).toBe(9_800)
    expect(row.reserved + row.spent).toBeLessThanOrEqual(10_000)
    const { results: calls } = await testEnv.DB.prepare('SELECT id FROM ai_call WHERE creator_id = ?').bind(creatorId).all()
    expect(calls).toHaveLength(14)
  })

  it('concurrent reserve and settle keep the totals consistent', async () => {
    const { creatorId } = await publishedBoutique(PILOT_V1)
    await Promise.all(
      Array.from({ length: 10 }, async () => {
        const r = await reserve(testEnv, input(creatorId, 1_000, 5_000))
        if (r) await reconcile(testEnv, r, { actualMicroUsd: 400, now: new Date() })
      }),
    )
    const row = await budgetRow(testEnv, creatorScope(creatorId))
    expect(row.reserved).toBe(0)
    expect(row.spent % 400).toBe(0)
    expect(row.spent).toBeLessThanOrEqual(5_000)
  })
})
