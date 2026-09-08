import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { ConvexError } from 'convex/values'
import {
  requireTenantRole,
  assertTenantDoc,
  type AuthContext,
} from './authHelpers'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internal } from './_generated/api'

function normalizeFormEmail(email: string) {
  return email.toLowerCase().trim()
}

async function getOwnCandidate(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  identity: { subject: string; email?: string },
) {
  const byClerkUser = await ctx.db
    .query('candidates')
    .withIndex('by_tenant_clerk_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
    )
    .unique()
  if (byClerkUser) return byClerkUser

  if (identity.email) {
    const email = identity.email
    return ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenantId).eq('email', normalizeFormEmail(email)),
      )
      .unique()
  }
  return null
}

async function completeCandidateTask(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  candidateId: Id<'candidates'>,
  type: string,
) {
  const task = await ctx.db
    .query('candidateTasks')
    .withIndex('by_tenant_candidate_status', (q) =>
      q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('status', 'pending'),
    )
    .filter((q) => q.eq(q.field('type'), type))
    .first()
  if (task) {
    await ctx.db.patch(task._id, {
      status: 'complete',
      completedAt: new Date().toISOString(),
    })
  }
  return task
}

function isFieldRequired(field: unknown): field is { id: string; required: true; label?: string } {
  return (
    typeof field === 'object' &&
    field !== null &&
    'id' in field &&
    typeof (field as { id: unknown }).id === 'string' &&
    'required' in field &&
    (field as { required: unknown }).required === true
  )
}

function isValuePresent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

export const createFormDefinition = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    key: v.optional(v.string()),
    category: v.optional(v.string()),
    order: v.optional(v.number()),
    fields: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    if (!args.name.trim()) {
      throw new ConvexError('Form name is required.')
    }
    if (!args.fields.length) {
      throw new ConvexError('Form must have at least one field.')
    }

    const now = new Date().toISOString()
    return ctx.db.insert('formDefinitions', {
      tenantId,
      name: args.name,
      description: args.description,
      key: args.key,
      category: args.category,
      order: args.order,
      active: true,
      fields: args.fields,
      createdBy: identity.subject,
      createdAt: now,
    })
  },
})

export const updateFormDefinition = mutation({
  args: {
    clerkOrgId: v.string(),
    formDefinitionId: v.id('formDefinitions'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    key: v.optional(v.string()),
    category: v.optional(v.string()),
    order: v.optional(v.number()),
    fields: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const form = await ctx.db.get(args.formDefinitionId)
    if (!form) {
      throw new ConvexError('Form definition not found.')
    }
    assertTenantDoc(form, tenantId)

    const existingSubmissions = await ctx.db
      .query('formSubmissions')
      .withIndex('by_formDefinition', (q) =>
        q.eq('formDefinitionId', args.formDefinitionId),
      )
      .take(1)
    if (existingSubmissions.length > 0) {
      throw new ConvexError('Cannot update a form that already has submissions.')
    }

    const patch: Record<string, unknown> = {}
    if (args.name !== undefined) patch.name = args.name
    if (args.description !== undefined) patch.description = args.description
    if (args.key !== undefined) patch.key = args.key
    if (args.category !== undefined) patch.category = args.category
    if (args.order !== undefined) patch.order = args.order
    if (args.fields !== undefined) patch.fields = args.fields

    await ctx.db.patch(args.formDefinitionId, patch)
    return args.formDefinitionId
  },
})

export const deactivateFormDefinition = mutation({
  args: {
    clerkOrgId: v.string(),
    formDefinitionId: v.id('formDefinitions'),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const form = await ctx.db.get(args.formDefinitionId)
    if (!form) {
      throw new ConvexError('Form definition not found.')
    }
    assertTenantDoc(form, tenantId)

    await ctx.db.patch(args.formDefinitionId, { active: false })
    return args.formDefinitionId
  },
})

export const listFormDefinitions = query({
  args: {
    clerkOrgId: v.string(),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenantId, role } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
      'org:hr',
      'org:candidate',
    ])

    let forms = await ctx.db
      .query('formDefinitions')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    const isRestrictedRole = role === 'org:caregiver' || role === 'org:candidate'
    if (isRestrictedRole || !args.includeInactive) {
      forms = forms.filter((form) => form.active)
    }

    return forms
  },
})

export const getApplicationForms = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
      'org:hr',
      'org:candidate',
    ])

    const forms = await ctx.db
      .query('formDefinitions')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()

    return forms
      .filter((form) => form.active && form.category === 'application')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  },
})

