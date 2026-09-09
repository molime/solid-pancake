import { v } from 'convex/values'
import { mutation, query, internalMutation } from './_generated/server'
import { ConvexError } from 'convex/values'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { ensureCaregiverEmployeeProfile } from './employeeProfiles'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

const trainingStepType = v.union(
  v.literal('text'),
  v.literal('video'),
  v.literal('image'),
  v.literal('policy'),
  v.literal('quiz'),
  v.literal('embed'),
  v.literal('slides'),
)

const trainingStep = v.object({
  id: v.string(),
  title: v.string(),
  type: trainingStepType,
  content: v.string(),
  caption: v.optional(v.string()),
  minDurationSec: v.optional(v.number()),
  required: v.boolean(),
})

const LEARNER_ROLES: (
  | 'org:admin'
  | 'org:coordinator'
  | 'org:hr'
  | 'org:caregiver'
  | 'org:candidate'
)[] = ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver', 'org:candidate']

const ADMIN_ROLES: ('org:admin' | 'org:hr')[] = ['org:admin', 'org:hr']

const TRAINING_CERTIFICATE_CATEGORY = 'training_certificate'
const PLATFORM_TRAINING_ID = 'platform_training'
const CERTIFICATE_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000

function oneYearFrom(iso: string): string {
  return new Date(new Date(iso).getTime() + CERTIFICATE_VALIDITY_MS).toISOString()
}

async function getMember(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
): Promise<Doc<'tenantMembers'> | null> {
  return ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
    )
    .unique()
}

async function ensureTrainingCredentialRequirement(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
) {
  const existing = await ctx.db
    .query('credentialRequirements')
    .withIndex('by_tenant_role', (q) =>
      q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
    )
    .filter((q) => q.eq(q.field('category'), TRAINING_CERTIFICATE_CATEGORY))
    .first()
  if (existing) return existing._id
  return ctx.db.insert('credentialRequirements', {
    tenantId,
    role: 'org:caregiver',
    category: TRAINING_CERTIFICATE_CATEGORY,
    label: 'Training Certificate',
    isRequired: true,
    expiryMonths: 12,
  })
}

async function createCertificateDocument(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  identity: { subject: string },
  employeeProfileId: Id<'employeeProfiles'>,
  course: Doc<'trainingCourses'>,
  completedAt: string,
  expiresAt: string,
) {
  const certificateText =
    `TRAINING CERTIFICATE\n\n` +
    `Course: ${course.title}\n` +
    `Completed: ${completedAt}\n` +
    `Valid until: ${expiresAt}\n\n` +
    `This certificate verifies the holder has completed the required training.`

  const fileId = await ctx.db.insert('files', {
    tenantId,
    storageId: `training-cert-${course.courseKey}-${identity.subject}-${Date.now()}`,
    uploadedBy: identity.subject,
    fileName: `${course.title} Certificate.txt`,
    contentType: 'text/plain',
    size: certificateText.length,
    linkedType: 'complianceDoc',
    linkedId: `training-cert-${course.courseKey}-${identity.subject}`,
    visibility: 'all_staff',
    createdAt: completedAt,
  })

  await ctx.db.insert('documentArchiveItems', {
    tenantId,
    fileId,
    subjectType: 'employee',
    subjectId: employeeProfileId as string,
    category: TRAINING_CERTIFICATE_CATEGORY,
    status: 'verified',
    expiresAt,
    source: 'training',
    verifiedBy: identity.subject,
    verifiedAt: completedAt,
    createdAt: completedAt,
  })
}

