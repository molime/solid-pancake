import type { Id } from '../../convex/_generated/dataModel'
import type { EnrichedShift } from '../features/scheduling/model/schedulingUtils'

export const clerkOrgId = 'org_screenshot_mock'
export const tenantId = 'tenant_screenshot_mock' as Id<'tenants'>

export const currentCaregiverUserId = 'user_screenshot_caregiver'
export const coordinatorUserId = 'user_screenshot_coordinator'

const clientIds = {
  rosa: 'client_rosa_diaz' as Id<'clients'>,
  elena: 'client_elena_sanchez' as Id<'clients'>,
  marco: 'client_marco_torres' as Id<'clients'>,
  daniel: 'client_daniel_rios' as Id<'clients'>,
  samuel: 'client_samuel_kim' as Id<'clients'>,
}

const caregiverIds = {
  lucia: 'user_cg_lucia_fernandez',
  rosa: 'user_cg_rosa_diaz',
  ana: 'user_cg_ana_vega',
  miguel: 'user_cg_miguel_soto',
  carlos: 'user_cg_carlos_mora',
  pedro: 'user_cg_pedro_ramirez',
  sofia: 'user_cg_sofia_castro',
}

export const clients = [
  {
    _id: clientIds.rosa,
    _creationTime: Date.now(),
    tenantId,
    displayName: 'Rosa Díaz',
    serviceType: 'SLS' as const,
    authorizationHours: 40,
    riskFlags: [],
    serviceAddress: {
      line1: 'Av. Reforma 1234, Col. Juárez',
      line2: 'Apartment 4B, buzzer #4',
      city: 'Mexico City',
      state: 'CDMX',
      postalCode: '06600',
      country: 'Mexico',
    },
    phone: '+52 55 9876 5432',
  },
  {
    _id: clientIds.elena,
    _creationTime: Date.now(),
    tenantId,
    displayName: 'Elena Sánchez',
    serviceType: 'SLS' as const,
    authorizationHours: 40,
    riskFlags: [],
  },
  {
    _id: clientIds.marco,
    _creationTime: Date.now(),
    tenantId,
    displayName: 'Marco Torres',
    serviceType: 'ILS' as const,
    authorizationHours: 40,
    riskFlags: [],
  },
  {
    _id: clientIds.daniel,
    _creationTime: Date.now(),
    tenantId,
    displayName: 'Daniel Ríos',
    serviceType: 'SLS' as const,
    authorizationHours: 40,
    riskFlags: [],
  },
  {
    _id: clientIds.samuel,
    _creationTime: Date.now(),
    tenantId,
    displayName: 'Samuel Kim',
    serviceType: 'ILS' as const,
    authorizationHours: 40,
    riskFlags: [],
  },
]

export const caregivers = [
  {
    _id: 'member_lucia',
    clerkUserId: caregiverIds.lucia,
    role: 'org:caregiver' as const,
    displayName: 'Lucía Fernández',
    email: 'lucia@atriax.example',
    phone: '+52 55 1234 5678',
    rating: 4.9,
    visits: 214,
  },
  {
    _id: 'member_rosa',
    clerkUserId: caregiverIds.rosa,
    role: 'org:caregiver' as const,
    displayName: 'Rosa Díaz',
    email: 'rosa@atriax.example',
  },
  {
    _id: 'member_ana',
    clerkUserId: caregiverIds.ana,
    role: 'org:caregiver' as const,
    displayName: 'Ana Vega',
    email: 'ana@atriax.example',
  },
  {
    _id: 'member_miguel',
    clerkUserId: caregiverIds.miguel,
    role: 'org:caregiver' as const,
    displayName: 'Miguel Soto',
    email: 'miguel@atriax.example',
  },
  {
    _id: 'member_carlos',
    clerkUserId: caregiverIds.carlos,
    role: 'org:caregiver' as const,
    displayName: 'Carlos Mora',
    email: 'carlos@atriax.example',
  },
  {
    _id: 'member_pedro',
    clerkUserId: caregiverIds.pedro,
    role: 'org:caregiver' as const,
    displayName: 'Pedro Ramírez',
    email: 'pedro@atriax.example',
  },
  {
    _id: 'member_sofia',
    clerkUserId: caregiverIds.sofia,
    role: 'org:caregiver' as const,
    displayName: 'Sofía Castro',
    email: 'sofia@atriax.example',
  },
]

const coordinatorMember = {
  _id: 'member_coordinator',
  clerkUserId: coordinatorUserId,
  role: 'org:coordinator' as const,
  displayName: 'Ana Gómez',
  email: 'ana@atriax.example',
}

export function getCurrentMember(role: 'org:coordinator' | 'org:caregiver' | 'org:candidate') {
  if (role === 'org:candidate') return { ...caregivers[0], clerkUserId: 'user_screenshot_candidate', role: 'org:candidate' as const, displayName: 'Sofia Herrera', email: 'sofia.herrera@gmail.com' }
  return role === 'org:caregiver'
    ? { ...caregivers[0], clerkUserId: currentCaregiverUserId }
    : coordinatorMember
}

