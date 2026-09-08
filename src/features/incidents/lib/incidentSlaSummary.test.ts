import { describe, expect, it } from 'vitest'
import { incidentSlaSummary } from './incidentSlaSummary'

const NOW = '2026-08-20T12:00:00.000Z'

function makeIncident(overrides: Record<string, unknown> = {}) {
  return {
    status: 'draft',
    verbalDueAt: '2026-08-20T18:00:00.000Z',
    writtenDueAt: '2026-08-21T18:00:00.000Z',
    verbalBreached: false,
    writtenBreached: false,
    agenciesNotified: [] as string[],
    ...overrides,
  }
}

describe('incidentSlaSummary', () => {
  it('counts the filed report as the first part and points at the 24h call', () => {
    const summary = incidentSlaSummary(makeIncident(), NOW)

    expect(summary.tone).toBe('warning')
    expect(summary.partsDone).toBe(1)
    expect(summary.message).toBe(
      'Call the regional center within 6 hours — 1 of 5 parts done',
    )
  })

  it('moves to the written-report countdown once the call is recorded', () => {
    const summary = incidentSlaSummary(
      makeIncident({
        verbalReportedAt: '2026-08-20T10:00:00.000Z',
        agenciesNotified: ['aps'],
        familyContacted: { who: 'Jane', at: '2026-08-20T00:00:00.000Z' },
      }),
      NOW,
    )

    expect(summary.tone).toBe('warning')
    // filed + verbal + agencies + family = 4 of 5
    expect(summary.message).toBe('Written report due in 30 hours — 4 of 5 parts done')
  })

  it('turns danger when the written deadline is breached', () => {
    const summary = incidentSlaSummary(
      makeIncident({
        verbalReportedAt: '2026-08-20T10:00:00.000Z',
        writtenBreached: true,
        writtenDueAt: '2026-08-19T18:00:00.000Z',
      }),
      NOW,
    )

    expect(summary.tone).toBe('danger')
    expect(summary.message).toBe(
      'The written report is overdue by 18 hours — 2 of 5 parts done',
    )
  })

  it('turns danger when the 24h call is overdue', () => {
    const summary = incidentSlaSummary(
      makeIncident({
        verbalBreached: true,
        verbalDueAt: '2026-08-20T06:00:00.000Z',
      }),
      NOW,
    )

    expect(summary.tone).toBe('danger')
    expect(summary.message).toBe(
      'The 24-hour call to the regional center is overdue by 6 hours — 1 of 5 parts done',
    )
  })

  it('reports success once both reports are in', () => {
    const summary = incidentSlaSummary(
      makeIncident({
        status: 'written_submitted',
        verbalReportedAt: '2026-08-20T10:00:00.000Z',
        writtenSubmittedAt: '2026-08-21T10:00:00.000Z',
        agenciesNotified: ['law_enforcement'],
      }),
      NOW,
    )

    expect(summary.tone).toBe('success')
    expect(summary.message).toBe('All reports are in — 4 of 5 parts done')
  })

  it('reports success for closed incidents', () => {
    const summary = incidentSlaSummary(makeIncident({ status: 'closed' }), NOW)

    expect(summary.tone).toBe('success')
    expect(summary.message).toContain('All reports are in')
  })

  it('switches to days past 48 hours', () => {
    const summary = incidentSlaSummary(
      makeIncident({
        verbalBreached: true,
        verbalDueAt: '2026-08-17T12:00:00.000Z',
      }),
      NOW,
    )

    expect(summary.message).toContain('overdue by 3 days')
  })
})
