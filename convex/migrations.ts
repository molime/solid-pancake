import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'

/**
 * One-off account migration: moves everything attached to one Clerk user
 * (the "from" account) onto another (the "to" account) within a tenant.
 *
 * Used 2026-09-23 to merge Oge's personal account (ubahoge2014@yahoo.com)
 * into her work account (supervisor@goldenagesinhomecare.com) in Golden
 * Ages. Records keyed by candidateId (tasks, document versions, prefilled
 * documents, applications, background checks) follow the candidate row
 * automatically once its clerkUserId is re-pointed.
 *
 * Safe to re-run: every step is a no-op when there is nothing left to move.
 */
export const migrateUserAccount = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    fromClerkUserId: v.string(),
    toClerkUserId: v.string(),
    toEmail: v.string(),
    toRole: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
      v.literal('org:hr'),
      v.literal('org:candidate'),
    ),
  },
  handler: async (ctx, args) => {
    const summary = {
      candidateMoved: false as boolean,
      toMemberRoleSet: false as boolean,
      fromMemberRemoved: false as boolean,
      notifications: 0,
      platformTrainingCompletions: 0,
      trainingStepCompletions: 0,
    }

    // 1. Candidate record (tasks, versions, prefilled docs, applications and
    //    background checks all key off candidateId, so they move with it).
    const candidate = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.fromClerkUserId),
      )
      .unique()
    if (candidate) {
      await ctx.db.patch(candidate._id, {
        clerkUserId: args.toClerkUserId,
        email: args.toEmail.toLowerCase().trim(),
      })
      summary.candidateMoved = true
    }

    // 2. Membership: give the target account the source account's role, then
    //    remove the source membership so the old login loses tenant access.
    const toMember = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.toClerkUserId),
      )
      .unique()
    if (toMember && toMember.role !== args.toRole) {
      await ctx.db.patch(toMember._id, { role: args.toRole })
      summary.toMemberRoleSet = true
    }
    const fromMember = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.fromClerkUserId),
      )
      .unique()
    if (fromMember) {
      await ctx.db.delete(fromMember._id)
      summary.fromMemberRemoved = true
    }

    // 3-5. Rows keyed directly by clerkUserId.
    const rekey = async (
      table: 'notifications' | 'platformTrainingCompletions' | 'trainingStepCompletions',
    ) => {
      const rows = await ctx.db
        .query(table)
        .filter((q) =>
          q.and(
            q.eq(q.field('tenantId'), args.tenantId),
            q.eq(q.field('clerkUserId'), args.fromClerkUserId),
          ),
        )
        .collect()
      for (const row of rows) {
        await ctx.db.patch(row._id as Id<typeof table>, {
          clerkUserId: args.toClerkUserId,
        })
      }
      return rows.length
    }
    summary.notifications = await rekey('notifications')
    summary.platformTrainingCompletions = await rekey('platformTrainingCompletions')
    summary.trainingStepCompletions = await rekey('trainingStepCompletions')

    return summary
  },
})

/**
 * One-off display-name fix: sets a user's display name on their tenant
 * membership and employee profile. Used 2026-09-23 to give the supervisor
 * account Oge's full name after the account merge. Idempotent.
 */
export const updateUserDisplayName = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const summary = { member: false as boolean, employeeProfiles: 0 }
    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()
    if (member && member.displayName !== args.displayName) {
      await ctx.db.patch(member._id, { displayName: args.displayName })
      summary.member = true
    }
    const profiles = await ctx.db
      .query('employeeProfiles')
      .filter((q) =>
        q.and(
          q.eq(q.field('tenantId'), args.tenantId),
          q.eq(q.field('clerkUserId'), args.clerkUserId),
        ),
      )
      .collect()
    for (const profile of profiles) {
      if (profile.displayName !== args.displayName) {
        await ctx.db.patch(profile._id, { displayName: args.displayName })
        summary.employeeProfiles++
      }
    }
    return summary
  },
})

/**
 * One-off status correction: sets a candidate's status directly. Used
 * 2026-09-23 to normalize Oge's legacy 'offer_accepted' status to 'hired'
 * (she already has an employee profile) so she appears under the right
 * pipeline tabs.
 */
export const setCandidateStatusInternal = internalMutation({
  args: { candidateId: v.id('candidates'), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, { status: args.status })
    return { ok: true }
  },
})

/**
 * One-off org cleanup: removes every person (and their data) from a tenant
 * except the explicitly kept accounts. Used 2026-09-23 to clean the Golden
 * Ages org of test accounts, keeping only Samira (admin@) and Oge
 * (supervisor@). Clerk org memberships are removed separately via the Clerk
 * API — this only touches Convex data. Idempotent: re-running deletes
 * nothing when the kept set is all that remains.
 */
