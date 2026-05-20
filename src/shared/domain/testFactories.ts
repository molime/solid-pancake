import type { CareShift, ProgressNote, ShiftTask } from './types'

const completeNote: ProgressNote = {
  startTime: '09:00',
  endTime: '13:00',
  servicesProvided: 'SLS coaching, medication cueing, and community access.',
  clientResponse: 'Client participated and completed the planned routine.',
  narrative: 'Caregiver supported goals authorized for the current care plan.',
}

const completeTasks: ShiftTask[] = [
  {
    id: 'task-goals',
    title: 'Daily living goals reviewed',
    requiredProof: false,
    status: 'complete',
  },
  {
    id: 'task-proof',
    title: 'Community access proof',
    requiredProof: true,
    status: 'complete',
    proofName: 'community-access-receipt.pdf',
    proofUrl: '#proof',
  },
]

export function makeDemoShift(
  overrides: Partial<CareShift> = {},
): CareShift {
  const base: CareShift = {
    id: 'shift-demo',
    clientId: 'client-sls',
    clientName: 'Atria Community Residence',
    caregiverId: 'cg-1',
    caregiverName: 'Maria Santos',
    coordinatorId: 'co-1',
    coordinatorName: 'Jordan Lee',
    scheduledStart: '2026-05-19T09:00:00.000Z',
    scheduledEnd: '2026-05-19T13:00:00.000Z',
    status: 'in_progress',
    serviceType: 'SLS',
    authorizationHours: 84,
    rate: 74,
    riskFlags: ['Medication cueing', 'Community access'],
    progressNote: completeNote,
    tasks: completeTasks.map((task) => ({ ...task })),
    reviewEvents: [],
  }

  return {
    ...base,
    ...overrides,
    progressNote: { ...base.progressNote, ...overrides.progressNote },
    tasks: overrides.tasks ?? base.tasks,
    reviewEvents: overrides.reviewEvents ?? base.reviewEvents,
  }
}
