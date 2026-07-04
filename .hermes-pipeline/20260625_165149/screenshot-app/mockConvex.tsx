export * from 'convex/react'

import { getFunctionName } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'

const tenantId = 'tenant_screenshot' as Id<'tenants'>
const clientId = 'client_screenshot' as Id<'clients'>
const shiftId = 'shift_screenshot' as Id<'shifts'>
const noteId = 'note_screenshot' as Id<'progressNotes'>

const scheduledStart = '2026-06-04T15:00:00Z'
const scheduledEnd = '2026-06-04T19:00:00Z'
const submittedAt = '2026-06-25T19:04:00Z'

const baseShift = {
  _id: shiftId,
  tenantId,
  clientId,
  caregiverId: 'user_ana',
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

const coordinatorMember = { role: 'org:coordinator', displayName: 'Carla Núñez' }

const caregivers = [
  { clerkUserId: 'user_ana', displayName: 'Ana Silva' },
  { clerkUserId: 'user_marcus', displayName: 'Marcus Green' },
  { clerkUserId: 'user_julia', displayName: 'Julia Costa' },
  { clerkUserId: 'user_aisha', displayName: 'Aisha Mohammed' },
  { clerkUserId: 'user_rosa', displayName: 'Rosa Díaz' },
]

const clients = [
  { _id: 'client_maria' as Id<'clients'>, tenantId, displayName: 'Maria Lopez' },
  { _id: 'client_robert' as Id<'clients'>, tenantId, displayName: 'Robert Hill' },
  { _id: 'client_eleanor' as Id<'clients'>, tenantId, displayName: 'Eleanor Park' },
  { _id: 'client_frank' as Id<'clients'>, tenantId, displayName: 'Frank Diaz' },
  { _id: 'client_helen' as Id<'clients'>, tenantId, displayName: 'Helen Webb' },
]

function makeShift(
  id: string,
  caregiverId: string,
  clientIdValue: Id<'clients'>,
  startIso: string,
  endIso: string,
  status: string,
) {
  return {
    ...baseShift,
    _id: id as Id<'shifts'>,
    caregiverId,
    clientId: clientIdValue,
    scheduledStart: startIso,
    scheduledEnd: endIso,
    status,
  }
}

const reviewShifts = [
  makeShift('shift_1', 'user_ana', 'client_maria', '2026-06-04T15:00:00Z', '2026-06-04T19:00:00Z', 'submitted'),
  makeShift('shift_2', 'user_marcus', 'client_robert', '2026-06-04T14:00:00Z', '2026-06-04T18:30:00Z', 'submitted'),
  makeShift('shift_3', 'user_julia', 'client_eleanor', '2026-06-04T13:30:00Z', '2026-06-04T17:30:00Z', 'needs_correction'),
  makeShift('shift_4', 'user_aisha', 'client_frank', '2026-06-04T13:00:00Z', '2026-06-04T17:00:00Z', 'submitted'),
  makeShift('shift_5', 'user_rosa', 'client_helen', '2026-06-04T14:30:00Z', '2026-06-04T16:30:00Z', 'submitted'),
]

const approvedShifts = [
  makeShift('shift_6', 'user_ana', 'client_maria', '2026-06-04T15:00:00Z', '2026-06-04T19:00:00Z', 'billing_ready'),
]

const detailNote = {
  _id: noteId,
  tenantId,
  shiftId,
  startTime: '09:00',
  endTime: '13:00',
  servicesProvided: 'Bathing, Meals, Walking, Walk a little each day goal, Eat full meals goal',
  clientResponse: 'No problems — all good today',
  narrative: 'I helped Maria with her morning bath and got her dressed. She ate all of her breakfast and was in good spirits. We did her walking exercises in the hallway for about 15 minutes.',
  submittedAt,
}

const detailTasks = [
  {
    _id: 'task_screenshot' as Id<'shiftTasks'>,
    tenantId,
    shiftId,
    title: 'Observation note',
    requiredProof: true,
    status: 'complete',
    proofName: 'photo.jpg',
    proofUrl: 'storage_proof' as Id<'_storage'>,
  },
]

const verification = {
  locationMatched: true,
  submittedOnSite: true,
}

const states: Record<string, unknown> = {
  dashboard: {
    member: coordinatorMember,
    caregivers: Array.from({ length: 48 }, (_, i) => ({
      clerkUserId: `user_${i}`,
      displayName: i === 0 ? 'Ana Silva' : `Caregiver ${i}`,
    })),
    stats: {
      inProgress: 3,
      submitted: 7,
      needsCorrection: 5,
      billingReady: 24,
    },
  },
  queue: {
    member: coordinatorMember,
    reviewShifts,
    approvedShifts,
    clients,
    caregivers,
  },
  detail: {
    member: coordinatorMember,
    details: {
      shift: { ...baseShift, status: 'submitted' },
      client: baseClient,
      note: detailNote,
      tasks: detailTasks,
      reviews: [],
      verification,
    },
  },
}

function getState() {
  if (typeof window === 'undefined') return 'dashboard'
  return new URLSearchParams(window.location.search).get('state') ?? 'dashboard'
}

function getQueryName(queryRef: unknown) {
  try {
    return getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
  } catch {
    return ''
  }
}

export function useQuery(queryRef: unknown, args?: unknown) {
  const name = getQueryName(queryRef)
  const state = getState()
  const data = states[state] ?? states.dashboard

  if (args === 'skip') return undefined

  if (name === 'members:me') {
    return (data as { member?: unknown }).member ?? coordinatorMember
  }
  if (name === 'members:checkMembership') return true
  if (name === 'platform:isAdmin') return false
  if (name === 'members:listCaregivers') {
    if (state === 'dashboard') return (data as typeof states.dashboard).caregivers
    return caregivers
  }
  if (name === 'shiftQueries:dashboardStats') return (data as typeof states.dashboard).stats
  if (name === 'shiftQueries:listForReview') return (data as typeof states.queue).reviewShifts
  if (name === 'shiftQueries:listBillingReady') return (data as typeof states.queue).approvedShifts
  if (name === 'clients:list') return (data as typeof states.queue).clients
  if (name === 'shiftQueries:getWithDetails') return (data as typeof states.detail).details
  if (name === 'files:getDownloadUrl') return 'https://example.com/photo.jpg'

  return undefined
}

export function useMutation() {
  return () => Promise.resolve()
}
