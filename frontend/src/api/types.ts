import type { BoundaryFlag, Quote } from '../../../shared/domain/types.ts'

/**
 * The shapes the staging API returns for drafts and the AI Director (doc 11
 * §8 Phase 3). Every sentence in a Director reply was written by the server
 * from fixed templates (director-copy-v1); money is integer cents from the
 * server's quote and is only formatted here, never computed.
 */

export interface AskFirstNotice {
  limit: string
  heading: string
  body: string
  accept: string
  decline: string
  footnote: string
}

export interface DirectorSuggestion {
  id: string
  title: string
  adds: { label: string; qty: number; before: number }[]
  removes: { label: string }[]
  /** New estimate minus the current one, cents. Negative when it costs less. */
  deltaCents: number
  newTotalCents: number
  /** Budget minus the new estimate, cents; null without a budget. */
  budgetDifferenceCents: number | null
  /** Design 13 C1: a limit the creator must OK. Empty for an ordinary suggestion. */
  askFirst: AskFirstNotice[]
}

export interface DirectorReply {
  requestId: string
  draftRevision: number
  repliesLeft: number
  copyVersion: string
  /** The intro sentence, or null when the reply is only a question or a notice. */
  reply: string | null
  suggestions: DirectorSuggestion[]
  footer: string | null
  notOffered: { heading: string; body: string }[]
  customRequest: { text: string; offer: string; accept: string; decline: string } | null
  clarifyingQuestion: string | null
}

export interface DirectorThread {
  available: boolean
  reason: string | null
  repliesLeft: number
  draftRevision: number
  turns: { requestId: string; createdAt: string; fanMessage: string; response: DirectorReply | null }[]
  suggestionStatus: Record<string, 'offered' | 'accepted' | 'declined' | 'out_of_date'>
}

export type SuggestionOutcomeKind = 'accepted' | 'declined' | 'out_of_date'

export interface ServerSelection {
  itemId: string
  qty: number
}

export interface ServerDraftContent {
  selections: ServerSelection[]
  fanDisplayName: string | null
  customRequest: string | null
  fanScript: string | null
  notes: { id: number; text: string }[]
  budget: number | null
}

/** The server's quote: the shared contract (shared/domain/types.ts), computed on the server only. */
export type ServerQuote = Quote
export type ServerQuoteLine = Quote['lines'][number]

/* ------------------------- Phase 4: sent requests ------------------------ */

/** As the fan sees it: a withheld request shows as "closed" and nothing says why. */
export type CommissionStatus =
  | 'in_review'
  | 'question_open'
  | 'proposal_open'
  | 'approved'
  | 'declined'
  | 'withdrawn'
  | 'closed'

export interface CommissionTerms {
  catalogVersionId: string
  selections: ServerSelection[]
  customRequest: string | null
  customRequestPriceCents: number | null
  fanDisplayName: string | null
  fanScript: string | null
  totalCents: number
  deliveryDaysFromPayment: number
  notes: { id: number; text: string }[]
}

export interface CommissionVersion {
  id: string
  seq: number
  author: 'fan' | 'creator'
  status: 'offered' | 'accepted' | 'rejected' | 'superseded'
  catalogVersionId: string
  terms: CommissionTerms
  quote: ServerQuote
  customRequestPriceCents: number | null
  contentHash: string
  fanAcceptedAt: string | null
  createdAt: string
  /** Creator view only: ask-me flags. */
  boundaryFlags?: BoundaryFlag[]
}

export interface CommissionMessage {
  id: string
  authorKind: 'fan' | 'creator'
  kind: 'question' | 'answer' | 'proposal_note' | 'decline_reason'
  body: string
  versionId: string | null
  createdAt: string
}

/** Reported by the creator, never confirmed by the platform. */
export interface ReportedPayment {
  creatorReported: true
  reportedAt: string
}

export interface CommissionView {
  commission: {
    id: string
    creatorId: string
    creatorName: string
    status: CommissionStatus
    currentVersionId: string
    approvedVersionId: string | null
    approvedAt: string | null
    decidedAt: string | null
    payment: ReportedPayment | null
    /** What this side may do now (shared/domain/commission.ts actionsFor). */
    actions: string[]
    createdAt: string
    updatedAt: string
  }
  versions: CommissionVersion[]
  messages: CommissionMessage[]
}

export interface FanCommissionSummary {
  id: string
  creatorId: string
  creatorName: string
  status: CommissionStatus
  totalCents: number
  waitingOnYou: boolean
  payment: ReportedPayment | null
  createdAt: string
  updatedAt: string
}

export interface CreatorCommissionSummary {
  id: string
  status: CommissionStatus
  /** What the fan asked to be called; not a verified identity. */
  fanName: string | null
  totalCents: number
  customRequest: boolean
  customRequestPriced: boolean
  askFirst: number
  payment: ReportedPayment | null
  createdAt: string
  updatedAt: string
}

export interface ServerDraftResponse {
  draft: ServerDraftContent & {
    id: string
    creatorId: string
    catalogVersionId: string
    revision: number
    boundaryFlags: unknown[]
  }
  quote: ServerQuote | null
  stale: boolean
  /** When the catalog has a newer version: what the draft would cost under it. */
  current?: { catalogVersionId: string; ok: boolean; quote?: ServerQuote; error?: string } | null
  updatedAt: string
}
