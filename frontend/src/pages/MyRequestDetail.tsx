import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, type ApiResult } from '../api/client'
import type { CommissionMessage, CommissionVersion, CommissionView } from '../api/types'
import { useSignedIn } from '../auth/session'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { Modal } from '../components/common/Modal'
import { Header } from '../components/layout/Header'
import { requestsCopy as copy } from '../copy/requests'
import { currentVersion, diffVersions, formatDate, lastAccepted, openProposal } from '../domain/requests'
import { currency } from '../domain/sceneCard'
import { MESSAGE_MAX } from '../../../shared/domain/commission.ts'

/* -------------------------------------------------------------------------- */
/*  Phase 4, staging only: one sent request.                                  */
/*                                                                            */
/*  What the fan can do comes from the server's `actions`, never from this    */
/*  page's own reading of the status. Every action replaces the whole view    */
/*  with the server's answer, so the screen can't drift from the record.      */
/* -------------------------------------------------------------------------- */

export function MyRequestDetail() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const signedIn = useSignedIn()
  const justSent = params.get('sent') === '1'
  const [view, setView] = useState<CommissionView | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await api.myRequest(id)
    if (res.ok) {
      setView(res.body)
      setState('ready')
    } else setState(res.status === 404 ? 'missing' : 'failed')
  }, [id])

  useEffect(() => {
    if (signedIn !== true) return
    void (async () => {
      await load()
    })()
  }, [signedIn, load])

  /** Runs one action and takes the server's answer as the new truth. */
  async function act(run: () => Promise<ApiResult<CommissionView>>, success: string) {
    setBusy(true)
    setNotice(null)
    const res = await run()
    setBusy(false)
    if (res.ok) {
      setView(res.body)
      setNotice(success)
      if (justSent) setParams({}, { replace: true })
      return true
    }
    if (res.status === 409) {
      await load()
      setNotice(copy.changedElsewhere)
      return false
    }
    setNotice(res.error === 'hard_list_blocked' || res.error === 'creator_limit_blocked' ? copy.blocked : copy.failed)
    return false
  }

  if (signedIn === false) return <Shell><Notice icon="lucide:log-in">{copy.signedOut}</Notice></Shell>
  if (state === 'loading') return <Shell><p role="status" className="text-sm text-muted">Loading…</p></Shell>
  if (state === 'missing') return <Shell><Notice icon="lucide:search-x">That request isn’t here.</Notice></Shell>
  if (state === 'failed' || !view) return <Shell><Notice icon="lucide:circle-alert">{copy.listError}</Notice></Shell>

  const { commission } = view
  const creator = commission.creatorName
  const accepted = lastAccepted(view)
  const proposal = openProposal(view)
  const current = currentVersion(view)
  const approved = view.versions.find((v) => v.id === commission.approvedVersionId)
  const terms = approved ?? accepted ?? current
  const question = [...view.messages].reverse().find((m) => m.kind === 'question')
  const declineReason = view.messages.find((m) => m.kind === 'decline_reason')
  const can = (action: string) => commission.actions.includes(action)

  return (
    <Shell>
      <Link to="/requests" className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted hover:text-espresso focus-ring">
        <Icon icon="lucide:arrow-left" width={18} />
        {copy.listTitle}
      </Link>

      <h1 className="mb-1 font-serif text-3xl font-semibold text-espresso">{copy.detailTitle(creator)}</h1>
      <p className="mb-6 text-xs text-muted">
        {copy.reference(commission.id)} · {copy.sentOn(formatDate(commission.createdAt))}
      </p>

      {notice && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-card border border-divider bg-panel px-4 py-3 text-sm text-espresso">
          <Icon icon="lucide:info" width={16} className="mt-0.5 shrink-0" />
          {notice}
        </p>
      )}

      {/* Where the request stands, in the server's terms. */}
      <div className="mb-8 rounded-card border border-divider bg-panel p-5">
        <p className="mb-1 text-sm font-medium text-espresso">{copy.status(commission.status, creator)}</p>
        {justSent && commission.status === 'in_review' && <p className="text-sm text-muted">{copy.justSent(creator)}</p>}
        {!justSent && commission.status === 'in_review' && <p className="text-sm text-muted">{copy.inReview(creator)}</p>}
        {commission.status === 'approved' && (
          <>
            <p className="text-sm text-muted">{copy.approved(creator, formatDate(commission.approvedAt ?? commission.decidedAt ?? ''))}</p>
            {commission.payment && <p className="mt-2 text-sm text-muted">{copy.paymentReported(creator, formatDate(commission.payment.reportedAt))}</p>}
          </>
        )}
        {commission.status === 'declined' && (
          <>
            <p className="text-sm text-muted">{copy.declined(creator)}</p>
            {declineReason && (
              <div className="mt-3 rounded-lg bg-secondary p-3">
                <p className="mb-1 text-xs font-medium text-muted">{copy.declinedReason(creator)}</p>
                <p className="whitespace-pre-wrap text-sm text-espresso">{declineReason.body}</p>
              </div>
            )}
          </>
        )}
        {commission.status === 'withdrawn' && <p className="text-sm text-muted">{copy.withdrawn}</p>}
        {commission.status === 'closed' && <p className="text-sm text-muted">{copy.closed}</p>}
      </div>

      {can('reply') && question && <ReplyBox creator={creator} question={question} busy={busy} onSend={(body) => act(() => api.reply(commission.id, body), copy.replySent(creator))} />}

      {proposal && accepted && (
        <ProposalBox
          creator={creator}
          before={accepted}
          after={proposal}
          note={view.messages.find((m) => m.kind === 'proposal_note' && m.versionId === proposal.id)}
          busy={busy}
          onAccept={() => act(() => api.acceptProposal(commission.id, proposal.id, proposal.contentHash), copy.proposalAccepted(creator))}
          onReject={() => act(() => api.rejectProposal(commission.id, proposal.id), copy.proposalRejected(creator))}
        />
      )}

      {terms && <Terms version={terms} creator={creator} approved={Boolean(approved)} />}

      {view.messages.length > 0 && <History messages={view.messages} creator={creator} />}

      {can('withdraw') && <Withdraw creator={creator} busy={busy} onConfirm={() => act(() => api.withdraw(commission.id), copy.withdrawn)} />}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />
      <main className="mx-auto w-full max-w-[800px] flex-1 px-4 py-10 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}

