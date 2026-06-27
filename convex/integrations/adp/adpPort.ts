export interface AdpAccessToken {
  accessToken: string
  tokenType: string
  expiresAt: string
}

export interface AdpWorkerSummary {
  associateOID: string
  workerID?: string
  displayName: string
  email?: string
  status?: string
}

export interface AdpListWorkersResult {
  workers: AdpWorkerSummary[]
  nextCursor?: string
}

export interface AdpWorkerProfileInput {
  idempotencyKey: string
  employeeProfileId: string
  displayName: string
  email: string
}

export interface AdpWorkerResult {
  associateOID: string
  workerID?: string
}

export interface AdpPunchInput {
  idempotencyKey: string
  timePunchId: string
  associateOID: string
  punchType: 'clock_in' | 'clock_out'
  at: string
}

export interface AdpPunchResult {
  punchId: string
}

export interface AdpTimeCard {
  aoid: string
  timeCards: unknown[]
}

export interface AdpPort {
  getAccessToken(): Promise<AdpAccessToken>
  listWorkers(cursor?: string): Promise<AdpListWorkersResult>
  createWorker(profile: AdpWorkerProfileInput): Promise<AdpWorkerResult>
  postPunch(punch: AdpPunchInput): Promise<AdpPunchResult>
  getTimeCards(aoid: string): Promise<AdpTimeCard>
}
