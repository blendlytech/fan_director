import { effectiveLimits } from '../../shared/domain/boundaries.ts'
import {
  actionsFor,
  approveProblem,
  MESSAGE_MAX,
  OPEN_STATUSES,
  termsHash,
  type CommissionStatus,
  type CommissionTerms,
  type VersionStatus,
} from '../../shared/domain/commission.ts'
import type { BoundaryFlag, Quote } from '../../shared/domain/types.ts'
import type { CreatorIdentity, FanIdentity } from './auth'
import { gateFor, loadVersion, type VersionRow } from './catalog'
import { assertNotSubmitted, draftOf, requireOwned } from './drafts'
import { ApiError, json, readJsonBody } from './http'
import { checkTexts } from './rules/check'
import { limitLabel, recordBlock, recordHardListBlock, screenDraft, verifiedPerformerCount } from './screening'
import { validateForSubmission, type SubmissionProblem } from './submission'
import type { Deps, DraftContent, Env } from './types'
import { assertOnlyKeys, parseDraftContent, UUID } from './validation'

/**
 * Phase 4: sending a draft and the creator's review (doc 10 §5 and §7,
 * doc 11 §5.6 item 26). See shared/domain/commission.ts for the states.
 *
 * Every change is ONE D1 batch whose first statement is a compare-and-set on
 * the commission's status and current version, so two actions racing each
 * other (approve vs withdraw, propose vs accept, two tabs sending) can't both
 * win; the loser gets a typed 409 and nothing changes.
 *
 * Nothing here records or claims a payment. After approval the creator may
 * report one, and every response labels it `creatorReported`.
 */

const OPEN_SQL = `(${OPEN_STATUSES.map((s) => `'${s}'`).join(', ')})`

interface CommissionRow {
  id: string
  fan_id: string
  creator_id: string
  creator_name: string
  draft_id: string
  client_request_id: string
  status: CommissionStatus
  current_version_id: string
  approved_version_id: string | null
  approved_hash: string | null
  approved_at: string | null
  decided_at: string | null
  payment_reported_at: string | null
  created_at: string
  updated_at: string
}

interface VersionDbRow {
  id: string
  seq: number
  author: 'fan' | 'creator'
  catalog_version_id: string
  terms_json: string
  quote_json: string
  boundary_flags_json: string
  custom_request_price_cents: number | null
  content_hash: string
  status: VersionStatus
  fan_accepted_at: string | null
  created_at: string
}

interface MessageRow {
  id: string
  author_kind: 'fan' | 'creator'
  kind: 'question' | 'answer' | 'proposal_note' | 'decline_reason'
  body: string
  version_id: string | null
  created_at: string
}

/** What a version stores: the terms (hashed) plus the fan's notes (not part of the approved scope). */
interface StoredTerms extends CommissionTerms {
  notes: { id: number; text: string }[]
}

const COMMISSION_COLUMNS = `c.id, c.fan_id, c.creator_id, cr.display_name AS creator_name, c.draft_id, c.client_request_id,
  c.status, c.current_version_id, c.approved_version_id, c.approved_hash, c.approved_at, c.decided_at,
  c.payment_reported_at, c.created_at, c.updated_at`

/* ------------------------------- Helpers --------------------------------- */

function termsOf(content: DraftContent, catalogVersionId: string, q: Quote, customRequestPriceCents: number | null): StoredTerms {
  return {
    catalogVersionId,
    selections: content.selections.map((s) => ({ itemId: s.itemId, qty: s.qty })),
    customRequest: content.customRequest,
    customRequestPriceCents,
    fanDisplayName: content.fanDisplayName,
    fanScript: content.fanScript,
    totalCents: q.total + (customRequestPriceCents ?? 0),
    deliveryDaysFromPayment: q.deliveryDaysFromPayment,
    notes: content.notes,
  }
}

async function hashOf(terms: StoredTerms): Promise<string> {
  const { notes: _notes, ...scope } = terms
  return termsHash(scope)
}

function messageBody(value: unknown, field = 'body'): string {
  if (typeof value !== 'string' || value.includes('\u0000')) throw new ApiError(400, 'invalid_message', { field })
  const body = value.trim()
  if (body.length === 0 || body.length > MESSAGE_MAX) throw new ApiError(400, 'invalid_message', { field, max: MESSAGE_MAX })
  return body
}

function optionalMessage(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return messageBody(value, field)
}

function assertUuid(id: string): void {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found')
}