async function recomputePlatformTrainingCompletion(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
  role: string,
  nowIso: string,
) {
  const activeCourses = await ctx.db
    .query('trainingCourses')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .filter((q) => q.eq(q.field('active'), true))
    .collect()

  const requiredCourses = activeCourses.filter(
    (c) =>
      !c.requiredRoles ||
      c.requiredRoles.length === 0 ||
      c.requiredRoles.includes(role),
  )

  if (requiredCourses.length === 0) return

  const completions = await ctx.db
    .query('platformTrainingCompletions')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
    )
    .collect()

  const completionByCourse = new Map(
    completions.map((c) => [c.trainingId, c] as const),
  )

  const now = new Date(nowIso).getTime()
  const allCurrent = requiredCourses.every((course) => {
    const completion = completionByCourse.get(course.courseKey)
    if (!completion) return false
    if (completion.expiresAt && new Date(completion.expiresAt).getTime() <= now)
      return false
    return true
  })

  const existingPlatform = completions.find(
    (c) => c.trainingId === PLATFORM_TRAINING_ID,
  )

  if (!allCurrent) {
    if (existingPlatform) {
      await ctx.db.patch(existingPlatform._id, {
        status: 'expired',
        expiresAt: existingPlatform.expiresAt ?? nowIso,
      })
    }
    return
  }

  const earliestExpiry = requiredCourses
    .map((c) => completionByCourse.get(c.courseKey)?.expiresAt)
    .filter((d): d is string => !!d)
    .sort()[0]

  if (existingPlatform) {
    await ctx.db.patch(existingPlatform._id, {
      completedAt: nowIso,
      status: 'completed',
      expiresAt: earliestExpiry,
    })
  } else {
    await ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId,
      trainingId: PLATFORM_TRAINING_ID,
      completedAt: nowIso,
      status: 'completed',
      expiresAt: earliestExpiry,
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

export const listCourses = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      clerkOrgId,
      LEARNER_ROLES,
    )

    const courses = await ctx.db
      .query('trainingCourses')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .filter((q) => q.eq(q.field('active'), true))
      .order('asc')
      .collect()

    const completions = await ctx.db
      .query('trainingStepCompletions')
      .withIndex('by_tenant_user_course', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .collect()

    const platformCompletions = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .collect()

    const completedCourseIds = new Set(
      platformCompletions.map((c) => c.trainingId),
    )

    return courses.map((course) => {
      const requiredSteps = course.steps.filter((s) => s.required)
      const completedStepIds = new Set(
        completions
          .filter((c) => c.courseId === course._id)
          .map((c) => c.stepId),
      )
      const completedRequiredCount = requiredSteps.filter((s) =>
        completedStepIds.has(s.id),
      ).length
      const totalRequired = Math.max(requiredSteps.length, 1)
      const progressPercent = Math.round(
        (completedRequiredCount / totalRequired) * 100,
      )
      const isCompleted = completedCourseIds.has(course.courseKey)
      const isAssignable =
        !course.requiredRoles ||
        course.requiredRoles.length === 0 ||
        course.requiredRoles.includes(role)
      const completion = platformCompletions.find(
        (c) => c.trainingId === course.courseKey,
      )

      return {
        ...course,
        progressPercent,
        isCompleted,
        isAssignable,
        completedStepIds: Array.from(completedStepIds),
        expiresAt: completion?.expiresAt ?? null,
      }
    })
  },
})

export const listAllCourses = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ADMIN_ROLES)

    return await ctx.db
      .query('trainingCourses')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .order('asc')
      .collect()
  },
})

export const getCourse = query({
  args: { clerkOrgId: v.string(), courseId: v.id('trainingCourses') },
  handler: async (ctx, { clerkOrgId, courseId }) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      clerkOrgId,
      LEARNER_ROLES,
    )

    const course = await ctx.db.get(courseId)
    if (!course) throw new ConvexError('Course not found.')
    assertTenantDoc(course, tenantId)

    const completions = await ctx.db
      .query('trainingStepCompletions')
      .withIndex('by_tenant_user_course_step', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('clerkUserId', identity.subject)
          .eq('courseId', courseId),
      )
      .collect()

    const completedStepIds = new Set(completions.map((c) => c.stepId))
    const completion = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .filter((q) => q.eq(q.field('trainingId'), course.courseKey))
      .first()

    return {
      ...course,
      completedStepIds: Array.from(completedStepIds),
      isCompleted: !!completion,
      expiresAt: completion?.expiresAt ?? null,
    }
  },
})

