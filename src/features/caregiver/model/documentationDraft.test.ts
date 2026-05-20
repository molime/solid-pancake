import { describe, expect, it } from 'vitest'
import {
  createTaskDrafts,
  noteDraftFromNote,
  updateTaskDraft,
  validateDocumentationDraft,
} from './documentationDraft'

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
    status: 'complete' as const,
  },
]

describe('caregiver documentation draft', () => {
  it('creates editable task drafts from the loaded shift tasks', () => {
    const drafts = createTaskDrafts(tasks)

    expect(drafts).toEqual([
      {
        taskId: 'task-1',
        status: 'pending',
        proofUrl: undefined,
        proofName: undefined,
      },
      {
        taskId: 'task-2',
        status: 'complete',
        proofUrl: undefined,
        proofName: undefined,
      },
    ])
  })

  it('updates a task even when the previous draft list was empty', () => {
    const drafts = updateTaskDraft([], 'task-1', { status: 'complete' })

    expect(drafts).toEqual([
      {
        taskId: 'task-1',
        status: 'complete',
      },
    ])
  })

  it('blocks submission until required note fields, task completion, and proof are present', () => {
    const note = noteDraftFromNote({
      startTime: '09:00',
      endTime: '13:00',
      servicesProvided: 'Community integration',
      clientResponse: 'Client participated.',
      narrative: 'Supported morning routine.',
    })

    const missingProof = updateTaskDraft(createTaskDrafts(tasks), 'task-1', {
      status: 'complete',
    })

    expect(validateDocumentationDraft(note, missingProof, tasks)).toContain(
      'Medication support observed requires proof.',
    )

    const complete = updateTaskDraft(missingProof, 'task-1', {
      proofName: 'med-log.jpg',
    })

    expect(validateDocumentationDraft(note, complete, tasks)).toEqual([])
  })
})