async function loadCommission(env: Env, id: string, owner: { fanId?: string; creatorId?: string }): Promise<CommissionRow> {
  assertUuid(id)
  const row = await env.DB.prepare(
    `SELECT ${COMMISSION_COLUMNS} FROM commission c JOIN creator cr ON cr.id = c.creator_id
      WHERE c.id = ? AND (? IS NULL OR c.fan_id = ?) AND (? IS NULL OR (c.creator_id = ? AND c.status != 'withheld'))`,
  )
    .bind(id, owner.fanId ?? null, owner.fanId ?? null, owner.creatorId ?? null, owner.creatorId ?? null)
    .first<CommissionRow>()
  // Another fan's or another creator's request, or a withheld one, looks like none.
  if (!row) throw new ApiError(404, 'not_found')
  return row
}

async function versionsOf(env: Env, commissionId: string): Promise<VersionDbRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, seq, author, catalog_version_id, terms_json, quote_json, boundary_flags_json, custom_request_price_cents,
            content_hash, status, fan_accepted_at, created_at
       FROM commission_version WHERE commission_id = ? ORDER BY seq`,
  )
    .bind(commissionId)
    .all<VersionDbRow>()
  return results
}

async function messagesOf(env: Env, commissionId: string): Promise<MessageRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, author_kind, kind, body, version_id, created_at FROM commission_message WHERE commission_id = ? ORDER BY created_at, id`,
  )
    .bind(commissionId)
    .all<MessageRow>()
  return results
}

