import type {
  AdpAccessToken,
  AdpListWorkersResult,
  AdpPort,
  AdpPunchInput,
  AdpPunchResult,
  AdpTimeCard,
  AdpWorkerProfileInput,
  AdpWorkerResult,
  AdpWorkerSummary,
} from './adpPort'

export interface MockAdpOptions {
  workers?: AdpWorkerSummary[]
  failNextCall?: boolean
  failureMessage?: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function stableAoid(email: string): string {
  return `mock-aoid-${normalizeEmail(email)}`
}

function stableWorkerId(email: string): string {
  return `mock-worker-${normalizeEmail(email)}`
}

export class MockAdp implements AdpPort {
  private workers: Map<string, AdpWorkerSummary>
  private workersByIdempotencyKey: Map<string, AdpWorkerResult>
  private punches: Map<string, AdpPunchResult>
  private failNextCall: boolean
  private failureMessage: string

  callCounts = {
    getAccessToken: 0,
    listWorkers: 0,
    createWorker: 0,
    postPunch: 0,
    getTimeCards: 0,
  }

  constructor(options: MockAdpOptions = {}) {
    this.workers = new Map()
    this.workersByIdempotencyKey = new Map()
    this.punches = new Map()
    this.failNextCall = options.failNextCall ?? false
    this.failureMessage = options.failureMessage ?? 'Mock ADP failure'

    for (const worker of options.workers ?? []) {
      this.workers.set(worker.associateOID, worker)
    }
  }

  private assertAvailable() {
    if (this.failNextCall) {
      this.failNextCall = false
      throw new Error(this.failureMessage)
    }
  }

  async getAccessToken(): Promise<AdpAccessToken> {
    this.callCounts.getAccessToken++
    return {
      accessToken: 'mock-access-token',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    }
  }

  async listWorkers(cursor?: string): Promise<AdpListWorkersResult> {
    this.assertAvailable()
    this.callCounts.listWorkers++
    const all = Array.from(this.workers.values())
    const skip = cursor ? Number.parseInt(cursor, 10) : 0
    const page = all.slice(skip, skip + 100)
    const nextCursor = skip + page.length < all.length
      ? String(skip + page.length)
      : undefined
    return { workers: page, nextCursor }
  }

  async createWorker(
    profile: AdpWorkerProfileInput,
  ): Promise<AdpWorkerResult> {
    this.assertAvailable()
    this.callCounts.createWorker++

    const cached = this.workersByIdempotencyKey.get(profile.idempotencyKey)
    if (cached) return cached

    const associateOID = stableAoid(profile.email)
    const workerID = stableWorkerId(profile.email)
    const worker: AdpWorkerSummary = {
      associateOID,
      workerID,
      displayName: profile.displayName,
      email: profile.email,
      status: 'active',
    }
    const result = { associateOID, workerID }
    this.workers.set(associateOID, worker)
    this.workersByIdempotencyKey.set(profile.idempotencyKey, result)
    return result
  }

  lastPunchInput?: AdpPunchInput

  async postPunch(punch: AdpPunchInput): Promise<AdpPunchResult> {
    this.assertAvailable()
    this.callCounts.postPunch++
    this.lastPunchInput = punch
    const punchId = `mock-punch-${punch.idempotencyKey}`
    const result: AdpPunchResult = { punchId }
    this.punches.set(punch.idempotencyKey, result)
    return result
  }

  async getTimeCards(aoid: string): Promise<AdpTimeCard> {
    this.assertAvailable()
    this.callCounts.getTimeCards++
    return { aoid, timeCards: [] }
  }

  getPunch(idempotencyKey: string): AdpPunchResult | undefined {
    return this.punches.get(idempotencyKey)
  }

  getWorker(associateOID: string): AdpWorkerSummary | undefined {
    return this.workers.get(associateOID)
  }

  workerCount(): number {
    return this.workers.size
  }

  injectFailure(message?: string) {
    this.failNextCall = true
    if (message) this.failureMessage = message
  }

  clearFailure() {
    this.failNextCall = false
    this.failureMessage = 'Mock ADP failure'
  }
}

let sharedMock: MockAdp | null = null

export function getSharedMockAdp(options?: MockAdpOptions): MockAdp {
  if (!sharedMock) {
    sharedMock = new MockAdp(options)
  }
  return sharedMock
}

export function resetSharedMockAdp(options?: MockAdpOptions): MockAdp {
  sharedMock = new MockAdp(options)
  return sharedMock
}