export const getCourseCertificate = query({
  args: { clerkOrgId: v.string(), courseId: v.id('trainingCourses') },
  handler: async (ctx, { clerkOrgId, courseId }) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      clerkOrgId,
      LEARNER_ROLES,
    )

    const course = await ctx.db.get(courseId)
    if (!course) throw new ConvexError('Course not found.')
    assertTenantDoc(course, tenantId)

    const completion = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .filter((q) => q.eq(q.field('trainingId'), course.courseKey))
      .first()

    if (!completion) return null

    const certificateLinkedId = `training-cert-${course.courseKey}-${identity.subject}`
    const file = await ctx.db
      .query('files')
      .withIndex('by_tenant_linked', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('linkedType', 'complianceDoc')
          .eq('linkedId', certificateLinkedId),
      )
      .first()

    // The certificate must show the employee's name, not their Clerk user id.
    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .first()
    let recipientName = member?.displayName
    if (!recipientName) {
      const profile = await ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
        )
        .first()
      recipientName = profile?.displayName
    }

    return {
      course,
      completion,
      file,
      recipientName: recipientName ?? null,
    }
  },
})

export const listCompletions = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ADMIN_ROLES)

    const courses = await ctx.db
      .query('trainingCourses')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()

    const completions = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    const byCourse = new Map<string, { clerkUserId: string; completedAt: string; status: string }[]>()
    for (const c of completions) {
      const list = byCourse.get(c.trainingId) ?? []
      list.push({
        clerkUserId: c.clerkUserId,
        completedAt: c.completedAt,
        status: c.status,
      })
      byCourse.set(c.trainingId, list)
    }

    return courses.map((course) => ({
      courseId: course._id,
      courseKey: course.courseKey,
      title: course.title,
      completions: byCourse.get(course.courseKey) ?? [],
    }))
  },
})

// ═══════════════════════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════════════════════

export const completeStep = mutation({
  args: {
    clerkOrgId: v.string(),
    courseId: v.id('trainingCourses'),
    stepId: v.string(),
  },
  handler: async (ctx, { clerkOrgId, courseId, stepId }) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      clerkOrgId,
      LEARNER_ROLES,
    )

    const course = await ctx.db.get(courseId)
    if (!course) throw new ConvexError('Course not found.')
    assertTenantDoc(course, tenantId)

    const step = course.steps.find((s) => s.id === stepId)
    if (!step) throw new ConvexError('Step not found in course.')

    const existing = await ctx.db
      .query('trainingStepCompletions')
      .withIndex('by_tenant_user_course_step', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('clerkUserId', identity.subject)
          .eq('courseId', courseId)
          .eq('stepId', stepId),
      )
      .first()

    if (existing) return existing._id

    return ctx.db.insert('trainingStepCompletions', {
      tenantId,
      clerkUserId: identity.subject,
      courseId,
      stepId,
      completedAt: new Date().toISOString(),
    })
  },
})

export const completeCourse = mutation({
  args: {
    clerkOrgId: v.string(),
    courseId: v.id('trainingCourses'),
  },
  handler: async (ctx, { clerkOrgId, courseId }) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      clerkOrgId,
      LEARNER_ROLES,
    )

    const course = await ctx.db.get(courseId)
    if (!course) throw new ConvexError('Course not found.')
    assertTenantDoc(course, tenantId)

    const completions = await ctx.db
      .query('trainingStepCompletions')
      .withIndex('by_tenant_user_course_step', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('clerkUserId', identity.subject)
          .eq('courseId', courseId),
      )
      .collect()

    const completedStepIds = new Set(completions.map((c) => c.stepId))
    const requiredSteps = course.steps.filter((s) => s.required)
    const allRequiredDone = requiredSteps.every((s) =>
      completedStepIds.has(s.id),
    )

    if (!allRequiredDone) {
      throw new ConvexError(
        'All required steps must be completed before finishing the course.',
      )
    }

    const completedAt = new Date().toISOString()
    const expiresAt = oneYearFrom(completedAt)

    const existing = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .filter((q) => q.eq(q.field('trainingId'), course.courseKey))
      .first()

    let courseCompletionId: Id<'platformTrainingCompletions'>
    if (existing) {
      await ctx.db.patch(existing._id, {
        completedAt,
        status: 'completed',
        expiresAt,
      })
      courseCompletionId = existing._id
    } else {
      courseCompletionId = await ctx.db.insert('platformTrainingCompletions', {
        tenantId,
        clerkUserId: identity.subject,
        trainingId: course.courseKey,
        completedAt,
        status: 'completed',
        expiresAt,
      })
    }

    // Issue a compliance-tracked certificate for caregiver employees.
    const member = await getMember(ctx, tenantId, identity.subject)
    if (member && member.role === 'org:caregiver') {
      const employeeProfileId = await ensureCaregiverEmployeeProfile(
        ctx,
        tenantId,
        member,
      )
      if (employeeProfileId) {
        await ensureTrainingCredentialRequirement(ctx, tenantId)
        await createCertificateDocument(
          ctx,
          tenantId,
          identity,
          employeeProfileId,
          course,
          completedAt,
          expiresAt,
        )
      }
    }

    // Recompute the legacy platform_training aggregate so route guards treat
    // the caregiver as trained only while all required courses are current.
    await recomputePlatformTrainingCompletion(
      ctx,
      tenantId,
      identity.subject,
      role,
      completedAt,
    )

    return courseCompletionId
  },
})