function audit(env: Env, actor: 'fan' | 'creator', actorId: string, action: string, c: { id: string; creator_id: string }, detail: Record<string, unknown>, at: string) {
  return env.DB.prepare(
    `INSERT INTO audit_event (id, actor_kind, actor_id, action, subject_kind, subject_id, creator_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, 'commission', ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), actor, actorId, action, c.id, c.creator_id, JSON.stringify(detail), at)
}

/** The request as one side sees it. The creator also sees the ask-me flags. */
async function view(env: Env, row: CommissionRow, side: 'fan' | 'creator'): Promise<Record<string, unknown>> {
  const [versions, messages] = await Promise.all([versionsOf(env, row.id), messagesOf(env, row.id)])
  return {
    commission: {
      id: row.id,
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      status: row.status,
      currentVersionId: row.current_version_id,
      approvedVersionId: row.approved_version_id,
      approvedAt: row.approved_at,
      decidedAt: row.decided_at,
      // Reported by the creator, never confirmed by the platform.
      payment: row.payment_reported_at ? { creatorReported: true, reportedAt: row.payment_reported_at } : null,
      actions: actionsFor(row.status, side),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    versions: versions.map((v) => ({
      id: v.id,
      seq: v.seq,
      author: v.author,
      status: v.status,
      catalogVersionId: v.catalog_version_id,
      terms: JSON.parse(v.terms_json) as StoredTerms,
      quote: JSON.parse(v.quote_json) as Quote,
      customRequestPriceCents: v.custom_request_price_cents,
      contentHash: v.content_hash,
      fanAcceptedAt: v.fan_accepted_at,
      createdAt: v.created_at,
      ...(side === 'creator' ? { boundaryFlags: JSON.parse(v.boundary_flags_json) as BoundaryFlag[] } : {}),
    })),
    messages: messages.map((m) => ({
      id: m.id,
      authorKind: m.author_kind,
      kind: m.kind,
      body: m.body,
      versionId: m.version_id,
      createdAt: m.created_at,
    })),
  }
}

/** After a lost compare-and-set: say why, from the state that won. */
async function conflict(env: Env, id: string, owner: { fanId?: string; creatorId?: string }, side: 'fan' | 'creator'): Promise<never> {
  const row = await loadCommission(env, id, owner)
  throw new ApiError(409, 'commission_changed', { status: row.status, current: await view(env, row, side) })
}

/* --------------------------------- Send ---------------------------------- */

function problemError(problems: SubmissionProblem[]): ApiError {
  const stale = problems.find((p) => p.code === 'catalog_version_stale')
  if (stale && stale.code === 'catalog_version_stale') {
    return new ApiError(409, 'catalog_version_stale', { currentCatalogVersionId: stale.currentCatalogVersionId })
  }
  const hardNo = problems.find((p) => p.code === 'hard_no')
  if (hardNo && hardNo.code === 'hard_no') {
    return new ApiError(422, 'creator_limit_blocked', {
      limit: { kind: 'checklist', key: hardNo.limitKey },
      label: limitLabel(hardNo.limitKey),
      field: hardNo.field,
    })
  }
  return new ApiError(422, 'submission_blocked', { problems })
}

/**
 * POST /api/creators/:c/drafts/:d/submit — the fan sends the draft.
 * Body: { clientRequestId, expectedRevision, catalogVersionId }.
 * The same clientRequestId returns the same request (a retried send).
 */
export async function submitDraft(request: Request, env: Env, deps: Deps, fan: FanIdentity, creatorId: string, draftId: string): Promise<Response> {
  const body = await readJsonBody(request, 1_024)
  assertOnlyKeys(body, ['clientRequestId', 'expectedRevision', 'catalogVersionId'], 'invalid_request')
  const { clientRequestId, expectedRevision, catalogVersionId } = body
  if (typeof clientRequestId !== 'string' || !UUID.test(clientRequestId)) throw new ApiError(400, 'invalid_request', { field: 'clientRequestId' })
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 1) throw new ApiError(400, 'invalid_request', { field: 'expectedRevision' })
  if (typeof catalogVersionId !== 'string' || catalogVersionId.length > 64) throw new ApiError(400, 'invalid_request', { field: 'catalogVersionId' })

  // A retry of a send that already happened returns what it made.
  const earlier = await env.DB.prepare(`SELECT id, draft_id FROM commission WHERE fan_id = ? AND client_request_id = ?`)
    .bind(fan.fanId, clientRequestId)
    .first<{ id: string; draft_id: string }>()
  if (earlier) {
    if (earlier.draft_id !== draftId) throw new ApiError(409, 'client_request_reused')
    return json(200, await view(env, await loadCommission(env, earlier.id, { fanId: fan.fanId }), 'fan'))
  }

  const row = await requireOwned(env, fan, creatorId, draftId)
  assertNotSubmitted(row)
  if (row.revision !== expectedRevision || row.catalog_version_id !== catalogVersionId) {
    throw new ApiError(409, 'revision_conflict', { current: draftOf(row) })
  }

  const version = await loadVersion(env, creatorId, row.catalog_version_id)
  if (!version) throw new ApiError(422, 'catalog_version_mismatch')
  const gate = await gateFor(env, creatorId)
  const content = parseDraftContent(JSON.parse(row.content_json))
  const verifiedPerformers = await verifiedPerformerCount(env, creatorId)
  const check = validateForSubmission(content, {
    versionId: version.id,
    currentVersionId: version.currentVersionId,
    content: version.content,
    gate,
    verifiedPerformers,
  })
  if (!check.ok) {
    if (check.problems.some((p) => p.code === 'hard_list')) {
      // Rules can change after a save: the block is recorded like any other (§5.3.3).
      const screening = screenDraft(content, effectiveLimits(version.content.boundaries, gate), verifiedPerformers)
      if (screening.hardList) await recordBlock(request, env, deps, fan, creatorId, version.creatorName, draftId, content, screening.hardList)
    }
    throw problemError(check.problems)
  }

  const now = deps.now().toISOString()
  const commissionId = crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const terms = termsOf(content, version.id, check.quote, null)
  const hash = await hashOf(terms)
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE draft SET submitted_at = ?
        WHERE id = ? AND fan_id = ? AND creator_id = ? AND revision = ? AND catalog_version_id = ? AND submitted_at IS NULL`,
    ).bind(now, draftId, fan.fanId, creatorId, expectedRevision, catalogVersionId),
    env.DB.prepare(
      `INSERT INTO commission (id, fan_id, creator_id, draft_id, client_request_id, status, current_version_id, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, 'in_review', ?, ?, ? WHERE changes() = 1`,
    ).bind(commissionId, fan.fanId, creatorId, draftId, clientRequestId, versionId, now, now),
    env.DB.prepare(
      `INSERT INTO commission_version (id, commission_id, seq, author, catalog_version_id, terms_json, quote_json,
                                       boundary_flags_json, custom_request_price_cents, content_hash, status, fan_accepted_at, created_at)
       SELECT ?, ?, 1, 'fan', ?, ?, ?, ?, NULL, ?, 'accepted', ?, ? WHERE EXISTS (SELECT 1 FROM commission WHERE id = ?)`,
    ).bind(versionId, commissionId, version.id, JSON.stringify(terms), JSON.stringify(check.quote), JSON.stringify(check.flags), hash, now, now, commissionId),
    env.DB.prepare(
      `INSERT INTO audit_event (id, actor_kind, actor_id, action, subject_kind, subject_id, creator_id, detail_json, created_at)
       SELECT ?, 'fan', ?, 'commission_submitted', 'commission', ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM commission WHERE id = ?)`,
    ).bind(crypto.randomUUID(), fan.fanId, commissionId, creatorId, JSON.stringify({ versionId, hash }), now, commissionId),
  ])
  if (results[0].meta.changes !== 1) {
    // Another tab sent it, or the draft moved on, between the check and the write.
    const winner = await env.DB.prepare(`SELECT id, client_request_id FROM commission WHERE draft_id = ? AND fan_id = ?`)
      .bind(draftId, fan.fanId)
      .first<{ id: string; client_request_id: string }>()
    if (winner?.client_request_id === clientRequestId) {
      return json(200, await view(env, await loadCommission(env, winner.id, { fanId: fan.fanId }), 'fan'))
    }
    if (winner) throw new ApiError(409, 'draft_submitted')
    const current = await requireOwned(env, fan, creatorId, draftId)
    throw new ApiError(409, 'revision_conflict', { current: draftOf(current) })
  }
  return json(201, await view(env, await loadCommission(env, commissionId, { fanId: fan.fanId }), 'fan'))
}

