export const PLATFORM_TRAINING_ID = 'platform_training'

export const COMPLETE_STATUSES = ['complete', 'completed']

const SESSION_KEY = 'atria_training_complete_until'
// Short grace period so the client does not bounce between /onboarding/training
// and /caregiver/today while Convex mutations propagate to listMyCompletions.
const SESSION_MS = 30_000

export function isPlatformTrainingComplete(
  completions: Array<{ trainingId: string; status: string }> | undefined,
): boolean {
  if (isTrainingCompletedInSession()) return true
  if (!completions) return false
  return completions.some(
    (c) =>
      c.trainingId === PLATFORM_TRAINING_ID &&
      COMPLETE_STATUSES.includes(c.status),
  )
}

export function markTrainingCompletedInSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_MS))
  } catch {
    // ignore
  }
}

export function isTrainingCompletedInSession(): boolean {
  try {
    const until = Number(sessionStorage.getItem(SESSION_KEY))
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

export function clearTrainingCompletedSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
