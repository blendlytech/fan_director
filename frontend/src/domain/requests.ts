import type { CommissionVersion, CommissionView } from '../api/types'

/* Reading a sent request (Phase 4): which version is which, and what changed. */

export function currentVersion(view: CommissionView): CommissionVersion | undefined {
  return view.versions.find((v) => v.id === view.commission.currentVersionId)
}

/** The version the fan last accepted (theirs at first, a proposal once accepted). */
export function lastAccepted(view: CommissionView): CommissionVersion | undefined {
  return [...view.versions].reverse().find((v) => v.status === 'accepted')
}

/** The proposal waiting on the fan, if any. */
export function openProposal(view: CommissionView): CommissionVersion | undefined {
  if (view.commission.status !== 'proposal_open') return undefined
  const v = currentVersion(view)
  return v?.status === 'offered' ? v : undefined
}

export interface LineChange {
  kind: 'added' | 'removed' | 'changed'
  label: string
  before: number | null
  after: number | null
}

/**
 * What a proposal changes, line by line, from the two server quotes. Lines
 * that cost nothing on both sides are left out; every amount is a quote line.
 */
export function diffVersions(before: CommissionVersion, after: CommissionVersion): LineChange[] {
  const out: LineChange[] = []
  const was = new Map(before.quote.lines.map((l) => [l.itemId, l]))
  const now = new Map(after.quote.lines.map((l) => [l.itemId, l]))
  for (const [id, line] of now) {
    const old = was.get(id)
    if (!old) out.push({ kind: 'added', label: line.label, before: null, after: line.amount })
    else if (old.qty !== line.qty || old.amount !== line.amount) {
      out.push({ kind: 'changed', label: line.qty > 1 ? `${line.label} × ${line.qty}` : line.label, before: old.amount, after: line.amount })
    }
  }
  for (const [id, line] of was) {
    if (!now.has(id)) out.push({ kind: 'removed', label: line.label, before: line.amount, after: null })
  }
  if (before.customRequestPriceCents !== after.customRequestPriceCents && after.terms.customRequest) {
    out.push({ kind: 'changed', label: 'Custom request', before: before.customRequestPriceCents, after: after.customRequestPriceCents })
  }
  return out.filter((c) => (c.before ?? 0) !== 0 || (c.after ?? 0) !== 0 || c.kind === 'changed')
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