/* --------------------------------- Fan ----------------------------------- */

/** GET /api/commissions — the fan's requests, newest first. */
export async function listFanCommissions(env: Env, fan: FanIdentity): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.creator_id, cr.display_name AS creator_name, c.status, c.updated_at, c.created_at,
            v.terms_json, c.payment_reported_at
       FROM commission c
       JOIN creator cr ON cr.id = c.creator_id
       JOIN commission_version v ON v.id = c.current_version_id
      WHERE c.fan_id = ?
      ORDER BY c.updated_at DESC LIMIT 100`,
  )
    .bind(fan.fanId)
    .all<{ id: string; creator_id: string; creator_name: string; status: CommissionStatus; updated_at: string; created_at: string; terms_json: string; payment_reported_at: string | null }>()
  return json(200, {
    commissions: results.map((r) => ({
      id: r.id,
      creatorId: r.creator_id,
      creatorName: r.creator_name,
      // A withheld request is shown to its fan as closed; nothing says why (doc 11 §5.3.3).
      status: r.status === 'withheld' ? 'closed' : r.status,
      totalCents: (JSON.parse(r.terms_json) as StoredTerms).totalCents,
      waitingOnYou: r.status === 'question_open' || r.status === 'proposal_open',
      payment: r.payment_reported_at ? { creatorReported: true, reportedAt: r.payment_reported_at } : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  })
}

export async function getFanCommission(env: Env, fan: FanIdentity, id: string): Promise<Response> {
  const row = await loadCommission(env, id, { fanId: fan.fanId })
  const body = await view(env, row, 'fan')
  if (row.status === 'withheld') (body.commission as Record<string, unknown>).status = 'closed'
  return json(200, body)
}

/** POST /api/commissions/:id/reply — the fan answers the creator's question. Screened like any fan text. */
export async function replyToQuestion(request: Request, env: Env, deps: Deps, fan: FanIdentity, id: string): Promise<Response> {
  const payload = await readJsonBody(request, 4_096)
  assertOnlyKeys(payload, ['body'], 'invalid_message')
  const body = messageBody(payload.body)
  const row = await loadCommission(env, id, { fanId: fan.fanId })
  if (row.status !== 'question_open') throw new ApiError(409, 'commission_changed', { status: row.status })

  const version = await loadVersion(env, row.creator_id, null)
  const gate = await gateFor(env, row.creator_id)
  const limits = version ? effectiveLimits(version.content.boundaries, gate) : undefined
  const checked = checkTexts([body], { limits, verifiedPerformers: await verifiedPerformerCount(env, row.creator_id) })
  if (checked.hardList) {
    await recordHardListBlock(request, env, deps, fan, {
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      subjectKind: 'commission',
      subjectId: row.id,
      field: 'answer',
      hit: checked.hardList,
      evidence: { commissionId: row.id, field: 'answer', body, messages: await messagesOf(env, row.id) },
    })
  }
  const hardNo = checked.limits.find((l) => l.mode === 'hard_no')
  if (hardNo) {
    throw new ApiError(422, 'creator_limit_blocked', { limit: { kind: 'checklist', key: hardNo.limitKey }, label: limitLabel(hardNo.limitKey), field: 'answer' })
  }

  const now = deps.now().toISOString()
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE commission SET status = 'in_review', updated_at = ? WHERE id = ? AND fan_id = ? AND status = 'question_open'`).bind(now, row.id, fan.fanId),
    env.DB.prepare(
      `INSERT INTO commission_message (id, commission_id, author_kind, kind, body, version_id, created_at)
       SELECT ?, ?, 'fan', 'answer', ?, ?, ? WHERE changes() = 1`,
    ).bind(crypto.randomUUID(), row.id, body, row.current_version_id, now),
  ])
  if (results[0].meta.changes !== 1) await conflict(env, row.id, { fanId: fan.fanId }, 'fan')
  await audit(env, 'fan', fan.fanId, 'commission_answered', row, {}, now).run()
  return json(200, await view(env, await loadCommission(env, row.id, { fanId: fan.fanId }), 'fan'))
}

