import { describe, expect, it } from 'vitest'
import { assertCanEditProof } from './files'

describe('files authorization', () => {
  it('allows caregivers to edit proof on their own in-progress shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:caregiver',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-1', status: 'in_progress' },
      }),
    ).not.toThrow()
  })

  it('allows caregivers to edit proof on their own needs_correction shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:caregiver',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-1', status: 'needs_correction' },
      }),
    ).not.toThrow()
  })

  it('rejects caregiver editing another caregiver shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:caregiver',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-2', status: 'in_progress' },
      }),
    ).toThrow('Forbidden: caregivers can only edit proof on their own shifts.')
  })

  it('rejects caregiver editing proof on submitted shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:caregiver',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-1', status: 'submitted' },
      }),
    ).toThrow('Forbidden: proof can only be edited for shifts in progress or needing correction.')
  })

  it('allows admin to edit proof on any shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:admin',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-2', status: 'submitted' },
      }),
    ).not.toThrow()
  })

  it('allows coordinator to edit proof on any shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:coordinator',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-2', status: 'billing_ready' },
      }),
    ).not.toThrow()
  })
})
