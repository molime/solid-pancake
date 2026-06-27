'use node'

import { Agent, request } from 'node:https'
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
import { NotConfiguredError } from './errors'

declare const process: { env: Record<string, string | undefined> }

interface TokenCache {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new NotConfiguredError(`Missing ADP environment variable: ${name}`)
  return value
}

function buildHttpsAgent(): Agent {
  const cert = requireEnv('ADP_CLIENT_CERT_PEM')
  const key = requireEnv('ADP_CLIENT_KEY_PEM')
  return new Agent({ cert, key })
}

function httpsRequest(options: {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(options.url)
    const req = request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method,
        headers: options.headers,
        agent: buildHttpsAgent(),
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
        })
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body })
        })
      },
    )

    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function extractEmail(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const candidate =
      obj.emailUri ?? obj.uri ?? obj.address ?? obj.emailAddress
    if (typeof candidate === 'string') return candidate
  }
  return undefined
}

export function normalizeWorker(
  worker: Record<string, unknown>,
): AdpWorkerSummary {
  const associateOID = String(worker.associateOID ?? worker.associateOid ?? '')
  const workerID = worker.workerID
    ? String(worker.workerID)
    : worker.workerId
    ? String(worker.workerId)
    : undefined

  let displayName = ''
  const personName = worker.personName
  if (personName && typeof personName === 'object') {
    const name = personName as Record<string, unknown>
    const given = String(name.givenName ?? '')
    const family = String(name.familyName ?? '')
    displayName = `${given} ${family}`.trim()
  }
  if (!displayName) {
    displayName = String(worker.displayName ?? 'Unnamed Worker')
  }

  let email: string | undefined
  const workAssignments = worker.workAssignments
  if (Array.isArray(workAssignments)) {
    for (const assignment of workAssignments) {
      if (assignment && typeof assignment === 'object') {
        const emails = (assignment as Record<string, unknown>).emailAddresses
        if (Array.isArray(emails)) {
          for (const raw of emails) {
            const found = extractEmail(raw)
            if (found) {
              email = found
              break
            }
          }
        }
      }
      if (email) break
    }
  }

  if (!email) {
    const person = worker.person
    if (person && typeof person === 'object') {
      const communication = (person as Record<string, unknown>).communication
      if (communication && typeof communication === 'object') {
        const emails = (communication as Record<string, unknown>).emails
        if (Array.isArray(emails)) {
          for (const raw of emails) {
            const found = extractEmail(raw)
            if (found) {
              email = found
              break
            }
          }
        }
      }
    }
  }

  return {
    associateOID,
    workerID,
    displayName,
    email,
    status: worker.status
      ? String(worker.status)
      : worker.workerStatus
      ? String(worker.workerStatus)
      : undefined,
  }
}