function Notice({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-card border border-divider bg-panel px-4 py-3 text-sm text-muted">
      <Icon icon={icon} width={16} className="mt-0.5 shrink-0" />
      {children}
    </p>
  )
}

function ReplyBox({ creator, question, busy, onSend }: { creator: string; question: CommissionMessage; busy: boolean; onSend: (body: string) => Promise<boolean> }) {
  const [body, setBody] = useState('')
  return (
    <section className="mb-8 rounded-card border border-limitask-border bg-limitask-bg p-5">
      <h2 className="mb-2 text-sm font-semibold text-limitask-ink">{copy.questionHeading(creator)}</h2>
      <p className="mb-4 whitespace-pre-wrap text-sm text-espresso">{question.body}</p>
      <label htmlFor="reply" className="mb-1 block text-xs font-medium text-muted">
        {copy.replyLabel}
      </label>
      <textarea
        id="reply"
        value={body}
        maxLength={MESSAGE_MAX}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-[96px] w-full resize-none rounded-card border border-divider bg-panel p-3 text-sm text-espresso focus:outline-none focus-ring"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {body.length} / {MESSAGE_MAX}
        </span>
        <Button
          type="button"
          size="sm"
          icon="lucide:send"
          disabled={busy || body.trim() === ''}
          onClick={() => void onSend(body.trim()).then((ok) => ok && setBody(''))}
        >
          {copy.replySend}
        </Button>
      </div>
    </section>
  )
}