export const createCourse = mutation({
  args: {
    clerkOrgId: v.string(),
    courseKey: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal('agency_onboarding'),
      v.literal('regulatory'),
      v.literal('safety'),
      v.literal('skills'),
      v.literal('other'),
    ),
    durationMinutes: v.number(),
    steps: v.array(trainingStep),
    passingScore: v.optional(v.number()),
    requiredRoles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ADMIN_ROLES,
    )

    const existing = await ctx.db
      .query('trainingCourses')
      .withIndex('by_tenant_key', (q) =>
        q.eq('tenantId', tenantId).eq('courseKey', args.courseKey),
      )
      .first()

    if (existing) {
      throw new ConvexError(
        `A course with key "${args.courseKey}" already exists.`,
      )
    }

    if (!args.steps.length) {
      throw new ConvexError('A course must have at least one step.')
    }

    return ctx.db.insert('trainingCourses', {
      tenantId,
      courseKey: args.courseKey,
      title: args.title,
      description: args.description,
      category: args.category,
      durationMinutes: args.durationMinutes,
      steps: args.steps,
      passingScore: args.passingScore ?? 80,
      requiredRoles: args.requiredRoles,
      active: true,
      isDefault: false,
      createdAt: new Date().toISOString(),
    })
  },
})

export const updateCourse = mutation({
  args: {
    clerkOrgId: v.string(),
    courseId: v.id('trainingCourses'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal('agency_onboarding'),
        v.literal('regulatory'),
        v.literal('safety'),
        v.literal('skills'),
        v.literal('other'),
      ),
    ),
    durationMinutes: v.optional(v.number()),
    steps: v.optional(v.array(trainingStep)),
    passingScore: v.optional(v.number()),
    requiredRoles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ADMIN_ROLES,
    )

    const course = await ctx.db.get(args.courseId)
    if (!course) throw new ConvexError('Course not found.')
    assertTenantDoc(course, tenantId)

    const patch: Record<string, unknown> = {}
    if (args.title !== undefined) patch.title = args.title
    if (args.description !== undefined) patch.description = args.description
    if (args.category !== undefined) patch.category = args.category
    if (args.durationMinutes !== undefined)
      patch.durationMinutes = args.durationMinutes
    if (args.steps !== undefined) {
      if (!args.steps.length) {
        throw new ConvexError('A course must have at least one step.')
      }
      patch.steps = args.steps
    }
    if (args.passingScore !== undefined) patch.passingScore = args.passingScore
    if (args.requiredRoles !== undefined)
      patch.requiredRoles = args.requiredRoles

    await ctx.db.patch(args.courseId, patch)
    return args.courseId
  },
})

export const toggleCourse = mutation({
  args: {
    clerkOrgId: v.string(),
    courseId: v.id('trainingCourses'),
    active: v.boolean(),
  },
  handler: async (ctx, { clerkOrgId, courseId, active }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ADMIN_ROLES)

    const course = await ctx.db.get(courseId)
    if (!course) throw new ConvexError('Course not found.')
    assertTenantDoc(course, tenantId)

    await ctx.db.patch(courseId, { active })
    return courseId
  },
})