/** POST /api/commissions/:id/versions/:v/accept — the fan accepts the creator's proposed terms. */
export async function acceptProposal(request: Request, env: Env, deps: Deps, fan: FanIdentity, id: string, versionId: string): Promise<Response> {
  const payload = await readJsonBody(request, 1_024)
  assertOnlyKeys(payload, ['contentHash'], 'invalid_request')
  if (typeof payload.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(payload.contentHash)) throw new ApiError(400, 'invalid_request', { field: 'contentHash' })
  assertUuid(versionId)
  const row = await loadCommission(env, id, { fanId: fan.fanId })
  const now = deps.now().toISOString()
  const hash = payload.contentHash
  const results = await env.DB.batch([
    // The claim: only the offered version on screen, with the same terms.
    env.DB.prepare(
      `UPDATE commission SET status = 'in_review', updated_at = ?
        WHERE id = ? AND fan_id = ? AND status = 'proposal_open' AND current_version_id = ?
          AND EXISTS (SELECT 1 FROM commission_version WHERE id = ? AND commission_id = ? AND status = 'offered' AND content_hash = ?)`,
    ).bind(now, row.id, fan.fanId, versionId, versionId, row.id, hash),
    env.DB.prepare(
      `UPDATE commission_version SET status = 'superseded'
        WHERE commission_id = ? AND status = 'accepted'
          AND (SELECT status FROM commission_version WHERE id = ?) = 'offered'
          AND (SELECT status FROM commission WHERE id = ?) = 'in_review'
          AND (SELECT current_version_id FROM commission WHERE id = ?) = ?`,
    ).bind(row.id, versionId, row.id, row.id, versionId),
    env.DB.prepare(
      `UPDATE commission_version SET status = 'accepted', fan_accepted_at = ?
        WHERE id = ? AND status = 'offered'
          AND (SELECT status FROM commission WHERE id = ?) = 'in_review'
          AND (SELECT current_version_id FROM commission WHERE id = ?) = ?`,
    ).bind(now, versionId, row.id, row.id, versionId),
  ])
  if (results[0].meta.changes !== 1) await conflict(env, row.id, { fanId: fan.fanId }, 'fan')
  await audit(env, 'fan', fan.fanId, 'proposal_accepted', row, { versionId, hash }, now).run()
  return json(200, await view(env, await loadCommission(env, row.id, { fanId: fan.fanId }), 'fan'))
}

/** POST /api/commissions/:id/versions/:v/reject — the fan keeps their accepted terms instead. */
export async function rejectProposal(env: Env, deps: Deps, fan: FanIdentity, id: string, versionId: string): Promise<Response> {
  assertUuid(versionId)
  const row = await loadCommission(env, id, { fanId: fan.fanId })
  const now = deps.now().toISOString()
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE commission SET status = 'in_review', updated_at = ?,
              current_version_id = (SELECT id FROM commission_version WHERE commission_id = ? AND status = 'accepted' ORDER BY seq DESC LIMIT 1)
        WHERE id = ? AND fan_id = ? AND status = 'proposal_open' AND current_version_id = ?`,
    ).bind(now, row.id, row.id, fan.fanId, versionId),
    env.DB.prepare(
      `UPDATE commission_version SET status = 'rejected'
        WHERE id = ? AND commission_id = ? AND status = 'offered' AND changes() = 1`,
    ).bind(versionId, row.id),
  ])
  if (results[0].meta.changes !== 1) await conflict(env, row.id, { fanId: fan.fanId }, 'fan')
  await audit(env, 'fan', fan.fanId, 'proposal_rejected', row, { versionId }, now).run()
  return json(200, await view(env, await loadCommission(env, row.id, { fanId: fan.fanId }), 'fan'))
}

/** POST /api/commissions/:id/withdraw — the fan takes the request back before a decision. */
export async function withdrawCommission(env: Env, deps: Deps, fan: FanIdentity, id: string): Promise<Response> {
  const row = await loadCommission(env, id, { fanId: fan.fanId })
  const now = deps.now().toISOString()
  const result = await env.DB.prepare(
    `UPDATE commission SET status = 'withdrawn', decided_at = ?, updated_at = ? WHERE id = ? AND fan_id = ? AND status IN ${OPEN_SQL}`,
  )
    .bind(now, now, row.id, fan.fanId)
    .run()
  if (result.meta.changes !== 1) await conflict(env, row.id, { fanId: fan.fanId }, 'fan')
  await audit(env, 'fan', fan.fanId, 'commission_withdrawn', row, {}, now).run()
  return json(200, await view(env, await loadCommission(env, row.id, { fanId: fan.fanId }), 'fan'))
}

/* ------------------------------- Creator --------------------------------- */

/** GET /api/creator/commissions?status= — the queue (design 03). Withheld requests never appear. */
export async function listCreatorCommissions(request: Request, env: Env, creator: CreatorIdentity): Promise<Response> {
  const status = new URL(request.url).searchParams.get('status')
  const statuses: string[] = ['in_review', 'question_open', 'proposal_open', 'approved', 'declined', 'withdrawn']
  if (status !== null && !statuses.includes(status)) throw new ApiError(400, 'invalid_request', { field: 'status' })
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.status, c.created_at, c.updated_at, c.payment_reported_at, v.terms_json, v.boundary_flags_json
       FROM commission c JOIN commission_version v ON v.id = c.current_version_id
      WHERE c.creator_id = ? AND c.status != 'withheld' AND (? IS NULL OR c.status = ?)
      ORDER BY c.updated_at DESC LIMIT 200`,
  )
    .bind(creator.creatorId, status, status)
    .all<{ id: string; status: CommissionStatus; created_at: string; updated_at: string; payment_reported_at: string | null; terms_json: string; boundary_flags_json: string }>()
  const counts = await env.DB.prepare(
    `SELECT status, COUNT(*) AS n FROM commission WHERE creator_id = ? AND status != 'withheld' GROUP BY status`,
  )
    .bind(creator.creatorId)
    .all<{ status: string; n: number }>()
  return json(200, {
    commissions: results.map((r) => {
      const terms = JSON.parse(r.terms_json) as StoredTerms
      return {
        id: r.id,
        status: r.status,
        // What the fan asked to be called, not a verified identity (design 24 B).
        fanName: terms.fanDisplayName,
        totalCents: terms.totalCents,
        customRequest: terms.customRequest !== null,
        customRequestPriced: terms.customRequestPriceCents !== null,
        askFirst: (JSON.parse(r.boundary_flags_json) as BoundaryFlag[]).length,
        payment: r.payment_reported_at ? { creatorReported: true, reportedAt: r.payment_reported_at } : null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    }),
    counts: Object.fromEntries(counts.results.map((c) => [c.status, c.n])),
  })
}

