export type TrainingStepType =
  | 'text'
  | 'video'
  | 'image'
  | 'policy'
  | 'quiz'
  | 'embed'
  | 'slides'

export interface TrainingSlide {
  id: string
  title: string
  body: string
  imageUrl?: string
  narration?: string
  audioUrl?: string
}

export type TrainingStep = {
  id: string
  title: string
  type: TrainingStepType
  content: string
  caption?: string
  minDurationSec?: number
  required: boolean
}

export type QuizQuestion = {
  question: string
  options: string[]
  correct: number
}

export type TrainingCourse = {
  _id: string
  _creationTime: number
  tenantId: string
  courseKey: string
  title: string
  description: string
  category:
    | 'agency_onboarding'
    | 'regulatory'
    | 'safety'
    | 'skills'
    | 'other'
  durationMinutes: number
  steps: TrainingStep[]
  passingScore: number
  requiredRoles?: string[]
  active: boolean
  isDefault: boolean
  createdAt: string
}

export type CourseWithProgress = TrainingCourse & {
  progressPercent: number
  isCompleted: boolean
  isAssignable: boolean
  completedStepIds: string[]
  expiresAt: string | null
}

export type CourseDetail = TrainingCourse & {
  completedStepIds: string[]
  isCompleted: boolean
  expiresAt: string | null
}

export function parseQuiz(content: string): QuizQuestion[] {
  try {
    return (JSON.parse(content).questions ?? []) as QuizQuestion[]
  } catch {
    return []
  }
}

export function parseSlides(content: string): TrainingSlide[] {
  try {
    const parsed = JSON.parse(content)
    return (Array.isArray(parsed) ? parsed : parsed.slides ?? []) as TrainingSlide[]
  } catch {
    return []
  }
}

export function youtubeEmbedUrl(url: string): string {
  if (url.includes('/embed/')) return url
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
  )
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`
  }
  return url
}

export const CATEGORY_LABELS: Record<TrainingCourse['category'], string> = {
  agency_onboarding: 'Agency Onboarding',
  regulatory: 'Regulatory Compliance',
  safety: 'Safety & Emergency',
  skills: 'Care Skills',
  other: 'Other',
}

export const CATEGORY_COLORS: Record<TrainingCourse['category'], string> = {
  agency_onboarding: 'bg-atria-info text-atria-info',
  regulatory: 'bg-atria-warning text-atria-warning',
  safety: 'bg-atria-danger text-atria-danger',
  skills: 'bg-atria-success text-atria-success',
  other: 'bg-atria-neutral text-atria-neutral',
}
