import type { Quote } from '../../../shared/domain/types.ts'

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
