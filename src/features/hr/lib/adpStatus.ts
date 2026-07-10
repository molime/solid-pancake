import type { StatusBadgeVariant } from '@/shared/ui/StatusBadge'

export function adpStatusPill(status: string): {
  variant: StatusBadgeVariant
  label: string
} {
  switch (status) {
    case 'synced':
    case 'matched':
    case 'created':
      return { variant: 'success', label: 'Synced' }
    case 'queued':
      return { variant: 'warning', label: 'Queued' }
    case 'pending_credentials':
      return { variant: 'neutral', label: 'Pending credentials' }
    case 'error':
      return { variant: 'danger', label: 'Error' }
    default:
      return { variant: 'neutral', label: status }
  }
}
