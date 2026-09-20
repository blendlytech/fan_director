import { describe, expect, it } from 'vitest'
import type { CommissionVersion, CommissionView } from '../api/types'
import { currentVersion, diffVersions, formatDate, lastAccepted, openProposal } from './requests'

/* -------------------------------------------------------------------------- */
/*  Reading a sent request: which version the screens show, and what a         */
/*  proposal changed. Both sides depend on this: the fan accepts a version,    */
/*  the creator approves one, and they have to be the same one.                */
/* -------------------------------------------------------------------------- */

type Line = { itemId: string; label: string; qty: number; amount: number }

function version(seq: number, opts: Partial<CommissionVersion> & { lines?: Line[]; total?: number }): CommissionVersion {
  const lines = opts.lines ?? []
  const total = opts.total ?? lines.reduce((sum, l) => sum + l.amount, 0)
  return {
    id: opts.id ?? `v${seq}`,
    seq,
    author: opts.author ?? 'fan',
    status: opts.status ?? 'accepted',
    catalogVersionId: 'cat_1',
    terms: {
      catalogVersionId: 'cat_1',
      selections: lines.map((l) => ({ itemId: l.itemId, qty: l.qty })),
      customRequest: opts.terms?.customRequest ?? null,
      customRequestPriceCents: opts.customRequestPriceCents ?? null,
      fanDisplayName: null,
      fanScript: null,
      totalCents: total,
      deliveryDaysFromPayment: 7,
      notes: [],
    },
    quote: {
      catalogVersionId: 'cat_1',
      lines: lines.map((l) => ({ ...l, key: l.itemId, categoryKey: 'c', groupKey: null, pricingKind: 'fixed' as const })),
      total,
      budgetDifference: null,
      minutes: 5,
      deliveryDaysFromPayment: 7,
      customRequestPending: false,
    },
    customRequestPriceCents: opts.customRequestPriceCents ?? null,
    contentHash: opts.contentHash ?? `hash-${seq}`,
    fanAcceptedAt: opts.fanAcceptedAt ?? null,
    createdAt: `2026-09-1${seq}T10:00:00.000Z`,
  }
}

function view(versions: CommissionVersion[], status: CommissionView['commission']['status'], currentId?: string): CommissionView {
  return {
    commission: {
      id: 'c1',
      creatorId: 'cr_maya',
      creatorName: 'Maya',
      status,
      currentVersionId: currentId ?? versions[versions.length - 1].id,
      approvedVersionId: null,
      approvedAt: null,
      decidedAt: null,
      payment: null,
      actions: [],
      createdAt: '2026-09-10T10:00:00.000Z',
      updatedAt: '2026-09-12T10:00:00.000Z',
    },
    versions,
    messages: [],
  }
}

const base = [
  { itemId: 'setting', label: 'Vintage Lounge', qty: 1, amount: 9_000 },
  { itemId: 'greeting', label: 'Greeting', qty: 1, amount: 2_000 },
]

describe('which version a screen shows', () => {
  it('finds the current one by id, not by position', () => {
    const v1 = version(1, { lines: base, status: 'superseded' })
    const v2 = version(2, { lines: base, status: 'offered', author: 'creator' })
    expect(currentVersion(view([v1, v2], 'proposal_open', 'v1'))?.id).toBe('v1')
  })

  it('takes the latest version the fan accepted, not the latest version', () => {
    const v1 = version(1, { lines: base, status: 'superseded' })
    const v2 = version(2, { lines: base, status: 'accepted' })
    const v3 = version(3, { lines: base, status: 'offered', author: 'creator' })
    expect(lastAccepted(view([v1, v2, v3], 'proposal_open'))?.id).toBe('v2')
  })

  it('shows a proposal only while the request is actually waiting on the fan', () => {
    const v1 = version(1, { lines: base, status: 'accepted' })
    const v2 = version(2, { lines: base, status: 'offered', author: 'creator' })
    expect(openProposal(view([v1, v2], 'proposal_open'))?.id).toBe('v2')
    // The same versions, after the creator withdrew the request from review.
    expect(openProposal(view([v1, v2], 'in_review'))).toBeUndefined()
    // A current version the fan already accepted is not an open proposal.
    expect(openProposal(view([v1, version(2, { lines: base, status: 'accepted' })], 'proposal_open'))).toBeUndefined()
  })
})

describe('what a proposal changed', () => {
  it('names added, removed and changed lines with both amounts', () => {
    const before = version(1, { lines: base })
    const after = version(2, {
      author: 'creator',
      status: 'offered',
      lines: [
        { itemId: 'setting', label: 'Vintage Lounge', qty: 1, amount: 9_000 },
        { itemId: 'minutes', label: 'Extra minute', qty: 2, amount: 8_000 },
      ],
    })
    const changes = diffVersions(before, after)
    expect(changes).toContainEqual({ kind: 'added', label: 'Extra minute', before: null, after: 8_000 })
    expect(changes).toContainEqual({ kind: 'removed', label: 'Greeting', before: 2_000, after: null })
    // An unchanged line is not reported as a change.
    expect(changes.some((c) => c.label === 'Vintage Lounge')).toBe(false)
  })

  it('reports a quantity change on the same item, with its new label', () => {
    const before = version(1, { lines: [{ itemId: 'minutes', label: 'Extra minute', qty: 1, amount: 4_000 }] })
    const after = version(2, { lines: [{ itemId: 'minutes', label: 'Extra minute', qty: 3, amount: 12_000 }] })
    expect(diffVersions(before, after)).toEqual([
      { kind: 'changed', label: 'Extra minute × 3', before: 4_000, after: 12_000 },
    ])
  })

  it('reports the creator pricing a custom request as a change', () => {
    const before = version(1, { lines: base, terms: { customRequest: 'A birthday message' } as never })
    const after = version(2, {
      lines: base,
      author: 'creator',
      status: 'offered',
      customRequestPriceCents: 4_500,
      terms: { customRequest: 'A birthday message' } as never,
    })
    expect(diffVersions(before, after)).toContainEqual({ kind: 'changed', label: 'Custom request', before: null, after: 4_500 })
  })

  it('finds nothing to report when the versions match', () => {
    expect(diffVersions(version(1, { lines: base }), version(2, { lines: base }))).toEqual([])
  })
})

describe('dates', () => {
  it('formats a server timestamp, and shows nothing for a missing one', () => {
    expect(formatDate('2026-09-18T10:00:00.000Z')).toMatch(/Sep 1[78], 2026/)
    expect(formatDate('')).toBe('')
  })
})
