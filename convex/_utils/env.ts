import { ConvexError } from 'convex/values'

declare const process: { env: Record<string, string | undefined> }

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new ConvexError('Missing required environment variable: ' + name)
  }
  return value
}
