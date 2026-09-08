export const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export function caseStatusVariant(status: string) {
  switch (status) {
    case 'open':
      return 'danger'
    case 'in_review':
      return 'warning'
    case 'resolved':
      return 'success'
    default:
      return 'neutral'
  }
}
