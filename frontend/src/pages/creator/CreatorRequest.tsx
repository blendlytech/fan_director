import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { creatorApi, type ApiResult } from '../../api/client'
import type { CommissionVersion, CommissionView } from '../../api/types'
import { useSignedIn } from '../../auth/session'
import { Button } from '../../components/common/Button'
import { Icon } from '../../components/common/Icon'
import { Modal } from '../../components/common/Modal'
import { creatorCopy as copy, creatorErrorMessage } from '../../copy/creatorRequests'
import { diffVersions, formatDate } from '../../domain/requests'
import { currency } from '../../domain/sceneCard'
import { RequestCtx, useRequestContext } from './requestContext'
import { ProposeChanges } from './ProposeChanges'
import { CHECKLIST_LABELS } from '../../../../shared/domain/boundaries.ts'
import type { BoundaryFlag } from '../../../../shared/domain/types.ts'
import { useCatalog } from '../../state/catalog'

/* -------------------------------------------------------------------------- */
/*  Designs 05, 06 and 09 on real data (Phase 4, staging only).               */
/*                                                                            */
/*  Every decision goes to the server and the server's answer becomes the     */
/*  screen: nothing here says approved, declined or sent on its own. Approve   */
/*  sends the exact version id and content hash the creator is looking at, so  */
/*  a version that changed in another tab can never be approved by accident    */
/*  (doc 10 §5: "approval must identify the exact accepted version").          */
/*                                                                            */
/*  Dropped from design 05: the fan's platform handle and avatar, the          */
/*  reference image, a requested delivery date, and the free-text "New Total"  */
/*  (money is derived from the catalog, never typed — doc 11 §3 rule 3).      */
/* -------------------------------------------------------------------------- */

