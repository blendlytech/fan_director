import type { Env } from '../types'

/**
 * The AI cost ledger (doc 10 §4 step 4 and §6, doc 11 §8 Phase 3).
 *
 * Every paid call reserves a conservative amount first. The reservation is one
 * D1 batch (a transaction): make sure both budget rows exist, then a single
 * conditional UPDATE that only succeeds when BOTH the environment scope and the
 * creator scope can take the amount. D1 runs statements one at a time, so two
 * concurrent calls can never both spend the last of a budget. The ai_call row
 * is written in the same batch, only if the UPDATE changed both rows.
 *
 * After the call the reservation is reconciled with the actual cost. When the
 * outcome is unclear (a timeout: the provider may still bill), the whole
 * reservation is kept as spent ("held"), never released.
 */

export type CallPurpose = 'classify_input' | 'director' | 'classify_output'

export interface Reservation {
  callId: string
  creatorId: string
  amountMicroUsd: number
}

export interface ReserveInput {
  creatorId: string
  requestId: string | null
  purpose: CallPurpose
  model: string
  attempt: number
  amountMicroUsd: number
  ceilings: { global: number; creator: number }
  now: Date
}

export const GLOBAL_SCOPE = 'global'
export const creatorScope = (creatorId: string) => `creator:${creatorId}`

/** Returns null when the budget can't cover the amount. Nothing is written then. */
export async function reserve(env: Env, input: ReserveInput): Promise<Reservation | null> {
  const amount = Math.max(0, Math.ceil(input.amountMicroUsd))
  const at = input.now.toISOString()
  const cScope = creatorScope(input.creatorId)
  const callId = crypto.randomUUID()
  const results = await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO ai_budget (scope, reserved_microusd, spent_microusd, updated_at) VALUES (?1, 0, 0, ?3), (?2, 0, 0, ?3)').bind(
      GLOBAL_SCOPE,
      cScope,
      at,
    ),
    env.DB.prepare(
      `UPDATE ai_budget SET reserved_microusd = reserved_microusd + ?1, updated_at = ?6
       WHERE scope IN (?2, ?3)
         AND (SELECT count(*) FROM ai_budget
              WHERE scope IN (?2, ?3)
                AND spent_microusd + reserved_microusd + ?1 <= CASE scope WHEN ?2 THEN ?4 ELSE ?5 END) = 2`,
    ).bind(amount, GLOBAL_SCOPE, cScope, input.ceilings.global, input.ceilings.creator, at),
    env.DB.prepare(
      `INSERT INTO ai_call (id, ai_request_id, creator_id, purpose, model, attempt, reserved_microusd, cost_state, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'reserved', ?8 WHERE changes() = 2`,
    ).bind(callId, input.requestId, input.creatorId, input.purpose, input.model, input.attempt, amount, at),
  ])
  if ((results[1].meta.changes ?? 0) !== 2) return null
  return { callId, creatorId: input.creatorId, amountMicroUsd: amount }
}

export interface CallOutcome {
  /** What the provider charged, if known. Null means "use the tokens × rate estimate". */
  actualMicroUsd: number
  inputTokens?: number | null
  outputTokens?: number | null
  upstream?: string | null
  latencyMs?: number | null
  errorKind?: string | null
  now: Date
}

/**
 * Books the actual cost and releases the rest of the reservation. Idempotent:
 * only a call still in the 'reserved' state is settled.
 */
export async function reconcile(env: Env, r: Reservation, outcome: CallOutcome): Promise<void> {
  await settle(env, r, 'reconciled', Math.max(0, Math.ceil(outcome.actualMicroUsd)), outcome)
}

/** Unclear outcome: the whole reservation stays spent. */
export async function hold(env: Env, r: Reservation, outcome: Omit<CallOutcome, 'actualMicroUsd'>): Promise<void> {
  await settle(env, r, 'held', r.amountMicroUsd, { ...outcome, actualMicroUsd: r.amountMicroUsd })
}

async function settle(env: Env, r: Reservation, state: 'reconciled' | 'held', spent: number, o: CallOutcome): Promise<void> {
  const at = o.now.toISOString()
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE ai_call SET cost_state = ?2, actual_microusd = ?3, input_tokens = ?4, output_tokens = ?5,
         upstream = ?6, latency_ms = ?7, error_kind = ?8, finished_at = ?9
       WHERE id = ?1 AND cost_state = 'reserved'`,
    ).bind(r.callId, state, spent, o.inputTokens ?? null, o.outputTokens ?? null, o.upstream ?? null, o.latencyMs ?? null, o.errorKind ?? null, at),
    env.DB.prepare(
      `UPDATE ai_budget SET reserved_microusd = max(0, reserved_microusd - ?1), spent_microusd = spent_microusd + ?2, updated_at = ?5
       WHERE scope IN (?3, ?4) AND changes() = 1`,
    ).bind(r.amountMicroUsd, spent, GLOBAL_SCOPE, creatorScope(r.creatorId), at),
  ])
}

/** Totals for a scope, for reports and tests. */
export async function budgetRow(env: Env, scope: string): Promise<{ reserved: number; spent: number }> {
  const row = await env.DB.prepare('SELECT reserved_microusd AS reserved, spent_microusd AS spent FROM ai_budget WHERE scope = ?')
    .bind(scope)
    .first<{ reserved: number; spent: number }>()
  return row ?? { reserved: 0, spent: 0 }
}
