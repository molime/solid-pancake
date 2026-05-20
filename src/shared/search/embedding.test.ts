import { describe, expect, it } from 'vitest'
import { deterministicEmbedding } from './embedding'

describe('deterministicEmbedding', () => {
  it('returns a stable 32-number vector', () => {
    const first = deterministicEmbedding('missing documentation blocks billing')
    const second = deterministicEmbedding('missing documentation blocks billing')

    expect(first).toHaveLength(32)
    expect(first.every((value) => Number.isFinite(value))).toBe(true)
    expect(second).toEqual(first)
  })
})
