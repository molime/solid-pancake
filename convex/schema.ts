import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const adpPunchSyncStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('queued'),
  v.literal('synced'),
  v.literal('error'),
)

const adpEmployeeSyncStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('queued'),
  v.literal('synced'),
  v.literal('error'),
  v.literal('matched'),
  v.literal('created'),
)

const integrationConnectionStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('configured'),
  v.literal('error'),
)

const adpProviderLiteral = v.literal('adp')

export default defineSchema({
  tenants: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    billingSettings: v.optional(
      v.object({
        defaultRate: v.number(),
        exportFormat: v.union(v.literal('csv'), v.literal('json')),
      }),
    ),
    createdAt: v.string(),
  })
    .index('by_clerk_org_id', ['clerkOrgId'])
    .index('by_slug', ['slug']),

  tenantMembers: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    role: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
      v.literal('org:hr'),
      v.literal('org:candidate'),
    ),
    displayName: v.string(),
    email: v.string(),
  })
    .index('by_tenant_user', ['tenantId', 'clerkUserId'])
    .index('by_tenant_role', ['tenantId', 'role'])
    .index('by_clerk_user_id', ['clerkUserId']),

  tenantSettings: defineTable({
    tenantId: v.id('tenants'),
    shiftGeofence: v.object({
      enabled: v.boolean(),
      enforceClockIn: v.boolean(),
      enforceClockOut: v.boolean(),
      defaultRadiusMeters: v.number(),
      maxAccuracyMeters: v.number(),
    }),
  }).index('by_tenant', ['tenantId']),

  clients: defineTable({
    tenantId: v.id('tenants'),
    displayName: v.string(),
    serviceType: v.union(v.literal('SLS'), v.literal('ILS')),
    authorizationHours: v.number(),
    riskFlags: v.array(v.string()),
    serviceAddress: v.optional(
      v.object({
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        state: v.string(),
        postalCode: v.string(),
        country: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
      }),
    ),
  }).index('by_tenant', ['tenantId']),

  shifts: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    caregiverId: v.string(),
    coordinatorId: v.optional(v.string()),
    scheduledStart: v.string(),
    scheduledEnd: v.string(),
    clockInAt: v.optional(v.string()),
    clockOutAt: v.optional(v.string()),
    status: v.union(
      v.literal('scheduled'),
      v.literal('in_progress'),
      v.literal('submitted'),
      v.literal('needs_correction'),
      v.literal('approved'),
      v.literal('billing_ready'),
    ),
    serviceType: v.union(v.literal('SLS'), v.literal('ILS')),
    rate: v.number(),
    serviceLocationOverride: v.optional(
      v.object({
        label: v.string(),
        addressLine: v.optional(v.string()),
        latitude: v.number(),
        longitude: v.number(),
        radiusMeters: v.optional(v.number()),
      }),
    ),
  })
    .index('by_tenant_caregiver_status', ['tenantId', 'caregiverId', 'status'])
    .index('by_tenant_coordinator_status', [
      'tenantId',
      'coordinatorId',
      'status',
    ])
    .index('by_tenant_status_start', ['tenantId', 'status', 'scheduledStart'])
    .index('by_tenant_caregiver_status_start', [
      'tenantId',
      'caregiverId',
      'status',
      'scheduledStart',
    ]),

  timePunches: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    caregiverId: v.string(),
    punchType: v.union(v.literal('clock_in'), v.literal('clock_out')),
    at: v.string(),
    source: v.literal('atriax'),
    location: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracyMeters: v.number(),
        distanceMeters: v.optional(v.number()),
        targetLabel: v.optional(v.string()),
        targetLatitude: v.optional(v.number()),
        targetLongitude: v.optional(v.number()),
        withinGeofence: v.optional(v.boolean()),
      }),
    ),
    adpSyncStatus: adpPunchSyncStatus,
    adpPunchId: v.optional(v.string()),
    adpError: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant_shift', ['tenantId', 'shiftId'])
    .index('by_tenant_shift_type', ['tenantId', 'shiftId', 'punchType'])
    .index('by_tenant_sync_status', ['tenantId', 'adpSyncStatus']),

  employeeProfiles: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.optional(v.string()),
    tenantMemberId: v.optional(v.id('tenantMembers')),
    displayName: v.string(),
    email: v.string(),
    adpAssociateOid: v.optional(v.string()),
    adpWorkerId: v.optional(v.string()),
    adpSyncStatus: adpEmployeeSyncStatus,
    adpError: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_clerk_user', ['tenantId', 'clerkUserId'])
    .index('by_tenant_adp_aoid', ['tenantId', 'adpAssociateOid']),

  integrationConnections: defineTable({
    tenantId: v.id('tenants'),
    provider: adpProviderLiteral,
    status: integrationConnectionStatus,
    lastCheckedAt: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index('by_tenant_provider', ['tenantId', 'provider'])
    .index('by_provider_status', ['provider', 'status']),

  integrationEvents: defineTable({
    tenantId: v.id('tenants'),
    provider: adpProviderLiteral,
    kind: v.string(),
    refId: v.optional(v.string()),
    idempotencyKey: v.string(),
    status: v.string(),
    attempt: v.optional(v.number()),
    request: v.optional(v.any()),
    response: v.optional(v.any()),
    completedAt: v.optional(v.string()),
    nextRetryAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant_idemp', ['tenantId', 'idempotencyKey'])
    .index('by_tenant_created', ['tenantId', 'createdAt']),

  progressNotes: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    startTime: v.string(),
    endTime: v.string(),
    servicesProvided: v.string(),
    clientResponse: v.string(),
    narrative: v.string(),
    submittedBy: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
  }).index('by_tenant_shift', ['tenantId', 'shiftId']),

  shiftTasks: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    title: v.string(),
    requiredProof: v.boolean(),
    status: v.union(v.literal('pending'), v.literal('complete')),
    proofUrl: v.optional(v.string()),
    proofName: v.optional(v.string()),
  }).index('by_tenant_shift', ['tenantId', 'shiftId']),

  reviewEvents: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    reviewerId: v.string(),
    decision: v.union(v.literal('approved'), v.literal('correction_requested')),
    comment: v.string(),
    createdAt: v.string(),
  }).index('by_tenant_shift', ['tenantId', 'shiftId']),

  billingLines: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    hours: v.number(),
    rate: v.number(),
    amount: v.number(),
    exportBatchId: v.optional(v.id('exportBatches')),
    createdAt: v.string(),
  })
    .index('by_tenant_export_batch', ['tenantId', 'exportBatchId'])
    .index('by_tenant_shift', ['tenantId', 'shiftId']),

  exportBatches: defineTable({
    tenantId: v.id('tenants'),
    name: v.string(),
    exportedAt: v.string(),
    exportedBy: v.string(),
    invoiceNumber: v.optional(v.string()),
    periodStart: v.optional(v.string()),
    periodEnd: v.optional(v.string()),
    caregiverId: v.optional(v.string()),
    caregiverName: v.optional(v.string()),
    caregiverEmail: v.optional(v.string()),
    lineCount: v.optional(v.number()),
    totalAmount: v.optional(v.number()),
  }).index('by_tenant', ['tenantId']),

  complianceDocs: defineTable({
    tenantId: v.id('tenants'),
    title: v.string(),
    body: v.string(),
    category: v.union(
      v.literal('billing'),
      v.literal('documentation'),
      v.literal('credentialing'),
      v.literal('policy'),
    ),
    visibility: v.optional(
      v.union(v.literal('all_staff'), v.literal('admins_coordinators')),
    ),
    embedding: v.array(v.float64()),
  })
    .index('by_tenant_category', ['tenantId', 'category'])
    .vectorIndex('by_tenant_embedding', {
      vectorField: 'embedding',
      dimensions: 32,
      filterFields: ['tenantId', 'category'],
    }),

  auditEvents: defineTable({
    tenantId: v.id('tenants'),
    actorId: v.string(),
    actorRole: v.string(),
    shiftId: v.optional(v.id('shifts')),
    previousStatus: v.optional(v.string()),
    nextStatus: v.optional(v.string()),
    action: v.string(),
    kind: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.string(),
  }).index('by_tenant_created_at', ['tenantId', 'createdAt']),

  files: defineTable({
    tenantId: v.id('tenants'),
    storageId: v.string(),
    uploadedBy: v.string(),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    linkedType: v.union(v.literal('shiftTask'), v.literal('complianceDoc')),
    linkedId: v.string(),
    visibility: v.union(
      v.literal('all_staff'),
      v.literal('admins_coordinators'),
    ),
    createdAt: v.string(),
  })
    .index('by_tenant_linked', ['tenantId', 'linkedType', 'linkedId'])
    .index('by_tenant_uploaded', ['tenantId', 'uploadedBy'])
    .index('by_tenant_storage', ['tenantId', 'storageId']),

  platformAdmins: defineTable({
    clerkUserId: v.string(),
    createdAt: v.string(),
  }).index('by_clerk_user_id', ['clerkUserId']),

  candidates: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    displayName: v.string(),
    status: v.string(),
    source: v.optional(v.string()),
    createdAt: v.string(),
  }).index('by_tenant_email', ['tenantId', 'email']),

  applications: defineTable({
    tenantId: v.id('tenants'),
    candidateId: v.id('candidates'),
    status: v.string(),
    submittedAt: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    decisionAt: v.optional(v.string()),
    hiredEmployeeProfileId: v.optional(v.id('employeeProfiles')),
  }).index('by_tenant_status', ['tenantId', 'status']),

  candidateTasks: defineTable({
    tenantId: v.id('tenants'),
    candidateId: v.id('candidates'),
    applicationId: v.optional(v.id('applications')),
    type: v.string(),
    status: v.string(),
    dueAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
  }).index('by_tenant_candidate_status', ['tenantId', 'candidateId', 'status']),

  hrCases: defineTable({
    tenantId: v.id('tenants'),
    subjectType: v.string(),
    subjectId: v.string(),
    category: v.string(),
    status: v.string(),
    ownerMemberId: v.optional(v.id('tenantMembers')),
    description: v.optional(v.string()),
    resolvedAt: v.optional(v.string()),
  })
    .index('by_tenant_status', ['tenantId', 'status'])
    .index('by_tenant_owner_status', ['tenantId', 'ownerMemberId', 'status']),

  availabilityWindows: defineTable({
    tenantId: v.id('tenants'),
    caregiverId: v.string(),
    kind: v.union(v.literal('recurring'), v.literal('one-off')),
    dayOfWeek: v.optional(v.number()),
    date: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    available: v.boolean(),
    note: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant_caregiver', ['tenantId', 'caregiverId'])
    .index('by_tenant_caregiver_date', ['tenantId', 'caregiverId', 'date']),

  coverageRequests: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    requesterId: v.string(),
    reason: v.string(),
    status: v.union(v.literal('open'), v.literal('filled'), v.literal('cancelled')),
    reassignedTo: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant_shift', ['tenantId', 'shiftId'])
    .index('by_tenant_status', ['tenantId', 'status']),

  formDefinitions: defineTable({
    tenantId: v.id('tenants'),
    key: v.string(),
    name: v.string(),
    version: v.number(),
    status: v.string(),
    fields: v.array(v.any()),
    createdBy: v.string(),
    createdAt: v.string(),
  }).index('by_tenant_key_version', ['tenantId', 'key', 'version']),

  formSubmissions: defineTable({
    tenantId: v.id('tenants'),
    formDefinitionId: v.id('formDefinitions'),
    subjectType: v.string(),
    subjectId: v.string(),
    submittedBy: v.string(),
    status: v.string(),
    answers: v.record(v.string(), v.any()),
    submittedAt: v.string(),
  }).index('by_tenant_subject', ['tenantId', 'subjectType', 'subjectId']),

  documentArchiveItems: defineTable({
    tenantId: v.id('tenants'),
    fileId: v.id('files'),
    subjectType: v.string(),
    subjectId: v.string(),
    category: v.string(),
    status: v.string(),
    expiresAt: v.optional(v.string()),
    retentionUntil: v.optional(v.string()),
    source: v.optional(v.string()),
  })
    .index('by_tenant_subject', ['tenantId', 'subjectType', 'subjectId'])
    .index('by_tenant_category_status', ['tenantId', 'category', 'status'])
    .index('by_tenant_expires_at', ['tenantId', 'expiresAt']),

  platformTrainingCompletions: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    trainingId: v.string(),
    completedAt: v.string(),
    status: v.string(),
    expiresAt: v.optional(v.string()),
  }).index('by_tenant_user', ['tenantId', 'clerkUserId']),
})
