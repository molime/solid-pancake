import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

const SAMPLE_COURSE = {
  courseKey: 'test_course',
  title: 'Test Course',
  description: 'A course for testing.',
  category: 'agency_onboarding' as const,
  durationMinutes: 30,
  steps: [
    {
      id: 'step_1',
      title: 'Step 1',
      type: 'text' as const,
      content: 'Hello world.',
      required: true,
    },
    {
      id: 'step_2',
      title: 'Step 2',
      type: 'quiz' as const,
      content: JSON.stringify({
        questions: [
          {
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correct: 1,
          },
        ],
      }),
      required: true,
    },
  ],
  passingScore: 80,
}

async function seedTenant(t: ReturnType<typeof createTestConvex>, clerkOrgId: string) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Training Agency',
      slug: 'training-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: 'user_cg',
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'cg@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: 'user_admin',
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    return tenantId
  })
}

describe('training.createCourse', () => {
  it('creates a course and lists it', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_create_course'
    await seedTenant(t, clerkOrgId)

    const courseId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...SAMPLE_COURSE,
        })
      })

    const courses = await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.training.listCourses, { clerkOrgId })
      })

    expect(courses).toHaveLength(1)
    expect(courses[0]._id).toBe(courseId)
    expect(courses[0].title).toBe('Test Course')
    expect(courses[0].progressPercent).toBe(0)
  })
})

describe('training.completeStep', () => {
  it('records step completion and updates progress', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_complete_step'
    await seedTenant(t, clerkOrgId)

    const courseId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...SAMPLE_COURSE,
        })
      })

    await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.completeStep, {
          clerkOrgId,
          courseId,
          stepId: 'step_1',
        })
      })

    const courses = await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.training.listCourses, { clerkOrgId })
      })

    expect(courses[0].progressPercent).toBe(50)
    expect(courses[0].completedStepIds).toContain('step_1')
  })
})

describe('training.completeCourse', () => {
  it('records final completion when all required steps are done', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_complete_course'
    await seedTenant(t, clerkOrgId)

    const courseId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...SAMPLE_COURSE,
        })
      })

    await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        await ctx.runMutation(api.training.completeStep, {
          clerkOrgId,
          courseId,
          stepId: 'step_1',
        })
        await ctx.runMutation(api.training.completeStep, {
          clerkOrgId,
          courseId,
          stepId: 'step_2',
        })
        return ctx.runMutation(api.training.completeCourse, {
          clerkOrgId,
          courseId,
        })
      })

    const completions = await t.run(async (ctx) => {
      return ctx.db.query('platformTrainingCompletions').collect()
    })
    const userCompletion = completions.find(
      (c) => c.clerkUserId === 'user_cg' && c.trainingId === 'test_course',
    )
    expect(userCompletion).toBeDefined()
    expect(userCompletion?.status).toBe('completed')
  })
})

describe('training.seedDefaultCourses', () => {
  it('seeds default courses idempotently', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_seed_defaults'
    await seedTenant(t, clerkOrgId)

    const first = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.seedDefaultCourses, { clerkOrgId })
      })

    expect(first.seeded).toBe(true)

    const second = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.seedDefaultCourses, { clerkOrgId })
      })

    expect(second.seeded).toBe(false)
  })
})

describe('training.listAllCourses', () => {
  it('returns all courses for admins, including inactive ones', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_all'
    await seedTenant(t, clerkOrgId)

    const courseId = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.createCourse, {
          clerkOrgId,
          ...SAMPLE_COURSE,
        })
      })

    await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.training.toggleCourse, {
          clerkOrgId,
          courseId,
          active: false,
        })
      })

    const all = await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.training.listAllCourses, { clerkOrgId })
      })

    expect(all).toHaveLength(1)
    expect(all[0]._id).toBe(courseId)
    expect(all[0].active).toBe(false)
  })

  it('blocks non-admin learners from listing all courses', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_all_guard'
    await seedTenant(t, clerkOrgId)

    await expect(
      t
        .withIdentity({
          subject: 'user_cg',
          org_id: clerkOrgId,
          org_role: 'org:caregiver',
        })
        .run(async (ctx) => {
          return ctx.runQuery(api.training.listAllCourses, { clerkOrgId })
        }),
    ).rejects.toThrow()
  })
})

describe('seedGoldenAgesTraining', () => {
  it('seeds the Golden Ages onboarding course with slide steps', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_seed_golden_ages'
    await seedTenant(t, clerkOrgId)

    await t
      .withIdentity({
        subject: 'user_admin',
        org_id: clerkOrgId,
        org_role: 'org:admin',
      })
      .run(async (ctx) => {
        return ctx.runMutation(api.seedGoldenAges.seedGoldenAgesTraining, {
          clerkOrgId,
        })
      })

    const courses = await t
      .withIdentity({
        subject: 'user_cg',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.training.listCourses, { clerkOrgId })
      })

    expect(courses).toHaveLength(7)
    const onboarding = courses.find((c) => c.courseKey === 'golden_ages_onboarding')
    expect(onboarding).toBeDefined()
    expect(onboarding!.steps.some((s) => s.type === 'slides')).toBe(true)
    expect(onboarding!.steps.every((s) => s.required)).toBe(true)

    const moduleKeys = [
      'ga_california_safety_falls',
      'ga_california_outdoor_safety',
      'ga_california_emergency',
      'ga_california_disaster',
      'ga_california_infection',
      'ga_california_scenarios',
    ]
    for (const key of moduleKeys) {
      expect(courses.some((c) => c.courseKey === key)).toBe(true)
    }
  })
})
