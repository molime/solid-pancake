import { Clock, Play, CheckCircle2, Lock, AlertCircle, GraduationCap, ShieldAlert, HeartPulse, Sparkles, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import type { CourseWithProgress } from '../model/courseTypes'
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_ICON_COLORS,
} from '../model/courseTypes'
import { CourseProgress } from './CourseProgress'

const CATEGORY_ICONS = {
  agency_onboarding: GraduationCap,
  regulatory: BookOpen,
  safety: ShieldAlert,
  skills: HeartPulse,
  other: Sparkles,
} as const

function getExpiryStatus(expiresAt: string | null | undefined) {
  if (!expiresAt) return null
  const expiry = new Date(expiresAt).getTime()
  const now = Date.now()
  const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
  if (daysUntilExpiry < 0) return { label: 'Expired', variant: 'danger' as const }
  if (daysUntilExpiry <= 30) return { label: 'Due for renewal', variant: 'warning' as const }
  return null
}

export function CourseCard({
  course,
  onStart,
}: {
  course: CourseWithProgress
  onStart: () => void
}) {
  const categoryClass = CATEGORY_COLORS[course.category]
  const CategoryIcon = CATEGORY_ICONS[course.category]
  const iconColorClass = CATEGORY_ICON_COLORS[course.category]
  const expiryStatus = course.isCompleted ? getExpiryStatus(course.expiresAt) : null

  return (
    <Card
      className={cn(
        'flex flex-col transition-all hover:border-atria-border-strong',
        !course.isAssignable && 'opacity-70',
      )}
    >
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-[var(--radius-atria-md)] text-white',
                iconColorClass,
              )}
            >
              <CategoryIcon className="h-5 w-5" />
            </span>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                categoryClass,
              )}
            >
              {CATEGORY_LABELS[course.category]}
            </span>
          </div>
          {course.isCompleted && !expiryStatus && (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-atria-success" />
          )}
          {expiryStatus?.variant === 'warning' && (
            <span className="flex items-center gap-1 rounded-full bg-atria-warning-bg px-2 py-0.5 text-[11px] font-semibold text-atria-warning">
              <AlertCircle className="h-3 w-3" />
              {expiryStatus.label}
            </span>
          )}
          {expiryStatus?.variant === 'danger' && (
            <span className="flex items-center gap-1 rounded-full bg-atria-danger-bg px-2 py-0.5 text-[11px] font-semibold text-atria-danger">
              <AlertCircle className="h-3 w-3" />
              {expiryStatus.label}
            </span>
          )}
          {!course.isAssignable && !course.isCompleted && (
            <Lock className="h-4 w-4 shrink-0 text-atria-text-muted" />
          )}
        </div>

        <h3 className="mb-1 text-lg font-bold text-atria-ink">{course.title}</h3>
        <p className="mb-4 text-sm text-atria-text-secondary line-clamp-2">
          {course.description}
        </p>

        <div className="mb-4 flex items-center gap-4 text-xs text-atria-text-muted">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {course.durationMinutes} min
          </div>
          <div>{course.steps.length} steps</div>
        </div>

        <div className="mt-auto space-y-4">
          <CourseProgress
            percent={course.progressPercent}
            completed={course.isCompleted}
          />
          <Button
            variant={course.isCompleted ? 'secondary' : 'primary'}
            className="w-full"
            disabled={!course.isAssignable}
            onClick={onStart}
          >
            {course.isCompleted ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Review course
              </>
            ) : course.progressPercent > 0 ? (
              <>
                <Play className="h-4 w-4" />
                Continue
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start course
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
