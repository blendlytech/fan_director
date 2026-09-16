import { Icon } from './Icon'

export type RequestStatus = 'new' | 'pending' | 'alert' | 'approved'

const config: Record<RequestStatus, { icon: string; color: string; label: string }> = {
  new: { icon: 'lucide:circle-dot', color: 'text-status-new', label: 'New' },
  pending: { icon: 'lucide:clock', color: 'text-status-pending', label: 'Awaiting Reply' },
  alert: { icon: 'lucide:alert-triangle', color: 'text-status-alert', label: 'Changes Pending' },
  approved: { icon: 'lucide:check-circle', color: 'text-status-approved', label: 'Approved' },
}

export function StatusBadge({ status, label }: { status: RequestStatus; label?: string }) {
  const { icon, color, label: defaultLabel } = config[status]
  return (
    <span className={`flex items-center gap-2 ${color}`}>
      <span className="text-xs font-medium">{label ?? defaultLabel}</span>
      <Icon icon={icon} width={18} />
    </span>
  )
}