export const cleanupTenantPeople = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    keepClerkUserIds: v.array(v.string()),
    keepCandidateIds: v.array(v.id('candidates')),
  },
  handler: async (ctx, args) => {
    const keepUsers = new Set(args.keepClerkUserIds)
    const keepCandidates = new Set<string>(args.keepCandidateIds)
    const summary: Record<string, number> = {}

    const deleteWhere = async (
      table:
        | 'candidateTasks'
        | 'applications'
        | 'backgroundChecks'
        | 'drafts'
        | 'prefilledDocuments'
        | 'prefilledDocumentVersions'
        | 'notifications'
        | 'platformTrainingCompletions'
        | 'trainingStepCompletions'
        | 'hrCases'
        | 'escalations'
        | 'documentArchiveItems',
      matches: (doc: Record<string, unknown>) => boolean,
    ) => {
      const rows = await ctx.db
        .query(table)
        .filter((q) => q.eq(q.field('tenantId'), args.tenantId))
        .collect()
      let count = 0
      for (const row of rows) {
        if (matches(row as unknown as Record<string, unknown>)) {
          await ctx.db.delete(row._id)
          count++
        }
      }
      summary[table] = (summary[table] ?? 0) + count
      return count
    }

    // 1. Candidates not kept + their cascades.
    const candidates = await ctx.db
      .query('candidates')
      .filter((q) => q.eq(q.field('tenantId'), args.tenantId))
      .collect()
    const removedCandidateIds = new Set<string>()
    for (const candidate of candidates) {
      if (keepCandidates.has(candidate._id)) continue
      removedCandidateIds.add(candidate._id)
      await ctx.db.delete(candidate._id)
    }
    summary.candidates = removedCandidateIds.size
    const byRemovedCandidate = (doc: Record<string, unknown>) =>
      removedCandidateIds.has(String(doc.candidateId))
    await deleteWhere('candidateTasks', byRemovedCandidate)
    await deleteWhere('applications', byRemovedCandidate)
    await deleteWhere('backgroundChecks', byRemovedCandidate)
    await deleteWhere('drafts', byRemovedCandidate)
    await deleteWhere('prefilledDocuments', byRemovedCandidate)
    await deleteWhere('prefilledDocumentVersions', byRemovedCandidate)

    // 2. Memberships not kept.
    const members = await ctx.db
      .query('tenantMembers')
      .filter((q) => q.eq(q.field('tenantId'), args.tenantId))
      .collect()
    const keptSubjectIds = new Set<string>([...keepCandidates])
    let membersRemoved = 0
    for (const member of members) {
      if (keepUsers.has(member.clerkUserId)) {
        keptSubjectIds.add(member._id)
        continue
      }
      await ctx.db.delete(member._id)
      membersRemoved++
    }
    summary.tenantMembers = membersRemoved

    // 3. Employee profiles not kept (kept ones join the kept-subject set for
    //    document archive filtering).
    const profiles = await ctx.db
      .query('employeeProfiles')
      .filter((q) => q.eq(q.field('tenantId'), args.tenantId))
      .collect()
    let profilesRemoved = 0
    for (const profile of profiles) {
      if (keepUsers.has(String(profile.clerkUserId))) {
        keptSubjectIds.add(profile._id)
        continue
      }
      await ctx.db.delete(profile._id)
      profilesRemoved++
    }
    summary.employeeProfiles = profilesRemoved

    // 4. Rows keyed by clerkUserId.
    const byRemovedUser = (doc: Record<string, unknown>) =>
      !keepUsers.has(String(doc.clerkUserId))
    await deleteWhere('notifications', byRemovedUser)
    await deleteWhere('platformTrainingCompletions', byRemovedUser)
    await deleteWhere('trainingStepCompletions', byRemovedUser)

    // 5. HR cases about removed subjects, and their escalations.
    const removedCaseIds = new Set<string>()
    const cases = await ctx.db
      .query('hrCases')
      .filter((q) => q.eq(q.field('tenantId'), args.tenantId))
      .collect()
    for (const hrCase of cases) {
      if (keptSubjectIds.has(hrCase.subjectId)) continue
      removedCaseIds.add(hrCase._id)
      await ctx.db.delete(hrCase._id)
      summary.hrCases = (summary.hrCases ?? 0) + 1
    }
    await deleteWhere(
      'escalations',
      (doc) =>
        removedCaseIds.has(String(doc.subjectId)) ||
        !keptSubjectIds.has(String(doc.subjectId)),
    )

    // 6. Document archive items belonging to removed subjects.
    await deleteWhere(
      'documentArchiveItems',
      (doc) => !keptSubjectIds.has(String(doc.subjectId)),
    )

    return summary
  },
})
