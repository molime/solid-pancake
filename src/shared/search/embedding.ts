import type { CareShift, ComplianceDoc, SearchResult } from '@/shared/domain/types'

const DIMENSIONS = 32

export function deterministicEmbedding(text: string): number[] {
  const vector = Array.from({ length: DIMENSIONS }, () => 0)
  const tokens = tokenize(text)

  tokens.forEach((token, index) => {
    const hash = hashToken(`${token}:${index}`)
    const slot = Math.abs(hash) % DIMENSIONS
    const sign = hash % 2 === 0 ? 1 : -1
    vector[slot] += sign * (1 + token.length / 12)
  })

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0))
  if (magnitude === 0) return vector
  return vector.map((value) => Number((value / magnitude).toFixed(6)))
}

export function cosineSimilarity(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0)
}

export function searchComplianceDocs(
  query: string,
  docs: ComplianceDoc[],
  shifts: CareShift[],
): SearchResult[] {
  const queryVector = deterministicEmbedding(query)
  const docResults = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    body: doc.body,
    category: doc.category,
    relatedShiftIds: doc.relatedShiftIds,
    score: cosineSimilarity(queryVector, doc.embedding),
  }))

  const noteResults = shifts
    .filter((shift) => shift.progressNote.narrative.trim())
    .map((shift) => {
      const body = [
        shift.progressNote.servicesProvided,
        shift.progressNote.clientResponse,
        shift.progressNote.narrative,
      ].join(' ')
      return {
        id: `note-${shift.id}`,
        title: `${shift.clientName} progress note`,
        body,
        category: 'progress-note' as const,
        relatedShiftIds: [shift.id],
        score: cosineSimilarity(queryVector, deterministicEmbedding(body)),
      }
    })

  return [...docResults, ...noteResults]
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function hashToken(token: string): number {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash
}
