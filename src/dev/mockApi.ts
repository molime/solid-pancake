/* eslint-disable @typescript-eslint/no-unused-vars */
import { getFunctionName } from 'convex/server'
import type { FunctionReference } from 'convex/server'
import {
  calendarWeekShifts,
  caregiverScheduleShifts,
  clients,
  caregivers,
  coverageRequest,
  coverageRequestFriday,
  availabilityWindows,
  shiftTasks,
  auditEvents,
  getCurrentMember,
} from './mockData'

export type ScreenshotView =
  | 'scheduling'
  | 'shift-editor'
  | 'shift-packet'
  | 'coverage'
  | 'caregiver-schedule'
  | 'availability'

export function resolveQuery(
  view: ScreenshotView,
  role: 'org:coordinator' | 'org:caregiver',
  name: string,
  _args: Record<string, unknown>,
): unknown {
  switch (name) {
    case 'scheduling:listShifts': {
      const all =
        view === 'scheduling'
          ? calendarWeekShifts
          : [...calendarWeekShifts, ...caregiverScheduleShifts]
      const caregiverId = _args.caregiverId as string | undefined
      const startDate = _args.startDate as string | undefined
      const endDate = _args.endDate as string | undefined
      const items = all.filter((shift) => {
        if (caregiverId && shift.caregiverId !== caregiverId) return false
        if (startDate && shift.scheduledStart.slice(0, 10) < startDate)
          return false
        if (endDate && shift.scheduledEnd.slice(0, 10) > endDate) return false
        return true
      })
      return { items, hasMore: false, nextCursor: null }
    }

    case 'scheduling:listCaregiverShifts':
      return caregiverScheduleShifts

    case 'scheduling:listCoverageRequests':
      if (view === 'coverage') return [coverageRequest]
      if (view === 'scheduling') return [coverageRequestFriday]
      return []

    case 'scheduling:listMyAvailability':
      return availabilityWindows

    case 'scheduling:listAvailabilityForScheduling':
      return availabilityWindows

    case 'members:listCaregivers':
      return caregivers

    case 'members:me':
      return getCurrentMember(role)

    case 'clients:list':
      return clients

    case 'shiftQueries:getWithDetails':
      return {
        shift: caregiverScheduleShifts[0],
        client: clients[0],
        note: null,
        tasks: shiftTasks,
        reviews: [],
        verification: { locationMatched: true, submittedOnSite: true },
      }

    case 'audit:list':
      return auditEvents

    case 'platform:isAdmin':
      return false

    case 'members:checkMembership':
      return true

    default:
      return undefined
  }
}

export function runMutation(
  _view: ScreenshotView,
  _role: 'org:coordinator' | 'org:caregiver',
  name: string,
  _args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'scheduling:createShift':
      return Promise.resolve({ shiftId: 'shift_new_mock' })
    case 'scheduling:updateShift':
      return Promise.resolve({ shiftId: 'shift_updated_mock' })
    case 'scheduling:deleteShift':
      return Promise.resolve({ shiftId: 'shift_deleted_mock' })
    case 'scheduling:requestCoverage':
      return Promise.resolve({ coverageRequestId: 'coverage_new_mock' })
    case 'scheduling:resolveCoverage':
      return Promise.resolve({ shiftId: 'shift_resolved_mock', coverageRequestId: 'coverage_resolved_mock' })
    case 'scheduling:addAvailabilityWindow':
      return Promise.resolve({ windowId: 'window_new_mock' })
    case 'scheduling:deleteAvailabilityWindow':
      return Promise.resolve({ windowId: 'window_deleted_mock' })
    default:
      return Promise.resolve(undefined)
  }
}

export function getFunctionReferenceName(
  ref: FunctionReference<'query' | 'mutation', 'public'> | string,
): string | null {
  if (ref === 'skip' || ref === undefined || ref === null) return null
  if (typeof ref === 'string') return ref
  try {
    return getFunctionName(ref)
  } catch {
    return null
  }
}
