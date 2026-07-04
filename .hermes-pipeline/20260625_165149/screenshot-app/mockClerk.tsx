export function useOrganization() {
  return {
    organization: { id: 'org_screenshot', name: 'Screenshot Agency' },
    isLoaded: true,
  }
}

export function useUser() {
  return {
    user: {
      id: 'user_screenshot',
      firstName: 'Carla',
      fullName: 'Carla Núñez',
    },
  }
}

export function useAuth() {
  return { isLoaded: true, isSignedIn: true }
}

export function useClerk() {
  return { signOut: () => {} }
}

export function OrganizationSwitcher() {
  return (
    <span className="rounded-md border border-atria-border px-3 py-1.5 text-sm text-atria-ink">
      Screenshot Agency
    </span>
  )
}
