import { describe, expect, it } from 'vitest'
import { normalizeWorker } from './adpClient'

describe('normalizeWorker', () => {
  it('extracts emailUri from object-shaped ADP emailAddresses', () => {
    const worker = {
      associateOID: 'aoid-123',
      workerID: 'w-123',
      personName: { givenName: 'Jane', familyName: 'Doe' },
      workAssignments: [
        {
          emailAddresses: [{ emailUri: 'jane.doe@example.com' }],
        },
      ],
      status: 'active',
    }

    const result = normalizeWorker(worker as Record<string, unknown>)
    expect(result.email).toBe('jane.doe@example.com')
    expect(result.displayName).toBe('Jane Doe')
    expect(result.associateOID).toBe('aoid-123')
    expect(result.workerID).toBe('w-123')
    expect(result.status).toBe('active')
  })

  it('falls back to person.communication.emails when workAssignments has no email', () => {
    const worker = {
      associateOID: 'aoid-456',
      person: {
        communication: {
          emails: [{ emailUri: 'fallback@example.com' }],
        },
      },
      status: 'active',
    }

    const result = normalizeWorker(worker as Record<string, unknown>)
    expect(result.email).toBe('fallback@example.com')
    expect(result.displayName).toBe('Unnamed Worker')
  })

  it('handles plain string emailAddresses without turning objects into [object Object]', () => {
    const worker = {
      associateOID: 'aoid-789',
      workAssignments: [
        {
          emailAddresses: ['plain@example.com'],
        },
      ],
    }

    const result = normalizeWorker(worker as Record<string, unknown>)
    expect(result.email).toBe('plain@example.com')
  })

  it('prefers the first valid email when earlier entries are malformed', () => {
    const worker = {
      associateOID: 'aoid-mixed',
      workAssignments: [
        {
          emailAddresses: [{}, { emailUri: 'valid@example.com' }],
        },
      ],
    }

    const result = normalizeWorker(worker as Record<string, unknown>)
    expect(result.email).toBe('valid@example.com')
  })
})
