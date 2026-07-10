import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { ConvexError } from 'convex/values'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import { getFileMetadata } from './files'

const ALLOWED_STATUSES = ['active', 'verified', 'rejected'] as const
type DocumentStatus = (typeof ALLOWED_STATUSES)[number]

function isValidStatus(status: string): status is DocumentStatus {
  return (ALLOWED_STATUSES as readonly string[]).includes(status)
}

export const listDocumentArchive = query({
  args: {
    clerkOrgId: v.string(),
    linkedTo: v.optional(
      v.object({
        subjectType: v.string(),
        subjectId: v.string(),
      }),
    ),
    status: v.optional(v.string()),
    documentType: v.optional(v.string()),
    expiringSoonDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    let items = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    if (args.linkedTo) {
      items = items.filter(
        (item) =>
          item.subjectType === args.linkedTo?.subjectType &&
          item.subjectId === args.linkedTo?.subjectId,
      )
    }

    if (args.status) {
      items = items.filter((item) => item.status === args.status)
    }

    if (args.documentType) {
      items = items.filter((item) => item.category === args.documentType)
    }

    if (args.expiringSoonDays !== undefined) {
      const cutoff = new Date(
        Date.now() + args.expiringSoonDays * 24 * 60 * 60 * 1000,
      ).toISOString()
      items = items.filter((item) => item.expiresAt && item.expiresAt <= cutoff)
    }

    items = items.slice(0, 100)

    return await Promise.all(
      items.map(async (item) => {
        const file = await getFileMetadata(ctx, item.fileId)
        return {
          ...item,
          file: file
            ? {
                fileName: file.fileName,
                contentType: file.contentType,
                size: file.size,
                storageId: file.storageId,
                uploadedBy: file.uploadedBy,
                fileCreatedAt: file.createdAt,
              }
            : null,
        }
      }),
    )
  },
})

export const updateDocumentArchiveItem = mutation({
  args: {
    clerkOrgId: v.string(),
    itemId: v.id('documentArchiveItems'),
    status: v.string(),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const item = await ctx.db.get(args.itemId)
    if (!item) {
      throw new ConvexError('Document archive item not found.')
    }
    assertTenantDoc(item, tenantId)

    if (!isValidStatus(args.status)) {
      throw new ConvexError(
        `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}.`,
      )
    }

    const previousStatus = item.status
    const now = new Date().toISOString()
    const patch: {
      status: DocumentStatus
      verifiedBy?: string
      verifiedAt?: string
      rejectionReason?: string
    } = { status: args.status }

    if (args.status === 'verified') {
      patch.verifiedBy = identity.subject
      patch.verifiedAt = now
      patch.rejectionReason = undefined
    } else if (args.status === 'rejected') {
      if (!args.rejectionReason || !args.rejectionReason.trim()) {
        throw new ConvexError('Rejection reason is required when rejecting a document.')
      }
      patch.rejectionReason = args.rejectionReason
      patch.verifiedBy = undefined
      patch.verifiedAt = undefined
    } else {
      patch.verifiedBy = undefined
      patch.verifiedAt = undefined
      patch.rejectionReason = undefined
    }

    await ctx.db.patch(args.itemId, patch)

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'document.status_updated',
      previousStatus,
      nextStatus: args.status,
      metadata: { itemId: args.itemId as string, rejectionReason: args.rejectionReason },
    })

    return args.itemId
  },
})