function shift(
  id: string,
  clientId: Id<'clients'>,
  caregiverId: string,
  startIso: string,
  endIso: string,
  serviceType: 'SLS' | 'ILS' = 'SLS',
  rate = 28.5,
): EnrichedShift {
  const client = clients.find((c) => c._id === clientId)!
  const caregiver = caregivers.find((c) => c.clerkUserId === caregiverId)!
  return {
    _id: id as Id<'shifts'>,
    _creationTime: Date.now(),
    tenantId,
    clientId,
    caregiverId,
    scheduledStart: startIso,
    scheduledEnd: endIso,
    status: 'scheduled',
    serviceType,
    rate,
    clientDisplayName: client.displayName,
    caregiverDisplayName: caregiver.displayName,
  }
}

// Week of Mon Jun 15 – Sun Jun 21, 2026. Thursday Jun 18 is "today".
export const calendarWeekShifts: EnrichedShift[] = [
  shift('shift_mon_1', clientIds.marco, caregiverIds.rosa, '2026-06-15T12:00:00.000Z', '2026-06-15T15:00:00.000Z'),
  shift('shift_mon_2', clientIds.daniel, caregiverIds.miguel, '2026-06-15T17:00:00.000Z', '2026-06-15T20:00:00.000Z'),
  shift('shift_tue_1', clientIds.elena, caregiverIds.ana, '2026-06-16T13:00:00.000Z', '2026-06-16T16:00:00.000Z'),
  shift('shift_wed_1', clientIds.samuel, caregiverIds.carlos, '2026-06-17T18:00:00.000Z', '2026-06-17T21:00:00.000Z'),
  shift('shift_thu_1', clientIds.marco, caregiverIds.rosa, '2026-06-18T12:00:00.000Z', '2026-06-18T15:00:00.000Z'),
  shift('shift_thu_2', clientIds.daniel, caregiverIds.miguel, '2026-06-18T17:00:00.000Z', '2026-06-18T20:00:00.000Z'),
  // Friday open shift has no assigned caregiver so the panel renders the open-shift card.
  shift('shift_fri_open', clientIds.rosa, caregiverIds.lucia, '2026-06-19T14:00:00.000Z', '2026-06-19T17:00:00.000Z'),
  shift('shift_sat_1', clientIds.elena, caregiverIds.ana, '2026-06-20T13:00:00.000Z', '2026-06-20T16:00:00.000Z'),
]

// Shift used by the editor, packet, and coverage views.
export const featuredShift: EnrichedShift = shift(
  'shift_featured',
  clientIds.rosa,
  caregiverIds.lucia,
  '2026-06-20T13:00:00.000Z',
  '2026-06-20T17:00:00.000Z',
  'SLS',
  28.5,
)

export const caregiverScheduleShifts: EnrichedShift[] = [
  featuredShift,
  shift(
    'shift_cg_2',
    clientIds.marco,
    caregiverIds.lucia,
    '2026-06-22T13:00:00.000Z',
    '2026-06-22T17:00:00.000Z',
  ),
]

export const coverageRequest = {
  _id: 'coverage_featured' as Id<'coverageRequests'>,
  shiftId: featuredShift._id,
  requesterId: caregiverIds.lucia,
  reason: 'Family emergency',
  status: 'open' as const,
  shift: {
    scheduledStart: featuredShift.scheduledStart,
    scheduledEnd: featuredShift.scheduledEnd,
  },
  clientName: featuredShift.clientDisplayName,
}

const fridayOpenShift = calendarWeekShifts.find((s) => s._id === ('shift_fri_open' as Id<'shifts'>))!

export const coverageRequestFriday = {
  _id: 'coverage_fri_open' as Id<'coverageRequests'>,
  shiftId: fridayOpenShift._id,
  requesterId: caregiverIds.lucia,
  reason: 'Needs cover',
  status: 'open' as const,
  shift: {
    scheduledStart: fridayOpenShift.scheduledStart,
    scheduledEnd: fridayOpenShift.scheduledEnd,
  },
  clientName: fridayOpenShift.clientDisplayName,
}

export const availabilityWindows = [
  { _id: 'win_mon', kind: 'recurring' as const, dayOfWeek: 1, startTime: '08:00', endTime: '16:00', available: true },
  { _id: 'win_tue', kind: 'recurring' as const, dayOfWeek: 2, startTime: '08:00', endTime: '16:00', available: true },
  { _id: 'win_wed', kind: 'recurring' as const, dayOfWeek: 3, startTime: '10:00', endTime: '15:00', available: true },
  { _id: 'win_thu', kind: 'recurring' as const, dayOfWeek: 4, startTime: '08:00', endTime: '16:00', available: true },
  { _id: 'win_fri', kind: 'recurring' as const, dayOfWeek: 5, startTime: '09:00', endTime: '14:00', available: true },
  { _id: 'win_sat', kind: 'recurring' as const, dayOfWeek: 6, startTime: '00:00', endTime: '23:59', available: false },
]

