/**
 * SSN display masking (compliance mini-phase, Stage 3).
 *
 * Default rendering everywhere must be masked; the full value is only
 * available through the audited `sensitiveAccess.revealSsn` mutation, and
 * only for org:hr/org:admin. The full SSN is never persisted client-side.
 */
export function maskSsn(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const digits = value.replace(/[\s-]/g, '')
  if (/^\d{4,}$/.test(digits)) {
    return `***-**-${digits.slice(-4)}`
  }
  // Non-standard value (e.g. an ITIN with letters): mask completely.
  return '***-**-****'
}
