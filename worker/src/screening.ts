import { CHECKLIST_LABELS } from '../../shared/domain/boundaries.ts'
import { hardListLines } from '../../shared/domain/hardList.ts'
import type { Boundaries, BoundaryFlag } from '../../shared/domain/types.ts'
import type { FanIdentity } from './auth'
import { ApiError, clientIp, userAgent } from './http'
import { checkText, checkTexts, type HardListHit } from './rules/check'
import type { Deps, DraftContent, Env } from './types'

/** Owner decision, doc 11 §5.6 item 22: this many blocks in 24 hours flags the fan. */
export const HARD_LIST_BLOCK_THRESHOLD = 3
const WINDOW_MS = 24 * 60 * 60 * 1000

type Source = BoundaryFlag['source']

export interface Screening {
  hardList: { hit: HardListHit; source: Source | null } | null
  hardNo: { limitKey: string; source: Source }[]
  flags: BoundaryFlag[]
}

/** The draft's free-text fields, each with the source name a flag reports. */
function fieldsOf(content: DraftContent): { source: Source; text: string }[] {
  const fields: { source: Source; text: string }[] = []
  if (content.fanDisplayName) fields.push({ source: 'display_name', text: content.fanDisplayName })
  if (content.customRequest) fields.push({ source: 'custom_request', text: content.customRequest })
  if (content.fanScript) fields.push({ source: 'fan_script', text: content.fanScript })
  for (const note of content.notes) fields.push({ source: 'notes', text: note.text })
  return fields
}

/**
 * Runs the rules layer over every text field of a draft (check point 2 of
 * §5.3.3): each field alone, then all of them together, so a rule broken
 * across two fields is still caught. Creator limits come back by mode.
 */
export function screenDraft(
  content: DraftContent,
  limits: { checklist: Boundaries['checklist'] },
  verifiedPerformers: number,
): Screening {
  const ctx = { limits, verifiedPerformers }
  const fields = fieldsOf(content)
  let hardList: Screening['hardList'] = null
  const hardNo: Screening['hardNo'] = []
  const flags: BoundaryFlag[] = []

  for (const field of fields) {
    const result = checkText(field.text, ctx)
    if (result.hardList && (!hardList || (result.hardList.key === 'minors' && hardList.hit.key !== 'minors'))) {
      hardList = { hit: result.hardList, source: field.source }
    }
    for (const limit of result.limits) {
      if (limit.mode === 'hard_no') hardNo.push({ limitKey: limit.limitKey, source: field.source })
      else if (!flags.some((f) => f.source === field.source && f.limit.kind === 'checklist' && f.limit.key === limit.limitKey)) {
        flags.push({ source: field.source, limit: { kind: 'checklist', key: limit.limitKey }, mode: 'ask_me' })
      }
    }
  }
  if (!hardList && fields.length > 1) {
    const together = checkTexts(fields.map((f) => f.text), ctx)
    if (together.hardList) hardList = { hit: together.hardList, source: null }
  }
  return { hardList, hardNo, flags }
}

/** How many adult partners the creator has with age verification and a consent record. */
export async function verifiedPerformerCount(env: Env, creatorId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM performer
      WHERE creator_id = ? AND kind = 'partner' AND age_verified = 1 AND consent_record_id IS NOT NULL`,
  )
    .bind(creatorId)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/** The fan-facing text for a creator limit. Never a raw key. */
export function limitLabel(limitKey: string): string {
  return CHECKLIST_LABELS[limitKey] ?? 'One of the creator’s limits'
}

/**
 * Records a hard-list block and throws the response for it (§5.3.3 outcomes).
 *
 * - The audit event keeps only the rule key, a neutral subject, the layer and
 *   the ruleset version. Never the fan's wording.
 * - The third block in 24 hours turns AI off for the fan and flags them for
 *   platform review.
 * - A `minors` hit opens a safety case with the full request as evidence,
 *   suspends the fan, and answers as a paused account (design 14). The fan is
 *   never told about a report.
 */
export async function recordBlock(
  request: Request,
  env: Env,
  deps: Deps,
  fan: FanIdentity,
  creatorId: string,
  creatorName: string,
  draftId: string,
  content: DraftContent,
  blocked: NonNullable<Screening['hardList']>,
): Promise<never> {
  const now = deps.now()
  const at = now.toISOString()
  const { hit, source } = blocked
  const audit = (action: string, detail: Record<string, unknown>) =>
    env.DB.prepare(
      `INSERT INTO audit_event (id, actor_kind, actor_id, action, subject_kind, subject_id, creator_id, detail_json, created_at)
       VALUES (?, 'fan', ?, ?, 'draft', ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), fan.fanId, action, draftId, creatorId, JSON.stringify(detail), at)

  await audit('hard_list_block', { key: hit.key, subject: hit.subject, layer: hit.layer, version: hit.version, field: source }).run()

  if (hit.key === 'minors') {
    const caseId = crypto.randomUUID()
    const evidenceId = crypto.randomUUID()
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO safety_case (id, creator_id, fan_id, category, status, evidence_ref, created_at, updated_at)
         VALUES (?, ?, ?, 'minors', 'open', ?, ?, ?)`,
      ).bind(caseId, creatorId, fan.fanId, evidenceId, at, at),
      env.DB.prepare(
        `INSERT INTO safety_case_evidence (id, case_id, fan_id, request_json, ip, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        evidenceId,
        caseId,
        fan.fanId,
        JSON.stringify({ draftId, field: source, content, clerkUserId: fan.claims.userId, clerkSessionId: fan.claims.sessionId }),
        clientIp(request),
        userAgent(request),
        at,
      ),
      env.DB.prepare(`UPDATE fan SET status = 'suspended' WHERE id = ?`).bind(fan.fanId),
      restrict(env, fan.fanId, 'minors', at),
      audit('safety_case_opened', { caseId, key: 'minors' }),
    ])
    throw new ApiError(403, 'account_paused')
  }

  const since = new Date(now.getTime() - WINDOW_MS).toISOString()
  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM audit_event
      WHERE actor_kind = 'fan' AND actor_id = ? AND action = 'hard_list_block' AND created_at > ?`,
  )
    .bind(fan.fanId, since)
    .first<{ n: number }>()
  if ((count?.n ?? 0) >= HARD_LIST_BLOCK_THRESHOLD) {
    await env.DB.batch([restrict(env, fan.fanId, 'block_threshold', at), audit('fan_flagged_for_review', { reason: 'block_threshold' })])
  }

  const lines = hardListLines(hit.key, creatorName)
  throw new ApiError(422, 'hard_list_blocked', {
    key: hit.key,
    lines: hit.line !== null && lines[hit.line] ? [lines[hit.line]] : lines,
    field: source,
  })
}

function restrict(env: Env, fanId: string, reason: string, at: string): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO fan_restriction (fan_id, ai_disabled_at, review_flagged_at, reason, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (fan_id) DO UPDATE SET
       ai_disabled_at = COALESCE(fan_restriction.ai_disabled_at, excluded.ai_disabled_at),
       review_flagged_at = COALESCE(fan_restriction.review_flagged_at, excluded.review_flagged_at),
       reason = CASE WHEN excluded.reason = 'minors' THEN 'minors' ELSE fan_restriction.reason END,
       updated_at = excluded.updated_at`,
  ).bind(fanId, at, at, reason, at)
}
