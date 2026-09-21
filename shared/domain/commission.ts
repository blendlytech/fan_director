/**
 * A commission request after the fan sends it (doc 10 §5, doc 11 §5.6 item 26).
 *
 *   in_review ──ask──▶ question_open ──reply──▶ in_review
 *   in_review ──propose──▶ proposal_open ──accept / reject──▶ in_review
 *   in_review ──approve──▶ approved          (the exact accepted version only)
 *   any open status ──decline──▶ declined     (creator)
 *   any open status ──withdraw──▶ withdrawn   (fan, before approval)
 *   any open status ──withhold──▶ withheld    (system: a `minors` safety case;
 *                                              the creator never sees it)
 *
 * Every version of the terms is immutable. Approval names a version AND its
 * content hash, so a newer version (a proposal, or anything else) can never
 * inherit an approval given to an older one. Payment is never a status: the
 * creator may report it after approval, and it is always shown as reported.
 *
 * Pure: no I/O. The worker applies each transition as one compare-and-set.
 */

import type { Cents, Selection } from './types.ts'

export type CommissionStatus =
  | 'in_review'
  | 'question_open'
  | 'proposal_open'
  | 'approved'
  | 'declined'
  | 'withdrawn'
  | 'withheld'

export const OPEN_STATUSES: readonly CommissionStatus[] = ['in_review', 'question_open', 'proposal_open']
export const FINAL_STATUSES: readonly CommissionStatus[] = ['approved', 'declined', 'withdrawn', 'withheld']

export type CommissionAction =
  | { actor: 'fan'; kind: 'reply' }
  | { actor: 'fan'; kind: 'accept_proposal' }
  | { actor: 'fan'; kind: 'reject_proposal' }
  | { actor: 'fan'; kind: 'withdraw' }
  | { actor: 'creator'; kind: 'ask' }
  | { actor: 'creator'; kind: 'propose' }
  | { actor: 'creator'; kind: 'approve' }
  | { actor: 'creator'; kind: 'decline' }
  | { actor: 'system'; kind: 'withhold' }

export type ActionKind = CommissionAction['kind']

/** Where each action goes, and from which statuses it's allowed. */
const TRANSITIONS: Record<ActionKind, { from: readonly CommissionStatus[]; to: CommissionStatus }> = {
  reply: { from: ['question_open'], to: 'in_review' },
  accept_proposal: { from: ['proposal_open'], to: 'in_review' },
  reject_proposal: { from: ['proposal_open'], to: 'in_review' },
  withdraw: { from: OPEN_STATUSES, to: 'withdrawn' },
  ask: { from: ['in_review'], to: 'question_open' },
  propose: { from: ['in_review'], to: 'proposal_open' },
  approve: { from: ['in_review'], to: 'approved' },
  decline: { from: OPEN_STATUSES, to: 'declined' },
  withhold: { from: OPEN_STATUSES, to: 'withheld' },
}

const ACTOR_OF: Record<ActionKind, CommissionAction['actor']> = {
  reply: 'fan',
  accept_proposal: 'fan',
  reject_proposal: 'fan',
  withdraw: 'fan',
  ask: 'creator',
  propose: 'creator',
  approve: 'creator',
  decline: 'creator',
  withhold: 'system',
}

export type TransitionResult = { ok: true; to: CommissionStatus } | { ok: false; reason: 'wrong_actor' | 'not_allowed_now' }

/** The status after `kind`, or why it can't happen from `from`. */
export function transition(from: CommissionStatus, actor: CommissionAction['actor'], kind: ActionKind): TransitionResult {
  if (ACTOR_OF[kind] !== actor) return { ok: false, reason: 'wrong_actor' }
  const t = TRANSITIONS[kind]
  if (!t.from.includes(from)) return { ok: false, reason: 'not_allowed_now' }
  return { ok: true, to: t.to }
}

/** The statuses `kind` may start from: the worker's compare-and-set uses exactly these. */
export function allowedFrom(kind: ActionKind): readonly CommissionStatus[] {
  return TRANSITIONS[kind].from
}

/** Which actions each side may take now, for the screens. */
export function actionsFor(status: CommissionStatus, actor: 'fan' | 'creator'): ActionKind[] {
  return (Object.keys(TRANSITIONS) as ActionKind[]).filter((k) => ACTOR_OF[k] === actor && TRANSITIONS[k].from.includes(status))
}

/* ------------------------------- Versions -------------------------------- */

export type VersionStatus = 'offered' | 'accepted' | 'rejected' | 'superseded'

/** The terms a version fixes: what a fan accepts and a creator approves. */
export interface CommissionTerms {
  catalogVersionId: string
  selections: Selection[]
  customRequest: string | null
  /** Set by the creator in a proposal; null means not priced yet. */
  customRequestPriceCents: Cents | null
  fanDisplayName: string | null
  fanScript: string | null
  /** The server's quote for the selections, plus the custom request price if set. */
  totalCents: Cents
  deliveryDaysFromPayment: number
}

export interface VersionRef {
  id: string
  status: VersionStatus
  contentHash: string
  customRequest: string | null
  customRequestPriceCents: Cents | null
}

export type ApproveProblem =
  | 'not_in_review'
  | 'version_not_current'
  | 'version_not_accepted'
  | 'hash_mismatch'
  | 'custom_request_unpriced'

/**
 * Whether the creator may approve `claim` (the version and hash on their
 * screen). Only the commission's current version, accepted by the fan, with
 * the same content hash, and with any custom request priced. Anything else
 * would let old terms approve new scope (doc 10 §7 Phase 4).
 */
export function approveProblem(
  status: CommissionStatus,
  currentVersion: VersionRef,
  claim: { versionId: string; contentHash: string },
): ApproveProblem | null {
  if (status !== 'in_review') return 'not_in_review'
  if (claim.versionId !== currentVersion.id) return 'version_not_current'
  if (currentVersion.status !== 'accepted') return 'version_not_accepted'
  if (claim.contentHash !== currentVersion.contentHash) return 'hash_mismatch'
  if (currentVersion.customRequest && currentVersion.customRequestPriceCents === null) return 'custom_request_unpriced'
  return null
}

/* -------------------------------- Hashing -------------------------------- */

/** JSON with object keys sorted at every level and selections in a fixed order. */
export function canonicalTerms(terms: CommissionTerms): string {
  const selections = [...terms.selections]
    .map((s) => ({ itemId: s.itemId, qty: s.qty }))
    .sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0))
  return canonicalJson({ ...terms, selections })
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

/** SHA-256 of the canonical terms, as lowercase hex. The same in the worker and the browser. */
export async function termsHash(terms: CommissionTerms): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalTerms(terms))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Message bodies (questions, answers, notes, decline reasons): design 06's limit. */
export const MESSAGE_MAX = 500
