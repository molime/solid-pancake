import type { StatusBadgeVariant } from '@/shared/ui/StatusBadge'

export type CandidateStatus =
  | 'invited'
  | 'application_draft'
  | 'submitted'
  | 'applied'
  | 'hr_review'
  | 'offer_sent'
  | 'accepted'
  | 'hired'
  | 'rejected'
  | 'withdrawn'

export function candidateStatusPill(status: string): {
  variant: StatusBadgeVariant
  label: string
} {
  switch (status) {
    case 'invited':
    case 'withdrawn':
      return { variant: 'neutral', label: status === 'withdrawn' ? 'Withdrawn' : 'New' }
    case 'application_draft':
      return { variant: 'warning', label: 'Draft' }
    case 'submitted':
    case 'applied':
      return { variant: 'info', label: 'Submitted' }
    case 'hr_review':
      return { variant: 'info', label: 'Under review' }
    case 'offer_sent':
      return { variant: 'info', label: 'Offer sent' }
    case 'accepted':
      return { variant: 'success', label: 'Accepted' }
    case 'hired':
      return { variant: 'success', label: 'Hired' }
    case 'rejected':
      return { variant: 'danger', label: 'Rejected' }
    default:
      return { variant: 'neutral', label: status }
  }
}

export function candidateStatusAccentClass(status: string): string {
  const pill = candidateStatusPill(status)
  switch (pill.variant) {
    case 'success':
      return 'bg-atria-success text-atria-on-accent'
    case 'warning':
      return 'bg-atria-warning text-atria-bg'
    case 'info':
      return 'bg-atria-info text-white'
    case 'danger':
      return 'bg-atria-danger text-white'
    default:
      return 'bg-atria-neutral text-white'
  }
}

export function isTerminalCandidateStatus(status: string): boolean {
  return status === 'hired' || status === 'rejected' || status === 'withdrawn'
}
