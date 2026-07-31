import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/react'
import { Suspense, lazy, type ReactNode } from 'react'
import { AppShell } from './shell/AppShell'
import { PlatformShell } from './shell/PlatformShell'
import { SelectAgencyPage } from './auth/SelectAgencyPage'
import { SignedInRouteGuard, TenantRoleRouteGuard, TrainingRouteGuard } from './shell/RouteGuard'
import { AppLoader } from '@/shared/ui/AppLoader'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { cn } from '@/shared/lib/cn'

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
const GeofenceSettingsPage = lazy(() =>
  import('@/features/settings/pages/GeofenceSettingsPage').then((module) => ({
    default: module.GeofenceSettingsPage,
  })),
)
const AllowedDomainsSettingsPage = lazy(() =>
  import('@/features/settings/pages/AllowedDomainsSettingsPage').then(
    (module) => ({
      default: module.AllowedDomainsSettingsPage,
    }),
  ),
)
const SchedulingPage = lazy(() =>
  import('@/features/scheduling/pages/SchedulingPage').then((module) => ({
    default: module.SchedulingPage,
  })),
)
const CaregiverSchedulePage = lazy(() =>
  import('@/features/scheduling/pages/CaregiverSchedulePage').then((module) => ({
    default: module.CaregiverSchedulePage,
  })),
)
const AvailabilityPage = lazy(() =>
  import('@/features/scheduling/pages/AvailabilityPage').then((module) => ({
    default: module.AvailabilityPage,
  })),
)

const HRDashboardPage = lazy(() =>
  import('@/features/hr/pages/HRDashboardPage').then((module) => ({
    default: module.HRDashboardPage,
  })),
)
const CandidatePipelinePage = lazy(() =>
  import('@/features/hr/pages/CandidatePipelinePage').then((module) => ({
    default: module.CandidatePipelinePage,
  })),
)
const ApplicationReviewPage = lazy(() =>
  import('@/features/hr/pages/ApplicationReviewPage').then((module) => ({
    default: module.ApplicationReviewPage,
  })),
)
const HireConvertPage = lazy(() =>
  import('@/features/hr/pages/HireConvertPage').then((module) => ({
    default: module.HireConvertPage,
  })),
)
const EmployeesPage = lazy(() =>
  import('@/features/hr/pages/EmployeesPage').then((module) => ({
    default: module.EmployeesPage,
  })),
)
const EmployeeProfilePage = lazy(() =>
  import('@/features/hr/pages/EmployeeProfilePage').then((module) => ({
    default: module.EmployeeProfilePage,
  })),
)
const HRCasesPage = lazy(() =>
  import('@/features/hr/pages/HRCasesPage').then((module) => ({
    default: module.HRCasesPage,
  })),
)

const CandidateOnboardingPage = lazy(() =>
  import('@/features/onboarding/pages/CandidateOnboardingPage').then((module) => ({
    default: module.CandidateOnboardingPage,
  })),
)
const ApplicationFormPage = lazy(() =>
  import('@/features/onboarding/pages/ApplicationFormPage').then((module) => ({
    default: module.ApplicationFormPage,
  })),
)
const ApplicationStatusPage = lazy(() =>
  import('@/features/onboarding/pages/ApplicationStatusPage').then((module) => ({
    default: module.ApplicationStatusPage,
  })),
)
const DocumentUploadPage = lazy(() =>
  import('@/features/onboarding/pages/DocumentUploadPage').then((module) => ({
    default: module.DocumentUploadPage,
  })),
)
const AcknowledgmentPage = lazy(() =>
  import('@/features/onboarding/pages/AcknowledgmentPage').then((module) => ({
    default: module.AcknowledgmentPage,
  })),
)
const EmploymentAgreementPage = lazy(() =>
  import('@/features/onboarding/pages/EmploymentAgreementPage').then((module) => ({
    default: module.EmploymentAgreementPage,
  })),
)
const OfferAcceptancePage = lazy(() =>
  import('@/features/onboarding/pages/OfferAcceptancePage').then((module) => ({
    default: module.OfferAcceptancePage,
  })),
)
const CandidateProfilePage = lazy(() =>
  import('@/features/onboarding/pages/CandidateProfilePage').then((module) => ({
    default: module.CandidateProfilePage,
  })),
)
const CandidateOnboardingIndex = lazy(() =>
  import('@/features/onboarding/pages/CandidateOnboardingIndex').then((module) => ({
    default: module.CandidateOnboardingIndex,
  })),
)
const TrainingPage = lazy(() =>
  import('@/features/onboarding/pages/TrainingPage').then((module) => ({
    default: module.TrainingPage,
  })),
)
const OnboardingSuccessPage = lazy(() =>
  import('@/features/onboarding/pages/OnboardingSuccessPage').then((module) => ({
    default: module.OnboardingSuccessPage,
  })),
)
const ApplyEntryPage = lazy(() =>
  import('@/features/onboarding/pages/ApplyEntryPage').then((module) => ({
    default: module.ApplyEntryPage,
  })),
)

let ScreenshotHarnessPage: React.LazyExoticComponent<
  () => React.JSX.Element
> | null = null
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'
) {
  ScreenshotHarnessPage = lazy(() =>
    import('@/dev/ScreenshotHarnessPage').then((module) => ({
      default: module.ScreenshotHarnessPage,
    })),
  )
}

function useRedirectParam() {
  const params = new URLSearchParams(window.location.search)
  const redirect = params.get('redirect')
  return redirect ?? '/select-agency'
}

