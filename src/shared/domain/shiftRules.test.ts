import { describe, expect, it } from 'vitest'
import {
  approveShift,
  buildBillingExport,
  canSubmitShift,
  createBillingLine,
  submitShift,
  validateProgressNote,
} from './shiftRules'
import { makeDemoShift } from './testFactories'

describe('shift documentation rules', () => {
  it('rejects progress notes missing required fields and required task proof', () => {
    const shift = makeDemoShift({
      progressNote: {
        startTime: '',
        endTime: '15:00',
        servicesProvided: '',
        clientResponse: 'Client practiced meal planning.',
        narrative: 'Short visit.',
      },
      tasks: [
        {
          id: 'task-proof',
          title: 'Medication support observed',
          requiredProof: true,
          status: 'complete',
        },
      ],
    })

    const result = validateProgressNote(shift.progressNote, shift.tasks)

    expect(result.valid).toBe(false)
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'Start time is required.',
        'Services provided is required.',
        'Medication support observed requires proof.',
      ]),
    )
    expect(canSubmitShift(shift)).toBe(false)
  })

  it('allows caregivers to submit only complete documentation', () => {
    const shift = makeDemoShift()

    const submitted = submitShift(shift, 'cg-1')

    expect(submitted.status).toBe('submitted')
    expect(submitted.progressNote.submittedBy).toBe('cg-1')
  })

  it('prevents billing-ready state before coordinator approval', () => {
    const submitted = submitShift(makeDemoShift(), 'cg-1')

    expect(() => createBillingLine(submitted)).toThrow(
      'Coordinator approval is required before billing.',
    )

    const approved = approveShift(submitted, 'co-1', 'Documentation complete.')
    const line = createBillingLine(approved)

    expect(approved.status).toBe('billing_ready')
    expect(line.amount).toBeGreaterThan(0)
  })

  it('exports only approved documented shifts and reports excluded blockers', () => {
    const submitted = submitShift(makeDemoShift({ id: 'submitted' }), 'cg-1')
    const approved = approveShift(
      submitShift(makeDemoShift({ id: 'approved' }), 'cg-1'),
      'co-1',
      'Approved.',
    )
    const incomplete = makeDemoShift({
      id: 'incomplete',
      progressNote: {
        startTime: '',
        endTime: '',
        servicesProvided: '',
        clientResponse: '',
        narrative: '',
      },
    })

    const result = buildBillingExport([submitted, approved, incomplete])

    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].shiftId).toBe('approved')
    expect(result.excluded.map((item) => item.shiftId)).toEqual([
      'submitted',
      'incomplete',
    ])
  })
})
