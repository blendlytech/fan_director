import { sessionToken } from '../auth/session'
import { CREATOR_ID } from '../state/catalog'
import type {
  CommissionView,
  CreatorCommissionSummary,
  DirectorReply,
  DirectorThread,
  FanCommissionSummary,
  ServerDraftContent,
  ServerDraftResponse,
} from './types'

/**
 * The staging API, as the fan's own session. Every call sends the Clerk
 * session token in the Authorization header (never in a URL or storage).
 * Errors come back as values, so callers decide what the fan sees.
 */

export type ApiResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: string; body: Record<string, unknown> }

async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  const token = await sessionToken()
  if (!token) return { ok: false, status: 401, error: 'signed_out', body: {} }
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return { ok: false, status: 0, error: 'network', body: {} }
  }
  let parsed: Record<string, unknown> = {}
  try {
    parsed = (await res.json()) as Record<string, unknown>
  } catch {
    parsed = {}
  }
  if (res.ok) return { ok: true, status: res.status, body: parsed as T }
  return { ok: false, status: res.status, error: typeof parsed.error === 'string' ? parsed.error : `http_${res.status}`, body: parsed }
}

const drafts = `/api/creators/${CREATOR_ID}/drafts`

export const api = {
  latestDraft: () => call<{ draft: null } | ServerDraftResponse>('GET', drafts),
  saveDraft: (draftId: string, expectedRevision: number, catalogVersionId: string, draft: ServerDraftContent, signal?: AbortSignal) =>
    call<ServerDraftResponse>('PUT', `${drafts}/${draftId}`, { expectedRevision, catalogVersionId, draft }, signal),
  acceptCatalogVersion: (draftId: string, expectedRevision: number, catalogVersionId: string) =>
    call<ServerDraftResponse>('POST', `${drafts}/${draftId}/accept-catalog-version`, { expectedRevision, catalogVersionId }),
  director: (draftId: string) => call<DirectorThread>('GET', `${drafts}/${draftId}/director`),
  directorTurn: (draftId: string, requestId: string, expectedRevision: number, message: string) =>
    call<DirectorReply>('POST', `${drafts}/${draftId}/director`, { requestId, expectedRevision, message }),
  acceptSuggestion: (draftId: string, suggestionId: string, expectedRevision: number) =>
    call<ServerDraftResponse>('POST', `${drafts}/${draftId}/director/suggestions/${suggestionId}/accept`, { expectedRevision }),
  declineSuggestion: (draftId: string, suggestionId: string) =>
    call<{ id: string; status: string }>('POST', `${drafts}/${draftId}/director/suggestions/${suggestionId}/decline`, {}),

  // Phase 4: sending, and the fan's side of a sent request.
  submit: (draftId: string, clientRequestId: string, expectedRevision: number, catalogVersionId: string) =>
    call<CommissionView>('POST', `${drafts}/${draftId}/submit`, { clientRequestId, expectedRevision, catalogVersionId }),
  myRequests: () => call<{ commissions: FanCommissionSummary[] }>('GET', '/api/commissions'),
  myRequest: (id: string) => call<CommissionView>('GET', `/api/commissions/${encodeURIComponent(id)}`),
  reply: (id: string, body: string) => call<CommissionView>('POST', `/api/commissions/${encodeURIComponent(id)}/reply`, { body }),
  acceptProposal: (id: string, versionId: string, contentHash: string) =>
    call<CommissionView>('POST', `/api/commissions/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/accept`, { contentHash }),
  rejectProposal: (id: string, versionId: string) =>
    call<CommissionView>('POST', `/api/commissions/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/reject`, {}),
  withdraw: (id: string) => call<CommissionView>('POST', `/api/commissions/${encodeURIComponent(id)}/withdraw`, {}),
}

const creatorBase = '/api/creator/commissions'

/** The creator's side (designs 03, 05, 06, 09). Creator calls need a second factor this session. */
export const creatorApi = {
  queue: (status?: string) =>
    call<{ commissions: CreatorCommissionSummary[]; counts: Record<string, number> }>('GET', status ? `${creatorBase}?status=${encodeURIComponent(status)}` : creatorBase),
  request: (id: string) => call<CommissionView>('GET', `${creatorBase}/${encodeURIComponent(id)}`),
  ask: (id: string, body: string) => call<CommissionView>('POST', `${creatorBase}/${encodeURIComponent(id)}/question`, { body }),
  propose: (id: string, expectedVersionId: string, selections: { itemId: string; qty: number }[], customRequestPriceCents: number | null, note: string | null) =>
    call<CommissionView>('POST', `${creatorBase}/${encodeURIComponent(id)}/propose`, { expectedVersionId, selections, customRequestPriceCents, note }),
  approve: (id: string, versionId: string, contentHash: string) =>
    call<CommissionView>('POST', `${creatorBase}/${encodeURIComponent(id)}/approve`, { versionId, contentHash }),
  decline: (id: string, reason: string | null, internalNote: string | null) =>
    call<CommissionView>('POST', `${creatorBase}/${encodeURIComponent(id)}/decline`, { reason, internalNote }),
  reportPayment: (id: string) => call<CommissionView>('POST', `${creatorBase}/${encodeURIComponent(id)}/payment-reported`, {}),
}
