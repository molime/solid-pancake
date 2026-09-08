import { v } from 'convex/values'
import { internalMutation, mutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireTenantRole } from './authHelpers'
import onboardingData from '../src/features/training/fixtures/goldenAgesOnboarding.json'
import safetyFallsData from '../src/features/training/fixtures/ga_california_safety_falls.json'
import outdoorSafetyData from '../src/features/training/fixtures/ga_california_outdoor_safety.json'
import emergencyData from '../src/features/training/fixtures/ga_california_emergency.json'
import disasterData from '../src/features/training/fixtures/ga_california_disaster.json'
import infectionData from '../src/features/training/fixtures/ga_california_infection.json'
import scenariosData from '../src/features/training/fixtures/ga_california_scenarios.json'
import formsData from '../src/features/training/fixtures/goldenAgesForms.json'

type TrainingStepSeed = {
  id: string
  title: string
  type: 'text' | 'video' | 'image' | 'policy' | 'quiz' | 'embed' | 'slides'
  content: string
  caption?: string
  minDurationSec?: number
  required: boolean
}

type CourseSeed = {
  courseKey: string
  title: string
  description: string
  category: 'agency_onboarding' | 'regulatory' | 'safety' | 'skills' | 'other'
  durationMinutes: number
  passingScore: number
  steps: TrainingStepSeed[]
}

const CALIFORNIA_MODULES = [
  safetyFallsData,
  outdoorSafetyData,
  emergencyData,
  disasterData,
  infectionData,
  scenariosData,
]

const COURSE_KEYS = [onboardingData.courseKey, ...CALIFORNIA_MODULES.map((m) => m.courseKey)]

function insertCourse(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  data: CourseSeed,
) {
  return ctx.db.insert('trainingCourses', {
    tenantId,
    courseKey: data.courseKey,
    title: data.title,
    description: data.description,
    category: data.category,
    durationMinutes: data.durationMinutes,
    steps: data.steps as TrainingStepSeed[],
    passingScore: data.passingScore,
    requiredRoles: ['org:caregiver', 'org:coordinator', 'org:hr', 'org:admin'],
    active: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
  })
}

async function seedGoldenAgesForms(ctx: MutationCtx, tenantId: Id<'tenants'>) {
  const now = new Date().toISOString()
  let inserted = 0
  let updated = 0
  let deactivated = 0

  // Golden Ages uses the built-in Individuals Choice-style application flow
  // (job description → personal info → employment → criminal record → I-9/W-4
  // → disbursement → acknowledgments). Dynamic `category: 'application'` forms
  // would redirect applicants to `/onboarding/application-dynamic`, so we make
  // sure any previously-seeded dynamic application forms are inactive.
  const existingForms = await ctx.db
    .query('formDefinitions')
    .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
    .collect()
  for (const existing of existingForms) {
    if (existing.category === 'application' && existing.active) {
      await ctx.db.patch(existing._id, { active: false })
      deactivated++
    }
  }

  for (const form of formsData.forms) {
    const key = form.key as string
    const category = form.category as string
    // Only onboarding forms are seeded; application flow is built-in.
    if (category === 'application') continue

    const existing = await ctx.db
      .query('formDefinitions')
      .withIndex('by_tenant_key_version', (q) =>
        q.eq('tenantId', tenantId).eq('key', key),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: form.name,
        description: form.description,
        category: form.category,
        order: form.order,
        active: true,
        fields: form.fields,
      })
      updated++
    } else {
      await ctx.db.insert('formDefinitions', {
        tenantId,
        key,
        name: form.name,
        description: form.description,
        category: form.category,
        order: form.order,
        active: true,
        fields: form.fields,
        createdBy: 'system',
        createdAt: now,
      })
      inserted++
    }
  }

  return { seeded: true, inserted, updated, deactivated }
}