export async function getCreatorCommission(env: Env, creator: CreatorIdentity, id: string): Promise<Response> {
  return json(200, await view(env, await loadCommission(env, id, { creatorId: creator.creatorId }), 'creator'))
}

/** The creator's own words aren't screened as a fan's, but the hard list still applies to everything shown. */
function assertCreatorText(texts: string[]): void {
  const checked = checkTexts(texts)
  if (checked.hardList) throw new ApiError(422, 'hard_list_blocked', { key: checked.hardList.key, field: 'message' })
}

/** POST /api/creator/commissions/:id/question — design 06. */
export async function askQuestion(request: Request, env: Env, deps: Deps, creator: CreatorIdentity, id: string): Promise<Response> {
  const payload = await readJsonBody(request, 4_096)
  assertOnlyKeys(payload, ['body'], 'invalid_message')
  const body = messageBody(payload.body)
  assertCreatorText([body])
  const row = await loadCommission(env, id, { creatorId: creator.creatorId })
  const now = deps.now().toISOString()
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE commission SET status = 'question_open', updated_at = ? WHERE id = ? AND creator_id = ? AND status = 'in_review'`).bind(now, row.id, creator.creatorId),
    env.DB.prepare(
      `INSERT INTO commission_message (id, commission_id, author_kind, kind, body, version_id, created_at)
       SELECT ?, ?, 'creator', 'question', ?, ?, ? WHERE changes() = 1`,
    ).bind(crypto.randomUUID(), row.id, body, row.current_version_id, now),
  ])
  if (results[0].meta.changes !== 1) await conflict(env, row.id, { creatorId: creator.creatorId }, 'creator')
  await audit(env, 'creator', creator.creatorId, 'question_asked', row, {}, now).run()
  return json(200, await view(env, await loadCommission(env, row.id, { creatorId: creator.creatorId }), 'creator'))
}

/**
 * POST /api/creator/commissions/:id/propose — design 05 "Propose Changes".
 * Body: { expectedVersionId, selections, customRequestPriceCents?, note? }.
 * The server builds, validates and prices the new terms on the creator's
 * current catalog; the fan must accept them before they can be approved.
 */
export async function proposeChanges(request: Request, env: Env, deps: Deps, creator: CreatorIdentity, id: string): Promise<Response> {
  const payload = await readJsonBody(request, 16_384)
  assertOnlyKeys(payload, ['expectedVersionId', 'selections', 'customRequestPriceCents', 'note'], 'invalid_request')
  const { expectedVersionId, customRequestPriceCents } = payload
  if (typeof expectedVersionId !== 'string' || !UUID.test(expectedVersionId)) throw new ApiError(400, 'invalid_request', { field: 'expectedVersionId' })
  if (customRequestPriceCents !== undefined && customRequestPriceCents !== null &&
      (!Number.isInteger(customRequestPriceCents) || (customRequestPriceCents as number) < 0 || (customRequestPriceCents as number) > 10_000_000)) {
    throw new ApiError(400, 'invalid_request', { field: 'customRequestPriceCents' })
  }
  const note = optionalMessage(payload.note, 'note')
  if (note) assertCreatorText([note])

  const row = await loadCommission(env, id, { creatorId: creator.creatorId })
  if (row.status !== 'in_review' || row.current_version_id !== expectedVersionId) await conflict(env, row.id, { creatorId: creator.creatorId }, 'creator')
  const versions = await versionsOf(env, row.id)
  const base = versions.find((v) => v.id === expectedVersionId)!
  const baseTerms = JSON.parse(base.terms_json) as StoredTerms
  const price = (customRequestPriceCents as number | null | undefined) ?? null
  if (price !== null && !baseTerms.customRequest) throw new ApiError(400, 'invalid_request', { field: 'customRequestPriceCents', reason: 'no_custom_request' })

  // The fan's own words travel unchanged; only the choices and the custom-request price change.
  const content = parseDraftContent({
    selections: payload.selections,
    fanDisplayName: baseTerms.fanDisplayName,
    customRequest: baseTerms.customRequest,
    fanScript: baseTerms.fanScript,
    notes: baseTerms.notes,
    budget: null,
  })
  const version: VersionRow | null = await loadVersion(env, row.creator_id, null)
  if (!version) throw new ApiError(422, 'catalog_version_mismatch')
  const check = validateForSubmission(content, {
    versionId: version.id,
    currentVersionId: version.currentVersionId,
    content: version.content,
    gate: await gateFor(env, row.creator_id),
    verifiedPerformers: await verifiedPerformerCount(env, row.creator_id),
  })
  if (!check.ok) throw new ApiError(422, 'proposal_invalid', { problems: check.problems })

  const terms = termsOf(content, version.id, check.quote, price)
  const hash = await hashOf(terms)
  if (hash === base.content_hash) throw new ApiError(422, 'proposal_unchanged')
  const now = deps.now().toISOString()
  const newId = crypto.randomUUID()
  const seq = Math.max(...versions.map((v) => v.seq)) + 1
  const statements = [
    env.DB.prepare(
      `UPDATE commission SET status = 'proposal_open', current_version_id = ?, updated_at = ?
        WHERE id = ? AND creator_id = ? AND status = 'in_review' AND current_version_id = ?`,
    ).bind(newId, now, row.id, creator.creatorId, expectedVersionId),
    env.DB.prepare(
      `INSERT INTO commission_version (id, commission_id, seq, author, catalog_version_id, terms_json, quote_json,
                                       boundary_flags_json, custom_request_price_cents, content_hash, status, created_at)
       SELECT ?, ?, ?, 'creator', ?, ?, ?, ?, ?, ?, 'offered', ? WHERE changes() = 1`,
    ).bind(newId, row.id, seq, version.id, JSON.stringify(terms), JSON.stringify(check.quote), JSON.stringify(check.flags), price, hash, now),
  ]
  if (note) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO commission_message (id, commission_id, author_kind, kind, body, version_id, created_at)
         SELECT ?, ?, 'creator', 'proposal_note', ?, ?, ? WHERE changes() = 1`,
      ).bind(crypto.randomUUID(), row.id, note, newId, now),
    )
  }
  const results = await env.DB.batch(statements)
  if (results[0].meta.changes !== 1) await conflict(env, row.id, { creatorId: creator.creatorId }, 'creator')
  await audit(env, 'creator', creator.creatorId, 'changes_proposed', row, { versionId: newId, hash }, now).run()
  return json(200, await view(env, await loadCommission(env, row.id, { creatorId: creator.creatorId }), 'creator'))
}

