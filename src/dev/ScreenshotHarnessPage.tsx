import { type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SchedulingPage } from '@/features/scheduling/pages/SchedulingPage'
import { CaregiverSchedulePage } from '@/features/scheduling/pages/CaregiverSchedulePage'
import { AvailabilityPage } from '@/features/scheduling/pages/AvailabilityPage'
import { ShiftEditorModal } from '@/features/scheduling/components/ShiftEditorModal'
import { ShiftPacketPanel } from '@/features/scheduling/components/ShiftPacketPanel'
import { CoverageRequestsPanel } from '@/features/scheduling/components/CoverageRequestsPanel'
import { clerkOrgId, featuredShift } from './mockData'

const VIEW_OPTIONS = [
  'scheduling',
  'shift-editor',
  'shift-packet',
  'coverage',
  'caregiver-schedule',
  'availability',
] as const

type HarnessView = (typeof VIEW_OPTIONS)[number]

function isHarnessView(value: string | null): value is HarnessView {
  return VIEW_OPTIONS.includes(value as HarnessView)
}

// Date freezing lives in src/main.tsx so it happens before any component
// renders and overrides the Date constructor (not just Date.now).

function SchedulingEditorView() {
  return (
    <>
      <SchedulingPage />
      <ShiftEditorModal
        open
        onClose={() => {}}
        clerkOrgId={clerkOrgId}
        onSuccess={() => {}}
      />
    </>
  )
}

function SchedulingPacketView() {
  return (
    <>
      <SchedulingPage />
      <ShiftPacketPanel
        shift={featuredShift}
        clerkOrgId={clerkOrgId}
        onClose={() => {}}
        onEdit={() => {}}
        onSuccess={() => {}}
      />
    </>
  )
}

function CoverageRequestView() {
  return (
    <div className="mx-auto max-w-3xl">
      <CoverageRequestsPanel clerkOrgId={clerkOrgId} />
    </div>
  )
}

function viewToComponent(view: HarnessView): ReactNode {
  switch (view) {
    case 'scheduling':
      return <SchedulingPage />
    case 'shift-editor':
      return <SchedulingEditorView />
    case 'shift-packet':
      return <SchedulingPacketView />
    case 'coverage':
      return <CoverageRequestView />
    case 'caregiver-schedule':
      return <CaregiverSchedulePage />
    case 'availability':
      return <AvailabilityPage />
  }
}

export function ScreenshotHarnessPage() {
  const [searchParams] = useSearchParams()
  const rawView = searchParams.get('view')
  const view: HarnessView = isHarnessView(rawView) ? rawView : 'scheduling'

  return <div className="harness-root">{viewToComponent(view)}</div>
}
