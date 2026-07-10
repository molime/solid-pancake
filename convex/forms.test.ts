import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  adminId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

function asHR(
  t: ReturnType<typeof createTestConvex>,
  hrId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: hrId,
    org_id: clerkOrgId,
    org_role: 'org:hr',
  })
}

function asCandidate(
  t: ReturnType<typeof createTestConvex>,
  candidateId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: candidateId,
    org_id: clerkOrgId,
    org_role: 'org:candidate',
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

async function seedTenant(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  adminId: string,
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: adminId,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    return tenantId
  })
}

async function seedHR(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  hrId: string,
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    await ctx.db.insert('tenantMembers', {
      tenantId: tenant._id,
      clerkUserId: hrId,
      role: 'org:hr',
      displayName: 'HR Person',
      email: 'hr@example.com',
    })
  })
}

async function seedCandidate(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  candidateUserId: string,
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    await ctx.db.insert('tenantMembers', {
      tenantId: tenant._id,
      clerkUserId: candidateUserId,
      role: 'org:candidate',
      displayName: 'Candidate',
      email: 'candidate@example.com',
    })
    return ctx.db.insert('candidates', {
      tenantId: tenant._id,
      clerkUserId: candidateUserId,
      email: 'candidate@example.com',
      displayName: 'Candidate',
      status: 'invited',
      createdAt: new Date().toISOString(),
    })
  })
}

async function seedCaregiver(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  caregiverId: string,
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    await ctx.db.insert('tenantMembers', {
      tenantId: tenant._id,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
    })
  })
}

async function seedArchiveItem(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  overrides: {
    subjectType?: string
    subjectId?: string
    category?: string
    status?: string
    expiresAt?: string
    fileName?: string
    createdAt?: string
  } = {},
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    const fileId = await ctx.db.insert('files', {
      tenantId: tenant._id,
      storageId: 'storage-test',
      uploadedBy: 'user_test',
      fileName: overrides.fileName ?? 'doc.pdf',
      contentType: 'application/pdf',
      size: 2048,
      linkedType: 'shiftTask',
      linkedId: 'task-test',
      visibility: 'all_staff',
      createdAt: overrides.createdAt ?? new Date().toISOString(),
    })
    const itemId = await ctx.db.insert('documentArchiveItems', {
      tenantId: tenant._id,
      fileId,
      subjectType: overrides.subjectType ?? 'candidate',
      subjectId: overrides.subjectId ?? 'candidate-test',
      category: overrides.category ?? 'license',
      status: overrides.status ?? 'active',
      expiresAt: overrides.expiresAt,
      source: 'test',
      createdAt: overrides.createdAt ?? new Date().toISOString(),
    })
    return { tenantId: tenant._id, fileId, itemId }
  })
}

beforeEach(() => {
  // noop
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const sampleFields = [
  { id: 'name', label: 'Name', type: 'text', required: true },
  { id: 'experience', label: 'Experience', type: 'text', required: false },
]

describe('createFormDefinition', () => {
  it('works for org:admin', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_create_admin'
    const adminId = 'user_admin_create'
    await seedTenant(t, clerkOrgId, adminId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Admin Form',
        description: 'A form',
        fields: sampleFields,
      },
    )

    const form = await t.run(async (ctx) => ctx.db.get(formId as Id<'formDefinitions'>))
    expect(form?.name).toBe('Admin Form')
    expect(form?.active).toBe(true)
  })

  it('works for org:hr', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_create_hr'
    const adminId = 'user_admin_create_hr'
    const hrId = 'user_hr_create'
    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    const formId = await asHR(t, hrId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'HR Form',
        fields: sampleFields,
      },
    )

    const form = await t.run(async (ctx) => ctx.db.get(formId as Id<'formDefinitions'>))
    expect(form?.name).toBe('HR Form')
  })

  it('blocks org:caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_create_cg'
    const adminId = 'user_admin_create_cg'
    const caregiverId = 'user_cg_create'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCaregiver(t, clerkOrgId, caregiverId)

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.forms.createFormDefinition,
        {
          clerkOrgId,
          name: 'Caregiver Form',
          fields: sampleFields,
        },
      ),
    ).rejects.toThrow()
  })
})

