import { mutation } from './_generated/server'
import { v, ConvexError } from 'convex/values'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { categoryForAction } from './_utils/auditCategories'
import { checkRateLimit } from './_utils/rateLimit'

// Field-level encryption of stored SSN — assessed and SKIPPED (identified
// gap, recorded in the compliance docs as Pending). Rationale: the SSN lives
// inside free-form `applications.fields` / `drafts.data` JSON blobs that the
// frontend writes verbatim (candidates.submitApplication replaces the whole
// blob; drafts.saveDraft patches `data` opaquely) and that every consumer
// reads as plaintext — including the prefilled-PDF generation, which must
// render the raw value in the browser, and the generic field-renderers on the
// HR pages. Encrypting one leaf inside those blobs would require a recursive
// encrypt/decrypt walk on every write and in every read consumer (client-side
// included, where the key could not safely live), while legacy plaintext rows
// would still bypass it. The seam is not clean, so per the design doc we ship
// masking + audited reveal only — no half-implemented crypto. Revisit with a
// dedicated encrypted column + migration of existing rows.

type SsnContextType = 'application' | 'w4' | 'i9'

/** `fields` JSON section holding the SSN for each reveal context. */
const SECTION_FOR_CONTEXT: Record<SsnContextType, string> = {
  application: 'personal',
  w4: 'w4',
  i9: 'i9',
}

/**
 * Audited SSN reveal (compliance mini-phase, Stage 3). org:hr/org:admin only,
 * same tenant as the candidate. Every call writes an `access.ssn_revealed`
 * audit event (category `access`); the metadata identifies the context
 * record and NEVER contains the SSN value. Rate-limited (Stage 5): 10
 * reveals/minute/user via the in-memory limiter in `_utils/rateLimit`.
 */
export const revealSsn = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    contextType: v.union(
      v.literal('application'),
      v.literal('w4'),
      v.literal('i9'),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:hr'],
    )

    // Stage 5 (rate limiting): at most 10 reveals per minute per user.
    if (!checkRateLimit(`revealSsn:${identity.subject}`, 10, 60_000).allowed) {
      throw new ConvexError('Rate limit exceeded. Try again later.')
    }

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    const application = await ctx.db
      .query('applications')
      .withIndex('by_candidate_submittedAt', (q) =>
        q.eq('candidateId', args.candidateId),
      )
      .order('desc')
      .first()

    const fields = (application?.fields ?? {}) as Record<string, unknown>
    const section = (fields[SECTION_FOR_CONTEXT[args.contextType]] ?? {}) as Record<
      string,
      unknown
    >
    const ssn = typeof section.ssn === 'string' ? section.ssn : ''

    await ctx.db.insert('auditEvents', {
      tenantId,
      actorId: identity.subject,
      actorRole: role,
      action: 'access.ssn_revealed',
      category: categoryForAction('access.ssn_revealed'),
      kind: 'tenant',
      metadata: {
        contextType: args.contextType,
        candidateId: args.candidateId as string,
      },
      createdAt: new Date().toISOString(),
    })

    return { ssn }
  },
})
