import { describe, expect, it } from 'vitest'
import {
  calculateDocumentedHours,
  mergeTaskUpdates,
  validateShiftDocumentation,
} from './shiftValidation'

const completeNote = {
  startTime: '09:00',
  endTime: '13:00',
  servicesProvided: 'SLS community integration',
  clientResponse: 'Client participated actively.',
  narrative: 'Supported routine and outing.',
}

const tasks = [
  {
    _id: 'task-1',
    title: 'Medication support observed',
    requiredProof: true,
    status: 'pending' as const,
  },
  {
    _id: 'task-2',
    title: 'Community access activity',
    requiredProof: false,
    status: 'pending' as const,
  },
]

describe('Convex shift validation', () => {
  it('keeps omitted tasks pending when applying submitted updates', () => {
    const merged = mergeTaskUpdates(tasks, [
      {
        taskId: 'task-1',
        status: 'complete',
        proofName: 'med-log.jpg',
      },
    ])

    expect(merged).toEqual([
      expect.objectContaining({
        _id: 'task-1',
        status: 'complete',
        proofName: 'med-log.jpg',
      }),
      expect.objectContaining({
        _id: 'task-2',
        status: 'pending',
      }),
    ])
  })

  it('rejects incomplete documentation and invalid time ranges', () => {
    const blockers = validateShiftDocumentation(
      { ...completeNote, endTime: '08:00', servicesProvided: '' },
      mergeTaskUpdates(tasks, [
        {
          taskId: 'task-1',
          status: 'complete',
        },
      ]),
    )

    expect(blockers).toEqual(
      expect.arrayContaining([
        'Services provided is required.',
        'End time must be after start time.',
        'Medication support observed requires proof.',
        'Community access activity must be completed.',
      ]),
    )
  })

  it('calculates documented hours only for valid service windows', () => {
    expect(calculateDocumentedHours('09:00', '13:15')).toBe(4.25)
    expect(calculateDocumentedHours('13:00', '09:00')).toBe(null)
  })
})
