/**
 * Printable monthly payment calendar for one client (the "calendario para
 * pago" agencies attach to billing): Monday-first month grid, worked days show
 * one line per caregiver shift as "ES 9AM-12PM (3HR)" (caregiver initials +
 * time range + hours), total hours, consumer and instructor names. One
 * consolidated calendar per client — all caregivers in the same grid.
 * Generated client-side with pdf-lib.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface PaymentCalendarDay {
  date: string // yyyy-mm-dd
  beginAt: string
  endAt: string
  hours: number
  caregiverName: string
  caregiverInitials: string
}

const PAGE_W = 792
const PAGE_H = 612
const MARGIN = 40
const GRID_TOP = PAGE_H - 96
const HEADER_H = 22
const GRID_BOTTOM = 96
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function shortTime(iso: string): string {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, '0')}${ampm}`
}

function hoursLabel(hours: number): string {
  const rounded = Math.round(hours * 2) / 2
  return `(${rounded}HR)`
}

export async function generatePaymentCalendarPdf(args: {
  clientName: string
  caregiverNames: string[]
  month: string // yyyy-mm
  days: PaymentCalendarDay[]
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([PAGE_W, PAGE_H])

  const [year, month] = args.month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // Monday-first offset: JS getUTCDay is Sunday-first.
  const firstOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const weeks = Math.ceil((firstOffset + daysInMonth) / 7)

  const colW = (PAGE_W - MARGIN * 2) / 7
  const rowH = (GRID_TOP - HEADER_H - GRID_BOTTOM) / weeks

  page.drawText(`CONSUMER: ${args.clientName}`, {
    x: MARGIN,
    y: PAGE_H - 60,
    size: 13,
    font: bold,
  })

  // Header row (day names, shaded).
  page.drawRectangle({
    x: MARGIN,
    y: GRID_TOP - HEADER_H,
    width: PAGE_W - MARGIN * 2,
    height: HEADER_H,
    color: rgb(0.92, 0.93, 0.94),
  })
  DAY_NAMES.forEach((name, i) => {
    page.drawText(name, {
      x: MARGIN + i * colW + 6,
      y: GRID_TOP - HEADER_H + 7,
      size: 9,
      font: bold,
    })
  })

  const byDate = new Map<string, PaymentCalendarDay[]>()
  for (const day of args.days) {
    const list = byDate.get(day.date) ?? []
    list.push(day)
    byDate.set(day.date, list)
  }
  const cellBorder = rgb(0.75, 0.78, 0.8)
  const cellFill = rgb(1, 0.97, 0.94)

  for (let week = 0; week < weeks; week++) {
    for (let col = 0; col < 7; col++) {
      const dayNumber = week * 7 + col - firstOffset + 1
      const x = MARGIN + col * colW
      const y = GRID_TOP - HEADER_H - (week + 1) * rowH
      page.drawRectangle({
        x,
        y,
        width: colW,
        height: rowH,
        borderColor: cellBorder,
        borderWidth: 0.75,
        color: cellFill,
      })
      if (dayNumber < 1 || dayNumber > daysInMonth) continue
      page.drawText(String(dayNumber), {
        x: x + 6,
        y: y + rowH - 16,
        size: 10,
        font,
      })
      const iso = `${args.month}-${String(dayNumber).padStart(2, '0')}`
      const workedDays = byDate.get(iso) ?? []
      // One line per caregiver shift, initials first so caregivers are
      // distinguishable inside the single consolidated calendar.
      const visible = workedDays.slice(0, 3)
      visible.forEach((worked, i) => {
        const label = `${worked.caregiverInitials} ${shortTime(worked.beginAt)}-${shortTime(worked.endAt)} ${hoursLabel(worked.hours)}`
        page.drawText(label, {
          x: x + 8,
          y: y + rowH - 32 - i * 12,
          size: 8,
          font: bold,
          maxWidth: colW - 14,
        })
      })
      if (workedDays.length > visible.length) {
        page.drawText(`+${workedDays.length - visible.length} more`, {
          x: x + 8,
          y: y + rowH - 32 - visible.length * 12,
          size: 8,
          font,
        })
      }
    }
  }

  const totalHours = args.days.reduce((sum, d) => sum + d.hours, 0)
  const totalRounded = Math.round(totalHours * 2) / 2
  page.drawText(`Total -        ${totalRounded}      Hours.`, {
    x: PAGE_W / 2 - 60,
    y: 66,
    size: 11,
    font: bold,
  })
  page.drawText(`Instructor: ${args.caregiverNames.join(', ')}`, {
    x: MARGIN,
    y: 36,
    size: 11,
    font: bold,
    maxWidth: PAGE_W - MARGIN * 2,
  })

  return doc.save()
}