/**
 * POST /api/creator/commissions/:id/approve — body { versionId, contentHash }:
 * the exact terms on the creator's screen. Only the current, fan-accepted
 * version with the same hash and a priced custom request is approved, in one
 * statement, so an older version can never approve newer scope.
 */
export async function approveCommission(request: Request, env: Env, deps: Deps, creator: CreatorIdentity, id: string): Promise<Response> {
  const payload = await readJsonBody(request, 1_024)
  assertOnlyKeys(payload, ['versionId', 'contentHash'], 'invalid_request')
  const { versionId, contentHash } = payload
  if (typeof versionId !== 'string' || !UUID.test(versionId)) throw new ApiError(400, 'invalid_request', { field: 'versionId' })
  if (typeof contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(contentHash)) throw new ApiError(400, 'invalid_request', { field: 'contentHash' })

  const row = await loadCommission(env, id, { creatorId: creator.creatorId })
  const current = (await versionsOf(env, row.id)).find((v) => v.id === row.current_version_id)!
  const problem = approveProblem(
    row.status,
    {
      id: current.id,
      status: current.status,
      contentHash: current.content_hash,
      customRequest: (JSON.parse(current.terms_json) as StoredTerms).customRequest,
      customRequestPriceCents: current.custom_request_price_cents,
    },
    { versionId, contentHash },
  )
  if (problem) throw new ApiError(409, 'cannot_approve', { reason: problem, current: await view(env, row, 'creator') })

  const now = deps.now().toISOString()
  const result = await env.DB.prepare(
    `UPDATE commission SET status = 'approved', approved_version_id = ?, approved_hash = ?, approved_at = ?, decided_at = ?, updated_at = ?
      WHERE id = ? AND creator_id = ? AND status = 'in_review' AND current_version_id = ?
        AND EXISTS (SELECT 1 FROM commission_version
                     WHERE id = ? AND commission_id = ? AND status = 'accepted' AND content_hash = ?
                       AND (json_extract(terms_json, '$.customRequest') IS NULL OR custom_request_price_cents IS NOT NULL))`,
  )
    .bind(versionId, contentHash, now, now, now, row.id, creator.creatorId, versionId, versionId, row.id, contentHash)
    .run()
  if (result.meta.changes !== 1) await conflict(env, row.id, { creatorId: creator.creatorId }, 'creator')
  await audit(env, 'creator', creator.creatorId, 'commission_approved', row, { versionId, hash: contentHash }, now).run()
  return json(200, await view(env, await loadCommission(env, row.id, { creatorId: creator.creatorId }), 'creator'))
}