export const hasApplicationForms = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
      'org:caregiver',
    ])

    const forms = await ctx.db
      .query('formDefinitions')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()

    return forms.some((form) => form.active && form.category === 'application')
  },
})

export const getFormDefinitionsByIds = query({
  args: {
    clerkOrgId: v.string(),
    formDefinitionIds: v.array(v.id('formDefinitions')),
  },
  handler: async (ctx, { clerkOrgId, formDefinitionIds }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
      'org:hr',
      'org:candidate',
    ])

    const results = []
    for (const id of formDefinitionIds) {
      const form = await ctx.db.get(id)
      if (form && form.tenantId === tenantId) {
        results.push(form)
      }
    }
    return results
  },
})

export const getFormSubmissionsByIds = query({
  args: {
    clerkOrgId: v.string(),
    submissionIds: v.array(v.id('formSubmissions')),
  },
  handler: async (ctx, { clerkOrgId, submissionIds }) => {
    const { tenantId, role, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
      'org:hr',
      'org:candidate',
    ])

    const results = []
    for (const id of submissionIds) {
      const submission = await ctx.db.get(id)
      if (!submission || submission.tenantId !== tenantId) continue
      if (
        (role === 'org:caregiver' || role === 'org:candidate') &&
        submission.submittedBy !== identity.subject
      ) {
        continue
      }
      const formDefinition = await ctx.db.get(submission.formDefinitionId)
      results.push({
        ...submission,
        formDefinitionName: formDefinition?.name ?? null,
      })
    }
    return results
  },
})

export const submitForm = mutation({
  args: {
    clerkOrgId: v.string(),
    formDefinitionId: v.id('formDefinitions'),
    data: v.record(v.string(), v.any()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:candidate', 'org:caregiver'],
    )

    const form = await ctx.db.get(args.formDefinitionId)
    if (!form) {
      throw new ConvexError('Form definition not found.')
    }
    assertTenantDoc(form, tenantId)

    if (!form.active) {
      throw new ConvexError('This form is not accepting submissions.')
    }

    for (const field of form.fields) {
      if (isFieldRequired(field)) {
        if (!isValuePresent(args.data[field.id])) {
          throw new ConvexError(`Missing required field: ${field.id}`)
        }
      }
    }

    const now = new Date().toISOString()
    let subjectType: string
    let subjectId: string

    if (role === 'org:candidate') {
      const candidate = await getOwnCandidate(ctx, tenantId, {
        subject: identity.subject,
        email: typeof identity.email === 'string' ? identity.email : undefined,
      })
      if (!candidate) {
        throw new ConvexError('Candidate profile not found.')
      }
      subjectType = 'candidate'
      subjectId = candidate._id as string
      await completeCandidateTask(ctx, tenantId, candidate._id, 'form_submission')
    } else {
      subjectType = 'caregiver'
      subjectId = identity.subject
    }

    return ctx.db.insert('formSubmissions', {
      tenantId,
      formDefinitionId: args.formDefinitionId,
      subjectType,
      subjectId,
      submittedBy: identity.subject,
      status: 'submitted',
      answers: args.data,
      submittedAt: now,
    })
  },
})

