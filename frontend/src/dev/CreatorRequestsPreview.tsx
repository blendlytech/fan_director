import { useMemo, useState } from 'react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { quote } from '../../../shared/domain/quote.ts'
import type { Selection } from '../../../shared/domain/types.ts'
import type { CommissionView } from '../api/types'
import { updateSession } from '../auth/session'
import { CatalogContext } from '../state/catalog'
import { STAGING_INITIAL_VIEW } from '../state/catalog'
import { CreatorAskModal } from '../pages/creator/CreatorAskModal'
import { CreatorDeclineModal } from '../pages/creator/CreatorDeclineModal'
import { CreatorQueue } from '../pages/creator/CreatorQueue'
import { CreatorRequest } from '../pages/creator/CreatorRequest'
import { MyRequestDetail } from '../pages/MyRequestDetail'
import { MyRequests } from '../pages/MyRequests'
import { actionsFor, asFan, fanSummaryOf, makeVersion, PREVIEW_IDS, previewCommissions, summaryOf } from './creatorFixtures'

/* -------------------------------------------------------------------------- */
/*  The creator's Phase 4 screens (designs 03, 05, 06, 09) in the dev server,  */
/*  for browser checks at 375, 768 and 1280 px.                               */
/*                                                                            */
/*  It mounts the real pages and answers their API calls from fixtures held   */
/*  in memory, because a real creator session needs the owner's authenticator. */
/*  So this proves layout, wording and flow — not authorization, which the     */
/*  worker's own tests and the signed-in staging run cover. Dev only: the      */
/*  production build never imports this file.                                  */
/* -------------------------------------------------------------------------- */

const GATE = { adultAllowed: false }

type Store = Record<string, CommissionView>

/** Answers the creator API from `store`, and applies each decision to it. */
function install(store: Store): () => void {
  const real = window.fetch.bind(window)
  const find = (id: string) => Object.values(store).find((c) => c.commission.id === id)
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
    const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0]

    // The fan's side of the same fixtures, for the /requests screens.
    if (path === '/api/commissions') return reply({ commissions: Object.values(store).map(fanSummaryOf) })
    if (path.startsWith('/api/commissions/')) {
      const rest = path.slice('/api/commissions/'.length)
      const [id, ...action] = rest.split('/')
      const found = find(id)
      if (!found) return reply({ error: 'not_found' }, 404)
      if (action.length > 0) return reply({ error: 'not_supported_in_preview' }, 409)
      return reply(asFan(found))
    }

    if (!path.startsWith('/api/creator/commissions')) return real(input as RequestInfo, init)

    const rest = path.slice('/api/creator/commissions'.length).replace(/^\//, '')
    if (rest === '') {
      const commissions = Object.values(store).map(summaryOf)
      const counts: Record<string, number> = {}
      for (const c of commissions) counts[c.status] = (counts[c.status] ?? 0) + 1
      return reply({ commissions, counts })
    }

    const [id, action] = rest.split('/')
    const found = find(id)
    if (!found) return reply({ error: 'not_found' }, 404)
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
    const now = new Date().toISOString()
    const key = Object.keys(store).find((k) => store[k].commission.id === id)!
    const next = decide(found, action, body, now)
    if (!next.ok) return reply(next.body, next.status)
    store[key] = next.view
    return reply(next.view)
  }

  return () => {
    window.fetch = real
  }
}

type Decision = { ok: true; view: CommissionView } | { ok: false; status: number; body: unknown }

