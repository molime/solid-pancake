import type {
  BillingExport,
  BillingLine,
  CareShift,
  ProgressNote,
  ShiftTask,
  ValidationResult,
} from './types'

const REQUIRED_NOTE_FIELDS: Array<[keyof ProgressNote, string]> = [
  ['startTime', 'Start time is required.'],
  ['endTime', 'End time is required.'],
  ['servicesProvided', 'Services provided is required.'],
  ['clientResponse', 'Client response is required.'],
]

export function validateProgressNote(
  note: ProgressNote,
  tasks: ShiftTask[],
): ValidationResult {
  const blockers = REQUIRED_NOTE_FIELDS.flatMap(([field, message]) =>
    note[field]?.trim() ? [] : [message],
  )

  for (const task of tasks) {
    if (task.status !== 'complete') {
      blockers.push(`${task.title} must be completed.`)
    }
    if (task.requiredProof && !task.proofName?.trim()) {
      blockers.push(`${task.title} requires proof.`)
    }
  }

  return { valid: blockers.length === 0, blockers }
}

export function canSubmitShift(shift: CareShift): boolean {
  return validateProgressNote(shift.progressNote, shift.tasks).valid
}

export function submitShift(shift: CareShift, caregiverId: string): CareShift {
  const validation = validateProgressNote(shift.progressNote, shift.tasks)
  if (!validation.valid) {
    throw new Error(validation.blockers.join(' '))
  }

  return {
    ...shift,
    status: 'submitted',
    progressNote: {
      ...shift.progressNote,
      submittedBy: caregiverId,
      submittedAt: new Date().toISOString(),
    },
  }
}

export function canApproveShift(shift: CareShift): boolean {
  return (
    shift.status === 'submitted' &&
    validateProgressNote(shift.progressNote, shift.tasks).valid
  )
}

export function approveShift(
  shift: CareShift,
  reviewerId: string,
  comment: string,
): CareShift {
  if (!canApproveShift(shift)) {
    throw new Error('Coordinator cannot approve incomplete documentation.')
  }

  const createdAt = new Date().toISOString()
  return {
    ...shift,
    status: 'billing_ready',
    approvedAt: createdAt,
    reviewEvents: [
      ...shift.reviewEvents,
      {
        id: `review-${shift.id}-${createdAt}`,
        shiftId: shift.id,
        reviewerId,
        decision: 'approved',
        comment,
        createdAt,
      },
    ],
  }
}

export function requestCorrection(
  shift: CareShift,
  reviewerId: string,
  comment: string,
): CareShift {
  const createdAt = new Date().toISOString()
  return {
    ...shift,
    status: 'needs_correction',
    reviewEvents: [
      ...shift.reviewEvents,
      {
        id: `review-${shift.id}-${createdAt}`,
        shiftId: shift.id,
        reviewerId,
        decision: 'correction_requested',
        comment,
        createdAt,
      },
    ],
  }
}

export function createBillingLine(shift: CareShift): BillingLine {
  if (shift.status !== 'billing_ready') {
    throw new Error('Coordinator approval is required before billing.')
  }

  const validation = validateProgressNote(shift.progressNote, shift.tasks)
  if (!validation.valid) {
    throw new Error('Complete documentation is required before billing.')
  }

  const hours = calculateHours(
    shift.progressNote.startTime,
    shift.progressNote.endTime,
  )
  const amount = roundCurrency(hours * shift.rate)

  return {
    id: `line-${shift.id}`,
    shiftId: shift.id,
    clientName: shift.clientName,
    serviceType: shift.serviceType,
    hours,
    rate: shift.rate,
    amount,
    exportBatchId: `ATRIA-${new Date().toISOString().slice(0, 10)}`,
  }
}

export function buildBillingExport(shifts: CareShift[]): BillingExport {
  const lines: BillingLine[] = []
  const excluded: BillingExport['excluded'] = []

  for (const shift of shifts) {
    const validation = validateProgressNote(shift.progressNote, shift.tasks)
    if (shift.status === 'billing_ready' && validation.valid) {
      lines.push(createBillingLine(shift))
      continue
    }

    excluded.push({
      shiftId: shift.id,
      clientName: shift.clientName,
      reason: validation.valid
        ? 'Awaiting coordinator approval.'
        : validation.blockers.join(' '),
    })
  }

  return { lines, excluded }
}

export function calculateHours(startTime: string, endTime: string): number {
  const start = minutesSinceMidnight(startTime)
  const end = minutesSinceMidnight(endTime)
  if (start === null || end === null || end <= start) {
    return 0
  }
  return roundHours((end - start) / 60)
}

function minutesSinceMidnight(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}
