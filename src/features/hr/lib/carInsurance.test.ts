import { describe, expect, it } from 'vitest'
import { getCarInsuranceStatus } from './carInsurance'

const NOW = new Date('2026-07-15T00:00:00Z').getTime()

function datePlusDays(days: number) {
  return new Date(NOW + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

describe('getCarInsuranceStatus', () => {
  it('returns not_applicable when the applicant does not transport clients', () => {
    expect(
      getCarInsuranceStatus({ canTransportClients: false, now: NOW }),
    ).toBe('not_applicable')
    expect(
      getCarInsuranceStatus({ canTransportClients: undefined, now: NOW }),
    ).toBe('not_applicable')
  })

  it('returns missing when transport is desired but no document was uploaded', () => {
    expect(
      getCarInsuranceStatus({ canTransportClients: true, now: NOW }),
    ).toBe('missing')
  })

  it('returns missing for an unparseable expiry date', () => {
    expect(
      getCarInsuranceStatus({
        canTransportClients: true,
        expiresAt: 'not-a-date',
        now: NOW,
      }),
    ).toBe('missing')
  })

  it('returns expired when the expiry date is in the past', () => {
    expect(
      getCarInsuranceStatus({
        canTransportClients: true,
        expiresAt: datePlusDays(-1),
        now: NOW,
      }),
    ).toBe('expired')
  })

  it('returns expiring_soon when the expiry date is within 30 days', () => {
    expect(
      getCarInsuranceStatus({
        canTransportClients: true,
        expiresAt: datePlusDays(10),
        now: NOW,
      }),
    ).toBe('expiring_soon')
    expect(
      getCarInsuranceStatus({
        canTransportClients: true,
        expiresAt: datePlusDays(30),
        now: NOW,
      }),
    ).toBe('expiring_soon')
  })

  it('returns valid when the expiry date is more than 30 days out', () => {
    expect(
      getCarInsuranceStatus({
        canTransportClients: true,
        expiresAt: datePlusDays(31),
        now: NOW,
      }),
    ).toBe('valid')
  })
})
