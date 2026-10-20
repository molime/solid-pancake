import { ConvexError } from 'convex/values'

/**
 * Server-side upload validation (compliance mini-phase, Stage 5). The client
 * enforces a type allowlist and a 10 MB cap, but those values are
 * client-supplied — every mutation that stores a file row from client-sent
 * contentType/size must re-validate here and not trust the caller.
 *
 * Matches the existing client-side and stub-scanner rules (jpeg/png/webp/pdf,
 * ≤ 10 MB) and their error messages.
 */

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/**
 * Throws a user-safe ConvexError when the declared content type or size is
 * outside the allowlist. `undefined` values are tolerated (older clients may
 * omit them; the storage layer still bounds the actual bytes) — anything
 * explicitly sent is validated.
 */
export function assertValidUpload(
  contentType: string | undefined,
  size: number | undefined,
) {
  if (
    contentType !== undefined &&
    !ALLOWED_UPLOAD_CONTENT_TYPES.includes(contentType)
  ) {
    throw new ConvexError(
      'Invalid file type. Only JPG, PNG, WebP, and PDF are allowed.',
    )
  }
  if (size !== undefined && size > MAX_UPLOAD_BYTES) {
    throw new ConvexError('File exceeds 10 MB limit.')
  }
}
