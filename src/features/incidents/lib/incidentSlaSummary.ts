import type { IncidentSlaSource } from './incidentSlaBadges'

export type IncidentCountdownSource = IncidentSlaSource & {
  verbalDueAt: string
  writtenDueAt: string
  agenciesNotified: string[]
  familyContacted?: { who: string; at: string }
}

export type IncidentSlaSummary = {
  /** Plain-language banner line, e.g. "Written report due in 46 hours — 3 of 5 parts done". */
  message: string
  tone: 'danger' | 'warning' | 'success'
  partsDone: number
  partsTotal: number
}

const HOUR_MS = 60 * 60 * 1000

function hoursBetween(fromIso: string, toIso: string) {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / HOUR_MS)
}

function hoursText(hours: number) {
  if (hours < 1) return 'under an hour'
  if (hours >= 48) {
    const days = Math.round(hours / 24)
    return `${days} day${days === 1 ? '' : 's'}`
  }
  return `${hours} hour${hours === 1 ? '' : 's'}`
}

/**
 * Plain-language countdown for the incident detail page
 * (docs/design-audit-simplification.md, stage 3). Computed from the same SLA
 * fields as incidentSlaBadges — no new data. The "parts" are the five real
 * report elements: report filed, verbal report recorded, written report
 * submitted, agencies notified, family/representative contacted.
 */
export function incidentSlaSummary(
  incident: IncidentCountdownSource,
  nowIso = new Date().toISOString(),
): IncidentSlaSummary {
  const partsTotal = 5
  const partsDone = [
    true, // the report exists — it was filed
    Boolean(incident.verbalReportedAt),
    Boolean(incident.writtenSubmittedAt),
    incident.agenciesNotified.length > 0,
    Boolean(incident.familyContacted),
  ].filter(Boolean).length
  const progress = `${partsDone} of ${partsTotal} parts done`

  if (
    incident.status === 'closed' ||
    (incident.verbalReportedAt && incident.writtenSubmittedAt)
  ) {
    return {
      message: `All reports are in — ${progress}`,
      tone: 'success',
      partsDone,
      partsTotal,
    }
  }

  if (!incident.verbalReportedAt) {
    if (incident.verbalBreached) {
      const overdue = hoursBetween(incident.verbalDueAt, nowIso)
      return {
        message: `The 24-hour call to the regional center is overdue by ${hoursText(overdue)} — ${progress}`,
        tone: 'danger',
        partsDone,
        partsTotal,
      }
    }
    const remaining = hoursBetween(nowIso, incident.verbalDueAt)
    return {
      message: `Call the regional center within ${hoursText(remaining)} — ${progress}`,
      tone: 'warning',
      partsDone,
      partsTotal,
    }
  }

  if (incident.writtenBreached) {
    const overdue = hoursBetween(incident.writtenDueAt, nowIso)
    return {
      message: `The written report is overdue by ${hoursText(overdue)} — ${progress}`,
      tone: 'danger',
      partsDone,
      partsTotal,
    }
  }
  const remaining = hoursBetween(nowIso, incident.writtenDueAt)
  return {
    message: `Written report due in ${hoursText(remaining)} — ${progress}`,
    tone: 'warning',
    partsDone,
    partsTotal,
  }
}
