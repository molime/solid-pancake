import { Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useTenant } from '@/app/useTenant'
import { isPlatformTrainingComplete } from '@/features/onboarding/model/trainingCompletion'
import { areNewCoursesComplete } from '@/app/shell/RouteGuard'
import { AlertTriangle } from 'lucide-react'

/**
 * Persistent reminder on the caregiver dashboard while required training is
 * incomplete. Hidden once every required course is completed (or while the
 * caregiver is inside the training flow — those pages replace the dashboard).
 */
export function TrainingReminderBanner() {
  const { clerkOrgId } = useTenant()

  const completions = useQuery(
    api.platformTrainingCompletions.listMyCompletions,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const hasTrainingProduct = useQuery(
    api.agencyConfig.hasProduct,
    clerkOrgId ? { clerkOrgId, productKey: 'training' } : 'skip',
  )
  const courses = useQuery(
    api.training.listCourses,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  if (!completions || hasTrainingProduct === undefined || !courses) {
    return null
  }

  const complete =
    isPlatformTrainingComplete(completions) ||
    (hasTrainingProduct &&
      areNewCoursesComplete(courses, completions, 'org:caregiver'))

  if (complete) return null

  const trainingPath = hasTrainingProduct ? '/training' : '/onboarding/training'

  return (
    <div className='flex flex-col gap-3 rounded-[var(--radius-atria-md)] border border-atria-warning/40 bg-atria-warning-bg p-4 sm:flex-row sm:items-center'>
      <div className='flex flex-1 items-start gap-3'>
        <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-atria-warning' />
        <div>
          <p className='text-sm font-semibold text-atria-ink'>
            Training required
          </p>
          <p className='text-sm text-atria-text-secondary'>
            You have training courses waiting to be completed. Finish them to
            stay compliant and keep your certificate valid.
          </p>
        </div>
      </div>
      <Link
        to={trainingPath}
        className='inline-flex shrink-0 items-center justify-center rounded-[var(--radius-atria-md)] bg-atria-warning px-4 py-2 text-sm font-medium text-white hover:opacity-90'
      >
        Go to training →
      </Link>
    </div>
  )
}