export const submitApplicationForms = mutation({
  args: {
    clerkOrgId: v.string(),
    submissions: v.array(
      v.object({
        formDefinitionId: v.id('formDefinitions'),
        answers: v.record(v.string(), v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:candidate'],
    )

    const candidate = await getOwnCandidate(ctx, tenantId, {
      subject: identity.subject,
      email: typeof identity.email === 'string' ? identity.email : undefined,
    })
    if (!candidate) {
      throw new ConvexError('Candidate profile not found.')
    }

    // Validate all forms before writing anything.
    const formDefinitions = []
    for (const item of args.submissions) {
      const form = await ctx.db.get(item.formDefinitionId)
      if (!form) {
        throw new ConvexError('Form definition not found.')
      }
      assertTenantDoc(form, tenantId)
      if (!form.active) {
        throw new ConvexError(`Form "${form.name}" is not accepting submissions.`)
      }
      for (const field of form.fields) {
        if (isFieldRequired(field)) {
          if (!isValuePresent(item.answers[field.id])) {
            throw new ConvexError(`Missing required field: ${field.label || field.id}`)
          }
        }
      }
      formDefinitions.push(form)
    }

    const now = new Date().toISOString()
    const submissionRecords: {
      formDefinitionId: Id<'formDefinitions'>
      submissionId: Id<'formSubmissions'>
      formKey: string | null
      formName: string
    }[] = []

    for (let i = 0; i < args.submissions.length; i++) {
      const item = args.submissions[i]
      const form = formDefinitions[i]
      const submissionId = await ctx.db.insert('formSubmissions', {
        tenantId,
        formDefinitionId: item.formDefinitionId,
        subjectType: 'candidate',
        subjectId: candidate._id as string,
        submittedBy: identity.subject,
        status: 'submitted',
        answers: item.answers,
        submittedAt: now,
      })
      submissionRecords.push({
        formDefinitionId: item.formDefinitionId,
        submissionId,
        formKey: form.key ?? null,
        formName: form.name,
      })
    }

    // Aggregate answers for HR review compatibility.
    const allAnswers: Record<string, unknown> = {}
    for (const item of args.submissions) {
      for (const [key, value] of Object.entries(item.answers)) {
        allAnswers[key] = value
      }
    }

    const position =
      typeof allAnswers.position === 'string'
        ? allAnswers.position
        : typeof allAnswers.positionAppliedFor === 'string'
          ? allAnswers.positionAppliedFor
          : typeof allAnswers.availabilityName === 'string'
            ? 'Caregiver'
            : 'Caregiver'

    const nameParts = candidate.displayName?.trim().split(/\s+/) ?? []
    const personal: Record<string, unknown> = {
      firstName: nameParts[0] ?? '',
      lastName: nameParts.slice(1).join(' ') ?? '',
      email: candidate.email,
      cellPhone: candidate.phone,
    }

    const latest = await ctx.db
      .query('applications')
      .withIndex('by_candidate', (q) => q.eq('candidateId', candidate._id))
      .order('desc')
      .first()

    const applicationFields = {
      dynamicFormSubmissions: submissionRecords,
      position,
      personal,
      ...allAnswers,
    }

    if (latest && latest.status !== 'hired') {
      await ctx.db.patch(latest._id, {
        fields: applicationFields,
        status: 'submitted',
        submittedAt: now,
      })
    } else {
      await ctx.db.insert('applications', {
        tenantId,
        candidateId: candidate._id,
        status: 'submitted',
        fields: applicationFields,
        submittedAt: now,
      })
    }

    await ctx.db.patch(candidate._id, { status: 'applied' })
    await completeCandidateTask(ctx, tenantId, candidate._id, 'form_submission')

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.application.submitted',
      previousStatus: candidate.status,
      nextStatus: 'applied',
      metadata: { candidateId: candidate._id as string },
    })

    return { submitted: submissionRecords.length }
  },
})

export const listFormSubmissions = query({
  args: {
    clerkOrgId: v.string(),
    formDefinitionId: v.optional(v.id('formDefinitions')),
    submittedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const hasFormDefinitionId = args.formDefinitionId !== undefined
    const hasSubmittedBy = args.submittedBy !== undefined
    if (hasFormDefinitionId === hasSubmittedBy) {
      throw new ConvexError('Provide exactly one of formDefinitionId or submittedBy.')
    }

    let submissions
    const formDefinitionId = args.formDefinitionId
    const submittedBy = args.submittedBy
    if (formDefinitionId) {
      submissions = await ctx.db
        .query('formSubmissions')
        .withIndex('by_formDefinition', (q) =>
          q.eq('formDefinitionId', formDefinitionId),
        )
        .collect()
    } else {
      submissions = await ctx.db
        .query('formSubmissions')
        .withIndex('by_submittedBy', (q) => q.eq('submittedBy', submittedBy as string))
        .collect()
    }

    submissions = submissions.filter((sub) => sub.tenantId === tenantId)
    submissions.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    )

    return await Promise.all(
      submissions.map(async (sub) => {
        const formDefinition = await ctx.db.get(sub.formDefinitionId)
        return {
          ...sub,
          formDefinitionName: formDefinition?.name ?? null,
        }
      }),
    )
  },
})

export const getFormSubmission = query({
  args: {
    clerkOrgId: v.string(),
    submissionId: v.id('formSubmissions'),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
      'org:hr',
      'org:candidate',
    ])

    const submission = await ctx.db.get(args.submissionId)
    if (!submission) {
      throw new ConvexError('Submission not found.')
    }
    assertTenantDoc(submission, tenantId)

    if (
      (role === 'org:caregiver' || role === 'org:candidate') &&
      submission.submittedBy !== identity.subject
    ) {
      throw new ConvexError('Forbidden: you can only view your own submissions.')
    }

    const formDefinition = await ctx.db.get(submission.formDefinitionId)
    return {
      ...submission,
      formDefinitionName: formDefinition?.name ?? null,
    }
  },
})
