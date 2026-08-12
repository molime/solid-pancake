import { v } from 'convex/values'
import { internalAction } from '../_generated/server'

const RESEND_API_URL = 'https://api.resend.com/emails'

/**
 * Send a transactional email through Resend.
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.
 */
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
    attachments: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          content: v.string(), // base64-encoded
          contentType: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (_ctx, args) => {
    if (process.env.EMAIL_ENABLED !== 'true') {
      console.warn('Email sending is disabled. Set EMAIL_ENABLED=true to enable.')
      return { skipped: true }
    }

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM_EMAIL
    if (!apiKey || !from) {
      throw new Error('Missing RESEND_API_KEY or RESEND_FROM_EMAIL environment variable')
    }

    const body: Record<string, unknown> = {
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    }
    if (args.attachments && args.attachments.length > 0) {
      body.attachments = args.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        ...(a.contentType ? { content_type: a.contentType } : {}),
      }))
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(`Resend email failed (${response.status}): ${JSON.stringify(payload)}`)
    }

    return { id: payload.id }
  },
})
