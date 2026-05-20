import { v } from 'convex/values'
import { action } from './_generated/server'

const DIMENSIONS = 32

export const deterministicEmbedding = action({
  args: { text: v.string() },
  handler: async (_ctx, { text }) => {
    const vector = Array.from({ length: DIMENSIONS }, () => 0)
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)

    tokens.forEach((token, index) => {
      const hash = hashToken(`${token}:${index}`)
      const slot = Math.abs(hash) % DIMENSIONS
      const sign = hash % 2 === 0 ? 1 : -1
      vector[slot] += sign * (1 + token.length / 12)
    })

    const magnitude = Math.sqrt(
      vector.reduce((sum, value) => sum + value ** 2, 0),
    )
    return magnitude === 0
      ? vector
      : vector.map((value) => Number((value / magnitude).toFixed(6)))
  },
})

function hashToken(token: string): number {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash
}
