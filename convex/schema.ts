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
    ein: v.optional(v.string()),
    address: v.optional(v.string()),
    // Optional per-tenant email domain allowlist for invitations. When
    // undefined or empty, all domains are allowed (open enrollment).
    allowedEmailDomains: v.optional(v.array(v.string())),
    // Optional per-tenant custom monthly rate. When set, invoice
    // auto-calculation uses it as the base price instead of the plan's
    // basePrice (per-seat overage still applies on top).
    customMonthlyRate: v.optional(v.number()),
    // Optional per-tenant usage limits (soft enforcement — warnings only).
    limits: v.optional(
      v.object({
        maxSeats: v.optional(v.number()),
        maxCandidates: v.optional(v.number()),
        maxShiftsPerMonth: v.optional(v.number()),
      }),
    ),
    billingSettings: v.optional(
      v.object({
        defaultRate: v.number(),
        exportFormat: v.union(v.literal('csv'), v.literal('json')),
      }),
    ),
    // Allowed payment method for the one-time Stripe setup link, chosen by
    // the platform admin at agency creation (Phase 3 — Maria's review).
    paymentMethodAllowed: v.optional(
      v.union(v.literal('card'), v.literal('us_bank_account')),
    ),
    // Churn/offboarding metadata (soft — set by offboardTenant).
    churnedAt: v.optional(v.number()),
    churnReason: v.optional(v.string()),
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
    // Client master-record depth (docs/07 §3.1/§3.4, gap row B1). All optional
    // — existing client rows remain valid without them.
    uci: v.optional(v.string()), // Unique Client Identifier (regional center)
    dob: v.optional(v.string()), // ISO date-only (yyyy-mm-dd)
    conservatorName: v.optional(v.string()),
    conservatorPhone: v.optional(v.string()),
    emergencyContacts: v.optional(
      v.array(
        v.object({
          name: v.string(),
          phone: v.string(),
          relationship: v.string(),
        }),
      ),
    ),
    regionalCenter: v.optional(v.string()),
    serviceCoordinatorName: v.optional(v.string()),
    serviceCoordinatorEmail: v.optional(v.string()),
    vendorNumber: v.optional(v.string()),
    serviceCode: v.optional(v.string()), // e.g. '520' (ILS), '896' (SLS)
  }).index('by_tenant', ['tenantId']),

  // IPP/ISP objectives per client (docs/07 §3.4, gap row B2). Quarterly SLS /
  // semi-annual ILS progress reports are built from shift documentation tagged
  // to these objectives (progressNotes.objectiveId / shiftTasks.objectiveId).
  clientObjectives: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    title: v.string(),
    description: v.optional(v.string()),
    source: v.union(v.literal('ipp'), v.literal('isp')),
    targetDate: v.optional(v.string()), // ISO date-only (yyyy-mm-dd)
    hoursPerMonth: v.optional(v.number()),
    status: v.union(
      v.literal('active'),
      v.literal('achieved'),
      v.literal('discontinued'),
    ),
    createdAt: v.string(),
  })
    .index('by_tenant_client', ['tenantId', 'clientId'])
    .index('by_tenant_status', ['tenantId', 'status']),

  // Quarterly SLS / semi-annual ILS progress reports toward IPP/ISP objectives
  // (docs/07 §3.4, gap row B3; 17 CCR §58680 + regional-center contract). One
  // report per client+periodStart: generating for an existing draft period
  // refreshes its entries; submitted reports are locked. Entries are prefilled
  // deterministically from objective-linked shift documentation (see
  // convex/progressReports.ts).
  progressReports: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    periodType: v.union(v.literal('quarterly'), v.literal('semiannual')),
    periodStart: v.string(), // ISO date-only (yyyy-mm-dd)
    periodEnd: v.string(), // ISO date-only (yyyy-mm-dd)
    entries: v.array(
      v.object({
        objectiveId: v.id('clientObjectives'),
        objectiveTitle: v.string(),
        servicesSummary: v.string(),
        progressSummary: v.string(),
        barriers: v.string(),
        planForward: v.string(),
        hoursDelivered: v.number(),
      }),
    ),
    status: v.union(v.literal('draft'), v.literal('submitted')),
    generatedBy: v.string(), // clerkUserId
    submittedTo: v.optional(v.string()), // service coordinator name/email
    submittedAt: v.optional(v.string()), // ISO
    // Legal hold suspends the retention window (17 CCR §54326(a)(3) audit-hold
    // extension) — records under hold must never be deleted.
    legalHold: v.optional(v.boolean()),
    createdAt: v.string(),
  }).index('by_tenant_client_period', ['tenantId', 'clientId', 'periodStart']),

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
    escalatedTo: v.optional(v.string()),
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
    .index('by_tenant_adp_aoid', ['tenantId', 'adpAssociateOid'])
    .index('by_tenant_member', ['tenantId', 'tenantMemberId']),

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
    objectiveId: v.optional(v.id('clientObjectives')),
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
    objectiveId: v.optional(v.id('clientObjectives')),
  }).index('by_tenant_shift', ['tenantId', 'shiftId']),

  reviewEvents: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    reviewerId: v.string(),
    decision: v.union(v.literal('approved'), v.literal('correction_requested')),
    comment: v.string(),
    complianceOverride: v.optional(v.boolean()),
    complianceOverrideReason: v.optional(v.string()),
    createdAt: v.string(),
  }).index('by_tenant_shift', ['tenantId', 'shiftId']),

  billingLines: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    hours: v.number(),
    rate: v.number(),
    amount: v.number(),
    exportBatchId: v.optional(v.id('exportBatches')),
    blockedReason: v.optional(v.string()),
    blockedAt: v.optional(v.string()),
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
    clientId: v.optional(v.id('clients')),
    payerType: v.optional(v.string()),
    status: v.optional(v.string()),
  }).index('by_tenant', ['tenantId']),

  payPeriods: defineTable({
    tenantId: v.id('tenants'),
    startDate: v.string(),
    endDate: v.string(),
    status: v.string(),
    exportedAt: v.optional(v.string()),
    exportedBy: v.optional(v.string()),
  })
    .index('by_tenant_status', ['tenantId', 'status'])
    .index('by_tenant_dates', ['tenantId', 'startDate']),

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
    branchId: v.optional(v.id('agencyBranches')),
    invitationId: v.optional(v.string()),
    invitationFailed: v.optional(v.boolean()),
    invitationError: v.optional(v.string()),
    manualSetup: v.optional(v.boolean()),
    requiresPasswordChange: v.optional(v.boolean()),
    magicLink: v.optional(v.string()),
    manualSetupTicketExpiresAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant_email', ['tenantId', 'email'])
    .index('by_tenant_clerk_user', ['tenantId', 'clerkUserId']),

  applications: defineTable({
    tenantId: v.id('tenants'),
    candidateId: v.id('candidates'),
    status: v.string(),
    fields: v.optional(v.any()),
    decision: v.optional(
      v.union(
        v.literal('approved'),
        v.literal('rejected'),
        v.literal('needs_correction'),
      ),
    ),
    hrNotes: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    decisionAt: v.optional(v.string()),
    hiredEmployeeProfileId: v.optional(v.id('employeeProfiles')),
  })
    .index('by_tenant_status', ['tenantId', 'status'])
    .index('by_candidate', ['candidateId'])
    .index('by_candidate_submittedAt', ['candidateId', 'submittedAt']),

  candidateTasks: defineTable({
    tenantId: v.id('tenants'),
    candidateId: v.id('candidates'),
    applicationId: v.optional(v.id('applications')),
    type: v.string(),
    status: v.string(),
    order: v.number(),
    dueAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
  })
    .index('by_tenant_candidate_status', ['tenantId', 'candidateId', 'status'])
    .index('by_tenant_candidate_order', ['tenantId', 'candidateId', 'order']),

  hrCases: defineTable({
    tenantId: v.id('tenants'),
    caseNumber: v.optional(v.string()),
    subjectType: v.string(),
    subjectId: v.string(),
    category: v.string(),
    title: v.string(),
    status: v.string(),
    ownerMemberId: v.optional(v.id('tenantMembers')),
    description: v.optional(v.string()),
    resolvedAt: v.optional(v.string()),
    // Set on cases created by the automatic flagging crons (checkAndFlagIssues
    // and checkExpiringCredentials): flagType identifies the flag scenario,
    // autoCreatedAt the run timestamp.
    flagType: v.optional(v.string()),
    autoCreatedAt: v.optional(v.string()),
    createdAt: v.string(),
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
    key: v.optional(v.string()),
    name: v.string(),
    version: v.optional(v.number()),
    description: v.optional(v.string()),
    active: v.boolean(),
    fields: v.array(v.any()),
    createdBy: v.string(),
    createdAt: v.string(),
  })
    .index('by_tenant_key_version', ['tenantId', 'key', 'version'])
    .index('by_tenant_created', ['tenantId', 'createdAt']),

  formSubmissions: defineTable({
    tenantId: v.id('tenants'),
    formDefinitionId: v.id('formDefinitions'),
    subjectType: v.string(),
    subjectId: v.string(),
    submittedBy: v.string(),
    status: v.string(),
    answers: v.record(v.string(), v.any()),
    submittedAt: v.string(),
  })
    .index('by_tenant_subject', ['tenantId', 'subjectType', 'subjectId'])
    .index('by_formDefinition', ['formDefinitionId'])
    .index('by_submittedBy', ['submittedBy']),

  documentArchiveItems: defineTable({
    tenantId: v.id('tenants'),
    fileId: v.id('files'),
    subjectType: v.string(),
    subjectId: v.string(),
    category: v.string(),
    status: v.string(),
    expiresAt: v.optional(v.string()),
    retentionUntil: v.optional(v.string()),
    // Legal hold suspends the retention window (17 CCR §54326(a)(3) audit-hold
    // extension) — records under hold must never be deleted.
    legalHold: v.optional(v.boolean()),
    source: v.optional(v.string()),
    verifiedBy: v.optional(v.string()),
    verifiedAt: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    photoIdType: v.optional(v.string()),
    overrideStatus: v.optional(v.string()),
    overrideReason: v.optional(v.string()),
    overrideBy: v.optional(v.string()),
    overrideAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant_subject', ['tenantId', 'subjectType', 'subjectId'])
    .index('by_tenant_category_status', ['tenantId', 'category', 'status'])
    .index('by_tenant_expires_at', ['tenantId', 'expiresAt'])
    .index('by_tenant_created', ['tenantId', 'createdAt']),

  credentialRequirements: defineTable({
    tenantId: v.id('tenants'),
    role: v.string(),
    category: v.string(),
    label: v.string(),
    isRequired: v.boolean(),
    expiryMonths: v.optional(v.number()),
  }).index('by_tenant_role', ['tenantId', 'role']),

  // Agency-level recurring compliance obligations (vendor-file items from
  // docs/07 §3.5: DS 1891, DS 1896, insurance certificates, CPA audit/review,
  // COI statements, whistleblower policy, program design). Completing an
  // obligation rolls dueAt forward by cadenceMonths; evidenceItemId links an
  // uploaded documentArchiveItems row as proof.
  agencyObligations: defineTable({
    tenantId: v.id('tenants'),
    key: v.union(
      v.literal('ds1891_disclosure'),
      v.literal('hcbs_agreement_ds1896'),
      v.literal('insurance_general_liability'),
      v.literal('insurance_workers_comp'),
      v.literal('insurance_auto'),
      v.literal('cpa_audit_or_review'),
      v.literal('conflict_of_interest'),
      v.literal('whistleblower_policy'),
      v.literal('program_design'),
    ),
    label: v.string(),
    cadenceMonths: v.number(),
    dueAt: v.string(),
    completedAt: v.optional(v.string()),
    evidenceItemId: v.optional(v.id('documentArchiveItems')),
    notes: v.optional(v.string()),
    createdAt: v.string(),
  }).index('by_tenant_due', ['tenantId', 'dueAt']),

  escalations: defineTable({
    tenantId: v.id('tenants'),
    subjectType: v.string(),
    subjectId: v.string(),
    escalationLevel: v.number(),
    escalatedTo: v.string(),
    reason: v.string(),
    createdAt: v.string(),
    resolvedAt: v.optional(v.string()),
  })
    .index('by_tenant_level', ['tenantId', 'escalationLevel'])
    .index('by_tenant_unresolved', ['tenantId', 'resolvedAt']),

  notifications: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    type: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
    read: v.boolean(),
    createdAt: v.string(),
  })
    .index('by_tenant_user', ['tenantId', 'clerkUserId'])
    .index('by_tenant_user_read', ['tenantId', 'clerkUserId', 'read']),

  platformTrainingCompletions: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    trainingId: v.string(),
    completedAt: v.string(),
    status: v.string(),
    expiresAt: v.optional(v.string()),
  }).index('by_tenant_user', ['tenantId', 'clerkUserId']),

  // Agency branches — each agency configures which branches they have
  // (ILS, SLS, Daycare, and/or custom branches)
  agencyBranches: defineTable({
    tenantId: v.id('tenants'),
    branchType: v.string(),
    label: v.string(),
    isPredefined: v.boolean(),
    order: v.number(),
    active: v.boolean(),
  }).index('by_tenant', ['tenantId']),

  // Products — platform products/flows that agencies can subscribe to
  products: defineTable({
    key: v.string(),
    label: v.string(),
    description: v.string(),
    active: v.boolean(),
  }).index('by_key', ['key']),

  // Agency product subscriptions — which products each agency has hired
  agencyProducts: defineTable({
    tenantId: v.id('tenants'),
    productKey: v.string(),
    active: v.boolean(),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_product', ['tenantId', 'productKey']),

  // Background checks — initiated after candidate consent
  backgroundChecks: defineTable({
    tenantId: v.id('tenants'),
    candidateId: v.id('candidates'),
    provider: v.string(),          // 'mock' | 'backgroundchecks_dot_com' | 'checkr' | 'victig' | etc.
    providerReportId: v.optional(v.string()),
    status: v.string(),            // 'pending' | 'clear' | 'consider' | 'suspended' | 'expired' | 'error' | 'pending_scan' | 'completed' | 'scan_failed'
    result: v.optional(v.string()), // JSON string with result summary
    package: v.string(),           // which check package was used
    initiatedAt: v.string(),
    completedAt: v.optional(v.string()),
    officialResultStorageId: v.optional(v.string()),
    officialResultUploadedAt: v.optional(v.string()),
    officialResultUploadedBy: v.optional(v.string()),
  }).index('by_tenant_candidate', ['tenantId', 'candidateId']),

  // Prefilled PDFs generated for candidate onboarding forms
  prefilledDocuments: defineTable({
    tenantId: v.id('tenants'),
    candidateId: v.id('candidates'),
    applicationId: v.optional(v.id('applications')),
    documentType: v.string(), // 'health_screen' | 'live_scan' | 'w4' | 'criminal_record'
    storageId: v.optional(v.string()), // Convex file storage of the generated PDF
    generatedAt: v.string(),
    generatedBy: v.string(),  // clerkUserId or 'system'
    uploadedSignedStorageId: v.optional(v.string()), // signed/stamped version uploaded by candidate
    hrSectionCompleted: v.optional(v.boolean()),
    hrSectionData: v.optional(v.any()),
  })
    .index('by_tenant_candidate', ['tenantId', 'candidateId'])
    .index('by_tenant_candidate_type', ['tenantId', 'candidateId', 'documentType']),

  // Training configurations — configurable per agency
  trainingConfigs: defineTable({
    tenantId: v.id('tenants'),
    isDefault: v.boolean(),
    steps: v.array(v.object({
      id: v.string(),
      title: v.string(),
      type: v.union(
        v.literal('text'),
        v.literal('video'),
        v.literal('image'),
        v.literal('policy'),
        v.literal('quiz'),
      ),
      content: v.string(),
      caption: v.optional(v.string()),
      minDurationSec: v.optional(v.number()),
      required: v.boolean(),
    })),
    passingScore: v.optional(v.number()),
  }).index('by_tenant', ['tenantId']),

  // Candidate form drafts — auto-saved application state
  drafts: defineTable({
    tenantId: v.id('tenants'),
    candidateId: v.id('candidates'),
    formType: v.string(),
    data: v.any(),
    updatedAt: v.string(),
  })
    .index('by_tenant_candidate_type', ['tenantId', 'candidateId', 'formType'])
    .index('by_tenant_candidate', ['tenantId', 'candidateId']),

  // Platform pricing plans — seat-based subscription tiers managed by
  // platform admins (Phase 3 / Platform Admin Dashboard).
  pricingPlans: defineTable({
    key: v.string(), // 'starter' | 'professional' | 'enterprise'
    label: v.string(),
    basePrice: v.number(), // monthly base USD
    includedSeats: v.number(),
    perSeatPrice: v.number(), // per seat above included
    active: v.boolean(),
    // Pricing model — absent means 'flat' (legacy behavior).
    model: v.optional(
      v.union(v.literal('flat'), v.literal('per_item'), v.literal('tiered')),
    ),
    // Per billable-item rates (USD), used when model === 'per_item'.
    perItemRates: v.optional(
      v.object({
        perCandidate: v.optional(v.number()),
        perShift: v.optional(v.number()),
        perApplication: v.optional(v.number()),
      }),
    ),
    // Volume tiers by active seats, used when model === 'tiered'. Evaluated
    // in order; first tier whose upTo >= seats wins.
    tiers: v.optional(
      v.array(v.object({ upTo: v.number(), monthlyPrice: v.number() })),
    ),
    // Optional soft alert threshold (active seats) — warning only, no block.
    alertThreshold: v.optional(v.number()),
  }).index('by_key', ['key']),

  // Per-tenant platform subscription (one per tenant, keyed by tenantId).
  tenantSubscriptions: defineTable({
    tenantId: v.id('tenants'),
    planKey: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('trialing'),
      v.literal('past_due'),
      v.literal('suspended'),
      v.literal('canceled'),
    ),
    billingEmails: v.array(v.string()),
    currentPeriodStart: v.string(),
    currentPeriodEnd: v.string(),
    renewsAt: v.optional(v.string()),
    trialEndsAt: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()), // Stripe customer ID (cus_xxx)
    // Default Stripe payment method attached via the one-time setup link
    // (pm_xxx). When present, monthly invoices auto-charge.
    stripeDefaultPaymentMethod: v.optional(v.string()),
    // Dunning state — set on invoice.payment_failed, cleared on invoice.paid.
    pastDueSince: v.optional(v.number()),
    graceUntil: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_status', ['status']),

  // Platform invoices billed to agencies (separate from agency-side billingLines).
  platformInvoices: defineTable({
    tenantId: v.id('tenants'),
    invoiceNumber: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    dueDate: v.string(),
    lineItems: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        amount: v.number(),
        source: v.union(v.literal('auto'), v.literal('manual')),
      }),
    ),
    subtotal: v.number(),
    total: v.number(),
    status: v.union(
      v.literal('draft'),
      v.literal('sent'),
      v.literal('paid'),
      v.literal('overdue'),
      v.literal('void'),
    ),
    sentTo: v.optional(v.array(v.string())),
    sentAt: v.optional(v.string()),
    paidAt: v.optional(v.string()),
    notes: v.optional(v.string()),
    stripeInvoiceId: v.optional(v.string()), // Stripe invoice ID (in_xxx)
    stripeHostedInvoiceUrl: v.optional(v.string()), // Stripe-hosted payment page
    paymentMethod: v.optional(v.string()), // 'card' | 'ach' | 'manual'
    createdBy: v.string(), // clerkUserId of platform admin
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_status', ['status'])
    .index('by_tenant_status', ['tenantId', 'status'])
    .index('by_stripe_invoice_id', ['stripeInvoiceId']),

  // Stripe webhook events already processed (idempotency guard).
  stripeWebhookEvents: defineTable({
    stripeEventId: v.string(), // Stripe event ID (evt_xxx)
    type: v.string(), // Stripe event type
    processedAt: v.string(),
  }).index('by_stripe_event_id', ['stripeEventId']),

  // Special Incident Reports (17 CCR §54327, operative 2026-05-01). The
  // initial narrative is immutable: there is no update mutation for these
  // fields — follow-up information is appended via specialIncidentUpdates.
  // Only verbalReportedAt/writtenSubmittedAt/status ever change, via the
  // dedicated transition mutations in convex/incidents.ts.
  specialIncidents: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    category: v.union(
      v.literal('death'),
      v.literal('serious_injury'),
      v.literal('hospitalization'),
      v.literal('emergency_room_visit'),
      v.literal('medication_error'),
      v.literal('suspected_abuse'),
      v.literal('suspected_exploitation'),
      v.literal('suspected_neglect'),
      v.literal('victim_of_crime'),
      v.literal('missing_person'),
      v.literal('unauthorized_absence'),
      v.literal('aggressive_act'),
      v.literal('rights_violation'),
      v.literal('other'),
    ),
    occurredAt: v.string(), // ISO — when the incident happened
    learnedAt: v.string(), // ISO — when the agency learned of it (SLA anchor)
    location: v.string(),
    description: v.string(),
    treatmentProvided: v.optional(v.string()),
    witnesses: v.optional(v.string()),
    allegedPerpetrator: v.optional(v.string()),
    actionsTaken: v.string(),
    agenciesNotified: v.array(
      v.union(
        v.literal('aps'),
        v.literal('cps'),
        v.literal('ccl'),
        v.literal('law_enforcement'),
        v.literal('ombudsman'),
        v.literal('dph'),
        v.literal('other'),
      ),
    ),
    familyContacted: v.optional(
      v.object({
        who: v.string(),
        at: v.string(), // ISO
      }),
    ),
    verbalReportedAt: v.optional(v.string()), // ISO — the 24h report
    writtenSubmittedAt: v.optional(v.string()), // ISO — the 48h report
    // Legal hold suspends the retention window (17 CCR §54326(a)(3) audit-hold
    // extension) — records under hold must never be deleted.
    legalHold: v.optional(v.boolean()),
    status: v.union(
      v.literal('draft'),
      v.literal('verbal_reported'),
      v.literal('written_submitted'),
      v.literal('closed'),
    ),
    createdBy: v.string(), // clerkUserId
    createdAt: v.string(),
  })
    .index('by_tenant_created', ['tenantId', 'createdAt'])
    .index('by_tenant_client', ['tenantId', 'clientId'])
    .index('by_tenant_status', ['tenantId', 'status']),

  // Append-only SIR follow-ups (Title 17 requires follow-up information to be
  // added, not overwritten — no update/delete mutations exist for this table).
  specialIncidentUpdates: defineTable({
    tenantId: v.id('tenants'),
    incidentId: v.id('specialIncidents'),
    note: v.string(),
    addedBy: v.string(), // clerkUserId
    createdAt: v.string(),
  }).index('by_tenant_incident', ['tenantId', 'incidentId']),

  // Client grievances (WIC §4705; 17 CCR §58615(b)(6), §58631(d) — docs/07 §3.3,
  // gap row A5). SLA: a resolution must be proposed within 5 business days of
  // filedAt (computed in convex/grievances.ts, never stored).
  grievances: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    filedAt: v.string(), // ISO
    filedBy: v.string(), // free-text: client, authorized rep, etc.
    description: v.string(),
    status: v.union(
      v.literal('open'),
      v.literal('resolution_proposed'),
      v.literal('resolved'),
      v.literal('escalated'),
    ),
    resolutionNote: v.optional(v.string()),
    proposedAt: v.optional(v.string()), // ISO
    resolvedAt: v.optional(v.string()), // ISO
    createdAt: v.string(),
  })
    .index('by_tenant_client', ['tenantId', 'clientId'])
    .index('by_tenant_status', ['tenantId', 'status']),

  // Corrective action plans from audit findings (docs/07 §3.6, gap row E3;
  // 17 CCR §58851 analog — typically 30-day cycles). 'overdue' is computed
  // (dueAt < now && status === 'open'), never stored.
  correctiveActions: defineTable({
    tenantId: v.id('tenants'),
    source: v.union(
      v.literal('regional_center'),
      v.literal('dds'),
      v.literal('internal'),
    ),
    finding: v.string(),
    dueAt: v.string(), // ISO — defaults to finding date + 30 days
    evidenceItemId: v.optional(v.id('documentArchiveItems')),
    status: v.union(
      v.literal('open'),
      v.literal('submitted'),
      v.literal('verified'),
    ),
    verifiedBy: v.optional(v.string()), // clerkUserId
    verifiedAt: v.optional(v.string()), // ISO
    createdAt: v.string(),
  }).index('by_tenant_due', ['tenantId', 'dueAt']),

  // Supervision notes + annual employee performance evaluations (17 CCR
  // §58615(b)(5) — docs/07 §3.2, gap row C4). Append-only: no update/delete
  // mutations; new entries are new rows.
  supervisionRecords: defineTable({
    tenantId: v.id('tenants'),
    employeeProfileId: v.id('employeeProfiles'),
    kind: v.union(v.literal('supervision'), v.literal('annual_evaluation')),
    occurredAt: v.string(), // ISO
    summary: v.string(),
    recordedBy: v.string(), // clerkUserId
    createdAt: v.string(),
  }).index('by_tenant_employee', ['tenantId', 'employeeProfileId']),

  // Agency support tickets (Phase 3 — Maria's review). Created by agency
  // admins/coordinators; managed by platform admins in the Support section.
  supportTickets: defineTable({
    tenantId: v.id('tenants'),
    createdByUserId: v.string(), // clerkUserId
    createdByName: v.string(),
    subject: v.string(),
    description: v.string(),
    category: v.union(
      v.literal('billing'),
      v.literal('technical'),
      v.literal('account'),
      v.literal('feature'),
      v.literal('other'),
    ),
    priority: v.union(
      v.literal('low'),
      v.literal('normal'),
      v.literal('high'),
      v.literal('urgent'),
    ),
    status: v.union(
      v.literal('open'),
      v.literal('in_progress'),
      v.literal('resolved'),
      v.literal('closed'),
    ),
    platformNotes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_status', ['status']),
})
