import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { FanCommissionSummary } from '../api/types'
import { useSignedIn } from '../auth/session'
import { Header } from '../components/layout/Header'
import { Icon } from '../components/common/Icon'
import { requestsCopy as copy } from '../copy/requests'
import { currency } from '../domain/sceneCard'
import { formatDate } from '../domain/requests'
import { CREATOR_NAME } from '../state/catalog'

/* -------------------------------------------------------------------------- */
/*  Phase 4, staging only: the requests this fan has sent.                    */
/*                                                                            */
/*  There is no email in Phase 4, so this page is where an answer appears.    */
/*  Every sentence comes from copy/requests.ts, and nothing says a request    */
/*  was sent, approved or paid unless the server said so.                     */
/* -------------------------------------------------------------------------- */

export function MyRequests() {
  const signedIn = useSignedIn()
  const [state, setState] = useState<{ kind: 'loading' | 'failed' } | { kind: 'ready'; rows: FanCommissionSummary[] }>({ kind: 'loading' })

  useEffect(() => {
    if (signedIn !== true) return
    let cancelled = false
    void (async () => {
      const res = await api.myRequests()
      if (cancelled) return
      setState(res.ok ? { kind: 'ready', rows: res.body.commissions } : { kind: 'failed' })
    })()
    return () => {
      cancelled = true
    }
  }, [signedIn])

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />
      <main className="mx-auto w-full max-w-[800px] flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">{copy.listTitle}</h1>
        <p className="mb-8 text-sm text-muted">{copy.listIntro(CREATOR_NAME)}</p>

        {signedIn === false && <Notice icon="lucide:log-in">{copy.signedOut}</Notice>}
        {signedIn === true && state.kind === 'loading' && (
          <p role="status" className="text-sm text-muted">
            Loading…
          </p>
        )}
        {signedIn === true && state.kind === 'failed' && <Notice icon="lucide:circle-alert">{copy.listError}</Notice>}
        {signedIn === true && state.kind === 'ready' && state.rows.length === 0 && <Notice icon="lucide:inbox">{copy.listEmpty}</Notice>}

        {signedIn === true && state.kind === 'ready' && state.rows.length > 0 && (
          <ul className="space-y-4">
            {state.rows.map((row) => (
              <li key={row.id}>
                <Link
                  to={`/requests/${row.id}`}
                  className="flex flex-col gap-3 rounded-card border border-divider bg-panel p-5 shadow-subtle transition-colors duration-160 hover:border-espresso focus-ring sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="mb-1 text-sm font-medium text-espresso">{copy.status(row.status, row.creatorName)}</p>
                    <p className="text-xs text-muted">
                      {copy.reference(row.id)} · {copy.sentOn(formatDate(row.createdAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    {row.waitingOnYou && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-limitask-border bg-limitask-bg px-2.5 py-1 text-[11px] font-medium text-limitask-ink">
                        <Icon icon="lucide:bell-dot" width={12} />
                        {copy.needsYou}
                      </span>
                    )}
                    <span className="font-serif text-xl font-semibold text-espresso">{currency.format(row.totalCents)}</span>
                    <Icon icon="lucide:chevron-right" width={18} className="text-muted" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
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
