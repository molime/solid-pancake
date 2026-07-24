import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { ConvexError } from 'convex/values'
import {
  requireTenantRole,
  assertTenantDoc,
  type TenantRole,
  type AuthContext,
} from './authHelpers'
import type { Id } from './_generated/dataModel'

export function assertCanEditProof(opts: {
  role: TenantRole
  identitySubject: string
  shift: { caregiverId: string; status: string }
}) {
  if (opts.role === 'org:caregiver') {
    if (opts.shift.caregiverId !== opts.identitySubject) {
      throw new ConvexError(
        'Forbidden: caregivers can only edit proof on their own shifts.',
      )
    }
    if (
      opts.shift.status !== 'in_progress' &&
      opts.shift.status !== 'needs_correction'
    ) {
      throw new ConvexError(
        'Forbidden: proof can only be edited for shifts in progress or needing correction.',
      )
    }
  }
}

export async function getFileMetadata(ctx: AuthContext, fileId: Id<'files'>) {
  return ctx.db.get(fileId)
}

export const generateUploadUrl = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
      'org:hr',
      'org:candidate',
    ])

    const url = await ctx.storage.generateUploadUrl()
    return { url, tenantId, uploadedBy: identity.subject }
  },
})

export const attachProof = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftTaskId: v.id('shiftTasks'),
    storageId: v.string(),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:coordinator', 'org:caregiver', 'org:hr'],
    )

    const task = await ctx.db.get(args.shiftTaskId)
    if (!task) {
      throw new ConvexError('Shift task not found.')
    }
    assertTenantDoc(task, tenantId)

    const shift = await ctx.db.get(task.shiftId)
    if (!shift) {
      throw new ConvexError('Shift not found.')
    }
    assertTenantDoc(shift, tenantId)

    assertCanEditProof({
      role,
      identitySubject: identity.subject,
      shift,
    })

    await ctx.db.patch(args.shiftTaskId, {
      proofUrl: args.storageId,
      proofName: args.fileName,
    })

    await ctx.db.insert('files', {
      tenantId,
      storageId: args.storageId,
      uploadedBy: identity.subject,
      fileName: args.fileName,
      contentType: args.contentType,
      size: args.size,
      linkedType: 'shiftTask',
      linkedId: args.shiftTaskId,
      visibility: 'all_staff',
      createdAt: new Date().toISOString(),
    })

    return { success: true }
  },
})

export const removeProof = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftTaskId: v.id('shiftTasks'),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:coordinator', 'org:caregiver', 'org:hr'],
    )

    const task = await ctx.db.get(args.shiftTaskId)
    if (!task) {
      throw new ConvexError('Shift task not found.')
    }
    assertTenantDoc(task, tenantId)

    const shift = await ctx.db.get(task.shiftId)
    if (!shift) {
      throw new ConvexError('Shift not found.')
    }
    assertTenantDoc(shift, tenantId)

    assertCanEditProof({
      role,
      identitySubject: identity.subject,
      shift,
    })

    await ctx.db.patch(args.shiftTaskId, {
      proofUrl: undefined,
      proofName: undefined,
    })

    const file = await ctx.db
      .query('files')
      .withIndex('by_tenant_linked', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('linkedType', 'shiftTask')
          .eq('linkedId', args.shiftTaskId),
      )
      .unique()

    if (file) {
      await ctx.db.delete(file._id)
    }

    return { success: true }
  },
})

export const getDownloadUrl = query({
  args: { clerkOrgId: v.string(), storageId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:coordinator', 'org:caregiver', 'org:hr'],
    )

    const file = await ctx.db
      .query('files')
      .withIndex('by_tenant_storage', (q) =>
        q.eq('tenantId', tenantId).eq('storageId', args.storageId),
      )
      .unique()

    if (!file) {
      throw new ConvexError('File not found.')
    }

    if (file.linkedType === 'shiftTask') {
      const task = await ctx.db.get(file.linkedId as import('./_generated/dataModel').Id<'shiftTasks'>)
      if (task) {
        const shift = await ctx.db.get(task.shiftId)
        if (shift) {
          assertTenantDoc(shift, tenantId)
          if (
            role === 'org:caregiver' &&
            shift.caregiverId !== identity.subject
          ) {
            throw new ConvexError(
              'Forbidden: cannot download proof for another caregiver\'s shift.',
            )
          }
        }
      }
    }

    return await ctx.storage.getUrl(args.storageId)
  },
})


export const getStorageUrl = query({
  args: { clerkOrgId: v.string(), storageId: v.string() },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin', 'org:coordinator', 'org:caregiver', 'org:hr',
    ])
    const url = await ctx.storage.getUrl(
      args.storageId as import('./_generated/dataModel').Id<'_storage'>,
    )
    return url
  },
})
