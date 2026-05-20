import { Navigate, Route, Routes } from 'react-router-dom'
import { CreateOrganization, SignIn, SignUp } from '@clerk/react'
import { Suspense, lazy, type ReactNode } from 'react'
import { AppShell } from './shell/AppShell'
import { PlatformShell } from './shell/PlatformShell'
import { SelectAgencyPage } from './auth/SelectAgencyPage'
import { TenantRoleRouteGuard } from './shell/RouteGuard'

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const CaregiverTodayPage = lazy(() =>
  import('@/features/caregiver/pages/CaregiverTodayPage').then((module) => ({
    default: module.CaregiverTodayPage,
  })),
)
const CoordinatorReviewPage = lazy(() =>
  import('@/features/coordinator/pages/CoordinatorReviewPage').then(
    (module) => ({
      default: module.CoordinatorReviewPage,
    }),
  ),
)
const BillingPage = lazy(() =>
  import('@/features/billing/pages/BillingPage').then((module) => ({
    default: module.BillingPage,
  })),
)
const ClientsPage = lazy(() =>
  import('@/features/clients/pages/ClientsPage').then((module) => ({
    default: module.ClientsPage,
  })),
)
const TeamPage = lazy(() =>
  import('@/features/team/pages/TeamPage').then((module) => ({
    default: module.TeamPage,
  })),
)
const PlatformAdminPage = lazy(() =>
  import('@/features/platform/pages/PlatformAdminPage').then((module) => ({
    default: module.PlatformAdminPage,
  })),
)
const SearchPage = lazy(() =>
  import('@/features/search/pages/SearchPage').then((module) => ({
    default: module.SearchPage,
  })),
)

function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="text-sm text-atria-muted">Loading…</div>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/sign-in/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/select-agency"
            />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/select-agency"
            />
          </div>
        }
      />
      <Route
        path="/create-agency"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <CreateOrganization
              routing="path"
              path="/create-agency"
              afterCreateOrganizationUrl="/select-agency"
            />
          </div>
        }
      />
      <Route path="/select-agency" element={<SelectAgencyPage />} />
      <Route element={<PlatformShell />}>
        <Route
          path="platform"
          element={
            <RouteSuspense>
              <PlatformAdminPage />
            </RouteSuspense>
          }
        />
      </Route>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <DashboardPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="caregiver/today"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
              <RouteSuspense>
                <CaregiverTodayPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="coordinator/review"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <CoordinatorReviewPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="coordinator/billing"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <BillingPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="clients"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <ClientsPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="team"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin']}>
              <RouteSuspense>
                <TeamPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="search"
          element={
            <RouteSuspense>
              <SearchPage />
            </RouteSuspense>
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  )
}
