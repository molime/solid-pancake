/**
 * Resolves the agency logo asset for the current tenant.
 *
 * STOPGAP: name-substring match against `tenantName` and, when available, the
 * employer legal name from tenant settings (the latter is how the Golden Ages
 * tenant is identified app-wide, since its tenant display name differs).
 * Replace this with a slug- or config-based lookup (e.g. an `agencyConfig`
 * table) once one is available.
 */
export function resolveAgencyLogo(
  tenantName: string | undefined,
  legalName?: string | null,
): string | null {
  const name = tenantName?.toLowerCase() ?? ''
  const legal = legalName?.toLowerCase() ?? ''
  if (name.includes('golden') || legal.includes('golden')) {
    return '/agency-logo-goldenages.png'
  }
  if (name.includes('individuals choice') || legal.includes('individuals choice')) {
    return '/agency-logo-individualschoice.jpeg'
  }
  return null
}