describe('updateFormDefinition', () => {
  it('patches name, description, and fields', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_update'
    const adminId = 'user_admin_update'
    await seedTenant(t, clerkOrgId, adminId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Original',
        fields: sampleFields,
      },
    )

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.updateFormDefinition,
      {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        name: 'Updated',
        description: 'New description',
        fields: [{ id: 'name', label: 'Name', type: 'text', required: true }],
      },
    )

    const form = await t.run(async (ctx) => ctx.db.get(formId as Id<'formDefinitions'>))
    expect(form?.name).toBe('Updated')
    expect(form?.description).toBe('New description')
    expect(form?.fields).toHaveLength(1)
  })

  it('throws when submissions exist', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_update_submitted'
    const adminId = 'user_admin_update_sub'
    const candidateUserId = 'user_candidate_update_sub'
    await seedTenant(t, clerkOrgId, adminId)
    const candidateId = await seedCandidate(t, clerkOrgId, candidateUserId)
    await t.run(async (ctx) => {
      await ctx.db.insert('candidateTasks', {
        tenantId: (await ctx.db
          .query('tenants')
          .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
          .unique())?._id as Id<'tenants'>,
        candidateId,
        type: 'form_submission',
        status: 'pending',
        order: 0,
      })
    })

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Submittable',
        fields: sampleFields,
      },
    )

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.forms.submitForm,
      {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        data: { name: 'Candidate' },
      },
    )

    await expect(
      asAdmin(t, adminId, clerkOrgId).mutation(
        api.forms.updateFormDefinition,
        {
          clerkOrgId,
          formDefinitionId: formId as Id<'formDefinitions'>,
          name: 'Updated',
        },
      ),
    ).rejects.toThrow('Cannot update a form that already has submissions.')
  })

  it('blocks org:hr', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_update_hr'
    const adminId = 'user_admin_update_hr'
    const hrId = 'user_hr_update'
    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'HR Cannot Edit',
        fields: sampleFields,
      },
    )

    await expect(
      asHR(t, hrId, clerkOrgId).mutation(api.forms.updateFormDefinition, {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        name: 'Nope',
      }),
    ).rejects.toThrow()
  })
})

describe('deactivateFormDefinition', () => {
  it('sets active to false', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_deactivate'
    const adminId = 'user_admin_deactivate'
    await seedTenant(t, clerkOrgId, adminId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'To Deactivate',
        fields: sampleFields,
      },
    )

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.deactivateFormDefinition,
      {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
      },
    )

    const form = await t.run(async (ctx) => ctx.db.get(formId as Id<'formDefinitions'>))
    expect(form?.active).toBe(false)
  })
})

