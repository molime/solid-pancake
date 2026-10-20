/**
 * Audit event category taxonomy (compliance mini-phase, Stage 1).
 *
 * Every `auditEvents` row carries a `category` derived from its action
 * string via `categoryForAction`, so the agency audit trail can be filtered
 * by area (category dropdown) without re-tagging each of the ~70 existing
 * actions. Rules are prefix-based and ordered: the first matching rule wins,
 * so keep specific prefixes before broader ones.
 */

export const AUDIT_CATEGORIES = [
  'shifts',
  'billing',
  'candidates',
  'compliance',
  'incidents',
  'hr',
  'files',
  'exports',
  'access',
  'policy',
  'data_lifecycle',
  'platform',
  'access_control',
  'other',
] as const

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]

const CATEGORY_RULES: Array<[AuditCategory, string[]]> = [
  // Sensitive access first: support access and future access.* actions
  // (e.g. access.ssn_revealed) must not be swallowed by broader prefixes.
  ['access', ['support_access_', 'access.']],
  ['policy', ['policy.']],
  ['files', ['file.']],
  ['exports', ['data.exported', 'export_']],
  ['data_lifecycle', ['data_lifecycle.', 'purge_']],
  ['billing', ['invoice', 'billing_', 'payroll_']],
  ['candidates', ['candidate.', 'candidate_']],
  [
    'compliance',
    [
      'compliance_',
      'credential_',
      'legal_hold',
      'document.',
      'report_',
      'agency_obligation',
    ],
  ],
  ['incidents', ['incident', 'grievance', 'corrective_', 'escalation_']],
  ['hr', ['hrcase.', 'hr_case', 'supervision_', 'member.', 'member_']],
  [
    'shifts',
    ['shift', 'timeclock', 'time_clock', 'coverage.resolved', 'live_in_attestation_'],
  ],
  [
    'platform',
    [
      'platform.',
      'tenant_',
      'stripe_',
      'payment_',
      'support_ticket_',
      'agency_settings_',
    ],
  ],
  ['access_control', ['access_control.', 'role_']],
]

/** Map an audit action string to its category. Defaults to 'other'. */
export function categoryForAction(action: string): AuditCategory {
  const normalized = action.toLowerCase()
  for (const [category, prefixes] of CATEGORY_RULES) {
    if (prefixes.some((prefix) => normalized.startsWith(prefix))) {
      return category
    }
  }
  return 'other'
}
