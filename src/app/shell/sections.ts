// Gateable platform sections. The platform owner can disable any of these
// per agency (tenants.disabledSections) — e.g. a basic-tier agency without
// Dashboard/Billing/Incidents. Anything not listed here is always available.
export const GATEABLE_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', paths: ['/', '/dashboard'] },
  { key: 'admin', label: 'Admin', paths: ['/admin'] },
  { key: 'incidents', label: 'Incidents', paths: ['/incidents'] },
  { key: 'evv', label: 'EVV Export', paths: ['/evv'] },
  { key: 'reporting', label: 'Reporting', paths: ['/reports'] },
  { key: 'audit', label: 'Audit Ready Center', paths: ['/audit'] },
  { key: 'logs', label: 'Logs', paths: ['/logs'] },
  { key: 'review', label: 'Review', paths: ['/coordinator/review'] },
  { key: 'billing', label: 'Billing', paths: ['/billing'] },
  { key: 'payroll', label: 'Payroll', paths: ['/billing/payroll'] },
  { key: 'clients', label: 'Clients', paths: ['/clients'] },
  { key: 'settings', label: 'Settings', paths: ['/settings/geofence'] },
  {
    key: 'email-domains',
    label: 'Email Domains',
    paths: ['/settings/allowed-domains'],
  },
] as const

export type SectionKey = (typeof GATEABLE_SECTIONS)[number]['key']

function pathMatches(sectionPaths: readonly string[], pathname: string): boolean {
  return sectionPaths.some((path) => {
    // The root path only matches itself — a prefix test would match every route.
    if (path === '/') return pathname === '/'
    return pathname === path || pathname.startsWith(`${path}/`)
  })
}

// Where to send a user who lands on a disabled section. '/hr' is never
// gateable, so it is always a safe fallback for agency staff.
export const SECTION_FALLBACK_PATH = '/hr'

export function isSectionDisabled(
  disabledSections: readonly string[] | undefined,
  pathname: string,
): boolean {
  if (!disabledSections || disabledSections.length === 0) return false
  return GATEABLE_SECTIONS.some(
    (section) =>
      disabledSections.includes(section.key) &&
      pathMatches(section.paths, pathname),
  )
}