describe('listFormDefinitions', () => {
  it('shows active only for candidates and caregivers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_roles'
    const adminId = 'user_admin_list_roles'
    const candidateUserId = 'user_candidate_list_roles'
    const caregiverId = 'user_cg_list_roles'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCandidate(t, clerkOrgId, candidateUserId)
    await seedCaregiver(t, clerkOrgId, caregiverId)

    const activeId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Active',
        fields: sampleFields,
      },
    )
    const inactiveId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Inactive',
        fields: sampleFields,
      },
    )
    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.deactivateFormDefinition,
      {
        clerkOrgId,
        formDefinitionId: inactiveId as Id<'formDefinitions'>,
      },
    )

    const candidateList = await asCandidate(t, candidateUserId, clerkOrgId).query(
      api.forms.listFormDefinitions,
      { clerkOrgId },
    )
    expect(candidateList).toHaveLength(1)
    expect(candidateList[0]?._id).toBe(activeId)

    const caregiverList = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.forms.listFormDefinitions,
      { clerkOrgId },
    )
    expect(caregiverList).toHaveLength(1)
    expect(caregiverList[0]?._id).toBe(activeId)
  })

  it('shows all forms for admin when includeInactive is true', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_admin'
    const adminId = 'user_admin_list_admin'
    await seedTenant(t, clerkOrgId, adminId)

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Active',
        fields: sampleFields,
      },
    )
    const inactiveId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Inactive',
        fields: sampleFields,
      },
    )
    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.deactivateFormDefinition,
      {
        clerkOrgId,
        formDefinitionId: inactiveId as Id<'formDefinitions'>,
      },
    )

    const activeOnly = await asAdmin(t, adminId, clerkOrgId).query(
      api.forms.listFormDefinitions,
      { clerkOrgId },
    )
    expect(activeOnly).toHaveLength(1)

    const allForms = await asAdmin(t, adminId, clerkOrgId).query(
      api.forms.listFormDefinitions,
      { clerkOrgId, includeInactive: true },
    )
    expect(allForms).toHaveLength(2)
  })
})

describe('submitForm', () => {
  it('throws when required field is missing', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_submit_missing'
    const adminId = 'user_admin_submit_missing'
    const candidateUserId = 'user_candidate_submit_missing'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCandidate(t, clerkOrgId, candidateUserId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Required Form',
        fields: sampleFields,
      },
    )

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).mutation(api.forms.submitForm, {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        data: { experience: '5 years' },
      }),
    ).rejects.toThrow('Missing required field: name')
  })

  it('rejects empty-string required field', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_submit_empty'
    const adminId = 'user_admin_submit_empty'
    const candidateUserId = 'user_candidate_submit_empty'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCandidate(t, clerkOrgId, candidateUserId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Required Form',
        fields: sampleFields,
      },
    )

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).mutation(api.forms.submitForm, {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        data: { name: '', experience: '5 years' },
      }),
    ).rejects.toThrow('Missing required field: name')
  })

  it('throws for cross-tenant formDefinitionId', async () => {
    const t = createTestConvex()
    const orgA = 'org_a'
    const orgB = 'org_b'
    const adminA = 'user_admin_a'
    const adminB = 'user_admin_b'
    const candidateA = 'user_candidate_a'
    await seedTenant(t, orgA, adminA)
    await seedTenant(t, orgB, adminB)
    await seedCandidate(t, orgA, candidateA)

    const formId = await asAdmin(t, adminB, orgB).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId: orgB,
        name: 'Other Tenant Form',
        fields: sampleFields,
      },
    )

    await expect(
      asCandidate(t, candidateA, orgA).mutation(api.forms.submitForm, {
        clerkOrgId: orgA,
        formDefinitionId: formId as Id<'formDefinitions'>,
        data: { name: 'Candidate' },
      }),
    ).rejects.toThrow('Forbidden: cross-tenant access denied.')
  })

  it('throws when form is inactive', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_submit_inactive'
    const adminId = 'user_admin_submit_inactive'
    const candidateUserId = 'user_candidate_submit_inactive'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCandidate(t, clerkOrgId, candidateUserId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Inactive Form',
        fields: sampleFields,
      },
    )
    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.deactivateFormDefinition,
      {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
      },
    )

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).mutation(api.forms.submitForm, {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        data: { name: 'Candidate' },
      }),
    ).rejects.toThrow('This form is not accepting submissions.')
  })

  it('inserts submission and completes form_submission task for candidate', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_submit_candidate'
    const adminId = 'user_admin_submit_candidate'
    const candidateUserId = 'user_candidate_submit_candidate'
    await seedTenant(t, clerkOrgId, adminId)
    const candidateId = await seedCandidate(t, clerkOrgId, candidateUserId)
    await t.run(async (ctx) => {
      await ctx.db.insert('candidateTasks', {
        tenantId: (await ctx.db
          .query('tenants')
          .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
          .unique())?._id as Id<'tenants'>,
        candidateId,
        type: 'form_submission',
        status: 'pending',
        order: 0,
      })
    })

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Candidate Form',
        fields: sampleFields,
      },
    )

    const submissionId = await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.forms.submitForm,
      {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        data: { name: 'Candidate', experience: '5 years' },
      },
    )

    const [submission, tasks] = await t.run(async (ctx) => {
      const sub = await ctx.db.get(submissionId as Id<'formSubmissions'>)
      const taskList = await ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', sub?.tenantId as Id<'tenants'>).eq('candidateId', candidateId),
        )
        .collect()
      return [sub, taskList]
    })

    expect(submission?.subjectType).toBe('candidate')
    expect(submission?.subjectId).toBe(candidateId as string)
    expect(submission?.answers).toEqual({ name: 'Candidate', experience: '5 years' })
    const formTask = tasks.find((task) => task.type === 'form_submission')
    expect(formTask?.status).toBe('complete')
  })

  it('inserts submission with caregiver subject', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_submit_caregiver'
    const adminId = 'user_admin_submit_cg'
    const caregiverId = 'user_cg_submit'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCaregiver(t, clerkOrgId, caregiverId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Caregiver Form',
        fields: sampleFields,
      },
    )

    const submissionId = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.forms.submitForm,
      {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        data: { name: 'Caregiver' },
      },
    )

    const submission = await t.run(async (ctx) =>
      ctx.db.get(submissionId as Id<'formSubmissions'>),
    )
    expect(submission?.subjectType).toBe('caregiver')
    expect(submission?.subjectId).toBe(caregiverId)
  })
})

