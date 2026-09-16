import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import type { Request } from '../../data/requests'
import { Icon } from '../common/Icon'
import { StatusBadge } from '../common/StatusBadge'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/**
 * Dashboard request card. The whole card is a single semantic link (per the design system's
 * "Request Card" pattern) — no interactive elements are nested inside it.
 */
export function RequestCard({ request }: { request: Request }) {
  const {
    id,
    fanHandle,
    avatarInitials,
    avatarImageUrl,
    avatarAlt,
    status,
    title,
    description,
    totalLabel,
    total,
    previousTotal,
    deliveryLabel,
    deliveryValue,
    unresolvedCount,
  } = request

  return (
    <Link
      to={`/creator/requests/${id}`}
      aria-label={`${title}, request from ${fanHandle}`}
      className={cn(
        'group block rounded-card border border-divider bg-panel p-6 shadow-subtle',
        'transition-all duration-160 hover:shadow-modal focus-ring',
        status === 'approved' && 'opacity-80 hover:opacity-100',
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {avatarImageUrl ? (
            <img
              src={avatarImageUrl}
              alt={avatarAlt ?? ''}
              className="h-8 w-8 rounded-full border border-divider bg-cream"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-divider bg-cream text-xs font-medium text-espresso">
              {avatarInitials}
            </div>
          )}
          <span className="text-sm font-medium text-muted">{fanHandle}</span>
        </div>
        <StatusBadge status={status} />
      </div>

      <h3 className="mb-2 font-serif text-2xl font-bold transition-colors duration-160 group-hover:text-rose-deep">
        {title}
      </h3>
      <p className="mb-6 line-clamp-2 text-sm text-muted">{description}</p>

      <hr className="mb-4 border-t border-divider" />

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="mb-1 text-xs text-muted">{totalLabel}</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{currency.format(total)}</span>
            {previousTotal !== undefined && (
              <span className="text-xs text-muted line-through">{currency.format(previousTotal)}</span>
            )}
          </div>
        </div>

        {unresolvedCount !== undefined ? (
          <div className="flex items-center gap-2 rounded border border-divider bg-cream px-2 py-1">
            <Icon icon="lucide:message-circle-question" width={14} className="text-muted" />
            <span className="text-xs font-medium text-muted">{unresolvedCount} Unresolved</span>
          </div>
        ) : (
          deliveryLabel && (
            <div className="flex flex-col text-right">
              <span className="mb-1 text-xs text-muted">{deliveryLabel}</span>
              <span className="text-sm font-medium">{deliveryValue}</span>
            </div>
          )
        )}
      </div>
    </Link>
  )
}
