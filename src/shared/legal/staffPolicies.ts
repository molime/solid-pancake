/**
 * Canonical staff policies live in `convex/_utils/staffPolicies.ts` (a plain
 * TS module with no Convex runtime dependencies) because Convex functions
 * cannot import from outside the convex/ directory. This file re-exports them
 * so frontend code imports from one stable path. Same pattern as
 * `convex/_utils/auditCategories` ↔ `AuditTrailPage`.
 */
export {
  STAFF_POLICIES,
  STAFF_POLICY_KEYS,
  STAFF_POLICY_VERSIONS,
  type StaffPolicy,
  type StaffPolicySection,
} from '../../../convex/_utils/staffPolicies'