/** The worker's own rules, in miniature, so the preview can't show a state the server wouldn't. */
function decide(view: CommissionView, action: string | undefined, body: Record<string, unknown>, now: string): Decision {
  const c = view.commission
  const current = view.versions.find((v) => v.id === c.currentVersionId)!
  const withStatus = (status: CommissionView['commission']['status'], extra: Partial<CommissionView['commission']> = {}, versions = view.versions, messages = view.messages) => ({
    ok: true as const,
    view: { ...view, commission: { ...c, status, actions: actionsFor(status), updatedAt: now, ...extra }, versions, messages },
  })

  switch (action) {
    case undefined:
      return { ok: true, view }
    case 'question':
      if (c.status !== 'in_review') return { ok: false, status: 409, body: { error: 'commission_changed' } }
      return withStatus('question_open', {}, view.versions, [
        ...view.messages,
        { id: `m${view.messages.length + 1}`, authorKind: 'creator', kind: 'question', body: String(body.body), versionId: current.id, createdAt: now },
      ])
    case 'propose': {
      if (c.status !== 'in_review') return { ok: false, status: 409, body: { error: 'commission_changed' } }
      const selections = body.selections as Selection[]
      const price = (body.customRequestPriceCents as number | null) ?? null
      const q = quote(STAGING_INITIAL_VIEW.content, STAGING_INITIAL_VIEW.versionId, { selections, customRequest: null, budget: null }, GATE)
      if (!q.ok) return { ok: false, status: 422, body: { error: 'proposal_invalid' } }
      const version = makeVersion({
        seq: current.seq + 1,
        selections,
        author: 'creator',
        status: 'offered',
        customRequest: current.terms.customRequest,
        customRequestPriceCents: price,
        fanDisplayName: current.terms.fanDisplayName,
        createdAt: now,
      })
      const messages = body.note
        ? [...view.messages, { id: `m${view.messages.length + 1}`, authorKind: 'creator' as const, kind: 'proposal_note' as const, body: String(body.note), versionId: version.id, createdAt: now }]
        : view.messages
      return withStatus('proposal_open', { currentVersionId: version.id }, [...view.versions.map((v) => ({ ...v, status: 'superseded' as const })), version], messages)
    }
    case 'approve':
      // The rule this screen exists to respect: the exact version, with its hash.
      if (c.status !== 'in_review' || body.versionId !== current.id || body.contentHash !== current.contentHash) {
        return { ok: false, status: 409, body: { error: 'cannot_approve', reason: 'version_not_current' } }
      }
      if (current.terms.customRequest && current.customRequestPriceCents === null) {
        return { ok: false, status: 409, body: { error: 'cannot_approve', reason: 'custom_request_unpriced' } }
      }
      return withStatus('approved', { approvedVersionId: current.id, approvedAt: now, decidedAt: now })
    case 'decline':
      return withStatus('declined', { decidedAt: now }, view.versions, body.reason
        ? [...view.messages, { id: `m${view.messages.length + 1}`, authorKind: 'creator', kind: 'decline_reason', body: String(body.reason), versionId: current.id, createdAt: now }]
        : view.messages)
    case 'payment-reported':
      if (c.status !== 'approved') return { ok: false, status: 409, body: { error: 'not_approved' } }
      if (c.payment) return { ok: false, status: 409, body: { error: 'payment_already_reported' } }
      return withStatus('approved', { payment: { creatorReported: true, reportedAt: now } })
    default:
      return { ok: false, status: 404, body: { error: 'not_found' } }
  }
}

const SCENARIOS = [
  { label: 'Queue', path: '/creator/requests' },
  { label: 'Needs a decision', path: `/creator/requests/${PREVIEW_IDS.needsDecision}` },
  { label: 'Ask a question', path: `/creator/requests/${PREVIEW_IDS.needsDecision}/ask` },
  { label: 'Decline', path: `/creator/requests/${PREVIEW_IDS.needsDecision}/decline` },
  { label: 'Waiting on the fan', path: `/creator/requests/${PREVIEW_IDS.questionOpen}` },
  { label: 'Changes proposed', path: `/creator/requests/${PREVIEW_IDS.proposalOpen}` },
  { label: 'Approved', path: `/creator/requests/${PREVIEW_IDS.approved}` },
  { label: 'Payment reported', path: `/creator/requests/${PREVIEW_IDS.paid}` },
  { label: 'Declined', path: `/creator/requests/${PREVIEW_IDS.declined}` },
  // The fan's side of the same records (Phase 4 fan screens, undesigned).
  { label: 'Fan: requests', path: '/requests' },
  { label: 'Fan: a question', path: `/requests/${PREVIEW_IDS.questionOpen}` },
  { label: 'Fan: a proposal', path: `/requests/${PREVIEW_IDS.proposalOpen}` },
  { label: 'Fan: approved', path: `/requests/${PREVIEW_IDS.paid}` },
]

export default function CreatorRequestsPreview() {
  const [start, setStart] = useState(SCENARIOS[0].path)
  const catalog = useMemo(() => ({ view: STAGING_INITIAL_VIEW, source: 'bundled' as const }), [])
  // Built once, on the first render: the fixtures and the stub that serves them.
  useState(() => {
    const store: Store = previewCommissions()
    install(store)
    // The pages ask our own session store, not Clerk: the preview is "signed in".
    updateSession({ signedIn: true, getToken: async () => 'preview' })
    return store
  })

  return (
    <div className="min-h-screen bg-cream">
      <nav className="flex flex-wrap gap-2 border-b border-divider bg-panel px-4 py-3">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.path}
            type="button"
            onClick={() => setStart(scenario.path)}
            className={`min-h-[44px] rounded-card border px-3 text-xs font-medium ${
              start === scenario.path ? 'border-espresso bg-espresso text-cream' : 'border-divider bg-cream text-espresso'
            }`}
          >
            {scenario.label}
          </button>
        ))}
      </nav>

      <CatalogContext.Provider value={catalog}>
        <MemoryRouter key={start} initialEntries={[start]}>
          <Routes>
            <Route path="/creator/requests" element={<CreatorQueue />}>
              <Route path=":id" element={<CreatorRequest />}>
                <Route path="ask" element={<CreatorAskModal />} />
                <Route path="decline" element={<CreatorDeclineModal />} />
              </Route>
            </Route>
            <Route path="/requests" element={<MyRequests />} />
            <Route path="/requests/:id" element={<MyRequestDetail />} />
            <Route path="*" element={<Redirect />} />
          </Routes>
        </MemoryRouter>
      </CatalogContext.Provider>
    </div>
  )
}

function Redirect() {
  const navigate = useNavigate()
  return (
    <button type="button" className="m-8 underline" onClick={() => navigate('/creator/requests')}>
      Back to the queue
    </button>
  )
}
