import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useSearchParams,
} from 'react-router-dom'
import './visual.css'
import { AppShell } from '@/app/shell/AppShell'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { CoordinatorReviewPage } from '@/features/coordinator/pages/CoordinatorReviewPage'
import { ReviewDetail } from '@/features/coordinator/components/ReviewDetail'
import type { Id } from '../../../convex/_generated/dataModel'

function DetailRoute() {
  const [params] = useSearchParams()
  const shiftId = params.get('shift') ?? 'shift_screenshot'
  return (
    <div className="min-h-screen bg-atria-bg p-6">
      <ReviewDetail
        clerkOrgId="org_screenshot"
        caregiverName="Ana Silva"
        clientName="Maria Lopez"
        onBack={() => {}}
        shiftId={shiftId as Id<'shifts'>}
      />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/coordinator/review/detail"
          element={<DetailRoute />}
        />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="coordinator/review" element={<CoordinatorReviewPage />} />
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
