import { quote } from '../../../shared/domain/quote.ts'
import type { Quote, Selection } from '../../../shared/domain/types.ts'
import type { CommissionMessage, CommissionVersion, CommissionView, CreatorCommissionSummary } from '../api/types'
import { STAGING_INITIAL_VIEW as view } from '../state/catalog'
import { INITIAL_DRAFT, selectionsOf } from '../domain/sceneCard'

/* -------------------------------------------------------------------------- */
/*  Fixtures for the creator preview (dev only, never in a production build).  */
/*                                                                            */
/*  Every figure is priced by the shared quote module on Maya's pilot          */
/*  catalog, the same code the worker prices with, so the screenshots show     */
/*  amounts the real screens could show. Nothing here is seeded anywhere.      */
/* -------------------------------------------------------------------------- */

const GATE = { adultAllowed: false }
const BASE: Selection[] = selectionsOf(view, INITIAL_DRAFT)

function priced(selections: Selection[]): Quote {
  const result = quote(view.content, view.versionId, { selections, customRequest: null, budget: null }, GATE)
  if (!result.ok) throw new Error(`preview fixture doesn't price: ${result.error.code}`)
  return result.value
}

/** A per-unit item to add in the "proposed changes" fixture, if the catalog has one. */
function extraMinute(): Selection | null {
  for (const category of view.content.categories) {
    for (const item of category.items) {
      if (!item.hidden && item.pricing.kind === 'per_unit') return { itemId: item.id, qty: 2 }
    }
  }
  return null
}

const hash = (n: number) => String(n).repeat(64).slice(0, 64).replace(/\D/g, '0').padEnd(64, 'a')

export function makeVersion(opts: {
  seq: number
  selections: Selection[]
  author?: 'fan' | 'creator'
  status?: CommissionVersion['status']
  customRequest?: string | null
  customRequestPriceCents?: number | null
  fanDisplayName?: string | null
  fanScript?: string | null
  notes?: { id: number; text: string }[]
  askFirst?: CommissionVersion['boundaryFlags']
  createdAt?: string
}): CommissionVersion {
  const q = priced(opts.selections)
  const price = opts.customRequestPriceCents ?? null
  return {
    id: `11111111-1111-4111-8111-00000000000${opts.seq}`,
    seq: opts.seq,
    author: opts.author ?? 'fan',
    status: opts.status ?? 'accepted',
    catalogVersionId: view.versionId,
    terms: {
      catalogVersionId: view.versionId,
      selections: opts.selections,
      customRequest: opts.customRequest ?? null,
      customRequestPriceCents: price,
      fanDisplayName: opts.fanDisplayName ?? 'Sam',
      fanScript: opts.fanScript ?? null,
      totalCents: q.total + (price ?? 0),
      deliveryDaysFromPayment: q.deliveryDaysFromPayment,
      notes: opts.notes ?? [],
    },
    quote: q,
    customRequestPriceCents: price,
    contentHash: hash(opts.seq),
    fanAcceptedAt: (opts.status ?? 'accepted') === 'accepted' ? '2026-09-18T09:00:00.000Z' : null,
    createdAt: opts.createdAt ?? '2026-09-18T09:00:00.000Z',
    boundaryFlags: opts.askFirst ?? [],
  }
}

function message(id: string, authorKind: 'fan' | 'creator', kind: CommissionMessage['kind'], body: string, at: string): CommissionMessage {
  return { id, authorKind, kind, body, versionId: null, createdAt: at }
}

function commission(
  id: string,
  status: CommissionView['commission']['status'],
  versions: CommissionVersion[],
  messages: CommissionMessage[],
  extra: Partial<CommissionView['commission']> = {},
): CommissionView {
  return {
    commission: {
      id,
      creatorId: 'cr_maya',
      creatorName: 'Maya',
      status,
      currentVersionId: versions[versions.length - 1].id,
      approvedVersionId: null,
      approvedAt: null,
      decidedAt: null,
      payment: null,
      actions: actionsFor(status),
      createdAt: '2026-09-18T09:00:00.000Z',
      updatedAt: '2026-09-18T11:00:00.000Z',
      ...extra,
    },
    versions,
    messages,
  }
}

/** The same table as shared/domain/commission.ts, for the side that's looking. */
export function actionsFor(status: CommissionView['commission']['status'], side: 'creator' | 'fan' = 'creator'): string[] {
  if (side === 'fan') {
    switch (status) {
      case 'in_review':
        return ['withdraw']
      case 'question_open':
        return ['reply', 'withdraw']
      case 'proposal_open':
        return ['accept_proposal', 'reject_proposal', 'withdraw']
      default:
        return []
    }
  }
  switch (status) {
    case 'in_review':
      return ['ask', 'propose', 'approve', 'decline']
    case 'question_open':
    case 'proposal_open':
      return ['decline']
    default:
      return []
  }
}

/** The same record as the fan sees it: no ask-me flags, and the fan's own actions. */
export function asFan(view: CommissionView): CommissionView {
  return {
    ...view,
    commission: { ...view.commission, actions: actionsFor(view.commission.status, 'fan') },
    versions: view.versions.map(({ boundaryFlags: _flags, ...rest }) => rest),
  }
}