async function seedGoldenAgesCourses(ctx: MutationCtx, tenantId: Id<'tenants'>) {
  // Deactivate the legacy monolithic California course if it still exists.
  const legacyCalifornia = await ctx.db
    .query('trainingCourses')
    .withIndex('by_tenant_key', (q) =>
      q.eq('tenantId', tenantId).eq('courseKey', 'golden_ages_california_requirements'),
    )
    .first()
  if (legacyCalifornia) {
    await ctx.db.patch(legacyCalifornia._id, { active: false })
  }

  const onboarding = await ctx.db
    .query('trainingCourses')
    .withIndex('by_tenant_key', (q) =>
      q.eq('tenantId', tenantId).eq('courseKey', onboardingData.courseKey),
    )
    .first()

  if (onboarding) {
    // Patch existing onboarding course with latest fixture content.
    await ctx.db.patch(onboarding._id, {
      title: onboardingData.title,
      description: onboardingData.description,
      durationMinutes: onboardingData.durationMinutes,
      passingScore: onboardingData.passingScore,
      steps: onboardingData.steps as TrainingStepSeed[],
      active: true,
    })
  } else {
    await insertCourse(ctx, tenantId, onboardingData as CourseSeed)
  }

  // Patch or insert each topic module.
  for (const module of CALIFORNIA_MODULES) {
    const existing = await ctx.db
      .query('trainingCourses')
      .withIndex('by_tenant_key', (q) =>
        q.eq('tenantId', tenantId).eq('courseKey', module.courseKey),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: module.title,
        description: module.description,
        durationMinutes: module.durationMinutes,
        passingScore: module.passingScore,
        steps: module.steps as TrainingStepSeed[],
        requiredRoles: ['org:caregiver', 'org:coordinator', 'org:hr', 'org:admin'],
        active: true,
      })
    } else {
      await insertCourse(ctx, tenantId, module as CourseSeed)
    }
  }

  return { seeded: true, courseKeys: COURSE_KEYS, updated: !!onboarding }
}

export const seedGoldenAgesTraining = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])
    const courses = await seedGoldenAgesCourses(ctx, tenantId)
    const forms = await seedGoldenAgesForms(ctx, tenantId)
    const shifts = await seedGoldenAgesShiftTemplates(ctx, tenantId)
    return { courses, forms, shifts }
  },
})

const GOLDEN_AGES_SHIFT_TEMPLATES = [
  { value: 'morning', label: 'Morning (9am–1pm)', hoursPerDay: 4, isFullTime: false },
  { value: 'afternoon', label: 'Afternoon (1pm–5pm)', hoursPerDay: 4, isFullTime: false },
  { value: 'full_time', label: 'Full time (9am–5pm)', hoursPerDay: 8, isFullTime: true },
]

const GOLDEN_AGES_EMPLOYER_INFO = {
  legalName: 'Golden Ages Home Care, LLC',
  phone: '(925) 555-0199',
  address: '1092 Trumpet Vine Lane, San Ramon, CA 94582',
  caEmployerAccountNumber: '123-4567-8',
  ein: '12-3456789',
  homeCareOrganizationNumber: 'HCO-2025-GA',
  liveScanOri: 'CA001930Z',
  liveScanMailCode: '92630',
}

async function seedGoldenAgesShiftTemplates(ctx: MutationCtx, tenantId: Id<'tenants'>) {
  const existing = await ctx.db
    .query('tenantSettings')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .unique()

  if (existing) {
    await ctx.db.patch(existing._id, {
      shiftTemplates: GOLDEN_AGES_SHIFT_TEMPLATES,
      employerInfo: GOLDEN_AGES_EMPLOYER_INFO,
    })
  } else {
    await ctx.db.insert('tenantSettings', {
      tenantId,
      shiftGeofence: {
        enabled: false,
        enforceClockIn: false,
        enforceClockOut: false,
        defaultRadiusMeters: 150,
        maxAccuracyMeters: 100,
      },
      shiftTemplates: GOLDEN_AGES_SHIFT_TEMPLATES,
      employerInfo: GOLDEN_AGES_EMPLOYER_INFO,
    })
  }
  return { seeded: true }
}

export const seedGoldenAgesTrainingInternal = internalMutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    const courses = await seedGoldenAgesCourses(ctx, tenantId)
    const forms = await seedGoldenAgesForms(ctx, tenantId)
    const shifts = await seedGoldenAgesShiftTemplates(ctx, tenantId)
    return { courses, forms, shifts }
  },
})

export const seedGoldenAgesFormsInternal = internalMutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    return seedGoldenAgesForms(ctx, tenantId)
  },
})

export const seedGoldenAgesBranchesInternal = internalMutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    const existing = await ctx.db
      .query('agencyBranches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .first()
    if (existing) return { seeded: false, reason: 'Branches already exist.' }

    await ctx.db.insert('agencyBranches', {
      tenantId,
      branchType: 'HomeCare',
      label: 'Non-Medical Home Care',
      isPredefined: false,
      order: 0,
      active: true,
    })
    return { seeded: true }
  },
})

export const seedGoldenAgesProductsInternal = internalMutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    const products = ['hiring', 'training']
    for (const productKey of products) {
      const existing = await ctx.db
        .query('agencyProducts')
        .withIndex('by_tenant_product', (q) =>
          q.eq('tenantId', tenantId).eq('productKey', productKey),
        )
        .first()
      if (!existing) {
        await ctx.db.insert('agencyProducts', {
          tenantId,
          productKey,
          active: true,
        })
      } else if (!existing.active) {
        await ctx.db.patch(existing._id, { active: true })
      }
    }
    return { seeded: true, products }
  },
})