describe('listFormSubmissions', () => {
  it('requires exactly one filter', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_subs_filter'
    const adminId = 'user_admin_list_subs'
    await seedTenant(t, clerkOrgId, adminId)

    await expect(
      asAdmin(t, adminId, clerkOrgId).query(api.forms.listFormSubmissions, {
        clerkOrgId,
      }),
    ).rejects.toThrow('Provide exactly one of formDefinitionId or submittedBy.')

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Filter Form',
        fields: sampleFields,
      },
    )

    await expect(
      asAdmin(t, adminId, clerkOrgId).query(api.forms.listFormSubmissions, {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        submittedBy: 'someone',
      }),
    ).rejects.toThrow('Provide exactly one of formDefinitionId or submittedBy.')
  })

  it('is blocked for candidates and caregivers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_subs_block'
    const adminId = 'user_admin_list_subs_block'
    const candidateUserId = 'user_candidate_list_subs_block'
    const caregiverId = 'user_cg_list_subs_block'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCandidate(t, clerkOrgId, candidateUserId)
    await seedCaregiver(t, clerkOrgId, caregiverId)

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).query(
        api.forms.listFormSubmissions,
        { clerkOrgId, submittedBy: candidateUserId },
      ),
    ).rejects.toThrow()

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).query(api.forms.listFormSubmissions, {
        clerkOrgId,
        submittedBy: caregiverId,
      }),
    ).rejects.toThrow()
  })

  it('joins formDefinition name', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_subs_join'
    const adminId = 'user_admin_list_subs_join'
    const candidateUserId = 'user_candidate_list_subs_join'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCandidate(t, clerkOrgId, candidateUserId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Joinable Form',
        fields: sampleFields,
      },
    )

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(api.forms.submitForm, {
      clerkOrgId,
      formDefinitionId: formId as Id<'formDefinitions'>,
      data: { name: 'Candidate' },
    })

    const subs = await asAdmin(t, adminId, clerkOrgId).query(
      api.forms.listFormSubmissions,
      {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
      },
    )

    expect(subs).toHaveLength(1)
    expect(subs[0]?.formDefinitionName).toBe('Joinable Form')
  })
})

