import {
  isPlatformTrainingComplete,
  markTrainingCompletedInSession,
  clearTrainingCompletedSession,
} from './trainingCompletion'

describe('isPlatformTrainingComplete', () => {
  let originalDateNow: typeof Date.now

  beforeEach(() => {
    clearTrainingCompletedSession()
    originalDateNow = Date.now
  })

  afterEach(() => {
    Date.now = originalDateNow
    clearTrainingCompletedSession()
  })

  it('returns true for complete status', () => {
    expect(
      isPlatformTrainingComplete([
        { trainingId: 'platform_training', status: 'complete' },
      ]),
    ).toBe(true)
  })

  it('returns true for completed status', () => {
    expect(
      isPlatformTrainingComplete([
        { trainingId: 'platform_training', status: 'completed' },
      ]),
    ).toBe(true)
  })

  it('returns false for other statuses', () => {
    expect(
      isPlatformTrainingComplete([
        { trainingId: 'platform_training', status: 'in_progress' },
      ]),
    ).toBe(false)
  })

  it('returns true while session flag is active even if query is empty', () => {
    markTrainingCompletedInSession()
    expect(isPlatformTrainingComplete([])).toBe(true)
  })

  it('session flag expires after the grace window', () => {
    markTrainingCompletedInSession()
    const now = Date.now()
    Date.now = () => now + 600_000
    expect(isPlatformTrainingComplete([])).toBe(false)
  })
})
