import { describe, it, expect } from 'vitest'
import { sanitizeConvexError } from './sanitizeConvexError'

describe('sanitizeConvexError', () => {
  it('returns a plain message unchanged', () => {
    expect(sanitizeConvexError('Candidate profile not found.')).toBe(
      'Candidate profile not found.',
    )
  })

  it('strips everything after the first newline', () => {
    expect(
      sanitizeConvexError(
        'Candidate profile not found.\n    at async handler (../convex/candidates.ts:1135:11)\n    at somethingElse',
      ),
    ).toBe('Candidate profile not found.')
  })

  it('strips the [CONVEX ...] transport prefix', () => {
    expect(
      sanitizeConvexError(
        '[CONVEX M(candidates:submitApplication)] Candidate profile not found.',
      ),
    ).toBe('Candidate profile not found.')
  })

  it('strips the [Request ID: ...] prefix', () => {
    expect(
      sanitizeConvexError(
        '[Request ID: abc123] Server Error: Uncaught ConvexError: Candidate profile not found.',
      ),
    ).toBe('Candidate profile not found.')
  })

  it('strips the Server Error prefix', () => {
    expect(sanitizeConvexError('Server Error Candidate profile not found.')).toBe(
      'Candidate profile not found.',
    )
  })

  it('strips the Uncaught ConvexError prefix', () => {
    expect(
      sanitizeConvexError('Uncaught ConvexError: Candidate profile not found.'),
    ).toBe('Candidate profile not found.')
  })

  it('strips the Uncaught Error prefix', () => {
    expect(sanitizeConvexError('Uncaught Error: Something broke.')).toBe(
      'Something broke.',
    )
  })

  it('strips repeated prefixes from nested action errors', () => {
    expect(
      sanitizeConvexError('Uncaught Error: Uncaught Error: Something broke.'),
    ).toBe('Something broke.')
    expect(
      sanitizeConvexError(
        'Server Error Uncaught Error: Uncaught Error: Missing STRIPE_SECRET_KEY environment variable',
      ),
    ).toBe('Missing STRIPE_SECRET_KEY environment variable')
  })

  it('strips the full Convex transport wrapper stack', () => {
    expect(
      sanitizeConvexError(
        '[CONVEX M(candidates:submitApplication)] [Request ID: 7f3a2b] Server Error\nUncaught ConvexError: Candidate profile not found.\n    at async handler (../convex/candidates.ts:1135:11)',
      ),
    ).toBe('Candidate profile not found.')
  })

  it('strips the inline at async handler suffix', () => {
    expect(
      sanitizeConvexError(
        'Given password is not strong enough. at async handler (../convex/candidates.ts:2609:6) Called by client',
      ),
    ).toBe('Given password is not strong enough.')
  })

  it('strips the Called by client suffix', () => {
    expect(
      sanitizeConvexError('Invoice creation failed. Called by client'),
    ).toBe('Invoice creation failed.')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeConvexError('  Padded message.  ')).toBe('Padded message.')
  })
})
