import { v } from 'convex/values'
import { internalAction } from '../_generated/server'

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01/Accounts'

/**
 * Send an SMS through Twilio.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER
 * environment variables. Set SMS_ENABLED=true to enable.
 */
export const sendSms = internalAction({
  args: {
    to: v.string(),
    body: v.string(),
  },
  handler: async (_ctx, args) => {
    if (process.env.SMS_ENABLED !== 'true') {
      console.warn('SMS sending is disabled. Set SMS_ENABLED=true to enable.')
      return { skipped: true }
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_PHONE_NUMBER
    if (!accountSid || !authToken || !from) {
      throw new Error(
        'Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER',
      )
    }

    const url = `${TWILIO_API_URL}/${accountSid}/Messages.json`
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const body = new URLSearchParams()
    body.append('To', args.to)
    body.append('From', from)
    body.append('Body', args.body)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(`Twilio SMS failed (${response.status}): ${JSON.stringify(payload)}`)
    }

    return { sid: payload.sid }
  },
})
