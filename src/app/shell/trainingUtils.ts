/**
 * True when every training course required for `role` has a current
 * (non-expired) completion. Shared by the dashboard route guard and the
 * caregiver TrainingReminderBanner.
 */
export function areNewCoursesComplete(
  courses: Array<{ requiredRoles?: string[] | null; courseKey: string; _id: string }> | undefined,
  completions: Array<{ trainingId: string; status: string; expiresAt?: string | null }> | undefined,
  role: string,
) {
  if (!courses || courses.length === 0) return false
  const completedIds = new Set(
    (completions ?? [])
      .filter((c) => {
        if (!['complete', 'completed'].includes(c.status)) return false
        if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) return false
        return true
      })
      .map((c) => c.trainingId),
  )
  const requiredForRole = courses.filter(
    (c) =>
      !c.requiredRoles ||
      c.requiredRoles.length === 0 ||
      c.requiredRoles.includes(role),
  )
  if (requiredForRole.length === 0) return false
  return requiredForRole.every((c) => completedIds.has(c.courseKey))
}
