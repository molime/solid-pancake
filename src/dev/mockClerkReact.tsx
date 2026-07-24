/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  createContext,
  useContext,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from 'react'

const clerkOrgId = 'org_screenshot_mock'

type User = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  emailAddresses: Array<{ emailAddress: string }>
  primaryEmailAddress: { emailAddress: string } | null
  imageUrl: string
}

const mockCoordinator: User = {
  id: 'user_screenshot_coordinator',
  firstName: 'Ana',
  lastName: 'Gómez',
  fullName: 'Ana Gómez',
  emailAddresses: [{ emailAddress: 'ana@atriax.example' }],
  primaryEmailAddress: { emailAddress: 'ana@atriax.example' },
  imageUrl: '',
}

const mockCaregiver: User = {
  id: 'user_screenshot_caregiver',
  firstName: 'Lucía',
  lastName: 'Fernández',
  fullName: 'Lucía Fernández',
  emailAddresses: [{ emailAddress: 'lucia@atriax.example' }],
  primaryEmailAddress: { emailAddress: 'lucia@atriax.example' },
  imageUrl: '',
}

const mockCandidate: User = {
  id: 'user_screenshot_candidate',
  firstName: 'Sofia',
  lastName: 'Herrera',
  fullName: 'Sofia Herrera',
  emailAddresses: [{ emailAddress: 'sofia.herrera@gmail.com' }],
  primaryEmailAddress: { emailAddress: 'sofia.herrera@gmail.com' },
  imageUrl: '',
}

const mockOrganization = {
  id: clerkOrgId,
  name: 'ATRIA-X Demo Agency',
  slug: 'atria-x-demo',
  imageUrl: '',
}

const ClerkContext = createContext<{
  user: User | null
  organization: typeof mockOrganization | null
}>({ user: null, organization: null })

function getRoleFromView(): 'org:admin' | 'org:coordinator' | 'org:caregiver' | 'org:candidate' {
  if (typeof window === 'undefined') return 'org:coordinator'
  const view = new URLSearchParams(window.location.search).get('view')
  if (view === 'caregiver-schedule' || view === 'availability') {
    return 'org:caregiver'
  }
  if (view && view.startsWith('candidate')) {
    return 'org:candidate'
  }
  return 'org:coordinator'
}

export function ClerkProvider({ children }: PropsWithChildren) {
  const role = getRoleFromView()
  const user = role === 'org:caregiver'
    ? mockCaregiver
    : role === 'org:candidate'
      ? mockCandidate
      : mockCoordinator
  return (
    <ClerkContext.Provider value={{ user, organization: mockOrganization }}>
      {children}
    </ClerkContext.Provider>
  )
}

export function useUser() {
  const { user } = useContext(ClerkContext)
  return { isLoaded: true, isSignedIn: Boolean(user), user }
}

export function useAuth() {
  const role = getRoleFromView()
  const user = useContext(ClerkContext).user ?? mockCoordinator
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: user.id,
    sessionId: 'sess_screenshot',
    orgId: clerkOrgId,
    orgRole: role,
    orgSlug: mockOrganization.slug,
    getToken: async () => 'mock-clerk-token',
    signOut: async () => {},
  }
}

export function useOrganization() {
  const { organization } = useContext(ClerkContext)
  return {
    isLoaded: true,
    organization,
  }
}

export function useOrganizationList() {
  return {
    isLoaded: true,
    organizationList: [
      {
        organization: mockOrganization,
        membership: { role: 'org:coordinator' },
      },
    ],
    setActive: () => {},
    createOrganization: () => Promise.resolve(mockOrganization),
  }
}

export function useClerk() {
  return {
    openSignIn: () => {},
    openSignUp: () => {},
    setActive: () => {},
    signOut: async () => {},
  }
}

export function CreateOrganization(
  _props: Record<string, unknown>,
): ReactElement {
  return <div data-testid="mock-create-organization">Create organization</div>
}

export function SignIn(_props: Record<string, unknown>): ReactElement {
  return <div data-testid="mock-sign-in">Sign in</div>
}

export function SignUp(_props: Record<string, unknown>): ReactElement {
  return <div data-testid="mock-sign-up">Sign up</div>
}

export function OrganizationSwitcher(
  _props: Record<string, unknown>,
): ReactElement {
  return <div data-testid="mock-organization-switcher">Organization switcher</div>
}

export function SignedIn({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function SignedOut({ children: _children }: { children: ReactNode }) {
  return null
}

export function useSession() {
  return { isLoaded: true, session: { id: 'sess_screenshot' } }
}

export function RedirectToSignIn() {
  return <div data-testid="mock-redirect-to-sign-in">Redirecting to sign in</div>
}
