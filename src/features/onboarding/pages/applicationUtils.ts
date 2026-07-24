import type { PersonalInfo, ApplicationFormData } from '../components/application/types'

export function prefilledI9FromPersonal(personal: PersonalInfo, existing: ApplicationFormData['i9']): ApplicationFormData['i9'] {
  const { street, apt, city, state, zip } = personal.address
  return {
    ...existing,
    address: street || existing.address,
    aptNumber: apt || existing.aptNumber,
    city: city || existing.city,
    state: state || existing.state,
    zip: zip || existing.zip,
  }
}

export function prefilledW4FromPersonal(personal: PersonalInfo, existing: ApplicationFormData['w4']): ApplicationFormData['w4'] {
  const { street, apt, city, state, zip } = personal.address
  const fullAddress = [street, apt].filter(Boolean).join(' ')
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return {
    ...existing,
    address: fullAddress || existing.address,
    cityStateZip: cityStateZip || existing.cityStateZip,
  }
}

export function mergeDraft(base: ApplicationFormData, draft?: Record<string, unknown> | null): ApplicationFormData {
  if (!draft) return base
  return {
    ...base,
    ...(draft.personal ? { personal: { ...base.personal, ...(draft.personal as object) } } : {}),
    ...(draft.employment ? { employment: draft.employment as ApplicationFormData['employment'] } : base.employment),
    ...(draft.references ? { references: draft.references as ApplicationFormData['references'] } : base.references),
    ...(draft.criminalRecord ? { criminalRecord: { ...base.criminalRecord, ...(draft.criminalRecord as object) } } : {}),
    ...(draft.i9 ? { i9: { ...base.i9, ...(draft.i9 as object) } } : {}),
    ...(draft.w4 ? { w4: { ...base.w4, ...(draft.w4 as object) } } : {}),
    ...(draft.disbursement ? { disbursement: { ...base.disbursement, ...(draft.disbursement as object) } } : {}),
    ...(draft.acknowledgments ? { acknowledgments: { ...base.acknowledgments, ...(draft.acknowledgments as object) } } : {}),
    ...(typeof draft.legalValidityAccepted === 'boolean'
      ? { legalValidityAccepted: draft.legalValidityAccepted }
      : {}),
  }
}