export const deleteCourse = mutation({
  args: {
    clerkOrgId: v.string(),
    courseId: v.id('trainingCourses'),
  },
  handler: async (ctx, { clerkOrgId, courseId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ADMIN_ROLES)

    const course = await ctx.db.get(courseId)
    if (!course) throw new ConvexError('Course not found.')
    assertTenantDoc(course, tenantId)

    await ctx.db.delete(courseId)
    return courseId
  },
})

// ═══════════════════════════════════════════════════════════════
// Seeding
// ═══════════════════════════════════════════════════════════════

export const seedDefaultCourses = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      clerkOrgId,
      ADMIN_ROLES,
    )

    const existing = await ctx.db
      .query('trainingCourses')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .first()

    if (existing) return { seeded: false, reason: 'Courses already exist.' }

    // Default placeholder course so agencies have something to preview.
    await ctx.db.insert('trainingCourses', {
      tenantId,
      courseKey: 'welcome_training',
      title: 'Welcome to Training',
      description:
        'A sample course showing how videos, interactive content, and quizzes work together.',
      category: 'agency_onboarding',
      durationMinutes: 15,
      passingScore: 80,
      steps: [
        {
          id: 'intro',
          title: 'How this training works',
          type: 'text',
          content:
            'This training platform mixes short videos, interactive reading cards, and quizzes.\n\n- Complete each section at your own pace.\n- You can pause and resume anytime.\n- Quizzes require a passing score but can be retaken.',
          minDurationSec: 10,
          required: true,
        },
        {
          id: 'sample_quiz',
          title: 'Sample knowledge check',
          type: 'quiz',
          content: JSON.stringify({
            questions: [
              {
                question: 'Can you retake a quiz if you do not pass?',
                options: ['No', 'Yes, as many times as needed', 'Only once'],
                correct: 1,
              },
            ],
          }),
          required: true,
        },
      ],
      active: true,
      isDefault: true,
      requiredRoles: [],
      createdAt: new Date().toISOString(),
    })

    return { seeded: true }
  },
})

// Internal variant keyed by tenantId for setup scripts.
export const seedDefaultCoursesInternal = internalMutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    const existing = await ctx.db
      .query('trainingCourses')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .first()

    if (existing) return { seeded: false, reason: 'Courses already exist.' }

    await ctx.db.insert('trainingCourses', {
      tenantId,
      courseKey: 'welcome_training',
      title: 'Welcome to Training',
      description:
        'A sample course showing how videos, interactive content, and quizzes work together.',
      category: 'agency_onboarding',
      durationMinutes: 15,
      passingScore: 80,
      steps: [
        {
          id: 'intro',
          title: 'How this training works',
          type: 'text',
          content:
            'This training platform mixes short videos, interactive reading cards, and quizzes.\n\n- Complete each section at your own pace.\n- You can pause and resume anytime.\n- Quizzes require a passing score but can be retaken.',
          minDurationSec: 10,
          required: true,
        },
        {
          id: 'sample_quiz',
          title: 'Sample knowledge check',
          type: 'quiz',
          content: JSON.stringify({
            questions: [
              {
                question: 'Can you retake a quiz if you do not pass?',
                options: ['No', 'Yes, as many times as needed', 'Only once'],
                correct: 1,
              },
            ],
          }),
          required: true,
        },
      ],
      active: true,
      isDefault: true,
      requiredRoles: [],
      createdAt: new Date().toISOString(),
    })

    return { seeded: true }
  },
})

// Helper for setup scripts: subscribe a tenant to the training product.
export const ensureTrainingProductInternal = internalMutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    const existing = await ctx.db
      .query('agencyProducts')
      .withIndex('by_tenant_product', (q) =>
        q.eq('tenantId', tenantId).eq('productKey', 'training'),
      )
      .first()
    if (!existing) {
      await ctx.db.insert('agencyProducts', {
        tenantId,
        productKey: 'training',
        active: true,
      })
    } else if (!existing.active) {
      await ctx.db.patch(existing._id, { active: true })
    }
    return true
  },
})
