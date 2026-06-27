import { describe, expect, it } from 'vitest'
import {
  WIZARD_STEPS,
  stepIndexFor,
  validateStep,
  buildAutosavePatch,
  isStepComplete,
} from './documentationWizard'
import { noteDraftFromNote } from './documentationDraft'

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

const emptyNote = noteDraftFromNote({})
const completeNote = noteDraftFromNote({
  startTime: '09:00',
  endTime: '13:00',
  servicesProvided: 'Community integration',
  clientResponse: 'Client participated.',
  narrative: 'Supported morning routine.',
})

const completeTaskDrafts = [
  { taskId: 'task-1', status: 'complete' as const, proofName: 'med-log.jpg' },
  { taskId: 'task-2', status: 'complete' as const },
]

describe('documentation wizard', () => {
  it('defines six ordered steps with accent colors', () => {
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual([
      'when',
      'what',
      'how',
      'goal',
      'issues',
      'done',
    ])
    expect(WIZARD_STEPS[0].accent).toBe('text-atria-step-when')
    expect(WIZARD_STEPS[4].accent).toBe('text-atria-step-issues')
  })

  it('maps step ids to indices', () => {
    expect(stepIndexFor('when')).toBe(0)
    expect(stepIndexFor('done')).toBe(5)
  })

  it('validates only the current step fields', () => {
    const partialNote = noteDraftFromNote({
      startTime: '09:00',
      endTime: '08:00',
    })
    expect(validateStep('when', partialNote, [], tasks)).toContain(
      'End time must be after start time.',
    )
    expect(validateStep('what', partialNote, [], tasks)).toEqual([
      'Services provided is required.',
    ])

    const noteWithWhenOnly = noteDraftFromNote({
      startTime: '09:00',
      endTime: '10:00',
    })
    expect(validateStep('when', noteWithWhenOnly, [], tasks)).toEqual([])
    expect(validateStep('what', noteWithWhenOnly, [], tasks)).toEqual([
      'Services provided is required.',
    ])
  })

  it('flags missing task completion on the issues step', () => {
    expect(validateStep('issues', completeNote, [], tasks)).toContain(
      'Medication support observed must be completed.',
    )
  })

  it('builds an autosave patch for the active step only', () => {
    const patch = buildAutosavePatch('when', completeNote)
    expect(patch).toEqual({
      startTime: '09:00',
      endTime: '13:00',
    })
    expect(buildAutosavePatch('what', completeNote)).toEqual({
      servicesProvided: 'Community integration',
    })
  })

  it('reports step completion', () => {
    expect(isStepComplete('when', completeNote, [], tasks)).toBe(true)
    expect(isStepComplete('issues', completeNote, completeTaskDrafts, tasks)).toBe(true)
    expect(isStepComplete('done', completeNote, completeTaskDrafts, tasks)).toBe(true)
    expect(isStepComplete('what', emptyNote, [], tasks)).toBe(false)
  })
})
