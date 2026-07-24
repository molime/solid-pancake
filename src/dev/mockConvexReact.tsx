/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type PropsWithChildren,
} from 'react'
import {
  getFunctionReferenceName,
  resolveQuery,
  runMutation,
  type ScreenshotView,
} from './mockApi'
import {
  caregivers,
  clients,
  eligibleCoworkers,
  getCurrentMember,
} from './mockData'

type MockConvexContextValue = {
  view: ScreenshotView
  role: 'org:coordinator' | 'org:caregiver' | 'org:candidate'
  getQuery: (name: string, args: Record<string, unknown>) => unknown
  runMutation: (name: string, args: Record<string, unknown>) => Promise<unknown>
}

const MockConvexContext = createContext<MockConvexContextValue | null>(null)

function useMockConvexContext() {
  const ctx = useContext(MockConvexContext)
  if (!ctx) {
    throw new Error('useConvex hooks must be used within a MockConvexProvider')
  }
  return ctx
}

function getRoleForView(view: ScreenshotView): 'org:coordinator' | 'org:caregiver' | 'org:candidate' {
  if (view === 'caregiver-schedule' || view === 'availability') {
    return 'org:caregiver'
  }
  if (view.startsWith('candidate')) {
    return 'org:candidate'
  }
  return 'org:coordinator'
}

function getViewFromUrl(): ScreenshotView {
  if (typeof window === 'undefined') return 'scheduling'
  const raw = new URLSearchParams(window.location.search).get('view')
  const valid: ScreenshotView[] = [
    'scheduling',
    'shift-editor',
    'shift-packet',
    'coverage',
    'caregiver-schedule',
    'availability',
    'candidate-checklist',
    'candidate-application',
    'candidate-upload',
    'candidate-acknowledgment',
    'candidate-employment-agreement',
    'candidate-training',
    'candidate-profile',
    'candidate-status',
    'candidate-success',
    'candidate-apply-entry',
  ]
  return valid.includes(raw as ScreenshotView) ? (raw as ScreenshotView) : 'scheduling'
}

export function ConvexProviderWithAuth({
  children,
}: PropsWithChildren<{
  client?: unknown
  useAuth?: () => { isLoading: boolean; isAuthenticated: boolean; fetchAccessToken?: unknown }
}>) {
  const view = getViewFromUrl()
  const role = getRoleForView(view)

  const value = useMemo<MockConvexContextValue>(() => {
    return {
      view,
      role,
      getQuery: (name, args) => resolveQuery(view, role, name, args ?? {}),
      runMutation: (name, args) => runMutation(view, role, name, args ?? {}),
    }
  }, [view, role])

  return (
    <MockConvexContext.Provider value={value}>
      {children}
    </MockConvexContext.Provider>
  )
}

export function ConvexReactClient(_url: string) {
  return { url: 'mock-convex-url' }
}

export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: true }
}

export function useConvex() {
  return useMockConvexContext()
}

export function useQuery(
  ref: unknown,
  args?: Record<string, unknown> | 'skip',
): unknown {
  const ctx = useMockConvexContext()
  if (args === 'skip' || ref === undefined || ref === null) return undefined
  const name = getFunctionReferenceName(ref as Parameters<typeof getFunctionReferenceName>[0])
  if (!name) return undefined
  return ctx.getQuery(name, args ?? {})
}

export function useMutation(ref: unknown) {
  const ctx = useMockConvexContext()
  const name = getFunctionReferenceName(ref as Parameters<typeof getFunctionReferenceName>[0])
  return useCallback(
    (args?: Record<string, unknown>) => {
      if (!name) return Promise.resolve(undefined)
      return ctx.runMutation(name, args ?? {})
    },
    [ctx, name],
  )
}

export function useAction(_ref: unknown) {
  return useCallback(() => Promise.resolve(undefined), [])
}

export function usePaginatedQuery(
  _ref: unknown,
  _args?: Record<string, unknown> | 'skip',
  _opts?: unknown,
) {
  return { results: [], status: 'success', loadMore: () => {}, isLoading: false }
}

// Eligible-coworker helper used by the caregiver coverage view.
export function useEligibleCoworkers() {
  return eligibleCoworkers
}

// Extra helpers that the screenshot harness can use to resolve mocked entities.
export function useMockClients() {
  return clients
}

export function useMockCaregivers() {
  return caregivers
}

export function useMockCurrentMember(role: 'org:coordinator' | 'org:caregiver') {
  return getCurrentMember(role)
}
