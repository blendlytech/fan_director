import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { creatorApi } from '../../api/client'
import type { CreatorCommissionSummary } from '../../api/types'
import { useSignedIn } from '../../auth/session'
import { Icon } from '../../components/common/Icon'
import { Header, type HeaderLink } from '../../components/layout/Header'
import { creatorCopy as copy, creatorErrorMessage } from '../../copy/creatorRequests'
import { formatDate } from '../../domain/requests'
import { currency } from '../../domain/sceneCard'

/* -------------------------------------------------------------------------- */
/*  Design 03 on real data (Phase 4, staging only).                           */
/*                                                                            */
/*  Everything on this screen comes from `GET /api/creator/commissions`. The   */
/*  demo's queue keeps its own mock data and its own copy; this page is a      */
/*  separate route so the demo build never renders a line of it.               */
/*                                                                            */
/*  Dropped from the design, because the server holds no such thing: the      */
/*  fan's platform handle and avatar, a requested delivery date, and          */
/*  "Awaiting Payment" as a status. Payment is only ever the creator's own    */
/*  report, shown as one.                                                      */
/* -------------------------------------------------------------------------- */

/** The same header as the demo's queue: `to` is omitted for sections that don't exist yet, and those render inert. */
const dashboardLinks: HeaderLink[] = [
  { label: 'Requests', to: '/creator/requests' },
  { label: 'Completed' },
  { label: 'Settings' },
]

type Filter = (typeof copy.filters)[number]['value']
type Sort = (typeof copy.sorts)[number]['value']

type QueueState =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: CreatorCommissionSummary[]; counts: Record<string, number> }
  | { kind: 'error'; message: string }

export function CreatorQueue() {
  const signedIn = useSignedIn()
  const { pathname } = useLocation()
  const [state, setState] = useState<QueueState>({ kind: 'loading' })
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('updated-desc')

  const load = useCallback(async () => {
    const res = await creatorApi.queue()
    if (res.ok) {
      setState({ kind: 'ready', rows: res.body.commissions, counts: res.body.counts })
      return
    }
    setState({ kind: 'error', message: creatorErrorMessage(res.status, res.error, res.body) })
  }, [])

  // Loads on arrival, and again on returning to the queue from a decision
  // modal, so a decision just made shows here without a page reload.
  const atRoot = pathname === '/creator/requests'
  useEffect(() => {
    if (signedIn !== true) return
    void (async () => {
      await load()
    })()
  }, [signedIn, load, atRoot])

  const rows = useMemo(() => {
    if (state.kind !== 'ready') return []
    const filtered = filter === 'all' ? state.rows : state.rows.filter((r) => r.status === filter)
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'date-desc':
          return b.createdAt.localeCompare(a.createdAt)
        case 'date-asc':
          return a.createdAt.localeCompare(b.createdAt)
        case 'price-desc':
          return b.totalCents - a.totalCents
        case 'price-asc':
          return a.totalCents - b.totalCents
        case 'updated-desc':
        default:
          return b.updatedAt.localeCompare(a.updatedAt)
      }
    })
  }, [state, filter, sort])

  const pending = state.kind === 'ready' ? (state.counts.in_review ?? 0) : 0

  return (
    <>
      <Header links={dashboardLinks} />

      {state.kind === 'ready' && pending > 0 && (
        <div className="border-b border-divider">
          <div className="mx-auto flex max-w-container justify-end px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 rounded-full bg-rose/20 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-deep opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-deep" />
              </span>
              <span className="text-xs font-medium text-rose-deep">{copy.pendingDecisions(pending)}</span>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-container px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="mb-2 font-serif text-4xl font-medium">{copy.queueTitle}</h2>
            <p className="max-w-[60ch] text-sm text-muted">{copy.queueIntro}</p>
          </div>

          {state.kind === 'ready' && state.rows.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Select label="Filter by status" value={filter} onChange={(v) => setFilter(v as Filter)} options={copy.filters} />
              <Select label="Sort requests" value={sort} onChange={(v) => setSort(v as Sort)} options={copy.sorts} />
            </div>
          )}
        </div>

        {signedIn === false && <Notice icon="lucide:log-in">{copy.signedOut}</Notice>}
        {signedIn === true && state.kind === 'loading' && (
          <p role="status" className="text-sm text-muted">
            Loading…
          </p>
        )}
        {signedIn === true && state.kind === 'error' && <Notice icon="lucide:circle-alert">{state.message}</Notice>}

        {state.kind === 'ready' &&
          (rows.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {rows.map((row) => (
                <QueueCard key={row.id} row={row} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-divider bg-panel shadow-subtle">
                <Icon icon="lucide:inbox" width={28} className="text-muted" />
              </div>
              <h3 className="mb-2 font-serif text-2xl font-medium">{copy.queueEmptyTitle}</h3>
              <p className="text-sm text-muted">{copy.queueEmpty}</p>
            </div>
          ))}
      </main>

      <Outlet />
    </>
  )
}

/** One request in the queue. Only what the server holds: no handle, no delivery date. */
function QueueCard({ row }: { row: CreatorCommissionSummary }) {
  const needsPrice = row.customRequest && !row.customRequestPriced
  return (
    <Link
      to={`/creator/requests/${row.id}`}
      className="flex flex-col gap-4 rounded-card border border-divider bg-panel p-6 shadow-subtle transition-colors duration-160 hover:border-espresso focus-ring"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-espresso">{copy.status(row.status)}</p>
          <p className="text-xs text-muted">
            {copy.reference(row.id)} · {copy.sentOn(formatDate(row.createdAt))}
          </p>
        </div>
        <span className="shrink-0 font-serif text-xl font-semibold text-espresso">{currency.format(row.totalCents)}</span>
      </div>

      <div>
        <p className="mb-0.5 text-xs uppercase tracking-wider text-muted">{copy.fanNameHeading}</p>
        <p className="text-sm text-espresso">
          {row.fanName ?? <span className="text-muted">{copy.fanNameMissing}</span>}{' '}
          <span className="text-xs text-muted">· {copy.fanNameUnverified}</span>
        </p>
      </div>

      {(needsPrice || row.askFirst > 0 || row.payment) && (
        <div className="flex flex-wrap gap-2">
          {needsPrice && <Badge icon="lucide:tag" tone="alert">{copy.customRequestNeedsPrice}</Badge>}
          {row.customRequest && !needsPrice && <Badge icon="lucide:tag">{copy.customRequestBadge}</Badge>}
          {row.askFirst > 0 && <Badge icon="lucide:shield-question">{copy.askFirstBadge(row.askFirst)}</Badge>}
          {row.payment && <Badge icon="lucide:wallet">{copy.paymentReported(formatDate(row.payment.reportedAt))}</Badge>}
        </div>
      )}

      <p className="text-xs text-muted">{copy.updatedOn(formatDate(row.updatedAt))}</p>
    </Link>
  )
}

function Badge({ icon, tone, children }: { icon: string; tone?: 'alert'; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        tone === 'alert' ? 'border-alert/40 bg-alert/10 text-alert' : 'border-divider bg-cream text-muted'
      }`}
    >
      <Icon icon={icon} width={12} />
      {children}
    </span>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <div className="relative w-full min-w-0 sm:w-auto">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[44px] w-full cursor-pointer appearance-none rounded-card border border-divider bg-panel py-2 pl-4 pr-10 text-sm text-espresso transition-colors duration-160 focus:border-espresso focus:outline-none focus-ring sm:w-auto"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon icon="lucide:chevron-down" width={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
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
