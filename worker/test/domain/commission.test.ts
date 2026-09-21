import { describe, expect, it } from 'vitest'
import {
  actionsFor,
  allowedFrom,
  approveProblem,
  canonicalTerms,
  FINAL_STATUSES,
  OPEN_STATUSES,
  termsHash,
  transition,
  type CommissionStatus,
  type CommissionTerms,
  type VersionRef,
} from '../../../shared/domain/commission.ts'

const ALL: CommissionStatus[] = [...OPEN_STATUSES, ...FINAL_STATUSES]

describe('commission transitions', () => {
  it('follows doc 10 §5: question, proposal, approval, decline', () => {
    expect(transition('in_review', 'creator', 'ask')).toEqual({ ok: true, to: 'question_open' })
    expect(transition('question_open', 'fan', 'reply')).toEqual({ ok: true, to: 'in_review' })
    expect(transition('in_review', 'creator', 'propose')).toEqual({ ok: true, to: 'proposal_open' })
    expect(transition('proposal_open', 'fan', 'accept_proposal')).toEqual({ ok: true, to: 'in_review' })
    expect(transition('proposal_open', 'fan', 'reject_proposal')).toEqual({ ok: true, to: 'in_review' })
    expect(transition('in_review', 'creator', 'approve')).toEqual({ ok: true, to: 'approved' })
    expect(transition('question_open', 'creator', 'decline')).toEqual({ ok: true, to: 'declined' })
  })

  it('each side can only take its own actions', () => {
    expect(transition('in_review', 'fan', 'approve')).toEqual({ ok: false, reason: 'wrong_actor' })
    expect(transition('proposal_open', 'creator', 'accept_proposal')).toEqual({ ok: false, reason: 'wrong_actor' })
    expect(transition('in_review', 'creator', 'withdraw')).toEqual({ ok: false, reason: 'wrong_actor' })
    expect(transition('in_review', 'fan', 'withhold')).toEqual({ ok: false, reason: 'wrong_actor' })
  })

  it('the creator cannot approve while waiting on the fan', () => {
    expect(transition('question_open', 'creator', 'approve').ok).toBe(false)
    expect(transition('proposal_open', 'creator', 'approve').ok).toBe(false)
    expect(transition('proposal_open', 'creator', 'propose').ok).toBe(false)
  })

  it('the fan can withdraw only before a final decision', () => {
    for (const s of OPEN_STATUSES) expect(transition(s, 'fan', 'withdraw')).toEqual({ ok: true, to: 'withdrawn' })
    for (const s of FINAL_STATUSES) expect(transition(s, 'fan', 'withdraw').ok).toBe(false)
  })

  it('nothing leaves a final status', () => {
    for (const s of FINAL_STATUSES) {
      for (const actor of ['fan', 'creator', 'system'] as const) {
        for (const kind of ['reply', 'accept_proposal', 'reject_proposal', 'withdraw', 'ask', 'propose', 'approve', 'decline', 'withhold'] as const) {
          expect(transition(s, actor, kind).ok).toBe(false)
        }
      }
    }
  })

  it('a safety case can withhold any open request', () => {
    for (const s of OPEN_STATUSES) expect(transition(s, 'system', 'withhold')).toEqual({ ok: true, to: 'withheld' })
  })

  it('lists the actions each side has now', () => {
    expect(actionsFor('in_review', 'creator').sort()).toEqual(['approve', 'ask', 'decline', 'propose'])
    expect(actionsFor('in_review', 'fan')).toEqual(['withdraw'])
    expect(actionsFor('proposal_open', 'fan').sort()).toEqual(['accept_proposal', 'reject_proposal', 'withdraw'])
    expect(actionsFor('approved', 'fan')).toEqual([])
    expect(actionsFor('withheld', 'creator')).toEqual([])
  })

  it('allowedFrom matches transition for every status', () => {
    for (const kind of ['reply', 'withdraw', 'ask', 'approve', 'decline'] as const) {
      for (const s of ALL) {
        const actor = kind === 'reply' || kind === 'withdraw' ? 'fan' : 'creator'
        expect(allowedFrom(kind).includes(s)).toBe(transition(s, actor, kind).ok)
      }
    }
  })
})

describe('approval names the exact accepted version', () => {
  const v: VersionRef = { id: 'v2', status: 'accepted', contentHash: 'abc', customRequest: null, customRequestPriceCents: null }

  it('approves the current accepted version with its hash', () => {
    expect(approveProblem('in_review', v, { versionId: 'v2', contentHash: 'abc' })).toBeNull()
  })

  it('an older version cannot approve newer scope', () => {
    expect(approveProblem('in_review', v, { versionId: 'v1', contentHash: 'abc' })).toBe('version_not_current')
  })

  it('a version the fan has not accepted cannot be approved', () => {
    expect(approveProblem('in_review', { ...v, status: 'offered' }, { versionId: 'v2', contentHash: 'abc' })).toBe('version_not_accepted')
  })

  it('a changed hash is refused', () => {
    expect(approveProblem('in_review', v, { versionId: 'v2', contentHash: 'zzz' })).toBe('hash_mismatch')
  })

  it('a custom request must be priced first', () => {
    const custom = { ...v, customRequest: 'Hold a candle', customRequestPriceCents: null }
    expect(approveProblem('in_review', custom, { versionId: 'v2', contentHash: 'abc' })).toBe('custom_request_unpriced')
    expect(approveProblem('in_review', { ...custom, customRequestPriceCents: 1_000 }, { versionId: 'v2', contentHash: 'abc' })).toBeNull()
  })

  it('only while in review', () => {
    expect(approveProblem('proposal_open', v, { versionId: 'v2', contentHash: 'abc' })).toBe('not_in_review')
    expect(approveProblem('approved', v, { versionId: 'v2', contentHash: 'abc' })).toBe('not_in_review')
  })
})

describe('terms hash', () => {
  const terms: CommissionTerms = {
    catalogVersionId: 'cv_maya_1',
    selections: [
      { itemId: 'b', qty: 1 },
      { itemId: 'a', qty: 2 },
    ],
    customRequest: null,
    customRequestPriceCents: null,
    fanDisplayName: 'Sam',
    fanScript: null,
    totalCents: 14_500,
    deliveryDaysFromPayment: 7,
  }

  it('ignores selection order and key order', async () => {
    const reordered = {
      deliveryDaysFromPayment: 7,
      totalCents: 14_500,
      fanScript: null,
      fanDisplayName: 'Sam',
      customRequestPriceCents: null,
      customRequest: null,
      selections: [
        { qty: 2, itemId: 'a' },
        { qty: 1, itemId: 'b' },
      ],
      catalogVersionId: 'cv_maya_1',
    }
    expect(canonicalTerms(reordered)).toBe(canonicalTerms(terms))
    expect(await termsHash(reordered)).toBe(await termsHash(terms))
  })

  it('changes when any term changes', async () => {
    const h = await termsHash(terms)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(await termsHash({ ...terms, totalCents: 14_501 })).not.toBe(h)
    expect(await termsHash({ ...terms, selections: [{ itemId: 'a', qty: 1 }, { itemId: 'b', qty: 1 }] })).not.toBe(h)
    expect(await termsHash({ ...terms, fanDisplayName: 'Alex' })).not.toBe(h)
    expect(await termsHash({ ...terms, customRequestPriceCents: 0 })).not.toBe(h)
  })
})
