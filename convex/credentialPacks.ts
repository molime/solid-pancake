import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireTenantRole } from './authHelpers'
import { internal } from './_generated/api'

type CredentialPackEntry = {
  role: 'org:caregiver'
  category: string
  label: string
  isRequired: boolean
  expiryMonths?: number
}

/**
 * Out-of-the-box credential requirements for California ILS/SLS caregivers
 * (docs/07 §3.2, gap row C1): Live Scan clearance, CPR/First Aid (2-yr),
 * TB screening, mandated-reporter / zero-tolerance / HIPAA / SIR trainings,
 * photo ID, plus optional driver's license and auto insurance for transport
 * staff. expiryMonths drives the expiring/expired compliance math; entries
 * without it never expire.
 */
export const CA_ILS_SLS_CAREGIVER_PACK: CredentialPackEntry[] = [
  {
    role: 'org:caregiver',
    category: 'live_scan',
    label: 'Live Scan background clearance',
    isRequired: true,
  },
  {
    role: 'org:caregiver',
    category: 'cpr_first_aid',
    label: 'CPR & First Aid certification',
    isRequired: true,
    expiryMonths: 24,
  },
  {
    role: 'org:caregiver',
    category: 'tb_test',
    label: 'TB screening',
    isRequired: true,
    // Default 48 months; agencies can adjust via upsertCredentialRequirement.
    expiryMonths: 48,
  },
  {
    role: 'org:caregiver',
    category: 'mandated_reporter',
    label: 'Mandated reporter training',
    isRequired: true,
    expiryMonths: 24,
  },
  {
    role: 'org:caregiver',
    category: 'zero_tolerance',
    label: 'Zero-tolerance policy training',
    isRequired: true,
    expiryMonths: 12,
  },
  {
    role: 'org:caregiver',
    category: 'hipaa',
    label: 'HIPAA / confidentiality training',
    isRequired: true,
    expiryMonths: 12,
  },
  {
    role: 'org:caregiver',
    category: 'sir_training',
    label: 'Special Incident Reporting training',
    isRequired: true,
    expiryMonths: 12,
  },
  {
    role: 'org:caregiver',
    category: 'photo_id',
    label: 'Photo identification',
    isRequired: true,
  },
  {
    role: 'org:caregiver',
    category: 'drivers_license',
    label: "Driver's license",
    isRequired: false,
  },
  {
    role: 'org:caregiver',
    category: 'car_insurance',
    label: 'Car insurance policy',
    isRequired: false,
    expiryMonths: 12,
  },
]

/**
 * Applies the CA ILS/SLS caregiver credential pack to the tenant. Idempotent:
 * categories that already exist for tenant+role are skipped, so re-clicking
 * never duplicates requirements (same idempotent style as seed.seedAgency).
 */
export const applyCredentialPack = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const existing = await ctx.db
      .query('credentialRequirements')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect()
    const existingCategories = new Set(existing.map((r) => r.category))

    let created = 0
    let skipped = 0
    for (const entry of CA_ILS_SLS_CAREGIVER_PACK) {
      if (existingCategories.has(entry.category)) {
        skipped += 1
        continue
      }
      await ctx.db.insert('credentialRequirements', {
        tenantId,
        role: entry.role,
        category: entry.category,
        label: entry.label,
        isRequired: entry.isRequired,
        expiryMonths: entry.expiryMonths,
      })
      existingCategories.add(entry.category)
      created += 1
    }

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'credential_pack_applied',
      metadata: { pack: 'ca_ils_sls_caregiver', created, skipped },
    })

    return {
      status: created > 0 ? ('applied' as const) : ('already-applied' as const),
      message:
        created > 0
          ? `Applied the CA ILS/SLS credential pack: ${created} requirement${created !== 1 ? 's' : ''} created${skipped > 0 ? `, ${skipped} already existed` : ''}.`
          : `All ${skipped} pack requirements already exist — nothing to do.`,
      counts: { created, skipped },
    }
  },
})