export function CreatorRequest() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const signedIn = useSignedIn()
  const [view, setView] = useState<CommissionView | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const closeToQueue = useCallback(() => navigate('/creator/requests'), [navigate])
  const closeToRequest = useCallback(() => navigate(`/creator/requests/${id}`), [navigate, id])

  const load = useCallback(async () => {
    const res = await creatorApi.request(id)
    if (res.ok) {
      setView(res.body)
      setState('ready')
      return
    }
    if (res.status === 404) {
      setState('missing')
      return
    }
    setMessage(creatorErrorMessage(res.status, res.error, res.body))
    setState('error')
  }, [id])

  useEffect(() => {
    if (signedIn !== true) return
    void (async () => {
      await load()
    })()
  }, [signedIn, load])

  const act = useCallback(
    async (run: () => Promise<ApiResult<CommissionView>>, success: string) => {
      setBusy(true)
      setNotice(null)
      const res = await run()
      setBusy(false)
      if (res.ok) {
        setView(res.body)
        setNotice(success)
        return true
      }
      if (res.status === 409) {
        await load()
        setNotice(copy.changedElsewhere)
        return false
      }
      setNotice(res.error === 'hard_list_blocked' ? copy.blocked : copy.failed)
      return false
    },
    [load],
  )

  if (signedIn === false) {
    return (
      <Modal onClose={closeToQueue} size="sm" labelledBy="creator-request-heading">
        <Shell heading={copy.signedOut} onClose={closeToQueue} />
      </Modal>
    )
  }
  if (state === 'loading') {
    return (
      <Modal onClose={closeToQueue} size="sm" labelledBy="creator-request-heading">
        <div className="p-8">
          <h2 id="creator-request-heading" className="sr-only">
            {copy.queueTitle}
          </h2>
          <p role="status" className="text-sm text-muted">
            Loading…
          </p>
        </div>
      </Modal>
    )
  }
  if (state === 'missing' || !view) {
    return (
      <Modal onClose={closeToQueue} size="sm" labelledBy="creator-request-heading">
        <Shell heading={state === 'missing' ? copy.missing : (message ?? copy.queueError)} onClose={closeToQueue} />
      </Modal>
    )
  }

  const { commission } = view
  const current = view.versions.find((v) => v.id === commission.currentVersionId)
  const approved = view.versions.find((v) => v.id === commission.approvedVersionId)
  const shown = approved ?? current
  const flags = current?.boundaryFlags ?? []

  return (
    <RequestCtx.Provider value={{ view, busy, act, closeToRequest, closeToQueue }}>
      <Modal onClose={closeToQueue} size="lg" labelledBy="creator-request-heading">
        <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row">
          {/* LEFT: what the fan asked for. */}
          <div className="w-full border-b border-divider p-8 lg:w-[60%] lg:border-b-0 lg:border-r lg:p-12">
            <p className="mb-1 text-xs uppercase tracking-wider text-muted">{copy.reference(commission.id)}</p>
            <h2 id="creator-request-heading" className="mb-2 font-serif text-3xl font-semibold leading-tight text-espresso sm:text-4xl">
              {copy.termsHeading}
            </h2>
            <p className="mb-8 text-xs text-muted">
              {copy.sentOn(formatDate(commission.createdAt))} · {copy.updatedOn(formatDate(commission.updatedAt))}
            </p>

            <section className="mb-8 rounded-xl border border-divider bg-cream/50 p-5">
              <p className="mb-1 text-xs uppercase tracking-wider text-muted">{copy.fanNameHeading}</p>
              <p className="text-sm text-espresso">
                {shown?.terms.fanDisplayName ?? <span className="text-muted">{copy.fanNameMissing}</span>}{' '}
                <span className="text-xs text-muted">· {copy.fanNameUnverified}</span>
              </p>
            </section>

            {flags.length > 0 && <AskFirst flags={flags} />}

            {shown && <Terms version={shown} approved={Boolean(approved)} />}

            {shown?.terms.notes && shown.terms.notes.length > 0 && (
              <section className="mb-8">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{copy.notesHeading}</h3>
                <ul className="space-y-2">
                  {shown.terms.notes.map((note) => (
                    <li key={note.id} className="whitespace-pre-wrap rounded-xl border border-divider bg-cream/40 p-4 text-sm italic leading-relaxed text-espresso">
                      {note.text}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {shown?.terms.fanScript && (
              <section className="mb-8">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{copy.scriptHeading}</h3>
                <p className="whitespace-pre-wrap rounded-xl border border-divider bg-cream/40 p-4 text-sm leading-relaxed text-espresso">
                  {shown.terms.fanScript}
                </p>
              </section>
            )}

            {view.versions.length > 1 && <Versions view={view} />}

            {view.messages.length > 0 && <History view={view} />}
          </div>

          {/* RIGHT: the decision. */}
          <div className="flex w-full flex-col bg-panel p-8 lg:w-[40%] lg:p-12">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">{copy.decisionHeading}</h3>
            <p className="mb-6 rounded-xl border border-divider bg-cream/40 p-4 text-sm text-espresso">{copy.status(commission.status)}</p>

            {notice && (
              <p role="status" className="mb-6 flex items-start gap-2 rounded-card border border-divider bg-cream px-4 py-3 text-sm text-espresso">
                <Icon icon="lucide:info" width={16} className="mt-0.5 shrink-0" />
                {notice}
              </p>
            )}

            <Decision />
          </div>
        </div>
      </Modal>

      <Outlet />
    </RequestCtx.Provider>
  )
}

function Shell({ heading, onClose }: { heading: string; onClose: () => void }) {
  return (
    <div className="p-8">
      <h2 id="creator-request-heading" className="mb-6 font-serif text-2xl font-semibold text-espresso">
        {heading}
      </h2>
      <Button variant="secondary" className="w-full" onClick={onClose}>
        {copy.backToQueue}
      </Button>
    </div>
  )
}

/** Approve, propose, ask, decline — and, after approval, the creator's own payment note. */
function Decision() {
  const { view, busy, act, closeToQueue } = useRequestContext()
  const navigate = useNavigate()
  const [proposing, setProposing] = useState(false)
  const { commission } = view
  const can = (action: string) => commission.actions.includes(action)
  const current = view.versions.find((v) => v.id === commission.currentVersionId)
  const approved = view.versions.find((v) => v.id === commission.approvedVersionId)

  if (commission.status === 'approved' && approved) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-success/30 bg-success/10 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-success">
            <Icon icon="lucide:check-circle-2" width={18} />
            {copy.approved(approved.seq, formatDate(commission.approvedAt ?? commission.decidedAt ?? ''))}
          </div>
          <p className="text-xs leading-relaxed text-muted">{copy.approvedNote}</p>
        </div>

        <div className="rounded-xl border border-divider bg-cream p-5">
          <h4 className="mb-2 text-sm font-medium text-espresso">{copy.paymentHeading}</h4>
          <p className="mb-4 text-xs leading-relaxed text-muted">{copy.paymentOffPlatform}</p>
          {commission.payment ? (
            <p className="flex items-start gap-2 text-sm text-espresso">
              <Icon icon="lucide:wallet" width={16} className="mt-0.5 shrink-0" />
              {copy.paymentReported(formatDate(commission.payment.reportedAt))}
            </p>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon="lucide:wallet"
                className="w-full"
                disabled={busy}
                onClick={() => void act(() => creatorApi.reportPayment(commission.id), copy.paymentReportedJustNow)}
              >
                {copy.paymentReport}
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-muted">{copy.paymentReportHelp}</p>
            </>
          )}
        </div>

        <Button variant="secondary" size="sm" className="w-full" onClick={closeToQueue}>
          {copy.backToQueue}
        </Button>
      </div>
    )
  }

  if (commission.status === 'declined') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-divider bg-cream p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-espresso">
            <Icon icon="lucide:x-circle" width={18} className="text-alert" />
            {copy.declined(formatDate(commission.decidedAt ?? ''))}
          </div>
        </div>
        <Button variant="secondary" size="sm" className="w-full" onClick={closeToQueue}>
          {copy.backToQueue}
        </Button>
      </div>
    )
  }

  if (commission.status === 'withdrawn' || commission.status === 'closed') {
    return (
      <div className="space-y-4">
        <Button variant="secondary" size="sm" className="w-full" onClick={closeToQueue}>
          {copy.backToQueue}
        </Button>
      </div>
    )
  }

  if (proposing && current) {
    return <ProposeChanges base={current} onDone={() => setProposing(false)} />
  }

  // Why approval isn't offered right now, in the creator's own terms.
  const blocked =
    commission.status === 'question_open'
      ? copy.approveBlockedQuestion
      : commission.status === 'proposal_open'
        ? copy.approveBlockedProposal
        : current && current.terms.customRequest && current.customRequestPriceCents === null
          ? copy.approveBlockedUnpriced
          : null

  return (
    <div className="space-y-4">
      {can('approve') && current && !blocked ? (
        <>
          <Button
            variant="primary"
            icon="lucide:check-circle-2"
            className="w-full"
            disabled={busy}
            onClick={() => void act(() => creatorApi.approve(commission.id, current.id, current.contentHash), copy.approvedJustNow)}
          >
            {copy.approve}
          </Button>
          <p className="text-xs leading-relaxed text-muted">{copy.approveOf(current.seq, currency.format(current.terms.totalCents))}</p>
        </>
      ) : (
        blocked && (
          <p className="flex items-start gap-2 rounded-xl border border-divider bg-cream p-4 text-xs leading-relaxed text-muted">
            <Icon icon="lucide:info" width={14} className="mt-0.5 shrink-0" />
            {blocked}
          </p>
        )
      )}

      {can('propose') && (
        <button
          type="button"
          onClick={() => setProposing(true)}
          className="flex h-[48px] w-full select-none items-center justify-center gap-2 rounded-card border border-divider bg-cream font-medium text-espresso transition-all duration-160 hover:border-espresso hover:bg-cream/80 focus-ring"
        >
          <Icon icon="lucide:pen-tool" width={18} />
          {copy.propose}
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
        {can('ask') && (
          <Button variant="secondary" size="sm" icon="lucide:message-circle-question" onClick={() => navigate(`/creator/requests/${commission.id}/ask`)}>
            {copy.ask}
          </Button>
        )}
        {can('decline') && (
          <Button
            variant="secondary"
            size="sm"
            icon="lucide:x-circle"
            className="text-alert hover:bg-alert/10"
            onClick={() => navigate(`/creator/requests/${commission.id}/decline`)}
          >
            {copy.decline}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Design 13 E: the limits the creator set to "ask me" that this request touches. */
function AskFirst({ flags }: { flags: BoundaryFlag[] }) {
  const { view } = useCatalog()
  const label = (flag: BoundaryFlag): string => {
    if (flag.limit.kind === 'checklist') return CHECKLIST_LABELS[flag.limit.key] ?? flag.limit.key
    const { id } = flag.limit
    return view.boundaries.askFirst.find((l) => l.source === 'custom' && l.id === id)?.text ?? id
  }
  return (
    <section className="mb-8 rounded-xl border border-limitask-border bg-limitask-bg p-5">
      <h3 className="mb-2 text-sm font-semibold text-limitask-ink">{copy.askFirstHeading}</h3>
      <p className="mb-3 text-sm text-espresso">{copy.askFirstIntro}</p>
      <ul className="space-y-1.5">
        {flags.map((flag, i) => (
          <li key={`${flag.source}-${i}`} className="flex items-start gap-2 text-sm text-espresso">
            <Icon icon="lucide:shield-question" width={14} className="mt-1 shrink-0 text-limitask-ink" />
            {label(flag)}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** One version's terms, straight from the server's own quote. */
function Terms({ version, approved }: { version: CommissionVersion; approved: boolean }) {
  return (
    <section className="mb-8 rounded-xl border border-divider bg-cream p-6 md:p-8">
      <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted">
        {approved ? copy.versionApproved : copy.versionCurrent} · {copy.versionHeading(version.seq)}
      </h3>
      <div className="mb-6 space-y-3">
        {version.quote.lines
          .filter((line) => line.amount !== 0)
          .map((line) => (
            <div key={line.itemId} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted">{line.qty > 1 ? `${line.label} × ${line.qty}` : line.label}</span>
              <span>{currency.format(line.amount)}</span>
            </div>
          ))}
      </div>

      {version.terms.customRequest && (
        <div className="mb-6 rounded-lg border border-divider bg-panel p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">{copy.customRequestHeading}</p>
          <p className="mb-2 whitespace-pre-wrap text-sm text-espresso">{version.terms.customRequest}</p>
          <p className="text-xs text-muted">
            {version.customRequestPriceCents === null
              ? copy.customRequestUnpriced
              : copy.customRequestPriced(currency.format(version.customRequestPriceCents))}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-divider pt-4">
        <span className="font-medium">{copy.total}</span>
        <span className="font-serif text-2xl font-semibold">{currency.format(version.terms.totalCents)}</span>
      </div>
      <p className="mt-3 text-xs text-muted">{copy.deliveryRule(version.terms.deliveryDaysFromPayment)}</p>
    </section>
  )
}

const VERSION_STATUS: Record<CommissionVersion['status'], string> = {
  accepted: copy.versionAccepted,
  offered: copy.versionOffered,
  rejected: copy.versionRejected,
  superseded: copy.versionSuperseded,
}

/** Every version, with what each proposal changed against the one before it. */
function Versions({ view }: { view: CommissionView }) {
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{copy.versionsHeading}</h3>
      <ul className="space-y-3">
        {view.versions.map((version, index) => {
          const previous = index > 0 ? view.versions[index - 1] : undefined
          const changes = previous ? diffVersions(previous, version) : []
          return (
            <li key={version.id} className="rounded-xl border border-divider bg-cream/40 p-4">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-espresso">
                  {copy.versionHeading(version.seq)} · {version.author === 'fan' ? copy.versionByFan : copy.versionByYou}
                </span>
                <span className="font-medium text-espresso">{currency.format(version.terms.totalCents)}</span>
              </div>
              <p className="mb-2 text-xs text-muted">
                {VERSION_STATUS[version.status]} · {formatDate(version.createdAt)}
              </p>
              {changes.length > 0 && (
                <ul className="space-y-1">
                  {changes.map((change) => (
                    <li key={`${change.kind}-${change.label}`} className="text-xs text-muted">
                      {change.label}:{' '}
                      {change.before !== null && change.after !== null
                        ? `${currency.format(change.before)} → ${currency.format(change.after)}`
                        : change.after !== null
                          ? `+${currency.format(change.after)}`
                          : `−${currency.format(change.before ?? 0)}`}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function History({ view }: { view: CommissionView }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{copy.historyHeading}</h3>
      <ul className="space-y-3">
        {view.messages.map((message) => (
          <li key={message.id} className="rounded-xl border border-divider bg-cream/40 p-4">
            <p className="mb-1 text-xs text-muted">
              {message.authorKind === 'creator' ? copy.youLabel : copy.fanLabel} · {formatDate(message.createdAt)}
            </p>
            <p className="whitespace-pre-wrap text-sm text-espresso">{message.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