export const shiftTasks = [
  { _id: 'task_1', tenantId, shiftId: featuredShift._id, title: 'Help with morning bath and dressing', requiredProof: false, status: 'pending' as const },
  { _id: 'task_2', tenantId, shiftId: featuredShift._id, title: 'Prepare breakfast (low-sodium diet)', requiredProof: false, status: 'pending' as const },
  { _id: 'task_3', tenantId, shiftId: featuredShift._id, title: 'Medication reminder at 10:00 AM', requiredProof: false, status: 'pending' as const },
  { _id: 'task_4', tenantId, shiftId: featuredShift._id, title: 'Light housekeeping in kitchen and bedroom', requiredProof: false, status: 'pending' as const },
  { _id: 'task_5', tenantId, shiftId: featuredShift._id, title: '15-minute walk if weather allows', requiredProof: false, status: 'pending' as const },
]

export const eligibleCoworkers = [
  { clerkUserId: caregiverIds.pedro, displayName: 'Pedro Ramírez', availability: 'available Sat morning' },
  { clerkUserId: caregiverIds.sofia, displayName: 'Sofía Castro', availability: 'available Sat morning' },
  { clerkUserId: caregiverIds.miguel, displayName: 'Miguel Torres', availability: 'available all day' },
]

export const auditEvents = [
  {
    _id: 'audit_1' as Id<'auditEvents'>,
    tenantId,
    actorId: coordinatorUserId,
    actorRole: 'org:coordinator',
    action: 'created shift',
    kind: 'shift.created',
    shiftId: featuredShift._id,
    createdAt: '2026-06-15T10:00:00.000Z',
  },
]


// ═══════════════════════════════════════════════════════════════
// Candidate onboarding mocks
// ═══════════════════════════════════════════════════════════════

export const mockCandidate = {
  _id: 'candidate_mock' as Id<'candidates'>,
  _creationTime: Date.now(),
  tenantId,
  clerkUserId: 'user_screenshot_candidate',
  email: 'sofia.herrera@gmail.com',
  phone: '(555) 219-4083',
  displayName: 'Sofia Herrera',
  status: 'applied',
  source: 'self_service',
  requiresPasswordChange: false,
  createdAt: '2026-07-10T10:00:00.000Z',
}

export const mockCandidateTasks = [
  { _id: 'task_form', tenantId, candidateId: mockCandidate._id, type: 'form_submission', status: 'complete', order: 0, completedAt: '2026-07-10T10:30:00.000Z' },
  { _id: 'task_photo', tenantId, candidateId: mockCandidate._id, type: 'photo_id', status: 'pending', order: 1 },
  { _id: 'task_tax', tenantId, candidateId: mockCandidate._id, type: 'tax_id_ssn', status: 'pending', order: 2 },
  { _id: 'task_cpr', tenantId, candidateId: mockCandidate._id, type: 'cpr_certificate', status: 'pending', order: 3 },
  { _id: 'task_health', tenantId, candidateId: mockCandidate._id, type: 'health_screen', status: 'pending', order: 4 },
  { _id: 'task_bg', tenantId, candidateId: mockCandidate._id, type: 'background_check', status: 'pending', order: 5 },
  { _id: 'task_agreement', tenantId, candidateId: mockCandidate._id, type: 'employment_agreement', status: 'pending', order: 6 },
  { _id: 'task_certs', tenantId, candidateId: mockCandidate._id, type: 'additional_certifications', status: 'pending', order: 7 },
]

export const mockApplication = {
  candidate: mockCandidate,
  application: { _id: 'app_mock', status: 'submitted', submittedAt: '2026-07-10T10:30:00.000Z', fields: { fullName: 'Sofia Herrera', email: 'sofia.herrera@gmail.com', phone: '(555) 219-4083', position: 'Home Care Aide' } },
  tasks: mockCandidateTasks,
}

export const mockBranches = [
  { _id: 'branch_ils', tenantId, branchType: 'ILS', label: 'Independent Living Services', isPredefined: true, order: 0, active: true },
  { _id: 'branch_sls', tenantId, branchType: 'SLS', label: 'Supported Living Services', isPredefined: true, order: 1, active: true },
]

export const mockTrainingCompletions = []

export const mockBgCheck = {
  _id: 'bgcheck_mock',
  tenantId,
  candidateId: mockCandidate._id,
  provider: 'mock',
  providerReportId: 'mock_123456',
  status: 'clear',
  result: JSON.stringify({ provider: 'mock', summary: 'No records found (mock sandbox)', checks: [{ type: 'national_criminal', status: 'clear', records: 0 }] }),
  package: 'basic',
  initiatedAt: '2026-07-10T11:00:00.000Z',
  completedAt: '2026-07-10T11:00:01.000Z',
}
