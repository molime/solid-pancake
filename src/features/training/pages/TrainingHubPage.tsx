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
      <div className="relative overflow-hidden rounded-[var(--radius-atria-lg)] border border-atria-border bg-gradient-to-br from-atria-accent/20 via-atria-info/10 to-atria-warning/10 p-5 lg:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-atria-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-atria-info/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-atria-accent text-atria-on-accent">
                <GraduationCap className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold text-atria-ink">Training</h1>
            </div>
            <p className="text-base text-atria-text-secondary">
              Complete your assigned courses. Progress is saved automatically.
            </p>
          </div>
          <div className="rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface/80 p-4 backdrop-blur lg:min-w-[220px]">
            <p className="text-xs font-medium uppercase tracking-wide text-atria-text-muted">
              Overall progress
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-atria-surface-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-atria-accent to-atria-info transition-all duration-500"
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
