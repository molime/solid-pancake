export * from '@clerk/react'

export function useOrganization() {
  return { organization: { id: 'org_screenshot', name: 'Screenshot Agency' } }
}

export function useUser() {
  return { user: { firstName: 'Ana' } }
}
