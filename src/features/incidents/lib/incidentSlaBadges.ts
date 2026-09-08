import type { StatusBadgeVariant } from '@/shared/ui/StatusBadge'

export type IncidentSlaSource = {
  status: string
  verbalReportedAt?: string
  writtenSubmittedAt?: string
  verbalBreached: boolean
  writtenBreached: boolean
}

/**
 * SLA badges for an incident row: pending (warning) while a §54327 report is
 * still inside its window, overdue/late (danger) once breached. Closed
 * incidents show no badges.
 */
export function incidentSlaBadges(incident: IncidentSlaSource) {
  const badges: { key: string; label: string; variant: StatusBadgeVariant }[] =
    []
  if (incident.status === 'closed') return badges

  if (!incident.verbalReportedAt && incident.verbalBreached) {
    badges.push({
      key: 'verbal-overdue',
      label: '24h report overdue',
      variant: 'danger',
    })
  } else if (incident.verbalReportedAt && incident.verbalBreached) {
    badges.push({
      key: 'verbal-late',
      label: '24h report late',
      variant: 'danger',
    })
  } else if (!incident.verbalReportedAt) {
    badges.push({
      key: 'verbal-pending',
      label: '24h report pending',
      variant: 'warning',
    })
  }

  if (!incident.writtenSubmittedAt && incident.writtenBreached) {
    badges.push({
      key: 'written-overdue',
      label: '48h report overdue',
      variant: 'danger',
    })
  } else if (incident.writtenSubmittedAt && incident.writtenBreached) {
    badges.push({
      key: 'written-late',
      label: '48h report late',
      variant: 'danger',
    })
  } else if (!incident.writtenSubmittedAt) {
    badges.push({
      key: 'written-pending',
      label: '48h report pending',
      variant: 'warning',
    })
  }

  return badges
}
