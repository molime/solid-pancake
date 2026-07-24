export type CarInsuranceStatus =
  | 'valid'
  | 'expiring_soon'
  | 'expired'
  | 'missing'
  | 'not_applicable'

const DAY_MS = 24 * 60 * 60 * 1000
export const EXPIRING_SOON_DAYS = 30

export function getCarInsuranceStatus(options: {
  canTransportClients: boolean | undefined
  expiresAt?: string
  now?: number
  expiringSoonDays?: number
}): CarInsuranceStatus {
  const {
    canTransportClients,
    expiresAt,
    now = Date.now(),
    expiringSoonDays = EXPIRING_SOON_DAYS,
  } = options

  if (canTransportClients !== true) return 'not_applicable'
  if (!expiresAt) return 'missing'

  const expiryMs = new Date(expiresAt).getTime()
  if (Number.isNaN(expiryMs)) return 'missing'

  const daysUntilExpiry = Math.floor((expiryMs - now) / DAY_MS)
  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= expiringSoonDays) return 'expiring_soon'
  return 'valid'
}