export function fanSummaryOf(view_: CommissionView) {
  const current = view_.versions.find((v) => v.id === view_.commission.currentVersionId)!
  return {
    id: view_.commission.id,
    creatorId: view_.commission.creatorId,
    creatorName: view_.commission.creatorName,
    status: view_.commission.status,
    totalCents: current.terms.totalCents,
    waitingOnYou: view_.commission.status === 'question_open' || view_.commission.status === 'proposal_open',
    payment: view_.commission.payment,
    createdAt: view_.commission.createdAt,
    updatedAt: view_.commission.updatedAt,
  }
}

const withScript: Selection[] = BASE
const proposed: Selection[] = extraMinute() ? [...BASE.filter((s) => s.itemId !== extraMinute()!.itemId), extraMinute()!] : BASE

/** Distinct in their first eight characters, because that is the reference a screen shows. */
export const PREVIEW_IDS = {
  needsDecision: 'a1d04e21-2222-4222-8222-222222222221',
  questionOpen: 'b7c39f08-2222-4222-8222-222222222222',
  proposalOpen: 'c2e58a44-2222-4222-8222-222222222223',
  approved: 'd9f61b30-2222-4222-8222-222222222224',
  paid: 'e4a72c19-2222-4222-8222-222222222225',
  declined: 'f60b83d5-2222-4222-8222-222222222226',
} as const

/** A fresh set on every call, so the preview's own edits never leak between reloads. */
export function previewCommissions(): Record<string, CommissionView> {
  const needsDecision = commission(
    PREVIEW_IDS.needsDecision,
    'in_review',
    [
      makeVersion({
        seq: 1,
        selections: withScript,
        customRequest: 'Could you mention that it’s our anniversary, near the end?',
        fanScript: 'Hi Sam — thank you for a wonderful year.',
        notes: [{ id: 1, text: 'Please keep the lighting warm, like your vintage set.' }],
        askFirst: [{ source: 'custom_request', limit: { kind: 'checklist', key: 'no_brand_mentions' }, mode: 'ask_me' }],
      }),
    ],
    [],
  )

  const questionOpen = commission(
    PREVIEW_IDS.questionOpen,
    'question_open',
    [makeVersion({ seq: 1, selections: BASE, fanDisplayName: 'Alex' })],
    [message('m1', 'creator', 'question', 'Would you like the greeting at the start or the end?', '2026-09-18T10:00:00.000Z')],
  )

  const proposalOpen = commission(
    PREVIEW_IDS.proposalOpen,
    'proposal_open',
    [
      makeVersion({ seq: 1, selections: BASE, status: 'accepted' }),
      makeVersion({ seq: 2, selections: proposed, author: 'creator', status: 'offered', createdAt: '2026-09-18T11:00:00.000Z' }),
    ],
    [message('m2', 'creator', 'proposal_note', 'Two extra minutes give the scene room to breathe.', '2026-09-18T11:00:00.000Z')],
  )

  const approvedVersion = makeVersion({ seq: 1, selections: BASE, fanDisplayName: 'Jordan' })
  const approved = commission(PREVIEW_IDS.approved, 'approved', [approvedVersion], [], {
    approvedVersionId: approvedVersion.id,
    approvedAt: '2026-09-18T12:00:00.000Z',
    decidedAt: '2026-09-18T12:00:00.000Z',
  })

  const paidVersion = makeVersion({ seq: 1, selections: BASE, fanDisplayName: 'Riley' })
  const paid = commission(PREVIEW_IDS.paid, 'approved', [paidVersion], [], {
    approvedVersionId: paidVersion.id,
    approvedAt: '2026-09-17T12:00:00.000Z',
    decidedAt: '2026-09-17T12:00:00.000Z',
    payment: { creatorReported: true, reportedAt: '2026-09-18T08:00:00.000Z' },
  })

  const declined = commission(
    PREVIEW_IDS.declined,
    'declined',
    [makeVersion({ seq: 1, selections: BASE, fanDisplayName: 'Casey' })],
    [message('m3', 'creator', 'decline_reason', 'I’m not shooting this month — please do send it again in October.', '2026-09-18T12:30:00.000Z')],
    { decidedAt: '2026-09-18T12:30:00.000Z' },
  )

  return { needsDecision, questionOpen, proposalOpen, approved, paid, declined }
}

export function summaryOf(view_: CommissionView): CreatorCommissionSummary {
  const current = view_.versions.find((v) => v.id === view_.commission.currentVersionId)!
  return {
    id: view_.commission.id,
    status: view_.commission.status,
    fanName: current.terms.fanDisplayName,
    totalCents: current.terms.totalCents,
    customRequest: current.terms.customRequest !== null,
    customRequestPriced: current.customRequestPriceCents !== null,
    askFirst: current.boundaryFlags?.length ?? 0,
    payment: view_.commission.payment,
    createdAt: view_.commission.createdAt,
    updatedAt: view_.commission.updatedAt,
  }
}