// Derives a product label from the redirect target so the shared login page
// tells the user which ATRIA portal they are signing into.
function deriveProductLabel(redirectUrl: string): string | null {
  if (redirectUrl.includes('/onboarding') || redirectUrl.includes('/caregiver')) {
    return 'Candidate Portal'
  }
  if (redirectUrl.includes('/hr')) return 'HR Portal'
  if (redirectUrl.includes('/coordinator')) return 'Staff Portal'
  return null
}

// Product tabs let users pick which ATRIA portal they are signing into.
// Selecting a tab only changes the redirect target — the sign-in form is
// the same Clerk component underneath.
const PRODUCT_TABS = [
  { label: 'Candidate Portal', redirect: '/onboarding' },
  { label: 'HR Portal', redirect: '/hr' },
  { label: 'Staff Portal', redirect: '/coordinator/review' },
]

function SignInRedirect() {
  const [searchParams, setSearchParams] = useSearchParams()
  const redirectUrl = searchParams.get('redirect') ?? '/select-agency'
  const productLabel = deriveProductLabel(redirectUrl)
  const activeIndex = PRODUCT_TABS.findIndex((t) => t.redirect === redirectUrl)

  const handleTabChange = (redirect: string) => {
    setSearchParams({ redirect }, { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-atria-bg p-4">
      <div className="flex flex-col items-center gap-2">
        <AtriaLogo />
        {productLabel && (
          <p className="text-sm font-medium text-atria-text-secondary">
            {productLabel}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {PRODUCT_TABS.map((tab, i) => (
          <button
            key={tab.redirect}
            onClick={() => handleTabChange(tab.redirect)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              activeIndex === i
                ? 'bg-atria-accent text-atria-on-accent'
                : 'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-surface-2',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
      />
    </div>
  )
}

function SignUpRedirect() {
  const redirectUrl = useRedirectParam()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-atria-bg p-4">
      <AtriaLogo />
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
      />
    </div>
  )
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppLoader label="Preparing workspace" />}>
      {children}
    </Suspense>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/sign-in/*"
        element={<SignInRedirect />}
      />
      <Route
        path="/sign-up/*"
        element={<SignUpRedirect />}
      />
      <Route
        path="/accept-invitation/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <SignUp
              routing="path"
              path="/accept-invitation"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/select-agency"
              forceRedirectUrl="/select-agency"
            />
          </div>
        }
      />

      <Route
        path="/select-agency"
        element={
          <SignedInRouteGuard>
            <SelectAgencyPage />
          </SignedInRouteGuard>
        }
      />
      <Route
        path="apply"
        element={
          <RouteSuspense>
            <ApplyEntryPage />
          </RouteSuspense>
        }
      />
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
              <TrainingRouteGuard>
                <RouteSuspense>
                  <CaregiverTodayPage />
                </RouteSuspense>
              </TrainingRouteGuard>
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
          path="hr"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:hr']}>
              <RouteSuspense>
                <HRDashboardPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="hr/candidates"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:hr']}>
              <RouteSuspense>
                <CandidatePipelinePage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="hr/candidates/:candidateId"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:hr']}>
              <RouteSuspense>
                <ApplicationReviewPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="hr/candidates/:candidateId/hire"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:hr']}>
              <RouteSuspense>
                <HireConvertPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="hr/employees"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:hr']}>
              <RouteSuspense>
                <EmployeesPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="hr/employees/:memberId"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:hr']}>
              <RouteSuspense>
                <EmployeeProfilePage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="hr/cases"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:hr']}>
              <RouteSuspense>
                <HRCasesPage />
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
        <Route
          path="settings/geofence"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <GeofenceSettingsPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="settings/allowed-domains"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin']}>
              <RouteSuspense>
                <AllowedDomainsSettingsPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="scheduling"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <SchedulingPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="caregiver/schedule"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
              <TrainingRouteGuard>
                <RouteSuspense>
                  <CaregiverSchedulePage />
                </RouteSuspense>
              </TrainingRouteGuard>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="caregiver/availability"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
              <RouteSuspense>
                <AvailabilityPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/training"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate', 'org:caregiver']}>
              <RouteSuspense>
                <TrainingPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate', 'org:caregiver']}>
              <RouteSuspense>
                <CandidateOnboardingIndex />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/checklist"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate', 'org:caregiver']}>
              <RouteSuspense>
                <CandidateOnboardingPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/application"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate']}>
              <RouteSuspense>
                <ApplicationFormPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/status"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate']}>
              <RouteSuspense>
                <ApplicationStatusPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/upload/:taskId"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate']}>
              <RouteSuspense>
                <DocumentUploadPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/acknowledgment"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate']}>
              <RouteSuspense>
                <AcknowledgmentPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/employment-agreement"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate']}>
              <RouteSuspense>
                <EmploymentAgreementPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/offer"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate']}>
              <RouteSuspense>
                <OfferAcceptancePage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/profile"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate']}>
              <RouteSuspense>
                <CandidateProfilePage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="onboarding/success"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:candidate', 'org:caregiver']}>
              <RouteSuspense>
                <OnboardingSuccessPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />

        {ScreenshotHarnessPage && (
          <Route
            path="dev/screenshots"
            element={
              <RouteSuspense>
                <ScreenshotHarnessPage />
              </RouteSuspense>
            }
          />
        )}
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  )
}