/** POST /api/creator/commissions/:id/decline — design 09. The internal note is never shown to the fan. */
export async function declineCommission(request: Request, env: Env, deps: Deps, creator: CreatorIdentity, id: string): Promise<Response> {
  const payload = await readJsonBody(request, 4_096)
  assertOnlyKeys(payload, ['reason', 'internalNote'], 'invalid_request')
  const reason = optionalMessage(payload.reason, 'reason')
  const internalNote = optionalMessage(payload.internalNote, 'internalNote')
  if (reason) assertCreatorText([reason])
  const row = await loadCommission(env, id, { creatorId: creator.creatorId })
  const now = deps.now().toISOString()
  const statements = [
    env.DB.prepare(
      `UPDATE commission SET status = 'declined', decided_at = ?, updated_at = ? WHERE id = ? AND creator_id = ? AND status IN ${OPEN_SQL}`,
    ).bind(now, now, row.id, creator.creatorId),
  ]
  if (reason) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO commission_message (id, commission_id, author_kind, kind, body, version_id, created_at)
         SELECT ?, ?, 'creator', 'decline_reason', ?, ?, ? WHERE changes() = 1`,
      ).bind(crypto.randomUUID(), row.id, reason, row.current_version_id, now),
    )
  }
  const results = await env.DB.batch(statements)
  if (results[0].meta.changes !== 1) await conflict(env, row.id, { creatorId: creator.creatorId }, 'creator')
  await audit(env, 'creator', creator.creatorId, 'commission_declined', row, internalNote ? { internalNote } : {}, now).run()
  return json(200, await view(env, await loadCommission(env, row.id, { creatorId: creator.creatorId }), 'creator'))
}

/**
 * POST /api/creator/commissions/:id/payment-reported — the creator says the
 * fan paid on the creator's own platform. Only after approval; always shown as
 * reported by the creator. No timer starts here (doc 10 §5).
 */
export async function reportPayment(env: Env, deps: Deps, creator: CreatorIdentity, id: string): Promise<Response> {
  const row = await loadCommission(env, id, { creatorId: creator.creatorId })
  const now = deps.now().toISOString()
  const result = await env.DB.prepare(
    `UPDATE commission SET payment_reported_at = ?, payment_reported_by = ?, updated_at = ?
      WHERE id = ? AND creator_id = ? AND status = 'approved' AND payment_reported_at IS NULL`,
  )
    .bind(now, creator.creatorId, now, row.id, creator.creatorId)
    .run()
  if (result.meta.changes !== 1) {
    const latest = await loadCommission(env, row.id, { creatorId: creator.creatorId })
    throw new ApiError(409, latest.status === 'approved' ? 'payment_already_reported' : 'not_approved', { status: latest.status })
  }
  await audit(env, 'creator', creator.creatorId, 'payment_reported', row, {}, now).run()
  return json(200, await view(env, await loadCommission(env, row.id, { creatorId: creator.creatorId }), 'creator'))
}
