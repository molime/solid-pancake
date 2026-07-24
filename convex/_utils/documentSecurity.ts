import { v } from 'convex/values'
import { internalAction } from '../_generated/server'

/**
 * Scan an uploaded document for malware/viruses.
 *
 * Currently a stub that validates file type and size.
 * Will be integrated with Scanii (scanii.com) or similar service
 * for production virus scanning.
 *
 * Required env vars (when fully integrated):
 * - SCANII_API_KEY: Scanii API key
 * - DOCUMENT_SCAN_ENABLED: set to 'true' to enable scanning.
 *   WARNING: fail-closed — while the Scanii integration is not implemented,
 *   enabling this makes every scan throw, so uploads gated on the scan
 *   (e.g. background-check results) will be marked 'scan_failed'.
 *   Do not enable in production until the Scanii integration ships.
 */
export const scanDocument = internalAction({
  args: {
    storageId: v.string(),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    // Validate file type
    const ALLOWED_TYPES = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]
    if (args.contentType && !ALLOWED_TYPES.includes(args.contentType)) {
      return {
        clean: false,
        reason: `File type ${args.contentType} is not allowed. Only PDF and images are accepted.`,
      }
    }

    // Validate file size (10 MB max)
    const MAX_SIZE = 10 * 1024 * 1024
    if (args.size && args.size > MAX_SIZE) {
      return {
        clean: false,
        reason: 'File exceeds 10 MB limit.',
      }
    }

    // Fail closed: if scanning is enabled but the scanner is not configured,
    // do not silently accept the file.
    if (process.env.DOCUMENT_SCAN_ENABLED === 'true') {
      const apiKey = process.env.SCANII_API_KEY
      if (!apiKey) {
        throw new Error(
          'DOCUMENT_SCAN_ENABLED is true but SCANII_API_KEY is not configured.',
        )
      }
      // TODO: Integrate Scanii API for actual virus scanning
      // POST https://api.scanii.com/v2.1/files
      // with the file content and API key
      // Return { clean: boolean, reason?: string }
      throw new Error('Document scanning is enabled but not yet implemented.')
    }

    return { clean: true }
  },
})
