import { useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { RequestCard } from '../components/cards/RequestCard'
import { Icon } from '../components/common/Icon'
import type { RequestStatus } from '../components/common/StatusBadge'
import { Header, type HeaderLink } from '../components/layout/Header'
import { requests } from '../data/requests'

const dashboardLinks: HeaderLink[] = [
  { label: 'Requests', to: '/creator/requests' },
  { label: 'Completed' },
  { label: 'Settings' },
]

type StatusFilter = 'all' | RequestStatus
type SortOption = 'date-desc' | 'date-asc' | 'price-desc' | 'price-asc'

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Status: All Active' },
  { value: 'new', label: 'New Requests' },
  { value: 'pending', label: 'Pending Response' },
  { value: 'alert', label: 'Proposed Changes' },
  { value: 'approved', label: 'Approved' },
]

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'date-desc', label: 'Sort: Date (Newest)' },
  { value: 'date-asc', label: 'Sort: Date (Oldest)' },
  { value: 'price-desc', label: 'Sort: Price (High-Low)' },
  { value: 'price-asc', label: 'Sort: Price (Low-High)' },
]

export function CreatorDashboard() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortOption>('date-desc')

  // Requests needing a fresh decision from the creator — matches the draft's "pending decisions"
  // count (only the "new" requests haven't yet received a creator decision; "alert" and "pending"
  // requests are already decided and are waiting on the fan).
  const pendingDecisions = useMemo(() => requests.filter((r) => r.status === 'new').length, [])

  const visibleRequests = useMemo(() => {
    const filtered =
      statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter)

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'date-asc':
          return a.submittedAt.localeCompare(b.submittedAt)
        case 'price-desc':
          return b.total - a.total
        case 'price-asc':
          return a.total - b.total
        case 'date-desc':
        default:
          return b.submittedAt.localeCompare(a.submittedAt)
      }
    })
  }, [statusFilter, sort])

  return (
    <>
      <Header links={dashboardLinks} />

      <div className="border-b border-divider">
        <div className="mx-auto flex max-w-container justify-end px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 rounded-full bg-rose/20 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-deep opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-deep" />
            </span>
            <span className="text-xs font-medium text-rose-deep">
              {pendingDecisions} pending decision{pendingDecisions === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-container px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="mb-2 font-serif text-4xl font-medium">Request Queue</h2>
            <p className="text-sm text-muted">Review incoming commissions and manage approvals.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="cursor-pointer appearance-none rounded-card border border-divider bg-panel py-2 pl-4 pr-10 text-sm text-espresso transition-colors duration-160 focus:border-espresso focus:outline-none focus-ring"
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Icon
                icon="lucide:chevron-down"
                width={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>

            <div className="relative">
              <select
                aria-label="Sort requests"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOption)}
                className="cursor-pointer appearance-none rounded-card border border-divider bg-panel py-2 pl-4 pr-10 text-sm text-espresso transition-colors duration-160 focus:border-espresso focus:outline-none focus-ring"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Icon
                icon="lucide:chevron-down"
                width={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>
          </div>
        </div>

        {visibleRequests.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {visibleRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-divider bg-panel shadow-subtle">
              <Icon icon="lucide:inbox" width={28} className="text-muted" />
            </div>
            <h3 className="mb-2 font-serif text-2xl font-medium">You're all caught up</h3>
            <p className="text-sm text-muted">No requests match the current filter.</p>
          </div>
        )}
      </main>

      <Outlet />
    </>
  )
}
