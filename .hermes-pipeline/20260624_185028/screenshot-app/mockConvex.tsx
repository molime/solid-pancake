export * from 'convex/react'

import { getFunctionName } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'

const shiftId = 'shift_screenshot' as Id<'shifts'>
const tenantId = 'tenant_screenshot' as Id<'tenants'>
const clientId = 'client_screenshot' as Id<'clients'>

// Figma reference times render as 9:00 AM – 1:00 PM in the local timezone (UTC-6).
const scheduledStart = '2026-06-25T15:00:00Z'
const scheduledEnd = '2026-06-25T19:00:00Z'
const clockInAt = '2026-06-25T15:02:00Z'
const clockOutAt = '2026-06-25T19:04:00Z'

const baseShift = {
  _id: shiftId,
  tenantId,
  clientId,
  caregiverId: 'user_screenshot',
  scheduledStart,
  scheduledEnd,
  serviceType: 'SLS',
  rate: 25,
}

const baseClient = {
  _id: clientId,
  tenantId,
  name: 'Maria Lopez',
  displayName: 'Maria Lopez',
  serviceType: 'SLS',
  serviceAddress: {
    line1: '1820 Oak Street',
    line2: 'Apt 4',
    city: 'Anytown',
    state: 'CA',
    postalCode: '90210',
  },
}

const baseNote = {
  _id: 'note_screenshot' as Id<'progressNotes'>,
  tenantId,
  shiftId,
  startTime: '',
  endTime: '',
  servicesProvided: '',
  clientResponse: '',
  narrative: '',
}

const baseTask = {
  _id: 'task_screenshot',
  tenantId,
  shiftId,
  title: 'Observation note',
  requiredProof: true,
  status: 'pending' as const,
}

const completeNarrative = 'I helped Maria with her morning bath and got her dressed. She ate all of her breakfast and was in good spirits. We did her walking exercises in the hallway for about 15 minutes.'

const states: Record<string, { details: unknown; settings: unknown }> = {
  today: {
    details: {
      shift: { ...baseShift, status: 'scheduled', clockInAt: null, clockOutAt: null },
      client: baseClient,
      note: baseNote,
      tasks: [baseTask],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  clockIn: {
    details: {
      shift: { ...baseShift, status: 'scheduled', clockInAt: null, clockOutAt: null },
      client: baseClient,
      note: baseNote,
      tasks: [baseTask],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  clockInGeofence: {
    details: {
      shift: { ...baseShift, status: 'scheduled', clockInAt: null, clockOutAt: null },
      client: baseClient,
      note: baseNote,
      tasks: [baseTask],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: true, enforceClockIn: true, enforceClockOut: true, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  step1: {
    details: {
      shift: { ...baseShift, status: 'in_progress', clockInAt, clockOutAt: null },
      client: baseClient,
      note: { ...baseNote, startTime: '09:00', endTime: '13:00' },
      tasks: [baseTask],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  step2: {
    details: {
      shift: { ...baseShift, status: 'in_progress', clockInAt, clockOutAt: null },
      client: baseClient,
      note: { ...baseNote, startTime: '09:00', endTime: '13:00' },
      tasks: [baseTask],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  step3: {
    details: {
      shift: { ...baseShift, status: 'in_progress', clockInAt, clockOutAt: null },
      client: baseClient,
      note: { ...baseNote, startTime: '09:00', endTime: '13:00', narrative: completeNarrative },
      tasks: [baseTask],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  step4: {
    details: {
      shift: { ...baseShift, status: 'in_progress', clockInAt, clockOutAt: null },
      client: baseClient,
      note: { ...baseNote, startTime: '09:00', endTime: '13:00', narrative: completeNarrative, servicesProvided: 'Bathing, Meals, Walk a little each day goal, Eat full meals goal' },
      tasks: [baseTask],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  step5: {
    details: {
      shift: { ...baseShift, status: 'in_progress', clockInAt, clockOutAt: null },
      client: baseClient,
      note: {
        ...baseNote,
        startTime: '09:00',
        endTime: '13:00',
        narrative: completeNarrative,
        servicesProvided: 'Bathing, Meals, Walking, Medication, Housekeeping, Company, Walk a little each day goal, Eat full meals goal',
        clientResponse: 'No problems — all good today',
      },
      tasks: [{ ...baseTask, status: 'complete' as const, proofName: 'photo.jpg' }],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  step6: {
    details: {
      shift: { ...baseShift, status: 'in_progress', clockInAt, clockOutAt: null },
      client: baseClient,
      note: {
        ...baseNote,
        startTime: '09:00',
        endTime: '13:00',
        narrative: completeNarrative,
        servicesProvided: 'Bathing, Meals, Walking, Medication, Housekeeping, Company, Walk a little each day goal, Eat full meals goal',
        clientResponse: 'No problems — all good today',
      },
      tasks: [{ ...baseTask, status: 'complete' as const, proofName: 'photo.jpg' }],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  clockOut: {
    details: {
      shift: { ...baseShift, status: 'in_progress', clockInAt, clockOutAt: null },
      client: baseClient,
      note: {
        ...baseNote,
        startTime: '09:00',
        endTime: '13:00',
        narrative: completeNarrative,
        servicesProvided: 'Bathing, Meals, Walking, Medication, Housekeeping, Company, Walk a little each day goal, Eat full meals goal',
        clientResponse: 'No problems — all good today',
      },
      tasks: [{ ...baseTask, status: 'complete' as const, proofName: 'photo.jpg' }],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
  success: {
    details: {
      shift: { ...baseShift, status: 'submitted', clockInAt, clockOutAt },
      client: baseClient,
      note: {
        ...baseNote,
        startTime: '09:00',
        endTime: '13:00',
        narrative: completeNarrative,
        servicesProvided: 'Bathing, Meals, Walking, Medication, Housekeeping, Company, Walk a little each day goal, Eat full meals goal',
        clientResponse: 'No problems — all good today',
      },
      tasks: [{ ...baseTask, status: 'complete' as const, proofName: 'photo.jpg' }],
      reviews: [],
    },
    settings: { tenantId, shiftGeofence: { enabled: false, enforceClockIn: false, enforceClockOut: false, defaultRadiusMeters: 100, maxAccuracyMeters: 50 } },
  },
}

function getState() {
  if (typeof window === 'undefined') return 'today'
  return new URLSearchParams(window.location.search).get('state') ?? 'today'
}

export function useQuery(queryRef: unknown, args?: unknown) {
  const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
  const state = getState()
  const data = states[state] ?? states.today
  if (args === 'skip') return undefined
  if (name === 'shiftQueries:getWithDetails') return data.details
  if (name === 'tenantSettings:get') return data.settings
  if (name === 'shiftQueries:listMyShifts') {
    return [{ shift: data.details.shift, client: data.details.client }]
  }
  return undefined
}

export function useMutation() {
  return () => Promise.resolve()
}