export class AdpClient implements AdpPort {
  async getAccessToken(): Promise<AdpAccessToken> {
    const now = Date.now()
    if (tokenCache && tokenCache.expiresAt > now + 60_000) {
      return {
        accessToken: tokenCache.accessToken,
        tokenType: 'Bearer',
        expiresAt: new Date(tokenCache.expiresAt).toISOString(),
      }
    }

    const tokenUrl = requireEnv('ADP_TOKEN_URL')
    const clientId = requireEnv('ADP_CLIENT_ID')
    const clientSecret = requireEnv('ADP_CLIENT_SECRET')

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    )
    const { status, body } = await httpsRequest({
      url: tokenUrl,
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (status < 200 || status >= 300) {
      throw new Error(`ADP token request failed with status ${status}`)
    }

    const payload = parseJson(body) as Record<string, unknown> | null
    if (!payload || typeof payload.access_token !== 'string') {
      throw new Error('ADP token response missing access_token')
    }

    const expiresIn =
      typeof payload.expires_in === 'number'
        ? payload.expires_in
        : Number.parseInt(String(payload.expires_in ?? '3600'), 10)

    const accessToken = payload.access_token
    const expiresAt = now + expiresIn * 1000
    tokenCache = { accessToken, expiresAt }

    return {
      accessToken,
      tokenType: String(payload.token_type ?? 'Bearer'),
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  private async adpGet(path: string): Promise<unknown> {
    const baseUrl = requireEnv('ADP_BASE_URL')
    const token = await this.getAccessToken()
    const { status, body } = await httpsRequest({
      url: `${baseUrl}${path}`,
      method: 'GET',
      headers: { Authorization: `${token.tokenType} ${token.accessToken}` },
    })

    if (status < 200 || status >= 300) {
      throw new Error(`ADP request failed: GET ${path} status ${status}`)
    }

    return parseJson(body)
  }

  private async adpPost(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    const baseUrl = requireEnv('ADP_BASE_URL')
    const token = await this.getAccessToken()
    const { status, body } = await httpsRequest({
      url: `${baseUrl}${path}`,
      method: 'POST',
      headers: {
        Authorization: `${token.tokenType} ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (status < 200 || status >= 300) {
      throw new Error(`ADP request failed: POST ${path} status ${status}`)
    }

    return parseJson(body)
  }

  async listWorkers(cursor?: string): Promise<AdpListWorkersResult> {
    const skip = cursor ? Number.parseInt(cursor, 10) : 0
    const payload = await this.adpGet(`/hr/v2/workers?$top=100&$skip=${skip}`)
    const workers: AdpWorkerSummary[] = []

    if (payload && typeof payload === 'object') {
      const rawWorkers = (payload as Record<string, unknown>).workers
      if (Array.isArray(rawWorkers)) {
        for (const raw of rawWorkers) {
          if (raw && typeof raw === 'object') {
            workers.push(normalizeWorker(raw as Record<string, unknown>))
          }
        }
      }
    }

    const nextCursor = workers.length === 100 ? String(skip + 100) : undefined
    return { workers, nextCursor }
  }

  async createWorker(
    profile: AdpWorkerProfileInput,
  ): Promise<AdpWorkerResult> {
    const payload = await this.adpPost('/events/hr/v1/worker.hire', {
      events: [
        {
          data: {
            eventContext: {
              correlationID: profile.idempotencyKey,
              associateOID: profile.employeeProfileId,
            },
            transform: {
              worker: {
                person: {
                  communication: {
                    emails: [{ emailUri: profile.email }],
                  },
                  legalName: {
                    formattedName: profile.displayName,
                  },
                },
              },
            },
          },
        },
      ],
    })

    const eventPayload = payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {}
    const events = eventPayload.events
    const firstEvent = Array.isArray(events) && events.length > 0
      ? events[0]
      : null
    const data = firstEvent && typeof firstEvent === 'object'
      ? (firstEvent as Record<string, unknown>).data
      : null
    const output = data && typeof data === 'object'
      ? (data as Record<string, unknown>).output
      : null
    const associateOID = output && typeof output === 'object'
      ? String((output as Record<string, unknown>).associateOID ?? '')
      : ''
    const workerID = output && typeof output === 'object'
      ? String((output as Record<string, unknown>).workerID ?? '')
      : undefined

    if (!associateOID) {
      throw new Error('ADP worker.hire response missing associateOID')
    }

    return { associateOID, workerID }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async postPunch(_punch: AdpPunchInput): Promise<AdpPunchResult> {
    // STUB: ADP time-entry event body is product-dependent (real-time punch
    // vs. batch time-card import). Do not enable payroll writes until the
    // final ADP event contract is approved and mapped. Everything around this
    // fill-in point (OAuth, mTLS, worker load, idempotency, retries) is wired.
    throw new NotConfiguredError(
      'ADP punch posting is not configured: implement the product-specific time-entry event body in adpClient.postPunch',
    )
  }

  async getTimeCards(aoid: string): Promise<AdpTimeCard> {
    const payload = await this.adpGet(`/time/v2/workers/${aoid}/time-cards`)
    const timeCards = payload && typeof payload === 'object'
      ? ((payload as Record<string, unknown>).timeCards ?? [])
      : []
    return {
      aoid,
      timeCards: Array.isArray(timeCards) ? timeCards : [],
    }
  }
}
