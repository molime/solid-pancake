import { useTenant } from '@/app/useTenant'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { AppLoader } from '@/shared/ui/AppLoader'
import { EmptyState } from '@/shared/ui/EmptyState'
import { GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { CourseWithProgress } from '../model/courseTypes'
import { CourseCard } from '../components/CourseCard'

export function TrainingHubPage() {
  const navigate = useNavigate()
  const { clerkOrgId } = useTenant()
  const courses = useQuery(
    api.training.listCourses,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  if (!clerkOrgId || courses === undefined) {
    return <AppLoader fullScreen label="Loading training..." />
  }

  const assignable = (courses ?? []).filter((c) => c.isAssignable)
  const completedCount = assignable.filter((c) => c.isCompleted).length
  const totalRequired = Math.max(assignable.length, 1)
  const overallProgress = Math.round((completedCount / totalRequired) * 100)

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Training</h1>
          <p className="text-base text-atria-text-secondary">
            Complete your assigned courses. Progress is saved automatically.
          </p>
        </div>
        <div className="rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface p-4 lg:min-w-[220px]">
          <p className="text-xs font-medium uppercase tracking-wide text-atria-text-muted">
            Overall progress
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-atria-surface-3">
              <div
                className="h-full rounded-full bg-atria-accent transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <span className="text-sm font-bold text-atria-ink">
              {overallProgress}%
            </span>
          </div>
          <p className="mt-1 text-xs text-atria-text-muted">
            {completedCount} of {assignable.length} completed
          </p>
        </div>
      </div>

      {assignable.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-8 w-8" />}
          title="No courses assigned"
          description="Your agency has not assigned any training courses to you yet."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assignable.map((course) => (
            <CourseCard
              key={course._id}
              course={course as CourseWithProgress}
              onStart={() => navigate(`/training/${course._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
