export type Role = 'caregiver' | 'coordinator' | 'admin'
export type ServiceType = 'SLS' | 'ILS'

export type ShiftStatus =
  | 'scheduled'
  | 'in_progress'
  | 'submitted'
  | 'needs_correction'
  | 'approved'
  | 'billing_ready'

export type TaskStatus = 'pending' | 'complete'
export type ReviewDecision = 'approved' | 'correction_requested'

export interface UserProfile {
  id: string
  clerkSubject: string
  name: string
  email: string
  role: Role
}

export interface ClientProfile {
  id: string
  displayName: string
  serviceType: ServiceType
  authorizationHours: number
  riskFlags: string[]
}

export interface ProgressNote {
  startTime: string
  endTime: string
  servicesProvided: string
  clientResponse: string
  narrative: string
  submittedBy?: string
  submittedAt?: string
}

export interface ShiftTask {
  id: string
  title: string
  requiredProof: boolean
  status: TaskStatus
  proofUrl?: string
  proofName?: string
}

export interface ReviewEvent {
  id: string
  shiftId: string
  reviewerId: string
  decision: ReviewDecision
  comment: string
  createdAt: string
}

export interface CareShift {
  id: string
  clientId: string
  clientName: string
  caregiverId: string
  caregiverName: string
  coordinatorId: string
  coordinatorName: string
  scheduledStart: string
  scheduledEnd: string
  status: ShiftStatus
  serviceType: ServiceType
  authorizationHours: number
  rate: number
  riskFlags: string[]
  progressNote: ProgressNote
  tasks: ShiftTask[]
  reviewEvents: ReviewEvent[]
  approvedAt?: string
}

export interface BillingLine {
  id: string
  shiftId: string
  clientName: string
  serviceType: ServiceType
  hours: number
  rate: number
  amount: number
  exportBatchId: string
}

export interface BillingExport {
  lines: BillingLine[]
  excluded: Array<{
    shiftId: string
    clientName: string
    reason: string
  }>
}

export interface ValidationResult {
  valid: boolean
  blockers: string[]
}

export interface ComplianceDoc {
  id: string
  title: string
  body: string
  category: 'billing' | 'documentation' | 'credentialing' | 'policy'
  embedding: number[]
  relatedShiftIds: string[]
}

export interface SearchResult {
  id: string
  title: string
  body: string
  category: ComplianceDoc['category'] | 'progress-note'
  score: number
  relatedShiftIds: string[]
}
