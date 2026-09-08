/**
 * Strip Convex transport wrappers and stack-trace suffixes from a server
 * error message so only the human-readable portion is shown to users.
 *
 * Handles:
 * - '[CONVEX A(path:fn)] [Request ID: ...] Server Error' prefixes
 * - 'Uncaught ConvexError:' / 'Uncaught Error:' prefixes
 * - anything after the first newline (stack traces)
 * - inline ' at async handler (...)' and 'Called by client' suffixes
 */
export function sanitizeConvexError(message: string): string {
  return message
    .replace(/^(\[CONVEX[^\]]*\]\s*)+/i, '')
    .replace(/\[Request ID:[^\]]*\]\s*/i, '')
    .replace(/^(Server Error:?\s*)+/i, '')
    .replace(/^(Uncaught (Convex)?Error:?\s*)+/i, '')
    .replace(/\n[\s\S]*$/, '')
    .replace(/\s+at async handler[\s\S]*$/i, '')
    .replace(/\s*Called by client\.?\s*$/i, '')
    .trim()
}
