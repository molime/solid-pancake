/**
 * Resolves the agency logo asset for the current tenant.
 *
 * STOPGAP: this is a name-substring match against `tenantName` because
 * `useTenant()` does not expose a tenant slug yet. Replace this with a
 * slug- or config-based lookup (e.g. an `agencyConfig` table) once one is
 * available.
 */
export function resolveAgencyLogo(tenantName: string | undefined): string | null {
  if (tenantName?.toLowerCase().includes('individuals choice')) {
    return '/agency-logo-individualschoice.jpeg'
  }
  return null
}