function ProposalBox({
  creator,
  before,
  after,
  note,
  busy,
  onAccept,
  onReject,
}: {
  creator: string
  before: CommissionVersion
  after: CommissionVersion
  note: CommissionMessage | undefined
  busy: boolean
  onAccept: () => Promise<boolean>
  onReject: () => Promise<boolean>
}) {
  const changes = diffVersions(before, after)
  const labels: Record<string, string> = { added: copy.added, removed: copy.removed, changed: copy.changed }
  return (
    <section className="mb-8 rounded-card border border-rose bg-panel p-5">
      <h2 className="mb-1 text-sm font-semibold text-espresso">{copy.proposalHeading(creator)}</h2>
      <p className="mb-4 text-sm text-muted">{copy.proposalIntro(creator)}</p>
      {note && <p className="mb-4 whitespace-pre-wrap rounded-lg bg-secondary p-3 text-sm text-espresso">{note.body}</p>}
      <ul className="mb-4 space-y-2">
        {changes.map((c) => (
          <li key={`${c.kind}-${c.label}`} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted">
              <span className="mr-2 text-xs uppercase tracking-wide">{labels[c.kind]}</span>
              {c.label}
            </span>
            <span className="font-medium text-espresso">
              {c.before !== null && c.after !== null && c.before !== c.after
                ? `${currency.format(c.before)} → ${currency.format(c.after)}`
                : currency.format((c.after ?? c.before) ?? 0)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mb-5 space-y-1 border-t border-divider pt-3 text-sm">
        <div className="flex justify-between text-muted">
          <span>{copy.totalWas}</span>
          <span>{currency.format(before.terms.totalCents)}</span>
        </div>
        <div className="flex justify-between font-medium text-espresso">
          <span>{copy.totalNow}</span>
          <span>{currency.format(after.terms.totalCents)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" disabled={busy} onClick={() => void onAccept()}>
          {copy.proposalAccept}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void onReject()}>
          {copy.proposalReject}
        </Button>
      </div>
    </section>
  )
}

function Terms({ version, creator, approved }: { version: CommissionVersion; creator: string; approved: boolean }) {
  return (
    <section className="mb-8 rounded-card border border-divider bg-panel p-5">
      <h2 className="mb-4 text-sm font-semibold text-espresso">{approved ? copy.approvedTermsHeading : copy.termsHeading}</h2>
      <ul className="mb-4 space-y-2">
        {version.quote.lines
          .filter((line) => line.amount !== 0)
          .map((line) => (
            <li key={line.itemId} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted">{line.qty > 1 ? `${line.label} × ${line.qty}` : line.label}</span>
              <span className="font-medium text-espresso">{currency.format(line.amount)}</span>
            </li>
          ))}
      </ul>
      {version.terms.customRequest && (
        <div className="mb-4 rounded-lg bg-secondary p-3">
          <p className="mb-1 text-xs font-medium text-muted">{copy.customRequest}</p>
          <p className="mb-2 whitespace-pre-wrap text-sm text-espresso">{version.terms.customRequest}</p>
          <p className="text-xs text-muted">
            {version.customRequestPriceCents === null
              ? copy.customRequestUnpriced(creator)
              : copy.customRequestPriced(creator, currency.format(version.customRequestPriceCents))}
          </p>
        </div>
      )}
      <div className="flex items-end justify-between border-t border-divider pt-4">
        <span className="font-medium text-espresso">{approved ? copy.approvedTotal : copy.estimatedTotal}</span>
        <span className="font-serif text-2xl font-bold text-espresso">{currency.format(version.terms.totalCents)}</span>
      </div>
      <p className="mt-3 text-xs text-muted">{copy.deliveryRule(version.terms.deliveryDaysFromPayment)}</p>
    </section>
  )
}

function History({ messages, creator }: { messages: CommissionMessage[]; creator: string }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-espresso">{copy.historyHeading}</h2>
      <ul className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className="rounded-card border border-divider bg-panel p-4">
            <p className="mb-1 text-xs text-muted">
              {m.authorKind === 'fan' ? copy.youLabel : creator} · {formatDate(m.createdAt)}
            </p>
            <p className="whitespace-pre-wrap text-sm text-espresso">{m.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Withdraw({ creator, busy, onConfirm }: { creator: string; busy: boolean; onConfirm: () => Promise<boolean> }) {
  const [asking, setAsking] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="min-h-[44px] text-sm text-muted underline transition-colors duration-160 hover:text-espresso focus-ring"
      >
        {copy.withdraw}
      </button>
      {asking && (
        <Modal onClose={() => setAsking(false)} size="sm" labelledBy="withdraw-title">
          <div className="p-6">
            <h2 id="withdraw-title" className="mb-2 font-serif text-xl font-semibold text-espresso">
              {copy.withdrawTitle}
            </h2>
            <p className="mb-6 text-sm text-muted">{copy.withdrawBody(creator)}</p>
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button type="button" variant="secondary" onClick={() => setAsking(false)}>
                {copy.withdrawKeep}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void onConfirm().then(() => setAsking(false))}
              >
                {copy.withdrawConfirm}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