describe('getFormSubmission', () => {
  it('allows any tenant role to read own tenant submission', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_get_sub'
    const adminId = 'user_admin_get_sub'
    const candidateUserId = 'user_candidate_get_sub'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCandidate(t, clerkOrgId, candidateUserId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Get Form',
        fields: sampleFields,
      },
    )

    const submissionId = await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.forms.submitForm,
      {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        data: { name: 'Candidate' },
      },
    )

    const got = await asAdmin(t, adminId, clerkOrgId).query(api.forms.getFormSubmission, {
      clerkOrgId,
      submissionId: submissionId as Id<'formSubmissions'>,
    })
    expect(got._id).toBe(submissionId)
  })

  it('blocks caregiver from viewing another user submission', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_get_sub_own'
    const adminId = 'user_admin_get_sub_own'
    const candidateUserId = 'user_candidate_get_sub_own'
    const caregiverId = 'user_cg_get_sub_own'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCandidate(t, clerkOrgId, candidateUserId)
    await seedCaregiver(t, clerkOrgId, caregiverId)

    const formId = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.forms.createFormDefinition,
      {
        clerkOrgId,
        name: 'Own Form',
        fields: sampleFields,
      },
    )

    const submissionId = await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.forms.submitForm,
      {
        clerkOrgId,
        formDefinitionId: formId as Id<'formDefinitions'>,
        data: { name: 'Candidate' },
      },
    )

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).query(api.forms.getFormSubmission, {
        clerkOrgId,
        submissionId: submissionId as Id<'formSubmissions'>,
      }),
    ).rejects.toThrow('Forbidden: you can only view your own submissions.')
  })
})

describe('updateDocumentArchiveItem', () => {
  it('sets verifiedBy and verifiedAt', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_forms_archive_verify'
    const adminId = 'user_admin_forms_archive_verify'
    await seedTenant(t, clerkOrgId, adminId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.updateDocumentArchiveItem,
      {
        clerkOrgId,
        itemId,
        status: 'verified',
      },
    )

    const item = await t.run(async (ctx) =>
      ctx.db.get(itemId as Id<'documentArchiveItems'>),
    )
    expect(item?.status).toBe('verified')
    expect(item?.verifiedBy).toBe(adminId)
    expect(item?.verifiedAt).toBeDefined()
  })

  it('rejection requires reason and clears verified fields', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_forms_archive_reject'
    const adminId = 'user_admin_forms_archive_reject'
    await seedTenant(t, clerkOrgId, adminId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    await expect(
      asAdmin(t, adminId, clerkOrgId).mutation(
        api.documentArchive.updateDocumentArchiveItem,
        {
          clerkOrgId,
          itemId,
          status: 'rejected',
        },
      ),
    ).rejects.toThrow('Rejection reason is required when rejecting a document.')

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.documentArchive.updateDocumentArchiveItem,
      {
        clerkOrgId,
        itemId,
        status: 'rejected',
        rejectionReason: 'Blurry scan',
      },
    )

    const item = await t.run(async (ctx) =>
      ctx.db.get(itemId as Id<'documentArchiveItems'>),
    )
    expect(item?.status).toBe('rejected')
    expect(item?.rejectionReason).toBe('Blurry scan')
    expect(item?.verifiedBy).toBeUndefined()
    expect(item?.verifiedAt).toBeUndefined()
  })

  it('is blocked for org:caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_forms_archive_update_block'
    const adminId = 'user_admin_forms_archive_update_block'
    const caregiverId = 'user_cg_forms_archive_update_block'
    await seedTenant(t, clerkOrgId, adminId)
    await seedCaregiver(t, clerkOrgId, caregiverId)
    const { itemId } = await seedArchiveItem(t, clerkOrgId)

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.documentArchive.updateDocumentArchiveItem,
        {
          clerkOrgId,
          itemId,
          status: 'verified',
        },
      ),
    ).rejects.toThrow()
  })
})
